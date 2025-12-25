// /pos/cigars/brand.js
// FINAL LOCKED VERSION — DO NOT REPLACE CSV URL
// Uses confirmed working Google Sheets CSV export

(function () {
  "use strict";

  /* ===============================
     CONFIG (LOCKED)
  =============================== */
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const RECEIPT_KEY = "pos_receipt_items_v1";

  /* ===============================
     HELPERS
  =============================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (v) => (v ?? "").toString().trim();
  const norm = (v) => txt(v).toLowerCase();
  const uniq = (arr) => Array.from(new Set(arr));
  const money = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

  function safeOn(el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
  }

  function getBrandParam() {
    return new URL(location.href).searchParams.get("brand") || "";
  }

  function slugBrand(s) {
    return norm(s)
      .replace(/&/g, "and")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function csvToObjects(csv) {
    const rows = [];
    let row = [],
      cur = "",
      q = false;

    for (let i = 0; i < csv.length; i++) {
      const c = csv[i],
        n = csv[i + 1];

      if (c === '"' && q && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        q = !q;
        continue;
      }
      if (c === "," && !q) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !q) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur || row.length) {
      row.push(cur);
      rows.push(row);
    }

    const headers = (rows.shift() || []).map((h) => txt(h));
    return rows
      .filter((r) => r.some((x) => txt(x) !== ""))
      .map((r) => {
        const o = {};
        headers.forEach((h, i) => (o[h] = txt(r[i])));
        return o;
      });
  }

  function wrapperBucket(row) {
    const s = norm(
      row["Wrapper Shade"] ||
        row["Wrapper"] ||
        row["Cigar"] ||
        row["Line"] ||
        ""
    );

    if (s.includes("maduro") || s.includes("oscuro") || s.includes("negro"))
      return "maduro";

    if (
      s.includes("natural") ||
      s.includes("claro") ||
      s.includes("connecticut") ||
      s.includes("rosado") ||
      s.includes("shade")
    )
      return "natural";

    return "either";
  }

  function brandIconCandidates(brandName) {
    const slug = slugBrand(brandName || "");
    // Canonical per your repo: /img/icons/brands (plural)
    const a = `/img/icons/brands/${slug}.svg`;
    const b = `/img/icons/brand/${slug}.svg`; // fallback if any legacy
    const c = `/img/icons/brands/${slug}.png`;
    const d = `/img/icons/brand/${slug}.png`;
    return [a, b, c, d];
  }

  function mountBrandIcon(target, brandName) {
    if (!target) return;

    const candidates = brandIconCandidates(brandName);
    const img =
      target.tagName && target.tagName.toLowerCase() === "img"
        ? target
        : (() => {
            target.innerHTML = "";
            const im = document.createElement("img");
            im.alt = "";
            target.appendChild(im);
            return im;
          })();

    let idx = 0;
    img.decoding = "async";
    img.loading = "eager";
    img.src = candidates[idx];

    img.onerror = () => {
      idx += 1;
      if (idx < candidates.length) img.src = candidates[idx];
    };
  }

  /* ===============================
     STATE
  =============================== */
  const state = {
    brandRaw: getBrandParam(),
    brand: norm(getBrandParam()),
    all: [],
    view: [],
    search: "",
    wrapper: "all", // all | maduro | natural
    bands: new Set(), // selected Line values
    receipt: [],
    // multi-select filters (each Set holds selected values)
    filters: {
      Shade: new Set(),
      Vitola: new Set(),
      Ring: new Set(),
      Strength: new Set(),
      Length: new Set(),
      Shape: new Set(),
      Tubo: new Set(),
      Flavored: new Set(),
      Tin: new Set(),
      Pack: new Set(),
      Barberpole: new Set(),
      "Box-Pressed": new Set()
    }
  };

  /* ===============================
     DOM (must match brand.html)
  =============================== */
  const el = {
    title: $("#brand-title"),
    iconBox: $("#brand-icon"),
    back: $("#brand-back"),

    list: $("#brand-list"),
    status: $("#brand-status"),
    search: $("#brand-search"),

    btnFilters: $("#btn-filters"),
    btnBands: $("#btn-bands"),

    segWrap: $("#wrapper-seg"),
    segMaduro: $("#seg-maduro"),
    segNatural: $("#seg-natural"),
    segSwitch: $("#seg-switch"),

    sheetBackdrop: $("#sheet-backdrop"),
    sheetReceipt: $("#sheet-receipt"),
    sheetBands: $("#sheet-bands"),
    sheetFilters: $("#sheet-filters"),

    bandsGrid: $("#bands-options"),
    bandsClear: $("#bands-clear"),
    bandsConfirm: $("#bands-confirm"),

    filtersGrid: $("#filters-options"),
    filtersConfirm: $("#filters-confirm"),

    receiptFab: $("#receipt-open"),
    receiptBadge: $("#receipt-count"),
    receiptItems: $("#receipt-items"),
    receiptClear: $("#receipt-clear"),

    modal: $("#cigar-modal"),
    modalBackdrop: $("#cigar-modal-backdrop"),
    modalClose: $("#cigar-modal-close"),

    modalBrand: $("#modal-brand"),
    modalLine: $("#modal-line"),
    modalBrandIcon: $("#modal-brand-icon"),
    modalImg: $("#modal-cigar-img"),

    modalRG: $("#modal-rg"),
    modalLen: $("#modal-len"),
    modalStrength: $("#modal-strength"),
    modalVitola: $("#modal-vitola"),
    modalWrapper: $("#modal-wrapper"),
    modalBinder: $("#modal-binder"),
    modalFiller: $("#modal-filler"),
    modalOrigin: $("#modal-origin"),
    modalShade: $("#modal-shade")
  };

  /* ===============================
     SHEETS (bottom sheets)
  =============================== */
  function openSheet(sheetEl) {
    if (!sheetEl || !el.sheetBackdrop) return;
    el.sheetBackdrop.hidden = false;
    sheetEl.hidden = false;
    document.body.classList.add("sheet-open");
  }

  function closeAllSheets() {
    if (!el.sheetBackdrop) return;
    el.sheetBackdrop.hidden = true;
    $$(".sheet").forEach((s) => (s.hidden = true));
    document.body.classList.remove("sheet-open");
  }

  /* ===============================
     RECEIPT
  =============================== */
  function loadReceipt() {
    try {
      state.receipt = JSON.parse(localStorage.getItem(RECEIPT_KEY) || "[]");
      if (!Array.isArray(state.receipt)) state.receipt = [];
    } catch {
      state.receipt = [];
    }
  }

  function saveReceipt() {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(state.receipt));
  }

  function updateReceiptUI() {
    if (!el.receiptBadge || !el.receiptItems) return;

    const count = state.receipt.length;
    el.receiptBadge.textContent = String(count);
    el.receiptBadge.hidden = count === 0;

    el.receiptItems.innerHTML = state.receipt
      .map(
        (i) => `
        <div class="receipt-row">
          <div class="receipt-name">${txt(i.name)}</div>
          <div class="receipt-price">$${money(i.price)}</div>
        </div>`
      )
      .join("");

    saveReceipt();
  }

  function addToReceipt(row) {
    state.receipt.push({
      name: row["Cigar"] || row["Line"] || "Cigar",
      price: money(row["MSRP"])
    });
    updateReceiptUI();
  }

  /* ===============================
     BRAND HEADER (title + icon)
  =============================== */
  function setBrandHeader() {
    if (el.title) el.title.textContent = state.brandRaw || "Brand";
    mountBrandIcon(el.iconBox, state.brandRaw || state.brand);
    mountBrandIcon(el.modalBrandIcon, state.brandRaw || state.brand);
  }

  /* ===============================
     BANDS (from Line column)
  =============================== */
  function renderBandsOptions() {
    if (!el.bandsGrid) return;

    const lines = uniq(
      state.all.map((r) => txt(r["Line"])).filter((v) => v.length > 0)
    ).sort((a, b) => a.localeCompare(b));

    el.bandsGrid.innerHTML = lines
      .map((line) => {
        const checked = state.bands.has(line) ? "checked" : "";
        return `<label class="chip"><input type="checkbox" value="${line}" ${checked}>${line}</label>`;
      })
      .join("");
  }

  function applyBandsFromUI() {
    state.bands.clear();
    $$("#bands-options input[type='checkbox']:checked").forEach((i) =>
      state.bands.add(i.value)
    );
  }

  /* ===============================
     FILTERS UI (2-level)
  =============================== */
  const FILTER_DEFS = [
    { key: "Shade", label: "Shade", col: "Wrapper Shade" },
    { key: "Vitola", label: "Vitola", col: "Vitola" },
    { key: "Ring", label: "Ring", col: "RG" },
    { key: "Strength", label: "Strength", col: "Strength" },
    { key: "Length", label: "Length", col: "Length" },
    { key: "Shape", label: "Shape", col: "Shape" },
    { key: "Tubo", label: "Tubo", col: "Tubo" },
    { key: "Flavored", label: "Flavored", col: "Flavored" },
    { key: "Tin", label: "Tin", col: "Tin" },
    { key: "Pack", label: "Pack", col: "Pack" },
    { key: "Barberpole", label: "Barberpole", col: "Barber" },
    { key: "Box-Pressed", label: "Box-Pressed", col: "Box-Pressed" }
  ];

  // Build a secondary sheet dynamically (so you don't need to edit brand.html)
  let filterDetail = null;

  function ensureFilterDetailSheet() {
    if (filterDetail) return filterDetail;

    const wrap = document.createElement("section");
    wrap.className = "sheet";
    wrap.id = "sheet-filter-detail";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Filter options");
    wrap.hidden = true;

    wrap.innerHTML = `
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="sheet-header">
        <h2 id="filter-detail-title">Filter</h2>
        <button class="sheet-x" type="button" data-sheet-close aria-label="Close">×</button>
      </header>

      <div class="sheet-body">
        <div class="chip-grid" id="filter-detail-options"></div>
      </div>

      <footer class="sheet-footer">
        <button class="sheet-btn" type="button" id="filter-detail-clear">Clear</button>
        <button class="sheet-btn primary" type="button" id="filter-detail-confirm">Confirm</button>
      </footer>
    `;

    document.body.appendChild(wrap);

    filterDetail = {
      sheet: wrap,
      title: $("#filter-detail-title", wrap),
      grid: $("#filter-detail-options", wrap),
      clear: $("#filter-detail-clear", wrap),
      confirm: $("#filter-detail-confirm", wrap)
    };

    // close buttons should work
    $$("[data-sheet-close]", wrap).forEach((btn) =>
      safeOn(btn, "click", closeAllSheets)
    );

    return filterDetail;
  }

  function filterValues(def) {
    const values = uniq(
      state.all
        .map((r) => txt(r[def.col]))
        .filter((v) => v.length > 0 && v.toLowerCase() !== "x")
    ).sort((a, b) => a.localeCompare(b));
    return values;
  }

  function renderFiltersHome() {
    if (!el.filtersGrid) return;

    el.filtersGrid.innerHTML = FILTER_DEFS.map((d) => {
      const count = state.filters[d.key]?.size || 0;
      const active = count ? " active" : "";
      const sub = count ? `<span class="chip-sub">${count}</span>` : "";
      return `
        <button type="button" class="chip chip-btn${active}" data-filter-key="${d.key}">
          ${d.label}
          ${sub}
        </button>
      `;
    }).join("");

    // tap a filter => open second-level picker
    $$("#filters-options [data-filter-key]").forEach((btn) => {
      safeOn(btn, "click", () => openFilterDetail(btn.dataset.filterKey));
    });
  }

  function openFilterDetail(key) {
    const def = FILTER_DEFS.find((d) => d.key === key);
    if (!def) return;

    const fd = ensureFilterDetailSheet();
    if (fd.title) fd.title.textContent = def.label;

    const values = filterValues(def);
    const selected = state.filters[key] || new Set();

    fd.grid.innerHTML = values
      .map((v) => {
        const checked = selected.has(v) ? "checked" : "";
        return `<label class="chip"><input type="checkbox" value="${v}" ${checked}>${v}</label>`;
      })
      .join("");

    // Clear (only this filter)
    safeOn(fd.clear, "click", () => {
      (state.filters[key] || new Set()).clear();
      // uncheck UI
      $$("#filter-detail-options input[type='checkbox']", fd.sheet).forEach(
        (i) => (i.checked = false)
      );
    });

    // Confirm (apply)
    safeOn(fd.confirm, "click", () => {
      const set = (state.filters[key] = state.filters[key] || new Set());
      set.clear();
      $$("#filter-detail-options input[type='checkbox']:checked", fd.sheet).forEach(
        (i) => set.add(i.value)
      );
      // return to filters home
      renderFiltersHome();
      applyFilters();
      // close detail sheet only (leave home open? your UX shows single sheet at a time)
      // We'll close all sheets to keep it clean:
      closeAllSheets();
    });

    openSheet(fd.sheet);
  }

  /* ===============================
     FILTERING LOGIC
  =============================== */
  function anyFilterActive() {
    return Object.values(state.filters).some((s) => s && s.size);
  }

  function matchMultiFilter(row) {
    for (const def of FILTER_DEFS) {
      const set = state.filters[def.key];
      if (!set || set.size === 0) continue;

      const value = txt(row[def.col]);
      if (!set.has(value)) return false;
    }
    return true;
  }

  function applyFilters() {
    const q = norm(state.search);

    state.view = state.all.filter((r) => {
      // Wrapper toggle (maduro/natural)
      if (state.wrapper !== "all") {
        const wb = wrapperBucket(r);
        if (wb !== state.wrapper) return false;
      }

      // Search
      if (q) {
        const hay = norm(
          `${r["Cigar"]} ${r["Line"]} ${r["Vitola"]} ${r["Wrapper Shade"]}`
        );
        if (!hay.includes(q)) return false;
      }

      // Bands (Line)
      if (state.bands.size) {
        const line = txt(r["Line"]);
        if (!state.bands.has(line)) return false;
      }

      // Advanced Filters (multi-select per filter)
      if (anyFilterActive() && !matchMultiFilter(r)) return false;

      return true;
    });

    renderList();
  }

  /* ===============================
     LIST RENDER
  =============================== */
  function renderList() {
    if (!el.list) return;
    el.list.innerHTML = "";

    if (!state.view.length) {
      if (el.status) {
        el.status.hidden = false;
        el.status.textContent = "No cigars match.";
      }
      return;
    }

    if (el.status) el.status.hidden = true;

    const iconCandidates = brandIconCandidates(state.brandRaw || state.brand);
    const primaryIconSrc = iconCandidates[0];

    state.view.forEach((row) => {
      const item = document.createElement("div");
      item.className = "brand-row";

      const cigarName = txt(row["Cigar"]) || "(Unnamed cigar)";
      const vitola = txt(row["Vitola"]) || "";
      const price = money(row["MSRP"]);

      item.innerHTML = `
        <div class="row-icon" aria-hidden="true">
          <img class="row-icon-img" alt="" src="${primaryIconSrc}">
        </div>

        <div class="row-main" role="button" tabindex="0" aria-label="${cigarName}">
          <div class="row-title">${cigarName}</div>
          <div class="row-sub">${vitola}</div>
        </div>

        <div class="row-price">${price}</div>
        <button class="row-add" type="button" aria-label="Add ${cigarName}">+</button>
      `;

      // fallback icon cycling
      const rowImg = item.querySelector(".row-icon-img");
      if (rowImg) {
        let idx = 0;
        rowImg.onerror = () => {
          idx += 1;
          if (idx < iconCandidates.length) rowImg.src = iconCandidates[idx];
        };
      }

      const main = item.querySelector(".row-main");
      const addBtn = item.querySelector(".row-add");

      safeOn(main, "click", () => openModal(row));
      safeOn(main, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(row);
        }
      });

      safeOn(addBtn, "click", (e) => {
        e.stopPropagation();
        addToReceipt(row);
      });

      el.list.appendChild(item);
    });
  }

  /* ===============================
     MODAL (cigar detail overlay)
  =============================== */
  function openModal(row) {
    if (!el.modal) return;

    if (el.modalBrand)
      el.modalBrand.textContent = txt(row["Brand"]) || state.brandRaw || "Brand";

    if (el.modalLine) {
      const lineCigar = `${txt(row["Line"])} ${txt(row["Cigar"])}`.trim();
      el.modalLine.textContent = lineCigar || txt(row["Cigar"]) || "Cigar";
    }

    if (el.modalRG) el.modalRG.textContent = txt(row["RG"]) || "—";
    if (el.modalLen) el.modalLen.textContent = txt(row["Length"]) || "—";
    if (el.modalStrength) el.modalStrength.textContent = txt(row["Strength"]) || "—";
    if (el.modalVitola) el.modalVitola.textContent = txt(row["Vitola"]) || "—";

    if (el.modalWrapper) el.modalWrapper.textContent = txt(row["Wrapper"]) || "—";
    if (el.modalBinder) el.modalBinder.textContent = txt(row["Binder"]) || "—";
    if (el.modalFiller) el.modalFiller.textContent = txt(row["Filler"]) || "—";
    if (el.modalOrigin) el.modalOrigin.textContent = txt(row["Origin"]) || "—";
    if (el.modalShade) el.modalShade.textContent = txt(row["Wrapper Shade"]) || "—";

    if (el.modalImg) {
      const src = txt(row["Cigar IMG"]);
      el.modalImg.src = src || "";
      el.modalImg.style.visibility = src ? "visible" : "hidden";
    }

    mountBrandIcon(el.modalBrandIcon, state.brandRaw || row["Brand"] || "");

    el.modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    if (el.modal) el.modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  /* ===============================
     TOGGLE UI STATE (Maduro / Natural / All)
  =============================== */
  function syncToggleUI() {
    if (el.segMaduro)
      el.segMaduro.setAttribute(
        "aria-pressed",
        state.wrapper === "maduro" ? "true" : "false"
      );

    if (el.segNatural)
      el.segNatural.setAttribute(
        "aria-pressed",
        state.wrapper === "natural" ? "true" : "false"
      );

    if (el.segWrap) el.segWrap.setAttribute("data-state", state.wrapper);
  }

  function setWrapper(next) {
    state.wrapper = next;
    syncToggleUI();
    applyFilters();
  }

  /* ===============================
     INIT + EVENTS
  =============================== */
  function wireEvents() {
    safeOn(el.back, "click", () => history.back());

    // Search
    safeOn(el.search, "input", (e) => {
      state.search = norm(e.target.value);
      applyFilters();
    });

    // Toggle: clicking words must work
    safeOn(el.segMaduro, "click", () => setWrapper("maduro"));
    safeOn(el.segNatural, "click", () => setWrapper("natural"));

    // Toggle: switch flips between maduro/natural; if ALL, first click -> maduro
    safeOn(el.segSwitch, "click", () => {
      if (state.wrapper === "all") return setWrapper("maduro");
      setWrapper(state.wrapper === "maduro" ? "natural" : "maduro");
    });

    // Bands / Filters buttons (open sheets)
    safeOn(el.btnBands, "click", () => openSheet(el.sheetBands));
    safeOn(el.btnFilters, "click", () => openSheet(el.sheetFilters));

    // Backdrop closes sheets
    safeOn(el.sheetBackdrop, "click", closeAllSheets);

    // Close buttons anywhere
    $$("[data-sheet-close]").forEach((btn) =>
      safeOn(btn, "click", closeAllSheets)
    );

    // Bands confirm/clear
    safeOn(el.bandsConfirm, "click", () => {
      applyBandsFromUI();
      closeAllSheets();
      applyFilters();
    });

    safeOn(el.bandsClear, "click", () => {
      state.bands.clear();
      $$("#bands-options input[type='checkbox']").forEach((i) => (i.checked = false));
      closeAllSheets();
      applyFilters();
    });

    // Filters confirm (just close + apply)
    safeOn(el.filtersConfirm, "click", () => {
      closeAllSheets();
      applyFilters();
    });

    // Receipt open/clear
    safeOn(el.receiptFab, "click", () => openSheet(el.sheetReceipt));
    safeOn(el.receiptClear, "click", () => {
      state.receipt = [];
      updateReceiptUI();
    });

    // Modal close
    safeOn(el.modalBackdrop, "click", closeModal);
    safeOn(el.modalClose, "click", closeModal);

    // ESC closes modal/sheets
    safeOn(document, "keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeAllSheets();
      }
    });
  }

  function setStatus(msg) {
    if (!el.status) return;
    el.status.hidden = false;
    el.status.textContent = msg;
  }

  function init() {
    loadReceipt();
    updateReceiptUI();

    setBrandHeader();
    wireEvents();

    if (!state.brand) {
      setStatus("Missing ?brand= in URL.");
      return;
    }

    setStatus("Loading…");

    fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" })
      .then((r) => r.text())
      .then(csvToObjects)
      .then((rows) => {
        state.all = rows.filter((r) => norm(r["Brand"]) === state.brand);

        if (!state.all.length) {
          setStatus(`No rows found for brand "${state.brandRaw}".`);
          renderBandsOptions();
          renderFiltersHome();
          renderList();
          return;
        }

        // Build UI
        renderBandsOptions();
        renderFiltersHome();

        // Default view shows ALL
        state.wrapper = "all";
        syncToggleUI();

        if (el.status) el.status.hidden = true;
        applyFilters();
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to load cigars.");
      });
  }

  init();
})();
