/* ====================================
   Food & Beverages POS — Logic
   ==================================== */

// 1) Catalog — all $1.50 as requested
const PRICE = 1.50;
const items = [
  { id:'7up',          name:'7 UP',             icon:'/img/icons/foodandbevs/7up.svg',          price:PRICE },
  { id:'cocacola',     name:'Coca-Cola',        icon:'/img/icons/foodandbevs/cocacola.svg',     price:PRICE },
  { id:'cocacolazero', name:'Coca-Cola Zero',   icon:'/img/icons/foodandbevs/cocacolazero.svg', price:PRICE },
  { id:'drpepper',     name:'Dr Pepper',        icon:'/img/icons/foodandbevs/drpepper.svg',     price:PRICE },
  { id:'dietdrpepper', name:'Diet Dr Pepper',   icon:'/img/icons/foodandbevs/dietdrpepper.svg', price:PRICE },
  { id:'gingerale',    name:'Ginger Ale',       icon:'/img/icons/foodandbevs/gingerale.svg',    price:PRICE },
  { id:'monstertea',   name:'Monster Tea',      icon:'/img/icons/foodandbevs/monstertea.svg',   price:PRICE },
  { id:'pepsi',        name:'Pepsi',            icon:'/img/icons/foodandbevs/pepsi.svg',        price:PRICE },
  { id:'rootbeer',     name:'Root Beer',        icon:'/img/icons/foodandbevs/rootbeer.svg',     price:PRICE },
  { id:'sprite',       name:'Sprite',           icon:'/img/icons/foodandbevs/sprite.svg',       price:PRICE },
];

// 2) State
const TAX_RATE = 0.07; // 7%
let cart = {}; // { id: { id, name, price, icon, qty } }

// 3) Helpers
const $ = sel => document.querySelector(sel);
const format = n => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// Persist cart per session
const saveCart = () => sessionStorage.setItem('bevCart', JSON.stringify(cart));
const loadCart = () => {
  try { cart = JSON.parse(sessionStorage.getItem('bevCart') || '{}'); } catch { cart = {}; }
};

// 4) Render beverages grid
function renderGrid(){
  const host = $('#bevGrid');
  host.innerHTML = '';
  items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'bev-card';
    card.innerHTML = `
      <img src="${it.icon}" alt="${it.name}" />
      <span class="bev-name">${it.name}</span>
      <span class="bev-price">${format(it.price)}</span>
    `;
    card.addEventListener('click', () => addToCart(it.id));
    host.appendChild(card);
  });
}

// 5) Cart operations
function addToCart(id){
  const it = items.find(x => x.id === id);
  if (!it) return;
  if (!cart[id]) cart[id] = { ...it, qty: 0 };
  cart[id].qty += 1;
  saveCart();
  renderCart();
}

function inc(id){ if (cart[id]) { cart[id].qty++; if (cart[id].qty <= 0) delete cart[id]; saveCart(); renderCart(); } }
function dec(id){ if (cart[id]) { cart[id].qty--; if (cart[id].qty <= 0) delete cart[id]; saveCart(); renderCart(); } }
function removeLine(id){ if (cart[id]) { delete cart[id]; saveCart(); renderCart(); } }
function clearCart(){ cart = {}; saveCart(); renderCart(); }

// 6) Render cart + totals
function renderCart(){
  const host = $('#cartItems');
  host.innerHTML = '';

  const ids = Object.keys(cart);
  if (!ids.length){
    host.innerHTML = `<div class="empty">Tap a drink to add it to the order.</div>`;
    $('#subtotal').textContent = '$0.00';
    $('#tax').textContent = '$0.00';
    $('#total').textContent = '$0.00';
    $('#checkout').disabled = true;
    return;
  }

  let subtotal = 0;

  ids.forEach(id => {
    const line = cart[id];
    const lineTotal = line.qty * line.price;
    subtotal += lineTotal;

    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <img class="cart-thumb" src="${line.icon}" alt="${line.name}" />
      <div class="cart-title">
        <span class="name">${line.name}</span>
        <span class="unit">${format(line.price)} ea</span>
        <div class="cart-qty">
          <button class="qty-btn" aria-label="decrease">−</button>
          <span class="qty-num">${line.qty}</span>
          <button class="qty-btn" aria-label="increase">+</button>
          <button class="qty-btn" aria-label="remove" title="Remove">×</button>
        </div>
      </div>
      <div class="cart-line-total">${format(lineTotal)}</div>
    `;

    const [decBtn, , incBtn, rmBtn] = row.querySelectorAll('.qty-btn');
    decBtn.addEventListener('click', () => dec(id));
    incBtn.addEventListener('click', () => inc(id));
    rmBtn.addEventListener('click', () => removeLine(id));

    host.appendChild(row);
  });

  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  $('#subtotal').textContent = format(subtotal);
  $('#tax').textContent = format(tax);
  $('#total').textContent = format(total);
  $('#checkout').disabled = false;
}

// 7) Checkout stub
function checkout(){
  const payload = {
    items: Object.values(cart).map(l => ({ id:l.id, name:l.name, qty:l.qty, unit:l.price, line:l.qty*l.price })),
    subtotal: $('#subtotal').textContent,
    tax: $('#tax').textContent,
    total: $('#total').textContent,
    taxRate: TAX_RATE
  };
  // Replace alert with your POS handoff
  alert('Checkout payload:\n' + JSON.stringify(payload, null, 2));
}

// 8) Wire up
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  renderGrid();
  renderCart();
  $('#clearCart').addEventListener('click', clearCart);
  $('#checkout').addEventListener('click', checkout);
});
