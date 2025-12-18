// /pos/cigars/cigars.js
// Handles: back button, brand search, filter modal, filter application, active blue states.

(function () {
  const gridEl =
    document.getElementById("category-grid") ||
    document.getElementById("brands-grid");

  const searchInput = document.getElementById("cigars-search-input");

  const modalEl = document.getElementById("filter-modal");
  const modalBackdrop = modalEl ? modalEl.querySelector(".filter-modal-backdrop") : null;
  const modalBackBtn = modalEl ? modalEl.querySelector(".filter-modal-back") : null;
  const modalTitle = document.getElementById("filter-modal-title");
  const modalSearch = document.getElementById("filter-modal-search-input");
  const modalList = document.getElementById("filter-modal-list");
  const modalConfirm = document.getElementById("filter-modal-confirm");

  // Non-toggle filters open the modal
  const MODAL_FILTERS = new Set([
    "manufacturer",
    "brand",
    "shade",
    "vitola",
    "length",
    "ring",
    "shape",
    "strength",
  ]);

  // Toggle filters (tap to activate)
  const TOGGLE_FILTERS = new Set([
    "tubo",
    "flavored",
    "tin",
    "pack",
    "barberpole",
    "boxpressed",
  ]);

  // Map your UI filter keys -> Google Sheet column names (tolerant)
  const COLS = {
    manufacturer: ["Manufacturer", "manufacturer", "MFR", "Maker"],
    brand: ["Brand", "brand"],
    shade: ["Wrapper Shade", "Shade", "shade", "WrapperShade"],
    vitola: ["Vitola", "vitola"],
    length: ["Length", "length"],
    ring: ["RG", "Ring", "Ring Gauge", "ring", "RingGauge"],
    shape: ["Shape", "shape"],
    strength: ["Strength", "strength"],

    // toggles (these columns usually contain X/Yes/TRUE/etc)
    tubo: ["Tubo", "tubo"],
    flavored: ["Flavored", "flavored"],
    tin: ["Tin", "tin"],
    pack: ["Pack", "pack"],
    barberpole: ["Barber", "Barberpole", "barberpole", "Barber Pole"],
    boxpressed: ["Box-Pressed", "Box Pressed", "boxpressed", "BoxPressed"],
  };

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function truthy(val) {
    const v = String(val || "").trim().toLowerCase();
    return v === "x" || v === "yes" || v === "true" || v === "1" || v === "y";
  }

  // state
  const state = {
    search: "",
    // modal selections (multi)
    selections: {
      manufacturer: new Set(),
      brand: new Set(),
      shade: new Set(),
      vitola: new Set(),
      length: new Set(),
      ring: new Set(),
      shape: new Set(),
      strength: new Set(),
    },
    // toggles (boolean)
    toggles: {
      tubo: false,
      flavored: false,
      tin: false,
      pack: false,
      barberpole: false,
      boxpressed: false,
    },
    currentModalFilter: null,
  };

  function getRows() {
    return Array.isArray(window.__CIGAR_SHEET_ROWS__) ? window.__CIGAR_SHEET_ROWS__ : [];
  }

  function getAllBrands() {
    return Array.isArray(window.__CIGAR_BRANDS__) ? window.__CIGAR_BRANDS__ : [];
  }

  function setPillActive(filterKey, isActive) {
    const btn = document.querySelector(`.filter-pill[data-filter="${filterKey}"]`);
    if (!btn) return;
    if (isActive) btn.classList.add("active");
    else btn.classList.remove("active");
  }

  function updateAllPillStates() {
    // modal-based filters
    Object.keys(state.selections).forEach((k) => {
      setPillActive(k, state.selections[k].size > 0);
    });
    // toggles
    Object.keys(state.toggles).forEach((k) => {
      setPillActive(k, !!state.toggles[k]);
    });
  }

  // Build a per-brand searchable blob so search can match cigar/vitola too
  function buildBrandSearchIndex(rows) {
    const map = new Map(); // brand -> blob
    for (const r of rows) {
      const brand = pick(r, COLS.brand);
      if (!brand) continue;

      const parts = [
        brand,
        pick(r, ["Line", "line"]),
        pick(r, ["Cigar", "cigar"]),
        pick(r, COLS.vitola),
      ]
        .filter(Boolean)
        .join(" ");

      const prev = map.get(brand) || "";
      // keep it from exploding
      if (prev.length < 8000) map.set(brand, (prev + " " + parts).toLowerCase());
    }
    return map;
  }

  let brandSearchIndex = new Map();

  function rowMatchesSelections(row) {
    // modal filters: if selected, row must match one of selected values
    for (const key of Object.keys(state.selections)) {
      const set = state.selections[key];
      if (!set || set.size === 0) continue;

      const colVal = pick(row, COLS[key]);
      if (!colVal) return false;
      if (!set.has(colVal)) return false;
    }

    // toggles: if enabled, row must be truthy in the toggle column
    for (const key of Object.keys(state.toggles)) {
      if (!state.toggles[key]) continue;
      const colVal = pick(row, COLS[key]);
      if (!truthy(colVal)) return false;
    }

    return true;
  }

  function getEligibleBrandsFromFilters(rows) {
    // If no filters at all, return null meaning “all brands”
    const anyModal = Object.values(state.selections).some((s) => s.size > 0);
    const anyToggle = Object.values(state.toggles).some(Boolean);

    if (!anyModal && !anyToggle) return null;

    const eligible = new Set();
    for (const r of rows) {
      const brand = pick(r, COLS.brand);
      if (!brand) continue;
      if (rowMatchesSelections(r)) eligible.add(brand);
    }
    return eligible;
  }

  function applySearchAndFilters() {
    if (!gridEl) return;

    const rows = getRows();
    const allBrands = getAllBrands();

    // filters determine which brands are eligible
    const eligibleSet = getEligibleBrandsFromFilters(rows);

    // search query
    const q = (state.search || "").trim().toLowerCase();

    // rebuild tiles from the canonical brand list so ordering stays consistent
    const filtered = allBrands.filter(({ brand }) => {
      if (eligibleSet && !eligibleSet.has(brand)) return false;
      if (!q) return true;

      const blob = brandSearchIndex.get(brand) || brand.toLowerCase();
      return blob.includes(q);
    });

    gridEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    filtered.forEach(({ brand, brandImg }) => {
      const a = document.createElement("a");
      a.className = "category-card";
      a.href = `/pos/cigars/brand.html?brand=${encodeURIComponent(brand)}`;
      a.setAttribute("aria-label", brand);

      const img = document.createElement("img");
      img.alt = brand;
      img.loading = "lazy";
      img.decoding = "async";

      // let build-cigars fallback logic work by using CSV path first if present
      // (same fallback scheme as build-cigars.js)
      const slug = (function brandSlug(name) {
        if (!name) return "";
        const canonical = String(name)
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "")
          .trim();
        const overrides = {
          aturrent: "aturrent",
          aflores: "aflores",
          carlostorano: "torano",
          brundelre: "brundelre",
          diamondcrown: "diamondcrown",
          elreydelmundo: "elreydelmundo",
          fonseca: "fonseca",
        };
        if (!canonical) return "";
        return overrides[canonical] || canonical;
      })(brand);

      const candidates = [];
      const csvSrc = (function safeSrc(src) {
        if (!src) return "";
        let s = String(src).trim();
        if (!s) return "";
        if (!s.startsWith("/") && !s.startsWith("http")) s = "/" + s.replace(/^\/+/, "");
        return s;
      })(brandImg);

      if (csvSrc) candidates.push(csvSrc);
      if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
      if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

      let idx = 0;
      function tryNext() {
        if (idx >= candidates.length) {
          img.style.display = "none";
          return;
        }
        img.src = candidates[idx++];
      }
      img.onerror = tryNext;
      tryNext();

      const name = document.createElement("div");
      name.className = "category-name";
      name.textContent = brand;

      a.appendChild(img);
      a.appendChild(name);
      frag.appendChild(a);
    });

    gridEl.appendChild(frag);
  }

  function openModal(filterKey) {
    if (!modalEl) return;
    state.currentModalFilter = filterKey;

    // title
    const titleMap = {
      manufacturer: "Manufacturer",
      brand: "Brand",
      shade: "Shade",
      vitola: "Vitola",
      length: "Length",
      ring: "Ring",
      shape: "Shape",
      strength: "Strength",
    };
    if (modalTitle) modalTitle.textContent = titleMap[filterKey] || "Filter";

    // clear search
    if (modalSearch) modalSearch.value = "";

    // build options from rows (unique)
    const rows = getRows();
    const keyCols = COLS[filterKey] || [];
    const options = new Set();

    rows.forEach((r) => {
      const v = pick(r, keyCols);
      if (v) options.add(v);
    });

    const sorted = Array.from(options).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    renderModalOptions(sorted);
    modalEl.classList.remove("filter-modal--hidden");
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add("filter-modal--hidden");
    state.currentModalFilter = null;
  }

  function renderModalOptions(optionList) {
    if (!modalList) return;

    const filterKey = state.currentModalFilter;
    const selected = filterKey ? state.selections[filterKey] : new Set();

    modalList.innerHTML = "";
    const frag = document.createDocumentFragment();

    optionList.forEach((opt) => {
      const label = document.createElement("label");
      label.className = "filter-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = opt;
      cb.checked = selected ? selected.has(opt) : false;

      const span = document.createElement("span");
      span.textContent = opt;

      label.appendChild(cb);
      label.appendChild(span);
      frag.appendChild(label);
    });

    modalList.appendChild(frag);
  }

  function getModalVisibleOptions() {
    const filterKey = state.currentModalFilter;
    if (!filterKey) return [];

    const rows = getRows();
    const keyCols = COLS[filterKey] || [];
    const options = new Set();
    rows.forEach((r) => {
      const v = pick(r, keyCols);
      if (v) options.add(v);
    });

    const q = (modalSearch?.value || "").trim().toLowerCase();
    const sorted = Array.from(options).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    if (!q) return sorted;
    return sorted.filter((x) => x.toLowerCase().includes(q));
  }

  function applyModalSelections() {
    const filterKey = state.currentModalFilter;
    if (!filterKey) return;

    const set = new Set();
    modalList?.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      if (cb.checked) set.add(cb.value);
    });

    state.selections[filterKey] = set;

    updateAllPillStates();
    closeModal();
    applySearchAndFilters();
  }

  function wireUI() {
    // Back button
    const backBtn = document.getElementById("cigars-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/pos/";
      });
    }

    // Search (filters brand grid)
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value || "";
        applySearchAndFilters();
      });
    }

    // Filter pills
    document.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-filter");
        if (!key) return;

        if (TOGGLE_FILTERS.has(key)) {
          state.toggles[key] = !state.toggles[key];
          updateAllPillStates();
          applySearchAndFilters();
          return;
        }

        if (MODAL_FILTERS.has(key)) {
          openModal(key);
        }
      });
    });

    // Modal wiring
    modalBackdrop?.addEventListener("click", closeModal);
    modalBackBtn?.addEventListener("click", closeModal);
    modalConfirm?.addEventListener("click", applyModalSelections);

    modalSearch?.addEventListener("input", () => {
      renderModalOptions(getModalVisibleOptions());
    });

    // “view all” just opens Brand filter
    const viewAllBtn = document.getElementById("filters-view-all");
    viewAllBtn?.addEventListener("click", () => openModal("brand"));

    updateAllPillStates();
  }

  function initWhenDataReady() {
    const rows = getRows();
    brandSearchIndex = buildBrandSearchIndex(rows);

    wireUI();

    // Initial apply ensures search/filters reflect current state
    applySearchAndFilters();
  }

  // Start
  document.addEventListener("DOMContentLoaded", () => {
    if (window.__CIGAR_SHEET_ROWS__ && window.__CIGAR_BRANDS__) {
      initWhenDataReady();
    } else {
      window.addEventListener("cigars:data-ready", initWhenDataReady, { once: true });
    }
  });
})();
