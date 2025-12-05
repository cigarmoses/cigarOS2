// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

let hubData = [];
let filteredData = [];
let activeFilters = {};
let currentFilterId = null;

// -------------------------------
// Helpers
// -------------------------------
function brandSlug(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// -------------------------------
// LOAD HUB
// -------------------------------
async function loadHub() {
  try {
    const res = await fetch(HUB_URL);
    if (!res.ok) throw new Error("Hub failed to load");

    hubData = await res.json();

    // Pre-clean: Ensure all text fields exist
    hubData = hubData.map((r) => ({
      Brand: r.Brand || "",
      Line: r.Line || "",
      Cigar: r.Cigar || "",
      Vitola: r.Vitola || "",
      Wrapper: r.Wrapper || "",
      Binder: r.Binder || "",
      Filler: r.Filler || "",
      WrapperShade: r["Wrapper Shade"] || "",
      Length: r.Length || "",
      RG: r.RG || "",
      MSRP: r.MSRP || "",
      "Brand IMG": r["Brand IMG"] || "",
    }));

    filteredData = [...hubData];

    // New: render brand tiles on the main Cigars page
    renderBrandsGrid();

    // Existing behavior: render cigar cards when a cigar grid is present
    renderCigarsGrid();
  } catch (err) {
    console.error("Error loading hub:", err);
  }
}

// -------------------------------
// RENDER BRAND GRID (main /pos/cigars/ page)
// -------------------------------
function renderBrandsGrid() {
  const container = document.getElementById("brands-grid");
  if (!container) return; // not on this page

  // Build a unique brand list with an icon per brand
  const brandMap = new Map();

  hubData.forEach((row) => {
    const brandName = (row.Brand || "").trim();
    if (!brandName) return;

    if (!brandMap.has(brandName)) {
      const imgFromHub = (row["Brand IMG"] || "").trim();
      // If Brand IMG is blank, fall back to slugified brand name
      const imgFile = imgFromHub || brandSlug(brandName) + ".svg";

      brandMap.set(brandName, {
        Brand: brandName,
        imgFile,
      });
    }
  });

  const brands = Array.from(brandMap.values()).sort((a, b) =>
    a.Brand.localeCompare(b.Brand)
  );

  container.innerHTML = "";

  brands.forEach((b) => {
    const brandName = b.Brand;
    const imgFile = b.imgFile || brandSlug(brandName) + ".svg";
    const href = `/pos/cigars/brand.html?brand=${encodeURIComponent(
      brandName
    )}`;

    const card = document.createElement("a");
    card.className = "brand-card";
    card.href = href;
    card.setAttribute("data-brand", brandName);

    card.innerHTML = `
      <div class="brand-card-inner">
        <div class="brand-card-icon-wrapper">
          <img class="brand-card-icon" src="/img/icons/brands/${imgFile}" alt="${brandName}">
        </div>
        <div class="brand-card-name">${brandName}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

// -------------------------------
// RENDER CIGAR GRID (used on brand pages or others)
// -------------------------------
function renderCigarsGrid() {
  // This is the old behavior: render individual cigars wherever
  // an element has [data-cigar-grid]. Brand pages can still use this.
  const container = document.querySelector("[data-cigar-grid]");
  if (!container) return;

  container.innerHTML = "";

  filteredData.forEach((row) => {
    const item = document.createElement("div");
    item.className = "cigar-item";

    const imgFile = row["Brand IMG"] || "_placeholder.svg";

    item.innerHTML = `
      <a class="cigar-card">
        <img class="brand-icon" src="/img/icons/brands/${imgFile}" alt="${row.Brand}">
        <div class="cigar-name">${row.Line} ${row.Cigar}</div>
        <div class="cigar-vitola">${row.Vitola}</div>
        <div class="cigar-brand">${row.Brand}</div>
        <div class="cigar-msrp">$${row.MSRP || ""}</div>
      </a>
    `;

    container.appendChild(item);
  });
}

// -------------------------------
// BOOTUP
// -------------------------------
document.addEventListener("DOMContentLoaded", loadHub);
