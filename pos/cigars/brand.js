/* /pos/cigars/brand.js */

(() => {
  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => [...p.querySelectorAll(s)];

  /* ===============================
     ELEMENTS
  =============================== */
  const listEl = qs('#brand-list');
  const statusEl = qs('#brand-status');

  const btnFilters = qs('#btn-filters');
  const btnBands = qs('#btn-bands');
  const receiptFab = qs('#receipt-open');

  const backdrop = qs('#sheet-backdrop');

  const sheetFilters = qs('#sheet-filters');
  const sheetBands = qs('#sheet-bands');
  const sheetReceipt = qs('#sheet-receipt');

  const filtersClose = qsa('[data-sheet-close]', sheetFilters);
  const bandsClose = qsa('[data-sheet-close]', sheetBands);
  const receiptClose = qsa('[data-sheet-close]', sheetReceipt);

  const bandsGrid = qs('#bands-options');
  const receiptItems = qs('#receipt-items');
  const receiptBadge = qs('#receipt-count');

  /* ===============================
     STATE
  =============================== */
  let cigars = [];
  let receipt = [];
  let activeBands = new Set();

  /* ===============================
     SHEET CONTROLS (FIXED)
  =============================== */
  function openSheet(sheet) {
    backdrop.hidden = false;
    sheet.hidden = false;
  }

  function closeAllSheets() {
    backdrop.hidden = true;
    sheetFilters.hidden = true;
    sheetBands.hidden = true;
    sheetReceipt.hidden = true;
  }

  backdrop.addEventListener('click', closeAllSheets);

  btnFilters.addEventListener('click', () => openSheet(sheetFilters));
  btnBands.addEventListener('click', () => openSheet(sheetBands));
  receiptFab.addEventListener('click', () => openSheet(sheetReceipt));

  filtersClose.forEach(b => b.addEventListener('click', closeAllSheets));
  bandsClose.forEach(b => b.addEventListener('click', closeAllSheets));
  receiptClose.forEach(b => b.addEventListener('click', closeAllSheets));

  /* ===============================
     DATA LOAD
  =============================== */
  async function loadBrand() {
    const brand = new URLSearchParams(location.search).get('brand');
    if (!brand) return;

    const res = await fetch(
      'https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv'
    );

    const csv = await res.text();
    const rows = csv.split('\n').slice(1);

    cigars = rows
      .map(r => r.split(','))
      .filter(r => r[2]?.toLowerCase() === brand.toLowerCase())
      .map(r => ({
        manufacturerImg: r[1],
        brandImg: r[4],
        line: r[6] || '',
        cigar: r[7] || '',
        vitola: r[8] || '',
        price: r[18] || '0.00'
      }));

    renderList();
    renderBands();
  }

  /* ===============================
     BAND SVG LOGIC (FINAL)
  =============================== */
  function getBandSVG(c) {
    const source = `${c.line} ${c.cigar}`.toLowerCase();

    if (source.includes('1926'))
      return '/img/icons/padron1926serieband.svg';

    if (source.includes('1964'))
      return '/img/icons/padron1964anniversaryband.svg';

    if (source.includes('damaso'))
      return '/img/icons/padrondamasoband.svg';

    return null;
  }

  /* ===============================
     LIST RENDER
  =============================== */
  function renderList() {
    listEl.innerHTML = '';

    cigars.forEach(c => {
      const row = document.createElement('div');
      row.className = 'brand-row';

      const band = getBandSVG(c);

      row.innerHTML = `
        <img src="${c.brandImg}" width="42" height="42" />
        <div class="row-main">
          <div class="row-title">${c.cigar}</div>
          <div class="row-sub">${c.vitola}</div>
        </div>
        <div class="row-price">${Number(c.price).toFixed(2)}</div>
        <button class="row-add">+</button>
      `;

      qs('.row-add', row).addEventListener('click', () => addToReceipt(c));
      listEl.appendChild(row);
    });
  }

  /* ===============================
     BANDS POPUP (WORKING)
  =============================== */
  function renderBands() {
    const bands = [
      { id: '1926', label: '1926 Serie' },
      { id: '1964', label: '1964 Anniversary' },
      { id: 'damaso', label: 'Damaso' }
    ];

    bandsGrid.innerHTML = '';

    bands.forEach(b => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = b.label;

      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        activeBands.has(b.id)
          ? activeBands.delete(b.id)
          : activeBands.add(b.id);
      });

      bandsGrid.appendChild(chip);
    });
  }

  /* ===============================
     RECEIPT (WORKING)
  =============================== */
  function addToReceipt(c) {
    receipt.push(c);
    updateReceipt();
  }

  function updateReceipt() {
    receiptItems.innerHTML = '';
    receiptBadge.textContent = receipt.length;
    receiptBadge.hidden = receipt.length === 0;

    receipt.forEach(c => {
      const div = document.createElement('div');
      div.textContent = `${c.cigar} — ${c.price}`;
      receiptItems.appendChild(div);
    });
  }

  /* ===============================
     INIT
  =============================== */
  loadBrand();
})();
