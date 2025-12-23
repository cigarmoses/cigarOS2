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
  const text = v => (v ?? "").toString().trim();
  const norm = v => text(v).toLowerCase();
  const money = v => {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

  function csvToObjects(csv) {
    const rows = [];
    let row = [], cur = "", q = false;

    for (let i = 0; i < csv.length; i++) {
      const c = csv[i], n = csv[i + 1];
      if (c === '"' && q && n === '"') { cur += '"'; i++; continue; }
      if (c === '"') { q = !q; continue; }
      if (c === "," && !q) { row.push(cur); cur = ""; continue; }
      if ((c === "\n" || c === "\r") && !q) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur); rows.push(row);
        row = []; cur = ""; continue;
      }
      cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }

    const headers = rows.shift().map(h => h.trim());
    return rows.map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = text(r[i]));
      return o;
    });
  }

  function getBrand() {
    return new URL(location.href).searchParams.get("brand") || "";
  }

  function wrapperType(row) {
    const v = norm(row["Wrapper Shade"] || row["Wrapper"] || row["Cigar"]);
    if (v.includes("maduro") || v.includes("oscuro")) return "maduro";
    if (
      v.includes("natural") ||
      v.includes("claro") ||
      v.includes("connecticut") ||
      v.includes("rosado")
    ) return "natural";
    return "either";
  }

  /* ===============================
     STATE
  =============================== */
  const state = {
    brand: norm(getBrand()),
    all: [],
    view: [],
    search: "",
    wrapper: "all", // all | maduro | natural
    bands: new Set(),
    receipt: JSON.parse(localStorage.getItem(RECEIPT_KEY) || "[]")
  };

  /* ===============================
     DOM
  =============================== */
  const el = {
    list: $("#brand-list"),
    search: $("#brand-search"),
    status: $("#brand-status"),

    btnFilters: $("#btn-filters"),
    btnBands: $("#btn-bands"),

    segMaduro: $("#seg-maduro"),
    segNatural: $("#seg-natural"),
    segSwitch: $("#seg-switch"),

    sheetBands: $("#sheet-bands"),
    sheetFilters: $("#sheet-filters"),
    backdrop: $("#sheet-backdrop"),

    bandsGrid: $("#bands-options"),
    bandsClear: $("#bands-clear"),
    bandsConfirm: $("#bands-confirm"),

    receiptFab: $("#receipt-open"),
    receiptBadge: $("#receipt-count"),
    receiptSheet: $("#sheet-receipt"),
    receiptItems: $("#receipt-items"),
    receiptClear: $("#receipt-clear"),

    modal: $("#cigar-modal"),
    modalBackdrop: $("#cigar-modal-backdrop"),
    modalClose: $("#cigar-modal-close"),

    modalBrand: $("#modal-brand"),
    modalLine: $("#modal-line"),
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
     UI HELPERS
  =============================== */
  function openSheet(s) {
    el.backdrop.hidden = false;
    s.hidden = false;
  }
  function closeSheets() {
    el.backdrop.hidden = true;
    $$(".sheet").forEach(s => s.hidden = true);
  }

  function updateReceiptUI() {
    el.receiptBadge.textContent = state.receipt.length;
    el.receiptBadge.hidden = !state.receipt.length;
    el.receiptItems.innerHTML = state.receipt.map(i =>
      `<div class="receipt-row">${i.name}<span>$${i.price}</span></div>`
    ).join("");
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(state.receipt));
  }

  /* ===============================
     RENDER
  =============================== */
  function renderList() {
    el.list.innerHTML = "";

    state.view.forEach(row => {
      const div = document.createElement("div");
      div.className = "brand-row";
      div.innerHTML = `
        <div class="row-main">
          <div class="row-title">${row["Cigar"]}</div>
          <div class="row-sub">${row["Vitola"]}</div>
        </div>
        <div class="row-price">$${money(row["MSRP"])}</div>
        <button class="row-add">+</button>
      `;

      div.querySelector(".row-main").onclick = () => openModal(row);
      div.querySelector(".row-add").onclick = () => {
        state.receipt.push({
          name: row["Cigar"],
          price: money(row["MSRP"])
        });
        updateReceiptUI();
      };

      el.list.appendChild(div);
    });
  }

  function applyFilters() {
    state.view = state.all.filter(r => {
      if (state.wrapper !== "all" && wrapperType(r) !== state.wrapper) return false;
      if (state.search && !norm(r["Cigar"]).includes(state.search)) return false;
      if (state.bands.size && !state.bands.has(r["Line"])) return false;
      return true;
    });
    renderList();
  }

  function openModal(row) {
    el.modalBrand.textContent = row["Brand"];
    el.modalLine.textContent = row["Cigar"];
    el.modalRG.textContent = row["RG"];
    el.modalLen.textContent = row["Length"];
    el.modalStrength.textContent = row["Strength"];
    el.modalVitola.textContent = row["Vitola"];
    el.modalWrapper.textContent = row["Wrapper"];
    el.modalBinder.textContent = row["Binder"];
    el.modalFiller.textContent = row["Filler"];
    el.modalOrigin.textContent = row["Origin"];
    el.modalShade.textContent = row["Wrapper Shade"];
    el.modalImg.src = row["Cigar IMG"] || "";
    el.modal.hidden = false;
  }

  /* ===============================
     EVENTS
  =============================== */
  el.search.oninput = e => { state.search = norm(e.target.value); applyFilters(); };

  el.segMaduro.onclick = () => { state.wrapper = "maduro"; applyFilters(); };
  el.segNatural.onclick = () => { state.wrapper = "natural"; applyFilters(); };
  el.segSwitch.onclick = () => {
    state.wrapper = state.wrapper === "maduro" ? "natural" : "maduro";
    applyFilters();
  };

  el.btnBands.onclick = () => openSheet(el.sheetBands);
  el.btnFilters.onclick = () => openSheet(el.sheetFilters);
  el.backdrop.onclick = closeSheets;
  el.modalBackdrop.onclick = () => el.modal.hidden = true;
  el.modalClose.onclick = () => el.modal.hidden = true;

  el.receiptFab.onclick = () => openSheet(el.receiptSheet);
  el.receiptClear.onclick = () => {
    state.receipt = [];
    updateReceiptUI();
  };

  el.bandsConfirm.onclick = () => {
    state.bands.clear();
    $$("#bands-options input:checked").forEach(i => state.bands.add(i.value));
    closeSheets();
    applyFilters();
  };
  el.bandsClear.onclick = () => {
    state.bands.clear();
    closeSheets();
    applyFilters();
  };

  /* ===============================
     INIT
  =============================== */
  fetch(GOOGLE_SHEETS_CSV_URL)
    .then(r => r.text())
    .then(csvToObjects)
    .then(rows => {
      state.all = rows.filter(r => norm(r["Brand"]) === state.brand);
      const lines = [...new Set(state.all.map(r => r["Line"]).filter(Boolean))];
      el.bandsGrid.innerHTML = lines.map(l =>
        `<label class="chip"><input type="checkbox" value="${l}">${l}</label>`
      ).join("");
      applyFilters();
      updateReceiptUI();
    })
    .catch(err => {
      console.error(err);
      el.status.hidden = false;
      el.status.textContent = "Failed to load cigars.";
    });

})();
