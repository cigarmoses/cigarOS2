/* /pos/cigars/brand.js
   Brand POS controller (single source of truth)
   Fixes:
   - Filters + Bands buttons work (open sheets, select chips, confirm)
   - Maduro/Natural toggle works + clicking words works
   - Wrapper filtering is correct (Maduro hides Natural and vice versa)
   - Natural no longer “only 3” (no accidental truncation; full dataset)
   - Clicking cigar row opens full overlay detail modal
   - + button adds to receipt + receipt badge updates + receipt sheet renders
*/

(() => {
  // =========================
  // CONFIG — SET THESE ONCE
  // =========================

  // OPTION A (recommended): publish your Google Sheet as CSV
  // Example format:
  // https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?output=csv&gid=<GID>
  //
  // If you already have this in another file, paste the exact same URL here.
  const SHEET_CSV_URL = window.POS_SHEET_CSV_URL || ""; // you can set window.POS_SHEET_CSV_URL globally

  // OPTION B fallback: a local CSV endpoint you host in the repo
  // (Use this as a safety net so brand pages never hard-fail.)
  const FALLBACK_CSV_URL = "/pos/cigars/cigars.csv";

  // LocalStorage keys
  const LS_RECEIPT = "pos_receipt_items_v1";
  const LS_BANDS   = "pos_brand_bands_v1";
  const LS_FILTERS = "pos_brand_filters_v1";
  const LS_WRAP    = "pos_brand_wrap_v1";

  // =========================
  // DOM
  // =========================

  const $ = (s, root = document) => root.querySelector(s);

  const elTitle = $("#brand-title");
  const elIcon = $("#brand-icon");
  const elList = $("#brand-list");
  const elStatus = $("#brand-status");
  const elSearch = $("#brand-search");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  const backdrop = $("#sheet-backdrop");
  const sheetReceipt = $("#sheet-receipt");
  const sheetBands = $("#sheet-bands");
  const sheetFilters = $("#sheet-filters");

  const receiptOpen = $("#receipt-open");
  const receiptCount = $("#receipt-count");
  const receiptItems = $("#receipt-items");
  const receiptClear = $("#receipt-clear");

  const bandsOptions = $("#bands-options");
  const bandsClear = $("#bands-clear");
  const bandsConfirm = $("#bands-confirm");

  const filtersOptions = $("#filters-options");
  const filtersConfirm = $("#filters-confirm");

  const modal = $("#cigar-modal");
  const modalBackdrop = $("#cigar-modal-backdrop");
  const modalClose = $("#cigar-modal-close");

  const modalBrand = $("#modal-brand");
  const modalLine = $("#modal-line");
  const modalBrandIcon = $("#modal-brand-icon");
  const modalImg = $("#modal-cigar-img");
  const modalRG = $("#modal-rg");
  const modalLen = $("#modal-len");
  const modalStrength = $("#modal-strength");
  const modalVitola = $("#modal-vitola");
  const modalWrapper = $("#modal-wrapper");
  const modalBinder = $("#modal-binder");
  const modalFiller = $("#modal-filler");
  const modalOrigin = $("#modal-origin");
  const modalShade = $("#modal-shade");
  const modalRank1 = $("#modal-rank1");
  const modalRank2 = $("#modal-rank2");

  // =========================
  // STATE
  // =========================

  const state = {
    brandName: "",
    brandSlug: "",
    all: [],
    view: [],
    wrap: "all",       // "all" | "maduro" | "natural"
    search: "",
    selectedBands: new Set(),
    selectedFilters: new Set(),
    pendingBands: new Set(),
    pendingFilters: new Set(),
    receipt: []
  };

  // =========================
  // HELPERS
  // =========================

  function getBrandFromURL() {
    const u = new URL(window.location.href);
    const b = (u.searchParams.get("brand") || "").trim();
    return b || "Brand";
  }

  function slugifyBrand(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function safeText(v) {
    return (v == null) ? "" : String(v).trim();
  }

  function money(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  function getLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normalizeWrapperShade(shade) {
    const s = safeText(shade).toLowerCase();
    // your data uses "Colorado Maduro" etc — this makes filtering reliable
    if (s.includes("maduro")) return "maduro";
    if (s.includes("natural")) return "natural";
    // sometimes natural isn’t written; treat “claro / colorado / rosado / connecticut” as natural-ish
    if (s.includes("claro") || s.includes("rosado") || s.includes("connecticut") || s.includes("colorado")) return "natural";
    return ""; // unknown
  }

  function buildBrandIconHTML(brandSlug) {
    // Matches your rule: img/icons/brand/{brandname lowercase no spaces}.svg
    // (Your repo uses both /img/icons/brand and /img/icons/brands in places — this picks /img/icons/brand)
    const src = `/img/icons/brand/${brandSlug}.svg`;
    return `<img src="${src}" alt="" onerror="this.style.display='none'">`;
  }

  function cigarImageFor(item) {
    // Priority:
    // 1) CSV column "Cigar IMG" if it’s a URL/path
    // 2) Convention: /pos/cigars/imgs/{brandSlug}/{key}.png
    const img = safeText(item["Cigar IMG"] || item["CigarIMG"] || item["Image"] || "");
    if (img) return img;

    const key = safeText(item["key"] || item["Key"] || item["Slug"] || "");
    if (key) return `/pos/cigars/imgs/${state.brandSlug}/${key}.png`;

    return "/img/icons/cigar-placeholder.png";
  }

  function computeBandLabel(item) {
    // Bands “selector” should be meaningful.
    // Prefer Line; fallback to Wrapper Shade bucket.
    const line = safeText(item["Line"]);
    if (line) return line;

    const shade = safeText(item["Wrapper Shade"] || item["WrapperShade"] || "");
    if (shade) return shade;

    return "Other";
  }

  function computeFilterLabel(item) {
    // Filters “selector” - use Vitola/Shape depending on your data.
    const vitola = safeText(item["Vitola"]);
    if (vitola) return vitola;

    const shape = safeText(item["Shape"]);
    if (shape) return shape;

    return "Other";
  }

  // Robust CSV parser (handles quoted commas)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];

      if (c === '"' && inQuotes && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  function rowsToObjects(csvText) {
    const rows = parseCSV(csvText).filter(r => r.some(cell => String(cell || "").trim() !== ""));
    if (!rows.length) return [];

    const headers = rows[0].map(h => safeText(h));
    const out = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = safeText(r[idx] ?? ""); });
      out.push(obj);
    }
    return out;
  }

  async function fetchCSV() {
    // Try sheet first, then fallback.
    const tried = [];

    async function tryURL(url) {
      if (!url) return null;
      tried.push(url);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    }

    let text = null;

    if (SHEET_CSV_URL) {
      try { text = await tryURL(SHEET_CSV_URL); }
      catch (e) { /* continue */ }
    }

    if (!text) {
      text = await tryURL(FALLBACK_CSV_URL);
    }

    return { text, tried };
  }

  // =========================
  // RECEIPT
  // =========================

  function loadReceipt() {
    const arr = getLS(LS_RECEIPT, []);
    state.receipt = Array.isArray(arr) ? arr : [];
    updateReceiptBadge();
  }

  function updateReceiptBadge() {
    const count = state.receipt.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
    if (count > 0) {
      receiptCount.hidden = false;
      receiptCount.textContent = String(count);
    } else {
      receiptCount.hidden = true;
      receiptCount.textContent = "0";
    }
  }

  function addToReceipt(item) {
    const id =
      safeText(item["key"]) ||
      safeText(item["Product #"]) ||
      safeText(item["Cigar"]) + "::" + safeText(item["Vitola"]) + "::" + safeText(item["Wrapper Shade"]);

    const price = Number(item["MSRP"] || item["Price"] || 0) || 0;

    const existing = state.receipt.find(r => r.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      state.receipt.push({
        id,
        name: safeText(item["Cigar"]) || safeText(item["Line"]) || "(Unnamed cigar)",
        vitola: safeText(item["Vitola"]),
        price,
        qty: 1,
        brand: state.brandName
      });
    }

    setLS(LS_RECEIPT, state.receipt);
    updateReceiptBadge();
    renderReceipt();
  }

  function renderReceipt() {
    if (!receiptItems) return;

    if (!state.receipt.length) {
      receiptItems.innerHTML = `<p class="muted">No items yet.</p>`;
      return;
    }

    const rows = state.receipt.map(r => {
      const sub = (Number(r.price) || 0) * (Number(r.qty) || 0);
      return `
        <div class="receipt-row">
          <div class="receipt-left">
            <div class="receipt-name">${escapeHTML(r.name)}</div>
            <div class="receipt-sub">${escapeHTML(r.brand)}${r.vitola ? ` • ${escapeHTML(r.vitola)}` : ""}</div>
          </div>
          <div class="receipt-right">
            <div class="receipt-qty">x${r.qty}</div>
            <div class="receipt-price">$${money(sub)}</div>
          </div>
        </div>
      `;
    }).join("");

    const total = state.receipt.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.qty) || 0), 0);

    receiptItems.innerHTML = `
      <div class="receipt-list">${rows}</div>
      <div class="receipt-total">
        <span>Total</span>
        <strong>$${money(total)}</strong>
      </div>
    `;
  }

  function clearReceipt() {
    state.receipt = [];
    setLS(LS_RECEIPT, state.receipt);
    updateReceiptBadge();
    renderReceipt();
  }

  // =========================
  // UI — SHEETS / MODAL
  // =========================

  function openSheet(sheetEl) {
    backdrop.hidden = false;
    sheetEl.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeAllSheets() {
    backdrop.hidden = true;
    sheetReceipt.hidden = true;
    sheetBands.hidden = true;
    sheetFilters.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // FILTERING + RENDER
  // =========================

  function setWrap(next) {
    state.wrap = next;
    setLS(LS_WRAP, next);
    syncWrapUI();
    applyAndRender();
  }

  function syncWrapUI() {
    const w = state.wrap;

    const maduroOn = (w === "maduro");
    const naturalOn = (w === "natural");

    segMaduro.setAttribute("aria-pressed", maduroOn ? "true" : "false");
    segNatural.setAttribute("aria-pressed", naturalOn ? "true" : "false");

    // Move knob (CSS should interpret data-state; but we set a class for safety)
    segSwitch.dataset.state = w;
  }

  function applyFilters(items) {
    let out = items.slice();

    // Wrapper toggle
    if (state.wrap === "maduro") {
      out = out.filter(it => normalizeWrapperShade(it["Wrapper Shade"] || it["WrapperShade"]) === "maduro");
    } else if (state.wrap === "natural") {
      out = out.filter(it => normalizeWrapperShade(it["Wrapper Shade"] || it["WrapperShade"]) === "natural");
    }

    // Search
    const q = state.search.trim().toLowerCase();
    if (q) {
      out = out.filter(it => {
        const cigar = safeText(it["Cigar"]).toLowerCase();
        const line = safeText(it["Line"]).toLowerCase();
        const vitola = safeText(it["Vitola"]).toLowerCase();
        const shade = safeText(it["Wrapper Shade"] || it["WrapperShade"]).toLowerCase();
        return cigar.includes(q) || line.includes(q) || vitola.includes(q) || shade.includes(q);
      });
    }

    // Bands selection (Line-based)
    if (state.selectedBands.size) {
      out = out.filter(it => state.selectedBands.has(computeBandLabel(it)));
    }

    // Filters selection (Vitola/Shape-based)
    if (state.selectedFilters.size) {
      out = out.filter(it => state.selectedFilters.has(computeFilterLabel(it)));
    }

    return out;
  }

  function applyAndRender() {
    state.view = applyFilters(state.all);
    renderList();
  }

  function renderList() {
    if (!elList) return;

    if (!state.view.length) {
      elList.innerHTML = `<div class="empty">No cigars match.</div>`;
      return;
    }

    const iconHTML = buildBrandIconHTML(state.brandSlug);

    elList.innerHTML = state.view.map((it, idx) => {
      const cigar = safeText(it["Cigar"]) || "(Unnamed cigar)";
      const vitola = safeText(it["Vitola"]);
      const price = money(it["MSRP"] || it["Price"] || 0);

      // Data index for click -> open modal
      return `
        <div class="cigar-row" data-row-index="${idx}">
          <div class="cigar-left">
            <div class="cigar-brand-ico">${iconHTML}</div>
            <div class="cigar-text">
              <div class="cigar-name">${escapeHTML(cigar)}</div>
              <div class="cigar-sub">${escapeHTML(vitola)}</div>
            </div>
          </div>

          <div class="cigar-right">
            <div class="cigar-price">${price}</div>
            <button class="cigar-add" type="button" data-add-index="${idx}" aria-label="Add to receipt">
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderBandsSheet() {
    const labels = Array.from(new Set(state.all.map(computeBandLabel))).sort((a,b)=>a.localeCompare(b));
    state.pendingBands = new Set(state.selectedBands);

    bandsOptions.innerHTML = labels.map(label => {
      const on = state.pendingBands.has(label);
      return `
        <button type="button" class="chip ${on ? "on" : ""}" data-band="${escapeHTML(label)}">
          ${escapeHTML(label)}
        </button>
      `;
    }).join("");
  }

  function renderFiltersSheet() {
    const labels = Array.from(new Set(state.all.map(computeFilterLabel))).sort((a,b)=>a.localeCompare(b));
    state.pendingFilters = new Set(state.selectedFilters);

    filtersOptions.innerHTML = labels.map(label => {
      const on = state.pendingFilters.has(label);
      return `
        <button type="button" class="chip ${on ? "on" : ""}" data-filter="${escapeHTML(label)}">
          ${escapeHTML(label)}
        </button>
      `;
    }).join("");
  }

  // =========================
  // MODAL POPULATION
  // =========================

  function openCigarDetail(item) {
    modalBrand.textContent = state.brandName;
    modalBrandIcon.innerHTML = buildBrandIconHTML(state.brandSlug);

    const line = safeText(item["Line"]);
    const cigar = safeText(item["Cigar"]) || "(Unnamed cigar)";
    modalLine.textContent = line ? `${line} ${cigar}` : cigar;

    modalRG.textContent = safeText(item["RG"] || item["Ring"] || item["Ring Size"] || "—") || "—";
    modalLen.textContent = safeText(item["Length"] || "—") || "—";
    modalStrength.textContent = safeText(item["Strength"] || "—") || "—";
    modalVitola.textContent = safeText(item["Vitola"] || item["Shape"] || "—") || "—";

    modalWrapper.textContent = safeText(item["Wrapper"] || "—") || "—";
    modalBinder.textContent = safeText(item["Binder"] || "—") || "—";
    modalFiller.textContent = safeText(item["Filler"] || "—") || "—";

    modalOrigin.textContent = safeText(item["Origin"] || "—") || "—";
    modalShade.textContent = safeText(item["Wrapper Shade"] || item["WrapperShade"] || "—") || "—";

    // Optional ranking fields if you have them
    const rank1 = safeText(item["Rank"] || item["CA Rank"] || "");
    const year1 = safeText(item["Year"] || item["CA Year"] || "");
    modalRank1.textContent = rank1 ? `#${rank1}${year1 ? ` • ${year1}` : ""}` : "#1";

    const r2 = safeText(item["CJ Rank"] || "");
    const y2 = safeText(item["CJ Year"] || "");
    modalRank2.textContent = r2 ? `#${r2}${y2 ? ` • ${y2}` : ""}` : "#2";

    const src = cigarImageFor(item);
    modalImg.src = src;
    modalImg.alt = `${state.brandName} ${cigar}`;
    modalImg.onerror = () => { modalImg.src = "/img/icons/cigar-placeholder.png"; };

    openModal();
  }

  // =========================
  // LOAD DATA
  // =========================

  function brandMatchRow(row) {
    const b = safeText(row["Brand"]);
    return b.toLowerCase() === state.brandName.toLowerCase();
  }

  async function load() {
    state.brandName = getBrandFromURL();
    state.brandSlug = slugifyBrand(state.brandName);

    elTitle.textContent = state.brandName;
    elIcon.innerHTML = buildBrandIconHTML(state.brandSlug);

    // Restore saved UI selections
    state.wrap = getLS(LS_WRAP, "all") || "all";
    const savedBands = getLS(LS_BANDS, []);
    const savedFilters = getLS(LS_FILTERS, []);
    state.selectedBands = new Set(Array.isArray(savedBands) ? savedBands : []);
    state.selectedFilters = new Set(Array.isArray(savedFilters) ? savedFilters : []);
    syncWrapUI();

    // Load receipt
    loadReceipt();
    renderReceipt();

    // Fetch CSV and parse
    elStatus.hidden = false;
    elStatus.textContent = "Loading…";

    try {
      const { text } = await fetchCSV();
      const objs = rowsToObjects(text);

      // Brand filtering
      const brandRows = objs.filter(brandMatchRow);

      state.all = brandRows;

      if (!state.all.length) {
        elStatus.hidden = false;
        elStatus.textContent = `No rows found for brand "${state.brandName}".`;
      } else {
        elStatus.hidden = true;
      }

      // Prepare sheets options
      renderBandsSheet();
      renderFiltersSheet();

      // Render list
      applyAndRender();

    } catch (err) {
      elStatus.hidden = false;
      elStatus.textContent = "Brand failed to load from Google Sheets.";
      elList.innerHTML = "";
      // keep UI alive though (receipt still works)
      console.error(err);
    }
  }

  // =========================
  // EVENTS
  // =========================

  // Back
  const backBtn = $("#brand-back");
  if (backBtn) backBtn.addEventListener("click", () => history.back());

  // Search
  elSearch.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    applyAndRender();
  });

  // Toggle: clicking words must work
  segMaduro.addEventListener("click", () => setWrap(state.wrap === "maduro" ? "all" : "maduro"));
  segNatural.addEventListener("click", () => setWrap(state.wrap === "natural" ? "all" : "natural"));

  // Toggle switch button
  segSwitch.addEventListener("click", () => {
    if (state.wrap === "maduro") setWrap("natural");
    else if (state.wrap === "natural") setWrap("maduro");
    else setWrap("maduro"); // default first click
  });

  // Filters / Bands open
  btnFilters.addEventListener("click", () => {
    renderFiltersSheet();
    openSheet(sheetFilters);
  });

  btnBands.addEventListener("click", () => {
    renderBandsSheet();
    openSheet(sheetBands);
  });

  // Receipt open
  receiptOpen.addEventListener("click", () => {
    renderReceipt();
    openSheet(sheetReceipt);
  });

  // Clear receipt
  receiptClear.addEventListener("click", clearReceipt);

  // Close sheets (X, Close buttons)
  document.addEventListener("click", (e) => {
    const t = e.target;

    // Backdrop closes
    if (t === backdrop) {
      closeAllSheets();
      return;
    }

    // Any [data-sheet-close]
    if (t && t.closest && t.closest("[data-sheet-close]")) {
      closeAllSheets();
      return;
    }
  });

  // Bands chip clicks (delegated)
  bandsOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip[data-band]");
    if (!btn) return;
    const label = btn.getAttribute("data-band");
    if (!label) return;

    if (state.pendingBands.has(label)) state.pendingBands.delete(label);
    else state.pendingBands.add(label);

    btn.classList.toggle("on");
  });

  bandsClear.addEventListener("click", () => {
    state.pendingBands.clear();
    renderBandsSheet();
  });

  bandsConfirm.addEventListener("click", () => {
    state.selectedBands = new Set(state.pendingBands);
    setLS(LS_BANDS, Array.from(state.selectedBands));
    closeAllSheets();
    applyAndRender();
  });

  // Filters chip clicks (delegated)
  filtersOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip[data-filter]");
    if (!btn) return;
    const label = btn.getAttribute("data-filter");
    if (!label) return;

    if (state.pendingFilters.has(label)) state.pendingFilters.delete(label);
    else state.pendingFilters.add(label);

    btn.classList.toggle("on");
  });

  filtersConfirm.addEventListener("click", () => {
    state.selectedFilters = new Set(state.pendingFilters);
    setLS(LS_FILTERS, Array.from(state.selectedFilters));
    closeAllSheets();
    applyAndRender();
  });

  // List click handling:
  // - clicking the row opens modal
  // - clicking the + adds to receipt
  elList.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add-index]");
    if (addBtn) {
      const idx = Number(addBtn.getAttribute("data-add-index"));
      const item = state.view[idx];
      if (item) addToReceipt(item);
      return;
    }

    const row = e.target.closest(".cigar-row[data-row-index]");
    if (row) {
      const idx = Number(row.getAttribute("data-row-index"));
      const item = state.view[idx];
      if (item) openCigarDetail(item);
      return;
    }
  });

  // Modal close
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);

  // Esc closes modal/sheets
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    else closeAllSheets();
  });

  // =========================
  // BOOT
  // =========================
  load();

})();
