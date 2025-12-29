/* /pos/cigars/cigars.js
   UI controller:
   - Back button
   - View all expand/collapse
   - Filter modal open/close
   - Wrapper Shade: title + custom ordered list (extras appended)
   - Dispatches "cigars:filters-changed" for other scripts if needed
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const backBtn = $("#cigars-back");
  const viewAllBtn = $("#filters-view-all");
  const expandedEl = $("#filters-expanded");

  const modal = $("#filter-modal");
  const modalBackdrop = modal?.querySelector("[data-fm-close]");
  const modalTitle = $("#fm-title");
  const modalList = $("#fm-list");
  const modalSearch = $("#fm-search-input");
  const modalConfirm = $("#fm-confirm");

  // --- state ---
  const state = {
    // multi-select values per filter key
    selected: {
      manufacturer: new Set(),
      brand: new Set(),
      ring: new Set(),
      vitola: new Set(),
      strength: new Set(),
      shade: new Set(),
      length: new Set(),
      shape: new Set(),
    },
    // toggles
    toggles: {
      flavored: false,
      boxpressed: false,
      tin: false,
      pack: false,
      barberpole: false,
    },
    currentModalKey: null,
    currentModalValues: [],
  };

  // --- Back ---
  backBtn?.addEventListener("click", () => history.back());

  // --- View all toggle ---
  viewAllBtn?.addEventListener("click", () => {
    const isHidden = expandedEl.hasAttribute("hidden");
    if (isHidden) expandedEl.removeAttribute("hidden");
    else expandedEl.setAttribute("hidden", "");
  });

  // --- helpers: attempt to locate cigar rows from whatever global the builder uses ---
  function getAllCigarRows() {
    const candidates = [
      window.CIGAR_ROWS,
      window.CIGARS_ROWS,
      window.CIGAR_DATA,
      window.CIGARS_DATA,
      window.cigarRows,
      window.cigarsRows,
      window.cigarData,
      window.cigarsData,
      window.__CIGARS__,
      window.__CIGAR_ROWS__,
      window.__CIGAR_DATA__,
    ];

    for (const c of candidates) {
      if (Array.isArray(c) && c.length) return c;
      // sometimes wrapped like {rows:[...]}
      if (c && Array.isArray(c.rows) && c.rows.length) return c.rows;
      if (c && Array.isArray(c.data) && c.data.length) return c.data;
    }
    return [];
  }

  // normalize string (for comparisons)
  function norm(v) {
    return String(v ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function uniqSorted(values) {
    const set = new Set();
    values.forEach((v) => {
      const s = norm(v);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // Extract unique values for a filter key from dataset.
  // We try common field names without breaking if structure is different.
  function getValuesForKey(key) {
    const rows = getAllCigarRows();
    if (!rows.length) return [];

    const fieldMap = {
      manufacturer: ["Manufacturer", "manufacturer"],
      brand: ["Brand", "brand"],
      ring: ["RG", "Ring", "ring", "ringGauge"],
      vitola: ["Vitola", "vitola", "Style", "style"],
      strength: ["Strength", "strength"],
      shade: ["Wrapper Shade", "WrapperShade", "shade", "wrapperShade", "Wrapper"],
      length: ["Length", "length"],
      shape: ["Shape", "shape"],
    };

    const keysToTry = fieldMap[key] || [key];

    const vals = [];
    for (const r of rows) {
      if (!r) continue;

      // object row
      if (typeof r === "object" && !Array.isArray(r)) {
        for (const k of keysToTry) {
          if (r[k] != null && r[k] !== "") {
            vals.push(r[k]);
            break;
          }
        }
        continue;
      }

      // array row (unknown column order) - can't safely parse without a header map
      // so we skip to avoid nonsense values
    }

    return uniqSorted(vals);
  }

  // --- Wrapper Shade custom ordering ---
  const WRAPPER_SHADE_ORDER = [
    "Natural",
    "Connecticut",
    "Maduro",
    "Oscuro",
    "Connecticut Shade",
    "EMS",
    "Claro",
    "Colorado",
    "Colorado Claro",
    "Colorado Maduro",
    "Mixed",
    "Candela",
  ];

  function orderWrapperShades(values) {
    const list = uniqSorted(values);

    const seen = new Set();
    const ordered = [];

    // requested items first (if present OR even if not present; we still show them)
    for (const item of WRAPPER_SHADE_ORDER) {
      const match = list.find((v) => v.toLowerCase() === item.toLowerCase());
      if (match) {
        ordered.push(match);
        seen.add(match.toLowerCase());
      } else {
        // show requested options even if not in data yet (use exact casing)
        ordered.push(item);
        seen.add(item.toLowerCase());
      }
    }

    // leftovers appended after requested list (per your instruction)
    for (const v of list) {
      const k = v.toLowerCase();
      if (!seen.has(k)) ordered.push(v);
    }

    return ordered;
  }

  // --- Modal open/close ---
  function openModal(key) {
    state.currentModalKey = key;

    // Title mapping
    const titles = {
      manufacturer: "Manufacturer",
      brand: "Brand",
      ring: "Ring",
      vitola: "Vitolas",
      strength: "Strength",
      shade: "Wrapper Shade",
      length: "Length",
      shape: "Shape",
    };

    modalTitle.textContent = titles[key] || "Filter";

    // Values
    let values = getValuesForKey(key);

    if (key === "shade") {
      values = orderWrapperShades(values);
    }

    state.currentModalValues = values;

    // Reset search + render
    modalSearch.value = "";
    renderModalList(values);

    modal.classList.remove("fm--hidden");
    modal.setAttribute("aria-hidden", "false");

    // focus
    setTimeout(() => modalSearch?.focus(), 50);
  }

  function closeModal() {
    modal.classList.add("fm--hidden");
    modal.setAttribute("aria-hidden", "true");
    state.currentModalKey = null;
    state.currentModalValues = [];
  }

  function renderModalList(values) {
    const key = state.currentModalKey;
    if (!modalList || !key) return;

    const selectedSet = state.selected[key] || new Set();

    modalList.innerHTML = values
      .map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);
        return `
          <div class="fm-row ${isSelected ? "is-selected" : ""}" data-value="${escapeHtml(label)}">
            <div></div>
            <div class="fm-label">${escapeHtml(label)}</div>
            <div class="fm-check" aria-hidden="true"></div>
          </div>
        `;
      })
      .join("");

    // click handlers
    $$(".fm-row").forEach((row) => {
      row.addEventListener("click", () => {
        const val = row.getAttribute("data-value") || "";
        if (!val) return;

        if (selectedSet.has(val)) selectedSet.delete(val);
        else selectedSet.add(val);

        row.classList.toggle("is-selected");
      });
    });
  }

  // search filter inside modal
  modalSearch?.addEventListener("input", () => {
    const q = norm(modalSearch.value).toLowerCase();
    const all = state.currentModalValues || [];
    const filtered = !q ? all : all.filter((v) => norm(v).toLowerCase().includes(q));
    renderModalList(filtered);
  });

  // confirm (keeps selection; just closes + updates pill active state)
  modalConfirm?.addEventListener("click", () => {
    syncPillActiveStates();
    dispatchFiltersChanged();
    closeModal();
  });

  // backdrop close
  modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("fm--hidden")) closeModal();
  });

  // --- Pill click wiring ---
  function syncPillActiveStates() {
    // normal filter pills: active if selection set has anything
    $$(".filter-pill[data-filter]").forEach((btn) => {
      const key = btn.getAttribute("data-filter");
      const set = state.selected[key];
      btn.classList.toggle("is-active", !!set && set.size > 0);
    });

    // toggles: active if true
    $$(".filter-pill[data-toggle]").forEach((btn) => {
      const t = btn.getAttribute("data-toggle");
      btn.classList.toggle("is-active", !!state.toggles[t]);
    });
  }

  function dispatchFiltersChanged() {
    const detail = {
      selected: Object.fromEntries(
        Object.entries(state.selected).map(([k, set]) => [k, Array.from(set)])
      ),
      toggles: { ...state.toggles },
    };
    document.dispatchEvent(new CustomEvent("cigars:filters-changed", { detail }));
  }

  // open modal on data-filter pills
  $$(".filter-pill[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-filter");
      if (!key) return;
      openModal(key);
    });
  });

  // toggles
  $$(".filter-pill[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-toggle");
      if (!t) return;
      state.toggles[t] = !state.toggles[t];
      btn.classList.toggle("is-active", state.toggles[t]);
      dispatchFiltersChanged();
    });
  });

  // --- tiny util ---
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // initial
  syncPillActiveStates();
})();
