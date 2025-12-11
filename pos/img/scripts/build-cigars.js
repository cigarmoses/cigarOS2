// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

let allRows = [];
let filteredRows = [];

// -------------------------------------
// Helpers
// -------------------------------------

// Safely grab a field by trying multiple possible column names
function getField(row, names) {
  if (!Array.isArray(names)) names = [names];

  for (const n of names) {
    if (!n) continue;

    // exact key
    if (row[n] !== undefined && row[n] !== null && row[n] !== "") {
      return row[n];
    }

    // case-insensitive key match
    const key = Object.keys(row).find(
      k => k.toLowerCase() === n.toLowerCase()
    );
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function getBrand(row) {
  return getField(row, ["Brand", "brand", "BRAND"]);
}

function getLine(row) {
  return getField(row, ["Line", "line"]);
}

function getCigarName(row) {
  return getField(row, ["Cigar Name", "Cigar", "cigar", "name", "Name"]);
}

function getVitola(row) {
  return getField(row, ["Vitola", "vitola"]);
}

// image coming from your Google Sheets export (300x300 SVG/PNG)
function getBrandIcon(row) {
  return getField(row, [
    "Brand Img 300",
    "brandImg300",
    "Brand Img",
    "brandImg",
    "Brand Icon",
    "brand_icon"
  ]);
}

// Build a unique brand list from the *filtered* rows
function buildBrandList(rows) {
  const map = new Map();

  rows.forEach(row => {
    const brandRaw = getBrand(row);
    const brandName = (brandRaw || "").toString().trim();
    if (!brandName) return;

    const key = brandName.toLowerCase();
    if (map.has(key)) return;

    const icon = getBrandIcon(row) || "";

    map.set(key, {
      brand: brandName,
      icon
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" })
  );
}

// -------------------------------------
// Rendering
// -------------------------------------

function renderBrands() {
  const grid = document.getElementById("brands-grid");
  if (!grid) return;

  const brands = buildBrandList(filteredRows);
  grid.innerHTML = "";

  if (!brands.length) {
    grid.innerHTML = `<p class="cigars-empty">No cigars match your search yet.</p>`;
    return;
  }

  brands.forEach(item => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "brand-tile";

    tile.addEventListener("click", () => {
      const url = `/pos/cigars/brand.html?brand=${encodeURIComponent(
        item.brand
      )}`;
      window.location.href = url;
    });

    tile.innerHTML = `
      <div class="brand-tile-inner">
        ${
          item.icon
            ? `<img src="${item.icon}" alt="${item.brand}" class="brand-tile-img" />`
            : ""
        }
        <div class="brand-tile-name">${item.brand}</div>
      </div>
    `;

    grid.appendChild(tile);
  });
}

// -------------------------------------
// Search logic
// -------------------------------------

function wireSearch() {
  const input = document.getElementById("cigars-search-input");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    if (!q) {
      filteredRows = [...allRows];
    } else {
      filteredRows = allRows.filter(row => {
        const brandText = (getBrand(row) || "").toString().toLowerCase();
        const lineText = (getLine(row) || "").toString().toLowerCase();
        const cigarText = (getCigarName(row) || "").toString().toLowerCase();
        const vitolaText = (getVitola(row) || "").toString().toLowerCase();

        const haystack = `${brandText} ${lineText} ${cigarText} ${vitolaText}`;
        return haystack.includes(q);
      });
    }

    renderBrands();
  });
}

// -------------------------------------
// Init
// -------------------------------------

async function loadHubAndRender() {
  try {
    const res = await fetch(HUB_URL);
    if (!res.ok) throw new Error("Hub failed to load");

    const data = await res.json();
    allRows = Array.isArray(data) ? data : [];
    filteredRows = [...allRows];

    renderBrands();
    wireSearch();
  } catch (err) {
    console.error("Error loading hub:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadHubAndRender);
