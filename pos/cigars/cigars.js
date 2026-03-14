/* cigars.js
   CigarOS POS – fast cigar loader
   - Google Sheet CSV
   - 24hr cache
   - instant brand rendering
*/

const CSV_URL =
"https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/export?format=csv";

const CACHE_KEY = "cigar_sheet_cache";
const CACHE_TIME = 24 * 60 * 60 * 1000;

let DATA_ROWS = [];

const cigarsList = document.getElementById("cigarsList");
const searchInput = document.getElementById("cigars-search-input");

function showError() {
  cigarsList.innerHTML =
    `<div style="opacity:.7;font-size:18px;padding:30px 0;">
      Unable to load cigars right now.
     </div>`;
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines.shift().split(",");

  return lines.map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h,i) => obj[h.trim()] = values[i]?.trim());
    return obj;
  });
}

async function fetchSheet() {

  try {

    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      const data = JSON.parse(cached);

      if (Date.now() - data.time < CACHE_TIME) {
        return data.rows;
      }
    }

    const res = await fetch(CSV_URL);

    if (!res.ok) throw new Error("Sheet fetch failed");

    const text = await res.text();
    const rows = parseCSV(text);

    localStorage.setItem(CACHE_KEY,
      JSON.stringify({
        time: Date.now(),
        rows
      })
    );

    return rows;

  } catch (e) {

    console.warn("Sheet load failed:", e);

    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      return JSON.parse(cached).rows;
    }

    throw e;
  }
}

function getBrands(rows) {

  const set = new Set();

  rows.forEach(r => {
    if (r.Brand) set.add(r.Brand);
  });

  return [...set].sort();
}

function renderBrands(brands) {

  cigarsList.innerHTML = "";

  brands.forEach(brand => {

    const card = document.createElement("a");

    card.href = `/pos/cigars/brand?brand=${encodeURIComponent(brand)}`;

    card.className = "brand-card";

    card.innerHTML =
    `
      <div class="brand-tile">
        <span>${brand}</span>
      </div>
    `;

    cigarsList.appendChild(card);

  });
}

function applySearch(brands) {

  if (!searchInput) return;

  searchInput.addEventListener("input", e => {

    const q = e.target.value.toLowerCase();

    const filtered = brands.filter(b =>
      b.toLowerCase().includes(q)
    );

    renderBrands(filtered);

  });
}

async function init() {

  try {

    DATA_ROWS = await fetchSheet();

    if (!DATA_ROWS.length) {
      showError();
      return;
    }

    const brands = getBrands(DATA_ROWS);

    renderBrands(brands);

    applySearch(brands);

  } catch (e) {

    console.error(e);
    showError();

  }

}

document.addEventListener("DOMContentLoaded", init);
