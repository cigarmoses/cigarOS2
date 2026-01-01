/* /pos/cigars/cigars.js
   UI controller:
   - Back button
   - View all expand/collapse
   - Filter modal open/close
   - Populates filter lists using the SAME data that build-cigars.js loads
   - Writes to window.__CIGAR_FILTER_STATE__ and calls window.buildCigarsRender()
   - Wrapper Shade: custom ordered list (extras appended)
   - ✅ Adds small icons for Manufacturer + Brand in the modal:
     img/icons/manufacturers/(slug).svg
     img/icons/brands/(slug).svg
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

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

  // --- CSV parsing (fallback if build-cigars.js hasn't loaded yet) ---
  function parseCSV(text) {
    const rows = [];
    let i = 0;
    let field = "";
    let row = [];
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i += 1;
        continue;
      }

      if (!inQuotes && (c === "," || c === "\n" || c === "\r")) {
        row.push(field);
        field = "";

        if (c === ",") {
          i += 1;
          continue;
        }

        if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
        row = [];

        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i += 1;

        continue;
      }

      field += c;
      i += 1;
    }

    if (field.length || row.length) {
      row.push(field);
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
  }

  function getValuesForKey(key) {
    if (!DATA_ROWS.length) return [];

    const fieldMap = {
      manufacturer: ["Manufacturer", "manufacturer"],
      brand: ["Brand", "brand"],
      ring: ["RG", "Ring", "ring"],
      vitola: ["Vitola", "vitola", "Style", "style"],
      strength: ["Strength", "strength"],
      shade: ["Wrapper Shade", "WrapperShade", "wrapperShade", "shade"],
      length: ["Length", "length"],
      shape: ["Shape", "shape"],
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

  // ✅ icon slug helper
  function slugify(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function iconPathForModalItem(key, label) {
    const slug = slugify(label);
    if (!slug) return "";
    if (key === "manufacturer") return `/img/icons/manufacturers/${slug}.svg`;
    if (key === "brand") return `/img/icons/brands/${slug}.svg`;
    return "";
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

  function renderModalList(values) {
    const key = state.currentModalKey;
    if (!modalList || !key) return;

    const selectedSet = state.selected[key] || new Set();
    const showIcons = key === "manufacturer" || key === "brand";

    modalList.innerHTML = values
      .map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);
        const iconSrc = showIcons ? iconPathForModalItem(key, label) : "";

        // ✅ small icon (text-height) – never massive
        const iconHtml = showIcons
          ? `<img
              class="fm-ico"
              src="${escapeHtml(iconSrc)}"
              alt=""
              loading="lazy"
              decoding="async"
              onerror="this.style.display='none';"
              style="
                width:22px;height:22px;max-width:22px;max-height:22px;
                border-radius:6px;object-fit:contain;flex:0 0 22px;
              "
            />`
          : `<div></div>`;

        return `
          <div class="fm-row ${isSelected ? "is-selected" : ""}" data-value="${escapeHtml(label)}"
               style="display:grid;grid-template-columns:${showIcons ? "26px" : "0px"} 1fr 28px;align-items:center;column-gap:12px;">
            ${iconHtml}
            <div class="fm-label">${escapeHtml(label)}</div>
            <div class="fm-check" aria-hidden="true"></div>
          </div>
        `;
      })
      .join("");

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

  modalSearch?.addEventListener("input", () => {
    const q = norm(modalSearch.value).toLowerCase();
    const all = state.currentModalValues || [];
    const filtered = !q ? all : all.filter((v) => norm(v).toLowerCase().includes(q));
    renderModalList(filtered);
  });

  modalConfirm?.addEventListener("click", () => {
    syncPillActiveStates();
    pushStateToGlobal();
    closeModal();
  });

  modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("fm--hidden")) closeModal();
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

  function pushStateToGlobal() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;

    for (const k of Object.keys(g.filters)) {
      if (state.selected[k]) {
        g.filters[k] = new Set([...state.selected[k]]);
      }
    }

    g.toggles.flavored = !!state.toggles.flavored;
    g.toggles.boxpressed = !!state.toggles.boxpressed;
    g.toggles.tin = !!state.toggles.tin;
    g.toggles.pack = !!state.toggles.pack;
    g.toggles.barberpole = !!state.toggles.barberpole;
    g.toggles.tubo = !!state.toggles.tubo;

    g.q = (searchInput?.value || "").toString();

    renderBrands();
  }

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
      state.toggles[t] = !state.toggles[t];
      btn.classList.toggle("is-active", state.toggles[t]);
      pushStateToGlobal();
    });
  });

  searchInput?.addEventListener("input", () => {
    pushStateToGlobal();
  });

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function init() {
    try {
      ensureGlobalState();

      if (Array.isArray(window.__CIGAR_SHEET_ROWS__) && window.__CIGAR_SHEET_ROWS__.length) {
        DATA_ROWS = window.__CIGAR_SHEET_ROWS__;
      } else {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        const text = await res.text();
        const parsed = parseCSV(text);
        DATA_ROWS = rowsToObjects(parsed);
        window.__CIGAR_SHEET_ROWS__ = DATA_ROWS;
      }

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
    } catch (err) {
      console.error("cigars.js init error:", err);
      syncPillActiveStates();
    }
  }

  init();
})();
