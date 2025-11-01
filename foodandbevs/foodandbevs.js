/* Food & Beverages page
   - 4-up grid
   - Icons stay at: /img/icons/foodandbevs/<slug>.svg
   - Price list = the one you provided
*/

const ITEMS = [
  { name: "7 Up", price: 1.50, slug: "7up" },
  { name: "Cocacola", price: 1.50, slug: "cocacola" },
  { name: "Coke Zero", price: 1.50, slug: "cokezero" },
  { name: "Diet Coke", price: 1.50, slug: "dietcoke" },
  { name: "Diet Dr. Pepper", price: 1.50, slug: "dietdrpepper" }, // period removed in slug
  { name: "Dr. Pepper", price: 1.50, slug: "drpepper" },
  { name: "Dunkin", price: 3.50, slug: "dunkin" },
  { name: "Gatorade", price: 3.50, slug: "gatorade" },
  { name: "Ginger Ale", price: 1.50, slug: "gingerale" },
  { name: "GP Sweet Tea", price: 1.50, slug: "gpsweettea" },
  { name: "GP Unsweetened Tea", price: 1.50, slug: "gpunsweetened" },
  { name: "GP Zero Sugar Sweet Tea", price: 1.50, slug: "gpzerosugarsweettea" },
  { name: "Monster Tea", price: 3.50, slug: "monstertea" },
  { name: "Mountain Dew", price: 1.50, slug: "mountaindew" },
  { name: "Pepsi", price: 1.50, slug: "pepsi" },
  { name: "Red Bull", price: 3.50, slug: "redbull" },
  { name: "Root Beer", price: 1.50, slug: "rootbeer" },
  { name: "Sprite", price: 1.50, slug: "sprite" },
  { name: "Starbucks", price: 3.50, slug: "starbucks" },
  { name: "Water", price: 1.50, slug: "water" }
];

const grid = document.getElementById("grid");
const cartPill = document.getElementById("cartPill");
const cartCountEl = document.getElementById("cartCount");
const cartTotalEl = document.getElementById("cartTotal");

const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetPrice = document.getElementById("sheetPrice");
const sheetSubtotal = document.getElementById("sheetSubtotal");
const qtyVal = document.getElementById("qtyVal");
const btnMinus = document.getElementById("btnMinus");
const btnPlus = document.getElementById("btnPlus");
const btnAddToBill = document.getElementById("btnAddToBill");

// Simple cart
let cartQty = 0;
let cartTotal = 0;

// Render grid (4-up)
function render() {
  const frag = document.createDocumentFragment();

  ITEMS.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "food-tile";

    const btn = document.createElement("button");
    btn.className = "food-tile__btn";
    btn.type = "button";
    btn.dataset.name = item.name;
    btn.dataset.price = String(item.price);

    const img = document.createElement("img");
    img.alt = item.name;

    // Keep your exact icon location
    img.src = `/img/icons/foodandbevs/${item.slug}.svg`;

    btn.appendChild(img);

    const label = document.createElement("div");
    label.className = "food-tile__label";
    label.textContent = item.name;

    const price = document.createElement("div");
    price.className = "food-tile__price";
    price.textContent = `$${item.price.toFixed(2)}`;

    wrap.append(btn, label, price);
    frag.appendChild(wrap);

    btn.addEventListener("click", () => openSheet(item));
  });

  grid.innerHTML = "";
  grid.appendChild(frag);
}

function openSheet(item) {
  currentItem = { ...item };
  currentQty = 1;

  sheetTitle.textContent = item.name;
  sheetPrice.textContent = `$${item.price.toFixed(2)}`;
  qtyVal.textContent = String(currentQty);
  sheetSubtotal.textContent = `$${(item.price * currentQty).toFixed(2)} subtotal`;

  sheet.classList.add("sheet--open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeSheet() {
  sheet.classList.remove("sheet--open");
  sheet.setAttribute("aria-hidden", "true");
}

let currentItem = null;
let currentQty = 1;

btnMinus.addEventListener("click", () => {
  if (currentQty > 1) {
    currentQty--;
    qtyVal.textContent = String(currentQty);
    sheetSubtotal.textContent = `$${(currentItem.price * currentQty).toFixed(2)} subtotal`;
  }
});

btnPlus.addEventListener("click", () => {
  currentQty++;
  qtyVal.textContent = String(currentQty);
  sheetSubtotal.textContent = `$${(currentItem.price * currentQty).toFixed(2)} subtotal`;
});

btnAddToBill.addEventListener("click", () => {
  const add = currentItem.price * currentQty;
  cartQty += currentQty;
  cartTotal += add;

  cartCountEl.textContent = String(cartQty);
  cartTotalEl.textContent = `$${cartTotal.toFixed(2)}`;

  closeSheet();
});

document.querySelectorAll("[data-close-sheet]").forEach(el =>
  el.addEventListener("click", closeSheet)
);

// Kick things off
render();
