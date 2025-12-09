// /pos/cigars/cigars.js
// Page-specific wiring for Cigars filters UI

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------
  // Back button -> POS home
  // ------------------------
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // ------------------------
  // Helper: pill active state
  // ------------------------
  function setPillActive(pillId, isActive) {
    const pill = document.getElementById(pillId);
    if (!pill) return;
    pill.classList.toggle("filter-pill--active", !!isActive);
  }

  // ---------------------------------------------
  // Helper: brand -> SVG slug (for icon filenames)
  // ---------------------------------------------
  const BRAND_ICON_OVERRIDES = {
    // Confirmed mappings
    "A. Turrent": "aturrent",
    "A. Flores": "aflores",
    "Carlos Torano": "torano",
    "Bruno Del re": "brundelre",

    // The ones you mentioned as "loaded correctly"
    "Diamond Crown": "diamondcrown",
    "El Rey del Mundo": "elreydelmundo",
    "Fonseca": "fonseca",
  };

  function brandSlug(name) {
    if (!name) return "";
    // Exact-name overrides first
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, name)) {
      return BRAND_ICON_OVERRIDES[name];
    }

    // Generic slug: "El Rey del Mundo" -> "elreydelmundo"
    return name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "") // drop spaces, punctuation
      .trim();
  }

  // =====================================================
  // BRAND GRID: collect brand tiles + wire Brand filter
  // =====================================================
  const brandCards = Array.from(
    document.querySelectorAll(".brands-grid .brand-card")
  );

  // Map DOM -> brand objects for the Brand popup
  const brandItems = brandCards.map((card) => {
    const name =
      card.getAttribute("data-brand") ||
      (card.querySelector(".brand-name") &&
        card.querySelector(".brand-name").textContent.trim()) ||
      card.textContent.trim();

    return {
      card,
      name,
    };
  });

  let selectedBrandValues = []; // brand names

  function applyBrandFilter() {
    if (!brandCards.length) return;

    // If no brands selected, show everything
    const active = selectedBrandValues;
    const showAll = !active || !active.length;

    brandItems.forEach(({ card, name }) => {
      if (showAll || active.includes(name)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });

    setPillActive("filter-brand", !showAll);
  }

  // Brand pill -> open POSFilters popup (if engine is loaded)
  const brandPill = document.getElementById("filter-brand");
  if (brandPill && window.POSFilters && brandItems.length) {
    brandPill.addEventListener("click", () => {
      const itemsForModal = brandItems.map(({ name }) => ({
        value: name,
        label: name,
        // IMPORTANT: pass the SVG-safe slug, not the raw name
        iconSlug: brandSlug(name),
        selected: selectedBrandValues.includes(name),
      }));

      window.POSFilters.openFilterModal({
        id: "brand",
        title: "Brands",
        items: itemsForModal,
        withIcons: true,
        onConfirm: (values) => {
          selectedBrandValues = values || [];
          applyBrandFilter();
        },
      });
    });
  } else if (brandPill && !window.POSFilters) {
    // Fallback: simple toggle if the engine isn't present
    brandPill.addEventListener("click", () => {
      const isNowActive = !brandPill.classList.contains("filter-pill--active");
      brandPill.classList.toggle("filter-pill--active", isNowActive);
    });
  }

  // Initial: no brand filter applied
  applyBrandFilter();

  // =====================================================
  // TOGGLE PILLS – no popup, just ON/OFF (bottom rows)
  // =====================================================
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
      // TODO: hook into real cigar data when ready
      // e.g., activeToggles.tubo = isNowActive;
      // applyInventoryFilters();
    });
  });

  // =====================================================
  // POPUP FILTERS – open modal using global engine
  // (Manufacturer, Shade, Vitola, Length, Ring, Shape, Strength)
  // =====================================================

  // For now, we’ll use placeholder lists for these filters.
  // Later we can build them dynamically from your hub data.
  const FILTER_OPTIONS = {
    manufacturer: ["Arturo Fuente", "Drew Estate", "Altadis", "STG"],
    shade: ["Natural", "Maduro", "Oscuro", "Colorado", "Claro"],
    vitola: ["Robusto", "Toro", "Gordo", "Churchill", "Lancero"],
    length: ["4.5", "5", "5.5", "6", "7"],
    ring: ["40", "42", "44", "48", "50", "52", "54", "60"],
    shape: ["Parejo", "Torpedo", "Perfecto", "Box-Pressed"],
    strength: ["Mild", "Mild-Medium", "Medium", "Medium-Full", "Full"],
  };

  // Track selected values by filter key
  const selected = {
    manufacturer: [],
    shade: [],
    vitola: [],
    length: [],
    ring: [],
    shape: [],
    strength: [],
  };

  function openPopupFilter(filterKey, pillId, title) {
    if (!window.POSFilters) {
      // Fallback: simple pill toggle if engine isn't present
      const pill = document.getElementById(pillId);
      if (!pill) return;
      const isNowActive = !pill.classList.contains("filter-pill--active");
      pill.classList.toggle("filter-pill--active", isNowActive);
      return;
    }

    const options = FILTER_OPTIONS[filterKey] || [];

    const items = options.map((opt) => ({
      value: opt,
      label: opt,
      selected: (selected[filterKey] || []).includes(opt),
    }));

    window.POSFilters.openFilterModal({
      id: filterKey,
      title,
      items,
      withIcons: false,
      onConfirm: (values) => {
        selected[filterKey] = values || [];
        const hasAny = selected[filterKey].length > 0;
        setPillActive(pillId, hasAny);

        // TODO: apply to inventory once hooked into hub data
        // applyInventoryFilters();
      },
    });
  }

  const popupMap = [
    { key: "manufacturer", pillId: "filter-manufacturer", title: "Manufacturer" },
    { key: "shade", pillId: "filter-shade", title: "Shade" },
    { key: "vitola", pillId: "filter-vitola", title: "Vitola" },
    { key: "length", pillId: "filter-length", title: "Length" },
    { key: "ring", pillId: "filter-ring", title: "Ring" },
    { key: "shape", pillId: "filter-shape", title: "Shape" },
    { key: "strength", pillId: "filter-strength", title: "Strength" },
  ];

  popupMap.forEach(({ key, pillId, title }) => {
    const pill = document.getElementById(pillId);
    if (!pill) return;
    pill.addEventListener("click", () => openPopupFilter(key, pillId, title));
  });

  // ==========================
  // "View all" button
  // ==========================
  const viewAllBtn = document.getElementById("filters-view-all");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      // For now, show Manufacturer filter as the "All Filters" entry point.
      // Later we can design a dedicated All Filters modal if you want.
      openPopupFilter("manufacturer", "filter-manufacturer", "All Filters");
    });
  }

  // =====================================================
  // Search bar – currently just logs; later can tie into hub
  // =====================================================
  const searchInput = document.getElementById("cigars-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = (e.target.value || "").toLowerCase().trim();
      // TODO: tie to hub data; for now we can optionally filter brand cards by name
      brandItems.forEach(({ card, name }) => {
        const matches =
          !term || (name || "").toLowerCase().includes(term);
        // If brand filter already applied, we respect that AND the search
        const withinBrandFilter =
          !selectedBrandValues.length || selectedBrandValues.includes(name);

        card.style.display = matches && withinBrandFilter ? "" : "none";
      });
    });
  }
});
