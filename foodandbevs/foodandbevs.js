/* Food & Beverages: pure SVG grid (no captions), qty modal, add-to-bill, FAB totals */

(function(){
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));
  const money = n => `$${(+n).toFixed(2)}`;

  /* ---- Config ---- */
  const cfg = JSON.parse(($('#bev-config')?.textContent)||'{}');
  const ICON_PATH = cfg.iconPath || '/img/icons/foodandbevs/';
  const ITEMS = cfg.items || [];
  const TAX = typeof cfg.taxRate==='number' ? cfg.taxRate : 0.07;

  /* ---- Cart (shared) ---- */
  const CART_KEY='smoke_cart_v1';
  const load=()=>{ try{ return JSON.parse(localStorage.getItem(CART_KEY))||{items:[],taxRate:TAX}; }catch(e){ return {items:[],taxRate:TAX}; } };
  const save=c=>localStorage.setItem(CART_KEY, JSON.stringify(c));
  const cart=load(); cart.taxRate=TAX;
  const totals=c=>{
    const sub=c.items.reduce((s,i)=>s+i.price*i.qty,0);
    const qty=c.items.reduce((s,i)=>s+i.qty,0);
    return {sub, qty};
  };

  /* ---- FAB ---- */
  const fabBtn=$('#fabBtn'), fabQty=$('#fabQty'), fabSub=$('#fabSub');
  function syncFab(){ const t=totals(cart); fabQty.textContent=t.qty; fabSub.textContent=money(t.sub); }
  fabBtn?.addEventListener('click', ()=>window.location.href='/invoice/');

  /* ---- Render grid ---- */
  const grid = $('#bevGrid');
  function render(){
    grid.innerHTML = ITEMS.map(it => `
      <button class="icon-cell" data-id="${it.id}" title="${it.name}" aria-label="${it.name}">
        <img src="${ICON_PATH + it.iconFile}" alt="${it.name}" loading="lazy">
      </button>
    `).join('');

    $$('.icon-cell', grid).forEach(btn=>{
      btn.addEventListener('click', ()=>openQty(btn.dataset.id));
    });
  }

  /* ---- Qty dialog ---- */
  const dlg = $('#qtyDialog');
  const qdName = $('#qdName'), qdImg = $('#qdImg'), qdPrice = $('#qdPrice');
  const qMinus = $('#qMinus'), qPlus = $('#qPlus'), qInput = $('#qInput'), qAdd = $('#qAdd');
  const qClose = $('#qdClose');

  let active = null;

  function openQty(id){
    const it = ITEMS.find(x=>x.id===id);
    if(!it) return;
    active = it;

    qdName.textContent = it.name;
    qdImg.src = ICON_PATH + it.iconFile;
    qdImg.alt = it.name;
    qdPrice.textContent = money(it.price);
    qInput.value = 1;

    dlg.showModal();
  }

  qMinus.addEventListener('click', ()=> qInput.value = Math.max(1, (+qInput.value||1)-1) );
  qPlus.addEventListener('click',  ()=> qInput.value = (+qInput.value||1)+1 );
  qClose.addEventListener('click', ()=> dlg.close() );

  qAdd.addEventListener('click', ()=>{
    if(!active) return;
    const qty = Math.max(1, parseInt(qInput.value||'1',10));
    const found = cart.items.find(x=>x.id===active.id);
    if(found){ found.qty += qty; }
    else{
      cart.items.push({
        id: active.id,
        name: active.name,
        price: +active.price,
        qty,
        icon: ICON_PATH + active.iconFile,
        brand: 'Food & Beverages',
        vitola: '',
        taxable: true
      });
    }
    save(cart); syncFab(); dlg.close();
  });

  /* ---- Boot ---- */
  render(); syncFab();
})();
