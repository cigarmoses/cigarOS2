/* /pos/cigars/cigars.js
   UI controller (MAIN cigars page):
   - Controls filter pills + unified popup modal
   - Writes to window.__CIGAR_FILTER_STATE__
   - Calls window.buildCigarsRender()
   - WAITS for HUB loader (build-cigars.js) to be ready
   - Wrapper Shade uses your custom order
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const backBtn = $("#cigars-back");
  const viewAllBtn = $("#filters-view-all");
  const expandedEl = $("#filters-expanded");

  const searchInput = $("#cigars-search-input");

  const modal = $("#filter-modal");
  const modalBackdrop = modal?.querySelector("[data-fm-close]");
  const modalTitle = $("#fm-title");
  const modalList = $("#fm-list");
  const modalSearch = $("#fm-search-input");
  const modalConfirm = $("#fm-confirm");

  // Prefer the rows already loaded by build-cigars.js (HUB)
  let DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__)
    ? window.__CIGAR_SHEET_ROWS__
    : [];

  function ensureGlobalState() {
    if (!window.__CIGAR_FILTER_STATE__) {
      window.__CIGAR_FILTER_STATE__ = {
        q: "",
        filters: {
          manufacturer: new Set(),
          brand: new Set(),
          shade: new Set(),
          vitola: new Set(),
          length: new Set(),
          ring: new Set(),
          shape: new Set(),
          strength: new Set(),
        },
        toggles: {
          tubo: false,
          flavored: false,
          tin: false,
          pack: false,
          barberpole: false,
          boxpressed: false,
        },
      };
    }
  }

  function renderBrands() {
    if (typeof window.buildCigarsRender === "function") window.buildCigarsRender();
  }

  // ---- wait for HUB loader to be ready ----
  function waitForHubReady() {
    return new Promise((resolve) => {
      const already =
        Array.isArray(window.__CIGAR_SHEET_ROWS__) &&
        window.__CIGAR_SHEET_ROWS__.length &&
        typeof window.buildCigarsRender === "function";

      if (already) return resolve();

      const onReady = () => {
        window.removeEventListener("cigars:hub-ready", onReady);
        resolve();
      };

      window.addEventListener("cigars:hub-ready", onReady);

      // If event was missed but globals are now present, resolve on next tick
      setTimeout(() => {
        const ok =
          Array.isArray(window.__CIGAR_SHEET_ROWS__) &&
          window.__CIGAR_SHEET_ROWS__.length &&
          typeof window.buildCigarsRender === "function";
        if (ok) {
          window.removeEventListener("cigars:hub-ready", onReady);
          resolve();
        }
      }, 0);
    });
  }

  // Local UI state mirrors global state
  const state = {
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
    toggles: {
      flavored: false,
      boxpressed: false,
      tin: false,
      pack: false,
      barberpole: false,
      tubo: false,
    },
    currentModalKey: null,
    currentModalValues: [],
  };

  backBtn?.addEventListener("click", () => history.back());

  viewAllBtn?.addEventListener("click", () => {
    if (!expandedEl) return;
    const isHidden = expandedEl.hasAttribute("hidden");
    if (isHidden) expandedEl.removeAttribute("hidden");
    else expandedEl.setAttribute("hidden", "");
  });

  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function uniqSorted(values) {
    const set = new Set();
    values.forEach((v) => {
      const s = norm(v);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // Extract values for filter key from DATA_ROWS
  function getValuesForKey(key) {
    if (!DATA_ROWS.length) return [];

    const fieldMap = {
      manufacturer: ["Manufacturer"],
      brand: ["Brand"],
      ring: ["RG", "Ring"],
      vitola: ["Vitola", "Style"],
      strength: ["Strength"],
      shade: ["Wrapper Shade", "Shade"],
      length: ["Length"],
      shape: ["Shape"],
    };

    const keysToTry = fieldMap[key] || [key];

    const vals = [];
    for (const r of DATA_ROWS) {
      if (!r) continue;
      for (const k of keysToTry) {
        if (r[k] != null && r[k] !== "") {
          vals.push(r[k]);
          break;
        }
      }
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

    for (const item of WRAPPER_SHADE_ORDER) {
      const match = list.find((v) => v.toLowerCase() === item.toLowerCase());
      if (match) {
        ordered.push(match);
        seen.add(match.toLowerCase());
      } else {
        ordered.push(item);
        seen.add(item.toLowerCase());
      }
    }

    for (const v of list) {
      const k = v.toLowerCase();
      if (!seen.has(k)) ordered.push(v);
    }

    return ordered;
  }

  function openModal(key) {
    state.currentModalKey = key;

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

    if (modalTitle) modalTitle.textContent = titles[key] || "Filter";

    let values = getValuesForKey(key);
    if (key === "shade") values = orderWrapperShades(values);

    state.currentModalValues = values;

    if (modalSearch) modalSearch.value = "";
    renderModalList(values);

    if (modal) {
      modal.classList.remove("fm--hidden");
      modal.setAttribute("aria-hidden", "false");
    }

    setTimeout(() => modalSearch?.focus(), 50);
  }

  function closeModal() {
    if (modal) {
      modal.classList.add("fm--hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    state.currentModalKey = null;
    state.currentModalValues = [];
  }

  // ✅ DOM-build list so values are exact (no HTML escaping issues)
  function renderModalList(values) {
    const key = state.currentModalKey;
    if (!modalList || !key) return;

    const selectedSet = state.selected[key] || new Set();
    modalList.innerHTML = "";

    const frag = document.createDocumentFragment();

    values.forEach((v) => {
      const label = norm(v);
      if (!label) return;

      const row = document.createElement("div");
      row.className = "fm-row" + (selectedSet.has(label) ? " is-selected" : "");
      row.dataset.value = label;

      const left = document.createElement("div");
      const mid = document.createElement("div");
      mid.className = "fm-label";
      mid.textContent = label;

      const right = document.createElement("div");
      right.className = "fm-check";
      right.setAttribute("aria-hidden", "true");

      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);

      row.addEventListener("click", () => {
        const val = row.dataset.value || "";
        if (!val) return;

        if (selectedSet.has(val)) selectedSet.delete(val);
        else selectedSet.add(val);

        row.classList.toggle("is-selected");
      });

      frag.appendChild(row);
    });

    modalList.appendChild(frag);
  }

  modalSearch?.addEventListener("input", () => {
    const q = norm(modalSearch.value).toLowerCase();
    const all = state.currentModalValues || [];
    const filtered = !q ? all : all.filter((v) => norm(v).toLowerCase().includes(q));
    renderModalList(filtered);
  });

  function syncPillActiveStates() {
    $$(".filter-pill[data-filter]").forEach((btn) => {
      const key = btn.getAttribute("data-filter");
      const set = state.selected[key];
      btn.classList.toggle("is-active", !!set && set.size > 0);
    });

    $$(".filter-pill[data-toggle]").forEach((btn) => {
      const t = btn.getAttribute("data-toggle");
      btn.classList.toggle("is-active", !!state.toggles[t]);
    });
  }

  // ✅ Write into global state + rerender brand grid
  function pushStateToGlobal() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;

    // filters: copy sets
    for (const k of Object.keys(g.filters)) {
      if (state.selected[k]) g.filters[k] = new Set([...state.selected[k]]);
    }

    // toggles
    g.toggles.flavored = !!state.toggles.flavored;
    g.toggles.boxpressed = !!state.toggles.boxpressed;
    g.toggles.tin = !!state.toggles.tin;
    g.toggles.pack = !!state.toggles.pack;
    g.toggles.barberpole = !!state.toggles.barberpole;
    g.toggles.tubo = !!state.toggles.tubo;

    // search
    g.q = (searchInput?.value || "").toString();

    renderBrands();
  }

  modalConfirm?.addEventListener("click", () => {
    syncPillActiveStates();
    pushStateToGlobal();
    closeModal();
  });

  modalBackdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("fm--hidden")) closeModal();
  });

  // click handlers
  $$(".filter-pill[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-filter");
      if (!key) return;
      openModal(key);
    });
  });

  $$(".filter-pill[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-toggle");
      if (!t) return;
      state.toggles[t] = !state.toggles[t];
      btn.classList.toggle("is-active", state.toggles[t]);
      pushStateToGlobal();
    });
  });

  searchInput?.addEventListener("input", pushStateToGlobal);

  // ---- init ----
  async function init() {
    ensureGlobalState();

    // ✅ wait for Hub rows + renderer
    await waitForHubReady();

    // ✅ pull Hub rows
    DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__) ? window.__CIGAR_SHEET_ROWS__ : [];

    // pull global -> local so UI shows active states
    const g = window.__CIGAR_FILTER_STATE__;
    for (const k of Object.keys(state.selected)) {
      const set = g.filters?.[k];
      state.selected[k] = set instanceof Set ? new Set([...set]) : new Set();
    }
    for (const k of Object.keys(state.toggles)) {
      state.toggles[k] = !!g.toggles?.[k];
    }

    if (searchInput) searchInput.value = g.q || "";

    syncPillActiveStates();
    renderBrands();
  }

  init().catch((err) => {
    console.error("cigars.js init error:", err);
  });
})();
