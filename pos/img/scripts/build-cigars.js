// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

let hubData = [];
let filteredData = [];
let activeFilters = {};
let currentFilterId = null;

// -------------------------------
// LOAD HUB
// -------------------------------
async function loadHub() {
  try {
    const res = await fetch(HUB_URL);
    if (!res.ok) throw new Error("Hub failed to load");

    hubData = await res.json();

    // Pre-clean: Ensure all text fields exist
    hubData = hubData.map(r => ({
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
      "Brand IMG": r["Brand IMG"] || ""
    }));

    filteredData = [...hubData];
    renderCigars();
  } catch (err) {
    console.error("Error loading hub:", err);
  }
}

// -------------------------------
// RENDER CIGAR GRID
// -------------------------------
function renderCigars() {
  const container = document.querySelector("[data-cigar-grid]");
  if (!container) return;

  container.innerHTML = "";

  filteredData.forEach(row => {
    const item = document.createElement("div");
    item.className = "cigar-item";

    const imgFile = row["Brand IMG"] || "_placeholder.svg";

    item.innerHTML = `
      <a class="cigar-card">
        <img class="brand-icon" src="/img/icons/brands/${imgFile}">
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
