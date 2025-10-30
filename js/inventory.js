/* =========  Universal Inventory Engine (icons-only + modal + FAB + ripple)  ========= */
(function(){
  const $ = (s, c=document)=>c.querySelector(s);
  const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));
  const money = n => `$${(+n).toFixed(2)}`;

  // Config
  const cfgEl = $('#inv-config'); if(!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent||'{}');
  const TITLE = cfg.title || 'Inventory';
  const BACK = cfg.backHref || '/';
  const ICON_PATH = cfg.iconPath || '';
  const TAX = typeof cfg.taxRate==='number' ? cfg.taxRate : 0.07;

  // Cart
  const CART_KEY='smoke_cart_v1';
  const load=()=>{ try{ return JSON.parse(localStorage.getItem(CART_KEY))||{items:[],taxRate:TAX}; }catch(e){ return {items:[],taxRate:TAX}; } };
  const save=c=>localStorage.setItem(CART_KEY, JSON.stringify(c));
  const cart=load(); cart.taxRate=TAX;
  const totals=c=>{
    const sub=c.items.reduce((s,i)=>s+i.price*i.qty,0);
    const tax=+(sub*c.taxRate).toFixed(2);
    const total=+(sub+tax).toFixed(2);
    const qty=c.items.reduce((s,i)=>s+i.qty,0);
    return {sub,tax,total,qty};
  };

  // Base DOM
  document.body.insertAdjacentHTML('afterbegin', `
    <main class="inv-wrap">
      <header class="topbar">
        <a class="topbar-back" href="${BACK}" aria-label="Back">←</a>
        <h1 class="topbar-title">${TITLE}</h1>
      </header>
      <section id="invGrid"></section>
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
  const mIcon=$('#mIcon'), mName=$('#mName'), mMeta=$('#mMeta'), mPrice=$('#mPrice');
  const mMinus=$('#mMinus'), mPlus=$('#mPlus'), mQty=$('#mQty'), mAdd=$('#mAdd'), mCancel=$('#mCancel');
  const fabBtn=$('#fabBtn'), fabQty=$('#fabQty'), fabSub=$('#fabSub');

  // Data
  const normalize = r=>{
    const icon = r.icon ? r.icon : (r.iconFile ? (ICON_PATH + r.iconFile) : '');
    return {
      id: r.id || r.sku || crypto.randomUUID(),
      sku: r.sku || r.id || '',
      name: r.name || 'Item',
      brand: r.brand || '',
      vitola: r.vitola || '',
      price: typeof r.price==='number' ? r.price : parseFloat(r.price||0),
      icon, taxable: r.taxable !== false
    };
  };

  async function getItems(){
    if(Array.isArray(cfg.data)) return cfg.data.map(normalize);
    if(cfg.dataUrl){ const res=await fetch(cfg.dataUrl,{cache:'no-store'}); return (await res.json()).map(normalize); }
    return [];
  }

  let ITEMS=[];
  (async ()=>{
    ITEMS = await getItems();
    render(ITEMS);
    syncFab();
  })();

  // Ripple
  function ripple(e, el){
    const r=document.createElement('span');
    r.className='ripple';
    const rect=el.getBoundingClientRect();
    const size=Math.max(rect.width, rect.height);
    r.style.width=r.style.height=size+'px';
    const x=e.clientX - rect.left - size/2;
    const y=e.clientY - rect.top - size/2;
    r.style.left=x+'px'; r.style.top=y+'px';
    el.appendChild(r);
    r.addEventListener('animationend', ()=>r.remove());
  }

  // Render
  function render(items){
    grid.innerHTML = items.map(it => `
      <button class="inv-card" data-id="${it.id}" aria-label="${it.name}" title="${it.name}">
        ${ it.icon ? `<img src="${it.icon}" alt="${it.name}" loading="lazy">` : '' }
      </button>
    `).join('');

    $$('.inv-card', grid).forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        ripple(e, btn);
        const id=btn.getAttribute('data-id');
        const it=ITEMS.find(x=>x.id===id);
        // open modal slightly after ripple begins
        setTimeout(()=>openModal(it), 80);
      });
    });
  }

  // Modal / cart
  let current=null;
  function openModal(it){
    current=it;
    mIcon.src = it.icon || '/img/icons/pos.svg';
    mIcon.alt = it.name;
    mName.textContent = it.name;
    const meta=[];
    if(it.brand) meta.push(it.brand);
    if(it.vitola) meta.push(it.vitola);
    mMeta.textContent = meta.join(' • ');
    mPrice.textContent = `Price: ${money(it.price)}`;
    mQty.value=1;
    modal.showModal();
    mQty.focus();
  }
  function closeModal(){ modal.close(); current=null; }

  mMinus.addEventListener('click', ()=> mQty.value = Math.max(1, (+mQty.value||1)-1) );
  mPlus.addEventListener('click', ()=> mQty.value = (+mQty.value||1)+1 );
  mCancel.addEventListener('click', closeModal);
  modal.addEventListener('close', ()=> current=null );

  mAdd.addEventListener('click', ()=>{
    if(!current) return;
    const qty=Math.max(1, parseInt(mQty.value||'1',10));
    const found=cart.items.find(x=>x.id===current.id);
    if(found){ found.qty += qty; }
    else{
      cart.items.push({
        id: current.id, name: current.name, price: current.price, qty,
        sku: current.sku || '', icon: current.icon || '',
        brand: current.brand || '', vitola: current.vitola || '',
        taxable: current.taxable !== false
      });
    }
    save(cart);
    syncFab();
    closeModal();
  });

  function syncFab(){
    const t=totals(cart);
    fabQty.textContent=t.qty;
    fabSub.textContent=money(t.sub);
  }

  fabBtn.addEventListener('click', ()=>{ window.location.href='/invoice/'; });
})();
