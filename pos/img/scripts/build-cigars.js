// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

// Try a few common container selectors so it "just works" with your layout.
// If you want to be explicit, give your grid <div data-brand-grid> in the HTML.
function getBrandGridContainer() {
  return (
    document.querySelector("[data-brand-grid]") ||
    document.querySelector("#brands-grid") ||
    document.querySelector("#brand-grid") ||
    document.querySelector(".brands-grid") ||
    document.querySelector(".pos-grid") ||
    document.body
  );
}

async function loadHub() {
  const res = await fetch(HUB_URL);
  if (!res.ok) {
    console.error("Failed to load hub:", res.status, res.statusText);
    return [];
  }
  try {
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("Hub JSON is not an array");
      return [];
    }
    return data;
  } catch (err) {
    console.error("Error parsing hub JSON:", err);
    return [];
  }
}

// Build a unique list of brands from the hub data
function buildBrandIndex(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (!row) return;

    const brand = row.Brand || row.brand;
    if (!brand) return;

    if (!map.has(brand)) {
      map.set(brand, {
        brand,
        manufacturer: row.MANUFACTURER || row.Manufacturer || "",
        img: row["Brand IMG"] || row.brand_img || null,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.brand.localeCompare(b.brand)
  );
}

// Create a single brand tile (icon + label, clickable)
function createBrandTile(brandObj) {
  const { brand, img } = brandObj;

  const link = document.createElement("a");
  link.className = "brand-tile";
  link.href = `/pos/cigars/brand.html?brand=${encodeURIComponent(brand)}`;
  link.setAttribute("data-brand-name", brand);

  const wrapper = document.createElement("div");
  wrapper.className = "brand-tile-inner";

  const icon = document.createElement("img");
  icon.className = "brand-tile-icon";

  if (img) {
    // Expecting values like "aladino.svg" already in the hub
    icon.src = `/img/icons/brands/${img}`;
  } else {
    // Fallback – blank icon box
    icon.src = "/img/icons/brands/_placeholder.svg";
  }

  icon.alt = brand;

  const label = document.createElement("div");
  label.className = "brand-tile-label";
  label.textContent = brand;

  wrapper.appendChild(icon);
  wrapper.appendChild(label);
  link.appendChild(wrapper);
  return link;
}

// Render all brands into the grid container
function renderBrands(brandList) {
  const container = getBrandGridContainer();
  if (!container) {
    console.error("No container found for brand grid.");
    return;
  }

  container.innerHTML = ""; // clear anything existing

  brandList.forEach((b) => {
    const tile = createBrandTile(b);
    container.appendChild(tile);
  });
}

async function initCigarBrandGrid() {
  const rows = await loadHub();
  if (!rows.length) return;

  const brands = buildBrandIndex(rows);
  renderBrands(brands);
}

// Kick everything off once the DOM is ready
document.addEventListener("DOMContentLoaded", initCigarBrandGrid);
