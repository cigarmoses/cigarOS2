// /pos/cigars/cigars.js
// Page-specific wiring for Cigars filters UI

document.addEventListener("DOMContentLoaded", () => {
  // Back button -> main POS home
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // same pattern as other pages – adjust if your path differs
      window.location.href = "/pos/";
    });
  }

  // Helper: mark a pill as active (green) when it has selections
  function setPillActive(pillId, isActive) {
    const pill = document.getElementById(pillId);
    if (!pill) return;
    pill.classList.toggle("filter-pill--active", !!isActive);
  }

  // Toggle-style pills (no popup, just on/off) – bottom two rows
  const togglePillIds = [
    "filter-tubo",
    "filter-flavored",
    "filter-tin",
    "filter-pack",
    "filter-barberpole",
    "filter-boxpressed",
  ];

  togglePillIds.forEach((id) => {
    const pill = document.getElementById(id);
    if (!pill) return;
    pill.addEventListener("click", () => {
      const isNowActive = !pill.classList.contains("filter-pill--active");
      pill.classList.toggle("filter-pill--active", isNowActive);
      // TODO: hook into your actual data filtering logic
    });
  });

  // Popup-style filters (use POSFilters when you’re ready)
  const popupFilters = [
    { id: "filter-manufacturer", title: "Manufacturer" },
    { id: "filter-brand", title: "Brands" },
    { id: "filter-shade", title: "Shade" },
    { id: "filter-vitola", title: "Vitola" },
    { id: "filter-length", title: "Length" },
    { id: "filter-ring", title: "Ring" },
    { id: "filter-shape", title: "Shape" },
    { id: "filter-strength", title: "Strength" },
  ];

  // For now, just flip pills green; you can wire each to POSFilters later
  popupFilters.forEach(({ id }) => {
    const pill = document.getElementById(id);
    if (!pill) return;
    pill.addEventListener("click", () => {
      // When hooked up to POSFilters, you'll set this based on selections.length > 0
      const isNowActive = !pill.classList.contains("filter-pill--active");
      pill.classList.toggle("filter-pill--active", isNowActive);
    });
  });

  // "View all" -> later you can open a special modal that shows all filters
  const viewAllBtn = document.getElementById("filters-view-all");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      // For now, no-op; later we can open a dedicated "All Filters" modal
      // Example future hook:
      // window.POSFilters.openFilterModal({ ... });
      console.log("View all filters clicked");
    });
  }
});
