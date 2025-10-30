/* =========  Universal Inventory Engine  =========
   - Reads per-page JSON config from <script id="inv-config">
   - Renders icon-only grid (prices hidden on card)
   - On click: opens modal with price + qty (+/-) + Add to Bill
   - Maintains floating "bill" tab (FAB) with count and subtotal
*/

(function(){
  // ---- helpers ----
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const money = n => `$${n.toFixed(2)}`;

  // ---- read config ----
  const cfgEl = $('#inv-config');
  if(!cfgEl){ console.warn('inv-config not found'); return; }
  const cfg = JSON.parse(cfgEl.textContent || '{}');

  const TITLE     = cfg.title || 'Inventory';
  const BACK_HREF = cfg.backHref || '/';
  const GRID_MOBILE = cfg.grid || '3up'; // we always do responsive; left for future
  const SHOW_NAMES  = !!cfg.showNames;    // we keep classes but CSS currently hides
  const SHOW_PRICES = !!cfg.showPrices;   // we suppress prices on card (modal shows)
  const ICON_PATH   = cfg.iconPath || '';
  const TAX_RATE    = typeof cfg.taxRate === 'number' ? cfg.taxRate : 0.07;

  // ---- cart (shared via localStorage) ----
  const CART_KEY = 'smoke_cart_v1';
  const loadCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {items:[], taxRate:TAX_RATE}; }
    catch(e){ return {items:[], taxRate:TAX_RATE}; }
  };
  const saveCart = cart => localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const cart = loadCart();
  cart.taxRate = TAX_RATE;

  const cartTotals = c => {
    const sub = c.items.reduce((s,it)=> s + (it.price * it.qty), 0);
    const tax = +(sub * c.taxRate).toFixed(2);
    const total = +(sub + tax).toFixed(2);
    const qty = c.items.reduce((s,it)=> s + it.qty, 0);
    return {sub, tax, total, qty};
  };

  // ---- build base DOM ----
  document.body.insertAdjacentHTML('afterbegin', `
    <main class="inv-wrap">
      <header class="topbar">
        <a class="topbar-back" href="${BACK_HREF}" aria-label="Back">←</a>
        <h1 class="topbar-title">${TITLE}</h1>
      </header>
      <section id="invGrid" class="inv-grid"></section>
    </main>

    <dialog class="qty-modal" id="qtyModal">
      <div class="modal-card">
        <div class="m-head">
          <img id="mIcon" alt="">
          <div class="m-title">
            <h3 id="mName"></h3>
            <div id="mMeta" class="muted"></div>
          </div>
        </div>
        <div class="price-line" id="mPrice"></div>
        <div class="qty-row">
          <button class="step" id="mMinus">−</button>
          <input type="number" id="mQty" min="1" step="1" value="1">
          <button class="step" id="mPlus">+</button>
        </div>
        <div class="m-actions">
          <button class="btn btn-light" id="mCancel">Cancel</button>
          <button class="btn btn-primary" id="mAdd">Add to Bill</button>
        </div>
      </div>
    </dialog>

    <button class="fab" id="fabBtn" aria-label="Open bill">
      <img src="/img/icons/pos.svg" alt="">
      <span class="fab-badge" id="fabQty">0</span>
      <span class="fab-sub" id="fabSub">$0.00</span>
    </button>
  `);

  const grid = $('#invGrid');
  const modal = $('#qtyModal');
  const mIcon = $('#mIcon'), mName = $('#mName'), mMeta = $('#mMeta'), mPrice = $('#mPrice');
  const mMinus = $('#mMinus'), mPlus = $('#mPlus'), mQty = $('#mQty'), mAdd = $('#mAdd'), mCancel = $('#mCancel');
  const fabBtn = $('#fabBtn'), fabQty = $('#fabQty'), fabSub = $('#fabSub');

  // ---- load data ----
  const normalizeItem = raw => {
    const icon = raw.icon ? raw.icon : (raw.iconFile ? (ICON_PATH + raw.iconFile) : '');
    return {
      id: raw.id || raw.sku || crypto.randomUUID(),
      sku: raw.sku || raw.id || '',
      name: raw.name || 'Item',
      brand: raw.brand || '',
      vitola: raw.vitola || '',
      price: typeof raw.price === 'number' ? raw.price : parseFloat(raw.price||0),
      icon,
      taxable: raw.taxable !== false,
      meta: raw.meta || ''
    };
  };

  const fetchData = async () => {
    if (Array.isArray(cfg.data)) return cfg.data.map(normalizeItem);
    if (cfg.dataUrl){
      const res = await fetch(cfg.dataUrl, {cache:'no-store'});
      const json = await res.json();
      return json.map(normalizeItem);
    }
    return [];
  };

  let ITEMS = [];
  (async () => {
    ITEMS = await fetchData();
    renderGrid(ITEMS);
    syncFab();
  })();

  // ---- render grid (icons only) ----
  function renderGrid(items){
    grid.innerHTML = items.map(it => {
      const name = SHOW_NAMES ? `<div class="inv-name">${it.name}</div>` : '';
      const price = SHOW_PRICES ? `<div class="inv-price">${money(it.price)}</div>` : '';
      const icon = it.icon ? `<img src="${it.icon}" alt="${it.name}" loading="lazy">` : '';
      return `
        <button class="inv-card" data-id="${it.id}" aria-label="${it.name}">
          ${icon}
          ${name}
          ${price}
        </button>
      `;
    }).join('');
    // attach handlers
    $$('.inv-card', grid).forEach(btn=>{
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const it = ITEMS.find(x=>x.id===id);
        openModal(it);
      });
    });
  }

  // ---- modal / add to cart ----
  let currentItem = null;

  function openModal(it){
    currentItem = it;
    mIcon.src = it.icon || '/img/icons/pos.svg';
    mIcon.alt = it.name;
    mName.textContent = it.name;
    const metaParts = [];
    if (it.brand) metaParts.push(it.brand);
    if (it.vitola) metaParts.push(it.vitola);
    mMeta.textContent = metaParts.join(' • ');
    mPrice.textContent = `Price: ${money(it.price)}`;
    mQty.value = 1;
    modal.showModal();
    mQty.focus();
  }

  function closeModal(){ modal.close(); currentItem = null; }

  mMinus.addEventListener('click', ()=>{ const v=Math.max(1, (parseInt(mQty.value||'1',10)-1)); mQty.value=v; });
  mPlus.addEventListener('click', ()=>{ const v=(parseInt(mQty.value||'1',10)+1); mQty.value=v; });
  mCancel.addEventListener('click', closeModal);
  modal.addEventListener('close', ()=>{ currentItem=null; });

  mAdd.addEventListener('click', ()=>{
    if(!currentItem) return;
    const qty = Math.max(1, parseInt(mQty.value||'1',10));
    const existing = cart.items.find(x=>x.id===currentItem.id);
    if (existing){
      existing.qty += qty;
    } else {
      cart.items.push({
        id: currentItem.id,
        name: currentItem.name,
        price: currentItem.price,
        qty,
        sku: currentItem.sku || '',
        icon: currentItem.icon || '',
        brand: currentItem.brand || '',
        vitola: currentItem.vitola || '',
        taxable: currentItem.taxable !== false
      });
    }
    saveCart(cart);
    syncFab();
    closeModal();
  });

  function syncFab(){
    const t = cartTotals(cart);
    fabQty.textContent = t.qty;
    fabSub.textContent = money(t.sub);
  }

  fabBtn.addEventListener('click', ()=>{
    // go to invoice; change if your invoice path differs
    window.location.href = '/invoice/';
  });

})();
