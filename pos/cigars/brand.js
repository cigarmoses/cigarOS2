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
    // Robust-ish CSV parser (handles quoted commas)
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
    // Try multiple fields because the sheet isn’t always consistent.
    const s = norm(
      row["Wrapper Shade"] ||
        row["Wrapper"] ||
        row["Cigar"] ||
        row["Line"] ||
        ""
    );

    // Maduro signals
    if (s.includes("maduro") || s.includes("oscuro") || s.includes("negro"))
      return "maduro";

    // Natural signals
    if (
      s.includes("natural") ||
      s.includes("claro") ||
      s.includes("connecticut") ||
      s.includes("rosado") ||
      s.includes("shade")
    )
      return "natural";

    // If unknown, treat as "either" so it can show in ALL view.
    return "either";
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
    bands: new Set(), // holds selected Line values
    receipt: []
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

  function requireEl(name, node) {
    if (!node) console.warn("[brand.js] Missing element:", name);
  }
  Object.entries(el).forEach(([k, v]) => requireEl(k, v));

  /* ===============================
     SHEETS (bottom sheets)
  =============================== */
  function openSheet(sheetEl) {
    if (!sheetEl || !el.sheetBackdrop) return;
    el.sheetBackdrop.hidden = false;
    sheetEl.hidden = false;
  }

  function closeAllSheets() {
    if (!el.sheetBackdrop) return;
    el.sheetBackdrop.hidden = true;
    $$(".sheet").forEach((s) => (s.hidden = true));
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

    // Brand icon: try both /img/icons/brand/ and /img/icons/brands/
    const slug = slugBrand(state.brandRaw || state.brand || "");
    const try1 = `/img/icons/brand/${slug}.svg`;
    const try2 = `/img/icons/brands/${slug}.svg`;

    function mountIcon(target, src1, src2) {
      if (!target) return;
      target.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "";
      img.src = src1;
      img.onerror = () => {
        if (img.src.endsWith(src2)) return;
        img.src = src2;
      };
      target.appendChild(img);
    }

    mountIcon(el.iconBox, try1, try2);
    mountIcon(el.modalBrandIcon, try1, try2);
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
        // class names kept generic so your CSS can style label/input
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
     FILTERING
  =============================== */
  function applyFilters() {
    const q = norm(state.search);

    state.view = state.all.filter((r) => {
      // Wrapper
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

      return true;
    });

    renderList();
  }

  /* ===============================
     LIST RENDER (must match your blue UI CSS)
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

    state.view.forEach((row) => {
      const item = document.createElement("div");
      item.className = "brand-row";

      const cigarName = txt(row["Cigar"]) || "(Unnamed cigar)";
      const vitola = txt(row["Vitola"]) || "";
      const price = money(row["MSRP"]);

      item.innerHTML = `
        <div class="row-main" role="button" tabindex="0" aria-label="${cigarName}">
          <div class="row-title">${cigarName}</div>
          <div class="row-sub">${vitola}</div>
        </div>
        <div class="row-price">${price}</div>
        <button class="row-add" type="button" aria-label="Add ${cigarName}">+</button>
      `;

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

    if (el.modalBrand) el.modalBrand.textContent = txt(row["Brand"]) || state.brandRaw || "Brand";
    if (el.modalLine)
      el.modalLine.textContent = `${txt(row["Line"])} ${txt(row["Cigar"])}`.trim() || txt(row["Cigar"]) || "Cigar";

    if (el.modalRG) el.modalRG.textContent = txt(row["RG"]) || "—";
    if (el.modalLen) el.modalLen.textContent = txt(row["Length"]) || "—";
    if (el.modalStrength) el.modalStrength.textContent = txt(row["Strength"]) || "—";
    if (el.modalVitola) el.modalVitola.textContent = txt(row["Vitola"]) || "—";

    if (el.modalWrapper) el.modalWrapper.textContent = txt(row["Wrapper"]) || "—";
    if (el.modalBinder) el.modalBinder.textContent = txt(row["Binder"]) || "—";
    if (el.modalFiller) el.modalFiller.textContent = txt(row["Filler"]) || "—";
    if (el.modalOrigin) el.modalOrigin.textContent = txt(row["Origin"]) || "—";
    if (el.modalShade) el.modalShade.textContent = txt(row["Wrapper Shade"]) || "—";

    // Image (optional)
    if (el.modalImg) {
      const src = txt(row["Cigar IMG"]);
      el.modalImg.src = src || "";
      el.modalImg.style.visibility = src ? "visible" : "hidden";
    }

    el.modal.hidden = false;
  }

  function closeModal() {
    if (el.modal) el.modal.hidden = true;
  }

  /* ===============================
     TOGGLE UI STATE (Maduro / Natural)
  =============================== */
  function syncToggleUI() {
    // aria-pressed on words
    if (el.segMaduro) el.segMaduro.setAttribute("aria-pressed", state.wrapper === "maduro" ? "true" : "false");
    if (el.segNatural) el.segNatural.setAttribute("aria-pressed", state.wrapper === "natural" ? "true" : "false");

    // If your CSS uses a data-state attribute on a wrapper element, you can optionally set it here.
    // (We can't assume the wrapper element exists, so this is safe.)
    const segWrap = el.segSwitch ? el.segSwitch.closest(".pill-toggle, .seg") : null;
    if (segWrap) {
      segWrap.setAttribute("data-state", state.wrapper === "maduro" ? "maduro" : state.wrapper === "natural" ? "natural" : "all");
    }
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

    // Toggle: clicking words MUST work
    safeOn(el.segMaduro, "click", () => setWrapper("maduro"));
    safeOn(el.segNatural, "click", () => setWrapper("natural"));

    // Toggle: switch flips between maduro/natural (no “all”)
    safeOn(el.segSwitch, "click", () => {
      setWrapper(state.wrapper === "maduro" ? "natural" : "maduro");
    });

    // Bands / Filters buttons
    safeOn(el.btnBands, "click", () => openSheet(el.sheetBands));
    safeOn(el.btnFilters, "click", () => openSheet(el.sheetFilters));

    // Backdrop closes sheets
    safeOn(el.sheetBackdrop, "click", closeAllSheets);

    // Close buttons (any element with data-sheet-close)
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
      // uncheck UI too
      $$("#bands-options input[type='checkbox']").forEach((i) => (i.checked = false));
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
      setStatus('Missing ?brand= in URL.');
      return;
    }

    setStatus("Loading…");

    fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" })
      .then((r) => r.text())
      .then(csvToObjects)
      .then((rows) => {
        // Filter by Brand column
        state.all = rows.filter((r) => norm(r["Brand"]) === state.brand);

        if (!state.all.length) {
          setStatus(`No rows found for brand "${state.brandRaw}".`);
          renderBandsOptions(); // empty
          renderList();         // empty
          return;
        }

        // Build bands list from Line column
        renderBandsOptions();

        // Default: show ALL (matches your blue screenshot)
        state.wrapper = "all";
        syncToggleUI();

        // Hide status and render
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
