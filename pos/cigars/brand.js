/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows (safe markup)
   - Bands modal (Padron bands + 3 new ones)
   - Uses shared /pos/cart.js if present
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Header + list
  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon-img");
  const listEl = $("#brand-list");

  // Bands modal elements (must match your existing HTML)
  const bandsBtn = $("#btn-bands");
  const bandsModal = $("#bands-modal");
  const bandsOverlay = $("#bands-overlay") || bandsModal?.querySelector("[data-close]") || null;
  const bandsCloseBtn = $("#bands-close");
  const bandsClearBtn = $("#bands-clear");
  const bandsConfirmBtn = $("#bands-confirm");
  const bandsListEl = $("#bands-list");

  // --- state ---
  const urlBrand = new URLSearchParams(window.location.search).get("brand") || "";
  const BRAND = decodeURIComponent(urlBrand).trim();

  const state = {
    allRows: [],
    filteredRows: [],
    selectedBands: new Set(), // stores opt.key
  };

  // ---- Padron band options (with your 3 new bands) ----
  // Use RELATIVE paths (no leading slash) to avoid Netlify subpath weirdness.
  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "img/icons/padron1926band.svg" },
    { key: "1964", label: "1964", img: "img/icons/padron1964band.svg" },
    { key: "damaso", label: "Damaso", img: "img/icons/padrondamasoband.svg" },

    // ✅ NEW
    { key: "padronblackseries", label: "Black Series", img: "img/icons/padronblackseriesband.svg" },
    { key: "padronseries", label: "Series", img: "img/icons/padronseriesband.svg" },
    { key: "padronfamilyreserve", label: "Family Reserve", img: "img/icons/padronfamilyreserveband.svg" },
  ];

  function getBandOptionsForBrand(brandName) {
    const b = (brandName || "").toLowerCase().trim();
    if (b === "padron" || b === "padrón") return PADRON_BANDS;
    return [];
  }

  // --- utils ---
  const norm = (v) => String(v ?? "").trim();
  const lower = (v) => norm(v).toLowerCase();
  const safeKey = (v) => lower(v).replace(/\s+/g, "").replace(/[^\w]/g, "");

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseMoney(v) {
    const s = String(v ?? "").replace(/[^0-9.]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  // --- CSV parsing ---
  function parseCSV(text) {
    const rows = [];
    let i = 0;
    let field = "";
    let row = [];
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i += 1;
        continue;
      }

      if (!inQuotes && (c === "," || c === "\n" || c === "\r")) {
        row.push(field);
        field = "";

        if (c === ",") {
          i += 1;
          continue;
        }

        // newline
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];

        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i += 1;

        continue;
      }

      field += c;
      i += 1;
    }

    if (field.length || row.length) {
      row.push(field);
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
  }

  // --- header icon handling (fixes “missing top right brand icon”) ---
  function setBrandHeader(brandName) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    if (!brandIconEl) return;

    const key = safeKey(brandName);
    const candidates = [
      // preferred per your repo structure
      `img/icons/brands/${key}.svg`,
      `/img/icons/brands/${key}.svg`,

      // legacy fallback
      `img/icons/brand/${key}.svg`,
      `/img/icons/brand/${key}.svg`,
    ];

    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) return;
      brandIconEl.onerror = () => {
        idx += 1;
        tryNext();
      };
      brandIconEl.src = candidates[idx];
      brandIconEl.alt = brandName || "Brand";
    };

    tryNext();
  }

  // --- filtering ---
  function applyFilters() {
    let rows = state.allRows.slice();

    // brand filter
    if (BRAND) rows = rows.filter((r) => lower(r.Brand) === lower(BRAND));

    // band filter
    if (state.selectedBands.size) {
      const selected = Array.from(state.selectedBands);

      rows = rows.filter((r) => {
        // match common fields without guessing too hard
        const line = lower(r.Line);
        const cigar = lower(r.Cigar);

        // If you later add a Band column to the sheet, we’ll pick it up too:
        const bandCol = lower(r.Band);

        return selected.some((k) => {
          const kk = lower(k);
          // keys are like "padronfamilyreserve" — also match label-like words
          return (
            line.includes(kk) ||
            cigar.includes(kk) ||
            (bandCol && bandCol.includes(kk)) ||
            // helpful fuzzy matches for Padron lines
            (kk.includes("familyreserve") && (line.includes("family") || line.includes("reserve"))) ||
            (kk.includes("blackseries") && (line.includes("black") || line.includes("series"))) ||
            (kk === "padronseries" && line.includes("series"))
          );
        });
      });
    }

    state.filteredRows = rows;
    renderList();
  }

  // --- render list (safe, won’t wipe your UI hooks) ---
  function renderList() {
    if (!listEl) return;

    listEl.innerHTML = "";

    const rows = state.filteredRows;
    if (!rows.length) {
      listEl.innerHTML = `<div class="brand-empty">No cigars match your filters.</div>`;
      return;
    }

    const frag = document.createDocumentFragment();

    rows.forEach((r) => {
      const cigarName = norm(r.Cigar);
      const brandName = norm(r.Brand);
      const vitola = norm(r.Vitola);
      const msrp = norm(r.MSRP);
      const img = norm(r["Cigar IMG"] || r.CigarIMG || r["Cigar Img"] || "");

      const row = document.createElement("div");
      row.className = "brand-row";

      row.innerHTML = `
        <div class="brand-row-left">
          <div class="brand-row-img">
            ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(cigarName)}" loading="lazy" />` : `<div class="brand-row-img-fallback"></div>`}
          </div>
          <div class="brand-row-text">
            <div class="brand-row-title">${escapeHtml(cigarName)}</div>
            <div class="brand-row-sub">${escapeHtml(brandName)}</div>
          </div>
        </div>

        <div class="brand-row-mid">
          <div class="brand-row-vitola">${escapeHtml(vitola)}</div>
          <div class="brand-row-msrp">${escapeHtml(msrp)}</div>
        </div>

        <div class="brand-row-right">
          <button class="brand-add-btn" type="button" aria-label="Add to receipt">+</button>
        </div>
      `;

      // POS cart hook (if present)
      const addBtn = row.querySelector(".brand-add-btn");
      if (addBtn && window.POS_CART && typeof window.POS_CART.addItem === "function") {
        addBtn.addEventListener("click", () => {
          window.POS_CART.addItem({
            name: cigarName,
            brand: brandName,
            price: parseMoney(msrp),
            meta: {
              vitola,
              rg: norm(r.RG),
              length: norm(r.Length),
              origin: norm(r.Origin),
            },
          });
        });
      }

      frag.appendChild(row);
    });

    listEl.appendChild(frag);
  }

  // --- Bands modal (compatible with either .open or .fm--hidden style) ---
  function showModal(el) {
    if (!el) return;
    // support either system
    el.classList.add("open");
    el.classList.remove("fm--hidden");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function hideModal(el) {
    if (!el) return;
    el.classList.remove("open");
    el.classList.add("fm--hidden");
    el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openBandsModal() {
    if (!bandsModal) return;
    renderBandsOptions();
    showModal(bandsModal);
  }

  function closeBandsModal() {
    hideModal(bandsModal);
  }

  function renderBandsOptions() {
    if (!bandsListEl) return;

    const opts = getBandOptionsForBrand(BRAND);
    bandsListEl.innerHTML = "";

    const frag = document.createDocumentFragment();

    opts.forEach((opt) => {
      const selected = state.selectedBands.has(opt.key);

      const card = document.createElement("div");
      card.className = `band-card ${selected ? "is-selected" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      card.innerHTML = `
        <div class="band-card-img">
          <img src="${escapeHtml(opt.img)}" alt="${escapeHtml(opt.label)}" loading="lazy" />
        </div>
        <div class="band-card-footer">
          <div class="band-card-label">${escapeHtml(opt.label)}</div>
          <div class="band-card-toggle ${selected ? "on" : ""}">
            <div class="band-card-toggle-knob"></div>
          </div>
        </div>
      `;

      const toggle = () => {
        if (state.selectedBands.has(opt.key)) state.selectedBands.delete(opt.key);
        else state.selectedBands.add(opt.key);
        renderBandsOptions();
      };

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      frag.appendChild(card);
    });

    bandsListEl.appendChild(frag);
  }

  function clearBands() {
    state.selectedBands.clear();
    renderBandsOptions();
  }

  function confirmBands() {
    closeBandsModal();
    applyFilters();
  }

  // --- init ---
  async function init() {
    setBrandHeader(BRAND || "Brand");

    // wire modal buttons
    if (bandsBtn) bandsBtn.addEventListener("click", openBandsModal);
    if (bandsCloseBtn) bandsCloseBtn.addEventListener("click", closeBandsModal);
    if (bandsClearBtn) bandsClearBtn.addEventListener("click", clearBands);
    if (bandsConfirmBtn) bandsConfirmBtn.addEventListener("click", confirmBands);
    if (bandsOverlay) bandsOverlay.addEventListener("click", closeBandsModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && bandsModal && !bandsModal.classList.contains("fm--hidden") && bandsModal.classList.contains("open")) {
        closeBandsModal();
      }
    });

    // load CSV
    const res = await fetch(CSV_URL, { cache: "no-store" });
    const text = await res.text();

    const parsed = parseCSV(text);
    const objs = rowsToObjects(parsed);

    state.allRows = objs;
    applyFilters();
  }

  init().catch((err) => {
    console.error("brand.js init error:", err);
    if (listEl) listEl.innerHTML = `<div class="brand-empty">Error loading cigars.</div>`;
  });
})();
