// /pos/img/scripts/build-cigars.js

const HUB_URL = "/hub/hub_11-5-25.json";

let hubData = [];
let filteredData = [];
let activeFilters = {};

// Normalize text helper
function norm(x) {
  return (x || "").toString().trim().toLowerCase();
}

// -------------------------------
// LOAD HUB
// -------------------------------
async function loadHub() {
  try {
    const res = await fetch(HUB_URL);
    if (!res.ok) throw new Error("Hub failed to load");

    hubData = await res.json();

    // PRE-CLEAN each row to match new JSON field names
    hubData = hubData.map(r => ({
      brand: norm(r.brand),
      manufacturer: norm(r.manufacturer),
      vitola: norm(r.vitola),
      shape: norm(r.shape),
      shade: norm(r.shade),
      strength: norm(r.strength),
      length: r.length,
      ring: r.ring,
      name: norm(r.name),
      image: r.image
    }));

    filteredData = [...hubData];

    renderResults();
  } catch (err) {
    console.error("Hub load error:", err);
  }
}

// -------------------------------
// SEARCH
// -------------------------------
function setupSearch() {
  const input = document.getElementById("cigars-search");
  if (!input) return;

  input.addEventListener("input", () => {
    const q = norm(input.value);

    filteredData = hubData.filter(r =>
      r.brand.includes(q) ||
      r.manufacturer.includes(q) ||
      r.name.includes(q)
    );

    renderResults();
  });
}

// -------------------------------
// FILTER SYSTEM
// -------------------------------
function setupFilters() {
  document.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const field = pill.dataset.field;
      const value = pill.dataset.value;

      if (!field) return;

      // Toggle active filter
      if (activeFilters[field] === value) {
        delete activeFilters[field];
      } else {
        activeFilters[field] = value;
      }

      applyFilters();
    });
  });
}

function applyFilters() {
  filteredData = hubData.filter(row => {
    return Object.entries(activeFilters).every(([field, value]) => {
      return norm(row[field]) === norm(value);
    });
  });

  renderResults();
}

// -------------------------------
// RENDER RESULTS
// -------------------------------
function renderResults() {
  const grid = document.getElementById("cigar-results");
  if (!grid) return;

  grid.innerHTML = "";

  filteredData.forEach(item => {
    const card = document.createElement("div");
    card.className = "cigar-card";

    card.innerHTML = `
      <img src="${item.image}" class="cigar-img" />
      <div class="cigar-name">${item.name || ""}</div>
    `;

    grid.appendChild(card);
  });
}

// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadHub();
  setupSearch();
  setupFilters();
});
