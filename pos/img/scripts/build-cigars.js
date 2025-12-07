// /pos/img/scripts/build-cigars.js

// LIVE GOOGLE SHEETS HUB URL
const HUB_URL =
  "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tq=select%20*&tqx=out:json";

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
// LOAD HUB (LIVE FROM GOOGLE SHEETS)
// -------------------------------
async function loadHub() {
  try {
    const res = await fetch(HUB_URL);
    if (!res.ok) throw new Error("Hub failed to load from Google Sheets");

    const text = await res.text();

    // Strip Google Visualization wrapper safely
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const gviz = JSON.parse(jsonStr);

    const table = gviz.table;
    const headers = table.cols.map(c => (c.label || c.id || "").trim());

    // Convert rows → clean hub objects
    hubData = table.rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const cell = row.c[i];
        obj[h] = cell ? cell.v : "";
      });

      return {
        Brand: obj.Brand || "",
        Line: obj.Line || "",
        Cigar: obj.Cigar || "",
        Vitola: obj.Vitola || "",
        Wrapper: obj.Wrapper || "",
        Binder: obj.Binder || "",
        Filler: obj.Filler || "",
        WrapperShade: obj["Wrapper Shade"] || "",
        Length: obj.Length || "",
        RG: obj.RG || "",
        MSRP: obj.MSRP || "",
        "Brand IMG": obj["Brand IMG"] || "",
      };
    });

    filteredData = [...hubData];

    // Render brand icons grid on main Cigars page
    renderBrandsGrid();

    // Render cigars if on brand page
    renderCigarsGrid();
  } catch (err) {
    console.error("Error loading hub:", err);
  }
}

// -------------------------------
// RENDER BRAND GRID (main /pos/cigars/)
// -------------------------------
function renderBrandsGrid() {
  const container = document.getElementById("brands-grid");
  if (!container) return;

  const brandMap = new Map();

  hubData.forEach(row => {
    const brandName = (row.Brand || "").trim();
    if (!brandName) return;

    if (!brandMap.has(brandName)) {
      const imgFromHub = (row["Brand IMG"] || "").trim();
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

  brands.forEach(b => {
    const brandName = b.Brand;
    const imgFile = b.imgFile;
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
// RENDER CIGAR GRID (brand pages)
// -------------------------------
function renderCigarsGrid() {
  const container = document.querySelector("[data-cigar-grid]");
  if (!container) return;

  container.innerHTML = "";

  filteredData.forEach(row => {
    const imgFile = row["Brand IMG"] || "_placeholder.svg";

    const item = document.createElement("div");
    item.className = "cigar-item";

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
