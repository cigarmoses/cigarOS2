import { addToCart } from "../cart.js";

const grid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");

let PRODUCTS = [];

// ---------- LOAD JSON ----------
async function loadProducts(){
  try{
    const res = await fetch("/pos/products/products.json");
    PRODUCTS = await res.json();

    render(PRODUCTS);

  }catch(e){
    grid.innerHTML = `<div style="color:red">Failed to load products</div>`;
    console.error(e);
  }
}

// ---------- RENDER ----------
function render(list){
  grid.innerHTML = "";

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "pos-card";

    el.innerHTML = `
      <div class="pos-name">${p.name}</div>
      <div class="pos-price">$${p.price}</div>
    `;

    el.onclick = () => {
      addToCart({
        id: p.id,
        name: p.name,
        price: p.price
      });
    };

    grid.appendChild(el);
  });
}

// ---------- SEARCH ----------
if(searchInput){
  searchInput.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();

    render(PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q)
    ));
  });
}

loadProducts();
