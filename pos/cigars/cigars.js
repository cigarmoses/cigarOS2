/* /pos/cigars/cigars.js
   POS Cigars (Main) — NEW Filters Bottom Sheet

   ✅ Replaces legacy "Filters card" + centered modal
   ✅ Uses top-right filter icon button (no text) next to Favorites ⭐
   ✅ Bottom sheet slides up from bottom
   ✅ Close via:
      - X button
      - click outside (backdrop)
      - ESC key
   ✅ Left column: filter categories
   ✅ Right column: searchable/scrollable list w/ checkboxes + optional icons
   ✅ Selected text uses iOS blue (#007AFF) (handled by CSS)
   ✅ Writes to window.__CIGAR_FILTER_STATE__ and calls window.buildCigarsRender()

   Data source:
   - Prefers window.__CIGAR_SHEET_ROWS__ (loaded by build-cigars.js)
   - Falls back to fetching the same CSV

   Icons:
   - Manufacturer: /img/icons/manufacturers/{slug}.svg
   - Brand:        /img/icons/brands/{slug}.svg
*/

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // -----------------------------
  // DOM (existing)
  // -----------------------------
  const backBtn = $("#cigars-back");
  const searchInput = $("#cigars-search-input");

  // New filter icon button (you can use either)
  const openBtn =
    $("#btn-open-filters") || $(".cigars-filter-btn") || $("#cigars-filter-btn");

  // Modal root (CSS expects #filter-modal with class "fm")
  let modalRoot = $("#filter-modal");

  // -----------------------------
  // Data
  // -----------------------------
  let DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__)
    ? window.__CIGAR_SHEET_ROWS__
    : [];

  // -----------------------------
  // Global filter state contract
  // -----------------------------
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
        toggles: {}, // reserved
      };
    } else {
      // If these came back as arrays/objects, normalize to Set
      const g = window.__CIGAR_FILTER_STATE__;
      if (!g.filters) g.filters = {};
      for (const k of [
        "manufacturer",
        "brand",
        "shade",
        "vitola",
        "length",
        "ring",
        "shape",
        "strength",
      ]) {
        const v = g.filters[k];
        if (v instanceof Set) continue;
        if (Array.isArray(v)) g.filters[k] = new Set(v);
        else if (v && typeof v === "object") g.filters[k] = new Set(Object.keys(v));
        else g.filters[k] = new Set();
      }
      if (typeof g.q !== "string") g.q = String(g.q ?? "");
    }
  }

  function renderBrands() {
    if (typeof window.buildCigarsRender === "function") window.buildCigarsRender();
  }

  // -----------------------------
  // Local UI state
  // -----------------------------
  const state = {
    // mirror of global filters, but local until "Apply"
    selected: {
      manufacturer: new Set(),
      brand: new Set(),
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
    activeKey: "brand",
    activeValues: [],
    activeSearch: "",
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function uniqSorted(values) {
    const set = new Set();
    for (const v of values) {
      const s = norm(v);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function iconPathFor(key, label) {
    const slug = slugify(label);
    if (!slug) return "";
    if (key === "manufacturer") return `/img/icons/manufacturers/${slug}.svg`;
    if (key === "brand") return `/img/icons/brands/${slug}.svg`;
    return "";
  }

  // -----------------------------
  // Wrapper Shade custom ordering
  // -----------------------------
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

  // -----------------------------
  // CSV parsing (fallback)
  // -----------------------------
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
      brand: ["Brand", "brand", "Brand aka", "brand_aka"],
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

    const cleaned = uniqSorted(vals);
    if (key === "shade") return orderWrapperShades(cleaned);
    return cleaned;
  }

  // -----------------------------
  // Modal template + wiring
  // -----------------------------
  const CATEGORIES = [
    { key: "manufacturer", label: "Manufacturers" },
    { key: "brand", label: "Brands" },
    { key: "vitola", label: "Vitolas" },
    { key: "ring", label: "Ring" },
    { key: "length", label: "Length" },
    { key: "strength", label: "Strength" },
    { key: "shape", label: "Shape" },
    { key: "shade", label: "Wrap. Shade" },
  ];

  function ensureModal() {
    if (!modalRoot) {
      modalRoot = document.createElement("div");
      modalRoot.id = "filter-modal";
      modalRoot.className = "fm fm--hidden";
      modalRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(modalRoot);
    }

    // Build sheet markup if empty
    if (!modalRoot.querySelector(".fm__sheet")) {
      modalRoot.innerHTML = `
        <div class="fm__backdrop" data-fm-close></div>

        <div class="fm__sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div class="fm__header">
            <h2 class="fm__title">Filters</h2>
            <button class="fm__close" type="button" aria-label="Close filters" data-fm-close>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="fm__body">
            <div class="fm__cats" id="fm-cats"></div>

            <div class="fm__panel">
              <div class="fm__search-row">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                </svg>

                <input class="fm__search-input" id="fm-search" placeholder="Search" autocomplete="off" />

                <button class="fm__mic-btn" type="button" aria-label="Voice search (coming soon)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
                          fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                    <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                    <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <div class="fm__list" id="fm-list"></div>
            </div>
          </div>

          <div class="fm__actions">
            <button class="fm__btn fm__btn--reset" type="button" id="fm-reset">Reset</button>
            <button class="fm__btn fm__btn--apply" type="button" id="fm-apply">Apply</button>
          </div>
        </div>
      `;
    }
  }

  function openModal() {
    ensureModal();
    modalRoot.classList.remove("fm--hidden");
    modalRoot.classList.add("is-open");
    modalRoot.setAttribute("aria-hidden", "false");

    renderCats();
    setActiveCategory(state.activeKey);

    // focus search after animation kick
    window.setTimeout(() => {
      const inp = $("#fm-search", modalRoot);
      inp?.focus();
    }, 60);
  }

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.classList.remove("is-open");
    modalRoot.classList.add("fm--hidden");
    modalRoot.setAttribute("aria-hidden", "true");
  }

  function renderCats() {
    const catsEl = $("#fm-cats", modalRoot);
    if (!catsEl) return;

    catsEl.innerHTML = CATEGORIES.map((c) => {
      const active = c.key === state.activeKey ? "is-active" : "";
      return `<button class="fm__cat-btn ${active}" type="button" data-cat="${escapeHtml(
        c.key
      )}">${escapeHtml(c.label)}</button>`;
    }).join("");

    $$(".fm__cat-btn", catsEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-cat");
        if (!key) return;
        setActiveCategory(key);
      });
    });
  }

  function setActiveCategory(key) {
    if (!state.selected[key]) return;

    state.activeKey = key;
    state.activeSearch = "";

    const inp = $("#fm-search", modalRoot);
    if (inp) inp.value = "";

    // highlight left buttons
    $$(".fm__cat-btn", modalRoot).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-cat") === key);
    });

    // load values
    state.activeValues = getValuesForKey(key);
    renderList();
  }

  function renderList() {
    const listEl = $("#fm-list", modalRoot);
    if (!listEl) return;

    const key = state.activeKey;
    const selectedSet = state.selected[key];
    const showIcons = key === "manufacturer" || key === "brand";

    const q = norm(state.activeSearch).toLowerCase();
    const values = state.activeValues || [];
    const filtered = !q
      ? values
      : values.filter((v) => norm(v).toLowerCase().includes(q));

    listEl.innerHTML = filtered
      .map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);
        const iconSrc = showIcons ? iconPathFor(key, label) : "";

        const cb = isSelected
          ? `<div class="fm__cb is-checked" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>`
          : `<div class="fm__cb" aria-hidden="true"></div>`;

        const icon = showIcons
          ? `<div class="fm__icon">
               <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" decoding="async"
                    onerror="this.style.display='none';" />
             </div>`
          : `<div class="fm__icon" aria-hidden="true"></div>`;

        return `
          <div class="fm__row ${isSelected ? "is-selected" : ""}" data-value="${escapeHtml(
          label
        )}">
            ${cb}
            ${icon}
            <div class="fm__label">${escapeHtml(label)}</div>
          </div>
        `;
      })
      .join("");

    $$(".fm__row", listEl).forEach((row) => {
      row.addEventListener("click", () => {
        const val = row.getAttribute("data-value") || "";
        if (!val) return;

        if (selectedSet.has(val)) selectedSet.delete(val);
        else selectedSet.add(val);

        row.classList.toggle("is-selected");
        const cb = $(".fm__cb", row);
        if (cb) cb.classList.toggle("is-checked", selectedSet.has(val));

        // re-render checkbox svg quickly (simple + robust)
        if (cb) {
          cb.innerHTML = selectedSet.has(val)
            ? `<svg viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>`
            : "";
        }
      });
    });
  }

  function syncLocalFromGlobal() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;

    for (const k of Object.keys(state.selected)) {
      const set = g.filters?.[k];
      state.selected[k] = set instanceof Set ? new Set([...set]) : new Set();
    }
  }

  function pushLocalToGlobal() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;

    for (const k of Object.keys(state.selected)) {
      g.filters[k] = new Set([...state.selected[k]]);
    }

    // main page search stays live in the top bar
    g.q = (searchInput?.value || "").toString();

    renderBrands();
  }

  function resetLocalSelections() {
    for (const k of Object.keys(state.selected)) state.selected[k].clear();
    renderList();
  }

  // -----------------------------
  // Event bindings
  // -----------------------------
  backBtn?.addEventListener("click", () => history.back());

  // Top bar search -> live update global & render
  searchInput?.addEventListener("input", () => {
    ensureGlobalState();
    window.__CIGAR_FILTER_STATE__.q = (searchInput.value || "").toString();
    renderBrands();
  });

  // Open modal
  openBtn?.addEventListener("click", () => {
    syncLocalFromGlobal();
    openModal();
  });

  // Close handlers (delegated inside modal)
  document.addEventListener("click", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-fm-close]")) closeModal();
  });

  // Backdrop click already handled by [data-fm-close], but ensure click-outside works:
  document.addEventListener("mousedown", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const sheet = $(".fm__sheet", modalRoot);
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (sheet && !sheet.contains(t) && t.closest(".fm")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    closeModal();
  });

  // Modal controls
  document.addEventListener("input", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.id !== "fm-search") return;

    state.activeSearch = t.value || "";
    renderList();
  });

  document.addEventListener("click", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest("#fm-reset")) {
      resetLocalSelections();
      return;
    }

    if (t.closest("#fm-apply")) {
      pushLocalToGlobal();
      closeModal();
      return;
    }
  });

  // -----------------------------
  // Init: load data, hydrate, render
  // -----------------------------
  async function init() {
    try {
      ensureGlobalState();

      // Prefer build-cigars.js data
      if (Array.isArray(window.__CIGAR_SHEET_ROWS__) && window.__CIGAR_SHEET_ROWS__.length) {
        DATA_ROWS = window.__CIGAR_SHEET_ROWS__;
      } else {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        const text = await res.text();
        const parsed = parseCSV(text);
        DATA_ROWS = rowsToObjects(parsed);
        window.__CIGAR_SHEET_ROWS__ = DATA_ROWS;
      }

      // hydrate top search from global state
      if (searchInput) searchInput.value = window.__CIGAR_FILTER_STATE__.q || "";

      // initial render
      renderBrands();
    } catch (err) {
      console.error("cigars.js init error:", err);
      // still try rendering with what we have
      try {
        ensureGlobalState();
        if (searchInput) searchInput.value = window.__CIGAR_FILTER_STATE__.q || "";
        renderBrands();
      } catch {}
    }
  }

  init();
})();
