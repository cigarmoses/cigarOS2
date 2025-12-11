// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

let allRows = [];
let filteredRows = [];

// Helper: pick a field from multiple possible names
function getField(row, names) {
  if (!Array.isArray(names)) names = [names];

  for (const n of names) {
    // direct key
    if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];

    // case-insensitive key lookup
    const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

// Helper: brand text
function getBrand(row) {
  return getField(row, ["brand", "Brand", "BRAND"]);
}

// Build a deduped, sorted brand list from cigar rows
function buildBrandList(rows) {
  const map = new Map();

  rows.forEach(row => {
    const brandRaw = getBrand(row);
    const brandName = (brandRaw || "").toString().trim();
    if (!brandName) return;

    const key = brandName.toLowerCase();
    if (map.has(key)) return;

    // Try to find an explicit icon field
    let icon = getField(row, [
      "brandImg300",
      "Brand Img 300",
      "BRAND IMG 300",
      "brandImg",
      "Brand Img",
      "BRAND IMG",
      "brand_icon",
      "Brand Icon"
    ]);

    // If none, derive from slug / brand
    if (!icon) {
      let slug = getField(row, ["brandSlug", "Brand Slug"]);
      if (!slug) {
        slug = brandName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .trim();
      }
      if (slug) icon = `/img/icons/brands/${slug}.svg`;
    }

    map.set(key, {
      brand: brandName,
      icon
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" })
  );
}

// Render brand tiles into #brands-grid
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

// Wire up the search bar
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
        const nameText = getField(row, ["name", "Name", "Cigar", "Cigar Name"])
          .toString()
          .toLowerCase();
        const vitolaText = getField(row, ["vitola", "Vitola"])
          .toString()
          .toLowerCase();

        return (
          brandText.includes(q) ||
          nameText.includes(q) ||
          vitolaText.includes(q)
        );
      });
    }

    renderBrands();
  });
}

// Load hub → render brands → wire search
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
