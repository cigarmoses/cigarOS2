/* /pos/cigars/brand.js — FINAL FIX */

(() => {
  /* ===============================
     HELPERS
  =============================== */
  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => [...p.querySelectorAll(s)];

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];

      if (c === '"' && inQuotes && n === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((c === '\n' || c === '\r') && !inQuotes) {
        if (cur || row.length) {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = '';
        }
      } else {
        cur += c;
      }
    }

    if (cur || row.length) {
      row.push(cur);
      rows.push(row);
    }

    return rows;
  }

  /* ===============================
     ELEMENTS
  =============================== */
  const listEl = qs('#brand-list');
  const titleEl = qs('#brand-title');
  const brandIconEl = qs('#brand-icon');

  const btnFilters = qs('#btn-filters');
  const btnBands = qs('#btn-bands');
  const receiptFab = qs('#receipt-open');

  const backdrop = qs('#sheet-backdrop');
  const sheetFilters = qs('#sheet-filters');
  const sheetBands = qs('#sheet-bands');
  const sheetReceipt = qs('#sheet-receipt');

  const receiptItems = qs('#receipt-items');
  const receiptBadge = qs('#receipt-count');
  const bandsGrid = qs('#bands-options');

  /* ===============================
     STATE
  =============================== */
  let cigars = [];
  let receipt = [];

  /* ===============================
     SHEETS
  =============================== */
  function openSheet(s) {
    backdrop.hidden = false;
    s.hidden = false;
  }

  function closeSheets() {
    backdrop.hidden = true;
    sheetFilters.hidden = true;
    sheetBands.hidden = true;
    sheetReceipt.hidden = true;
  }

  backdrop.onclick = closeSheets;
  qsa('[data-sheet-close]').forEach(b => b.onclick = closeSheets);

  btnFilters.onclick = () => openSheet(sheetFilters);
  btnBands.onclick = () => openSheet(sheetBands);
  receiptFab.onclick = () => openSheet(sheetReceipt);

  /* ===============================
     BAND SVG MATCHING
  =============================== */
  function bandSVG(c) {
    const s = `${c.line} ${c.cigar}`.toLowerCase();
    if (s.includes('1926')) return '/img/icons/padron1926serieband.svg';
    if (s.includes('1964')) return '/img/icons/padron1964anniversaryband.svg';
    if (s.includes('damaso')) return '/img/icons/padrondamasoband.svg';
    return c.brandImg;
  }

  /* ===============================
     LOAD BRAND
  =============================== */
  async function loadBrand() {
    const brand = new URLSearchParams(location.search).get('brand');
    if (!brand) return;

    titleEl.textContent = brand;
    brandIconEl.innerHTML = `<img src="/img/icons/brands/${brand.toLowerCase()}.svg">`;

    const res = await fetch(
      'https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv'
    );

    const text = await res.text();
    const rows = parseCSV(text);
    const header = rows.shift();

    const idx = name => header.indexOf(name);

    cigars = rows
      .filter(r => r[idx('Brand')]?.toLowerCase() === brand.toLowerCase())
      .map(r => ({
        brandImg: r[idx('Brand IMG')],
        line: r[idx('Line')],
        cigar: r[idx('Cigar')],
        vitola: r[idx('Vitola')],
        price: r[idx('MSRP')] || '0.00'
      }));

    renderList();
    renderBands();
  }

  /* ===============================
     RENDER LIST
  =============================== */
  function renderList() {
    listEl.innerHTML = '';

    cigars.forEach(c => {
      const row = document.createElement('div');
      row.className = 'brand-row';

      row.innerHTML = `
        <img src="${bandSVG(c)}" width="42" height="42" />
        <div class="row-main">
          <div class="row-title">${c.cigar}</div>
          <div class="row-sub">${c.vitola}</div>
        </div>
        <div class="row-price">${Number(c.price).toFixed(2)}</div>
        <button class="row-add">+</button>
      `;

      qs('.row-add', row).onclick = () => addToReceipt(c);
      listEl.appendChild(row);
    });
  }

  /* ===============================
     BANDS POPUP (VISUAL)
  =============================== */
  function renderBands() {
    bandsGrid.innerHTML = `
      <img src="/img/icons/padron1926serieband.svg" height="48">
      <img src="/img/icons/padron1964anniversaryband.svg" height="48">
      <img src="/img/icons/padrondamasoband.svg" height="48">
    `;
  }

  /* ===============================
     RECEIPT
  =============================== */
  function addToReceipt(c) {
    receipt.push(c);
    receiptBadge.hidden = false;
    receiptBadge.textContent = receipt.length;

    const div = document.createElement('div');
    div.textContent = `${c.cigar} — ${c.price}`;
    receiptItems.appendChild(div);
  }

  /* ===============================
     INIT
  =============================== */
  loadBrand();
})();
