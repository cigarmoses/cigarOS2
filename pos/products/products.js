import { addToCart } from "../cart.js";

const CSV_URL = "/data/products.csv";

const grid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");

let PRODUCTS = [];

// ---------- CSV ----------
function parseCSV(text){
  const rows = text.trim().split("\n");
  const headers = rows.shift().split(",").map(h => h.trim());

  return rows.map(row => {
    const values = row.split(",");
    const obj = {};
    headers.forEach((h,i)=> obj[h] = values[i]?.trim());
    return obj;
  });
}

// ---------- LOAD ----------
async function loadProducts(){
  try{
    const res = await fetch(CSV_URL);
    const text = await res.text();

    PRODUCTS = parseCSV(text);

    render(PRODUCTS);

  }catch(e){
    grid.innerHTML = `<div style="color:red">Error loading products</div>`;
  }
}

// ---------- RENDER ----------
function render(list){
  grid.innerHTML = "";

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "pos-card";

    el.innerHTML = `
      <div class="pos-name">${p.name || p.Name}</div>
      <div class="pos-price">$${p.price || p.Price}</div>
    `;

    el.onclick = () => {
      addToCart({
        id: p.id || p.ID || p.name,
        name: p.name || p.Name,
        price: parseFloat(p.price || p.Price)
      });
    };

    grid.appendChild(el);
  });
}

// ---------- SEARCH ----------
if(searchInput){
  searchInput.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();

    const filtered = PRODUCTS.filter(p =>
      (p.name || p.Name || "").toLowerCase().includes(q)
    );

    render(filtered);
  });
}

// ---------- INIT ----------
loadProducts();
