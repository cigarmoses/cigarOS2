// UNIVERSAL INVENTORY ENGINE
// Read config, render grid, show qty modal, manage FAB, add to Cart (shared).

(() => {
  const $ = s => document.querySelector(s);
  const fmt = n => `$${(Math.round(n*100)/100).toFixed(2)}`;

  // ----- Read inline JSON config -----
  const CONFIG = (() => {
    try {
      const node = document.getElementById('inv-config');
      return node ? JSON.parse(node.textContent) : {};
    } catch { return {}; }
  })();

  const {
    title = 'Inventory',
    grid = '3up',              // '2up' or '3up'
    showNames = false,         // show caption under icon
    showPrices = true,         // show price under icon
    iconPath = '/img/icons/',  // base path for icons
    data = [],                 // inline items (optional)
    dataUrl = '',              // OR external JSON file
    taxRate = 0.07             // default 7%
  } = CONFIG;

  // ----- Helpers -----
  function icon(src){
    const img = document.createElement('img');
    img.src = src; img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = '/img/icons/pos.svg'; };
    return img;
  }

  function getCartSnapshot(){
    let count = 0, subtotal = 0;
    try{
      const list = (window.Cart && (Cart.items || (Cart.getItems && Cart.getItems()))) ||
                   JSON.parse(localStorage.getItem('cart') || localStorage.getItem('pos_cart') || '[]');
      const arr = Array.isArray(list) ? list : (Array.isArray(list?.list) ? list.list : []);
      arr.forEach(it => { const q = Number(it.qty||1), p = Number(it.price||0); count += q; subtotal += q*p; });
    }catch(e){}
    return { count, subtotal };
  }

  // Toast
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
      background:#111827;color:#fff;padding:10px 20px;border-radius:20px;
      font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,.3); z-index:99; opacity:0; transition:opacity .3s;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = 1));
    setTimeout(() => { toast.style.opacity = 0; setTimeout(() => toast.remove(), 400); }, 1300);
  }

  // ----- Build shell -----
  document.title = `${title} · Smoke POS`;

  const wrap = document.createElement('main');
  wrap.className = 'page';

  wrap.innerHTML = `
    <header class="topbar">
      <a href="${CONFIG.backHref || '/pos/'}" class="topbar-back" aria-label="Back">←</a>
      <h1 class="topbar-title">${title}</h1>
      <span class="topbar-spacer"></span>
    </header>

    <section class="inv-wrap">
      <div class="inv-grid ${grid === '2up' ? 'inv-2up' : 'inv-3up'}" id="invGrid"></div>
    </section>

    <button id="fabCart" class="fab">
      <img src="/img/icons/pos.svg" alt="" />
      <span class="fab-badge" id="fabCount">0</span>
      <span class="fab-sub"   id="fabSub">$0.00</span>
    </button>

    <dialog id="qtyModal" class="qty-modal">
      <form method="dialog" class="modal-card" id="qtyForm">
        <div class="m-head">
          <img id="mIcon" alt="" />
          <div class="m-title">
            <h3 id="mName">—</h3>
            <div id="mPrice" class="muted">$0.00</div>
          </div>
        </div>
        <div class="qty-row">
          <button type="button" class="step" id="minus">−</button>
          <input type="number" id="qty" value="1" min="1" inputmode="numeric" />
          <button type="button" class="step" id="plus">+</button>
        </div>
        <menu class="m-actions">
          <button class="btn btn-light" value="cancel">Cancel</button>
          <button class="btn btn-primary" id="addBtn" value="default">Add to Bill</button>
        </menu>
      </form>
    </dialog>
  `;
  document.body.appendChild(wrap);

  // ----- FAB logic -----
  function updateFab(){
    const { count, subtotal } = getCartSnapshot();
    document.getElementById('fabCount').textContent = String(count);
    document.getElementById('fabSub').textContent   = fmt(subtotal);
  }
  document.getElementById('fabCart').addEventListener('click', () => location.href = '/invoice/');
  window.addEventListener('cart:updated', updateFab);

  // ----- Qty modal -----
  const modal = document.getElementById('qtyModal');
  const qtyInput = document.getElementById('qty');
  let activeItem = null;

  document.getElementById('minus').addEventListener('click', () => {
    const n = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
    qtyInput.value = String(n);
  });
  document.getElementById('plus').addEventListener('click', () => {
    const n = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
    qtyInput.value = String(n);
  });
  document.getElementById('addBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const q = Math.max(1, parseInt(qtyInput.value || '1', 10));
    if (activeItem){
      Cart?.setTaxRate?.(taxRate);
      Cart?.addItem?.(activeItem, q);
      window.dispatchEvent(new Event('cart:updated'));
      showToast(`${activeItem.name} ×${q} added`);
    }
    modal.close();
  });

  // ----- Render grid -----
  function render(list){
    const host = document.getElementById('invGrid');
    host.innerHTML = '';
    list.forEach(it => {
      const card = document.createElement('div');
      card.className = 'inv-card';

      const img = icon(it.icon || (iconPath + (it.iconFile || '')));
      card.appendChild(img);

      if (showNames) {
        const nm = document.createElement('div');
        nm.className = 'inv-name';
        nm.textContent = it.name || it.sku || 'Item';
        card.appendChild(nm);
      }
      if (showPrices) {
        const pr = document.createElement('div');
        pr.className = 'inv-price';
        pr.textContent = fmt(Number(it.price || 0));
        card.appendChild(pr);
      }

      card.addEventListener('click', () => {
        activeItem = {
          id: it.id || it.sku || it.name,
          sku: it.sku || it.id || '',
          name: it.name || 'Item',
          category: title,
          price: Number(it.price || 0),
          icon: it.icon || (iconPath + (it.iconFile || '')),
          taxable: it.taxable !== false,
          // cigar-specific optional fields (carried through to invoice, if used)
          brand: it.brand, vitola: it.vitola, length: it.length, ring: it.ring,
          wrapper: it.wrapper, binder: it.binder, filler: it.filler, origin: it.origin, strength: it.strength
        };
        document.getElementById('mIcon').src = activeItem.icon || '/img/icons/pos.svg';
        document.getElementById('mName').textContent = activeItem.name;
        document.getElementById('mPrice').textContent = fmt(activeItem.price);
        qtyInput.value = '1';
        modal.showModal();
      });

      host.appendChild(card);
    });
  }

  async function loadData(){
    try{
      if (dataUrl){
        const res = await fetch(dataUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('no data file');
        const json = await res.json();
        return Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
      }
      return data;
    }catch{ return data; }
  }

  (async () => {
    Cart?.setTaxRate?.(taxRate);
    updateFab();
    const list = await loadData();
    render(list || []);
  })();
})();
