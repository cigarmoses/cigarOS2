// --- Helpers ---
const $ = s => document.querySelector(s);
const fmt = n => `$${(Math.round(n*100)/100).toFixed(2)}`;

function icon(src){
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.onerror = () => { img.onerror = null; img.src = '/img/icons/pos.svg'; };
  return img;
}

// --- Prices ---
const P = { default: 1.50, water: 1.00, monstertea: 3.50 };

// --- Catalog mapped to your exact filenames ---
const items = [
  { id:'bev-7up',          sku:'7up',          name:'7 UP',            icon:'/img/icons/foodandbevs/7up.svg',          price:P.default,    taxable:true },
  { id:'bev-cocacola',     sku:'cocacola',     name:'Coca-Cola',       icon:'/img/icons/foodandbevs/cocacola.svg',     price:P.default,    taxable:true },
  { id:'bev-cocacolazero', sku:'cocacolazero', name:'Coca-Cola Zero',  icon:'/img/icons/foodandbevs/cocacolazero.svg', price:P.default,    taxable:true },
  { id:'bev-dietcoke',     sku:'dietcoke',     name:'Diet Coke',       icon:'/img/icons/foodandbevs/dietcoke.svg',     price:P.default,    taxable:true },
  { id:'bev-dietdrpepper', sku:'dietdrpepper', name:'Diet Dr Pepper',  icon:'/img/icons/foodandbevs/dietdrpepper.svg', price:P.default,    taxable:true },
  { id:'bev-drpepper',     sku:'drpepper',     name:'Dr Pepper',       icon:'/img/icons/foodandbevs/drpepper.svg',     price:P.default,    taxable:true },
  { id:'bev-gingerale',    sku:'gingerale',    name:'Ginger Ale',      icon:'/img/icons/foodandbevs/gingerale.svg',    price:P.default,    taxable:true },
  { id:'bev-monstertea',   sku:'monstertea',   name:'Monster Tea',     icon:'/img/icons/foodandbevs/monstertea.svg',   price:P.monstertea, taxable:true },
  { id:'bev-pepsi',        sku:'pepsi',        name:'Pepsi',           icon:'/img/icons/foodandbevs/pepsi.svg',        price:P.default,    taxable:true },
  { id:'bev-rootbeer',     sku:'rootbeer',     name:'Root Beer',       icon:'/img/icons/foodandbevs/rootbeer.svg',     price:P.default,    taxable:true },
  { id:'bev-sprite',       sku:'sprite',       name:'Sprite',          icon:'/img/icons/foodandbevs/sprite.svg',       price:P.default,    taxable:true },
  { id:'bev-water',        sku:'water',        name:'Water',           icon:'/img/icons/foodandbevs/water.svg',        price:P.water,      taxable:true }
];

// ---------- Floating Bill Tab ----------
function getCartSnapshot(){
  // Best-effort snapshot to power the FAB (works with our Cart.js or falls back to localStorage guesses)
  let count = 0, subtotal = 0;
  try{
    const list = (window.Cart && (Cart.items || (Cart.getItems && Cart.getItems()))) ||
                 JSON.parse(localStorage.getItem('cart') || localStorage.getItem('pos_cart') || '[]');
    const arr = Array.isArray(list) ? list : (Array.isArray(list?.list) ? list.list : []);
    arr.forEach(it => {
      const q = Number(it.qty || 1), p = Number(it.price || 0);
      count += q; subtotal += q * p;
    });
  }catch(e){}
  return { count, subtotal };
}

function updateFab(){
  const { count, subtotal } = getCartSnapshot();
  $('#fabCount').textContent = String(count);
  $('#fabSub').textContent   = fmt(subtotal);
}

function initFab(){
  const fab = $('#fabCart');
  fab.addEventListener('click', () => {
    // Take user to the invoice
    location.href = '/invoice/';
  });
  updateFab();
}

// Emit a lightweight event when we add items so the FAB updates immediately
function emitCartUpdated(){ window.dispatchEvent(new Event('cart:updated')); }
window.addEventListener('cart:updated', updateFab);

// ---------- Quantity Modal ----------
const modal = $('#qtyModal');
const qtyInput = $('#qty');
const btnMinus = $('#minus');
const btnPlus  = $('#plus');
const addBtn   = $('#addBtn');
let activeItem = null;

function openQtyModal(item){
  activeItem = item;
  $('#mIcon').src = item.icon || '/img/icons/pos.svg';
  $('#mName').textContent = item.name;
  $('#mPrice').textContent = fmt(item.price);
  qtyInput.value = '1'; // default qty
  modal.showModal();
}

btnMinus.addEventListener('click', () => {
  const n = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
  qtyInput.value = String(n);
});
btnPlus.addEventListener('click', () => {
  const n = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
  qtyInput.value = String(n);
});
addBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const q = Math.max(1, parseInt(qtyInput.value || '1', 10));
  if (activeItem){
    Cart?.addItem(activeItem, q);  // shared cart
    emitCartUpdated();
  }
  modal.close();
});

// ---------- Grid Rendering ----------
function renderBevs(){
  const host = $('#bevGrid');
  host.innerHTML = '';
  items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'bev-card';

    card.appendChild(icon(it.icon));

    const price = document.createElement('div');
    price.className = 'bev-price';
    price.textContent = fmt(it.price);
    card.appendChild(price);

    card.addEventListener('click', () => openQtyModal(it));

    host.appendChild(card);
  });
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  Cart?.setTaxRate?.(0.07);   // keep 7% standard
  renderBevs();
  initFab();
  updateFab();
});
