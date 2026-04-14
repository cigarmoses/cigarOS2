/* /pos/cigars/cigars.js
   POS Cigars (Main)
   - Loads cigar sheet CSV
   - Brands grid
   - Search + filter bottom sheet
   - Inline filter modal
   - Vitola + Shape ordering
   - Vitola/shape SVG icons in filters
   - Shape info buttons
*/

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const searchInput = $("#cigars-search-input");
  const openBtn = $("#btn-open-filters") || $(".cigars-filter-btn") || $("#cigars-filter-btn");
  const listRoot = $("#cigarsList");
  const appliedRoot = $("#cigarsAppliedFilters");

  let modalRoot = $("#filter-modal");

  let DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__)
    ? window.__CIGAR_SHEET_ROWS__
    : [];

  const VITOLA_ORDER = [
    "Corona",
    "Robusto",
    "Toro",
    "Gordo",
    "Petit Corona",
    "Corona Extra",
    "Lonsdale",
    "Lancero",
    "Panetela",
    "Pantela",
    "Churchill",
    "Double Corona",
    "Gigante",
    "Gran Corona",
  ];

  const SHAPE_ORDER = [
    "Parejo",
    "Torpedo",
    "Presidente",
    "Pyramid",
    "Perfecto",
    "Culebra",
  ];

  const SHAPE_INFO = {
    parejo:
      "Straight-sided cigars; standard or straight cigars. This is the most common shape.",
    torpedo:
      "Tapered at both the head and the foot, with a pointy head.",
    presidente:
      "A long tapered shape; often used like a Salomon-style reference with taper at the head and the foot.",
    pyramid:
      "Also called pyramide or piramide. Tapered to a point at the head and blossoms toward a cylindrical foot.",
    perfecto:
      "Usually about 4–6 inches long, tapered at both ends, with a rounded head and a bulbous center.",
    culebra:
      "Spanish for “snake.” Three loosely filled thin cigars braided together with string.",
  };

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

  const state = {
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
    activeKey: "vitola",
    activeSearch: "",
  };

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
      };
    } else {
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

  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqSorted(values) {
    const set = new Set();
    for (const v of values) {
      const s = norm(v);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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

  function getCigarFilterIcon(value = "", group = "") {
    const v = String(value || "").toLowerCase().trim();

    if (group === "vitola") {
      if (v.includes("gran corona")) return "/uxui/cigaricons/doublecorona.svg";
      if (v.includes("double corona")) return "/uxui/cigaricons/doublecorona.svg";
      if (v.includes("churchill")) return "/uxui/cigaricons/churchill.svg";
      if (v.includes("panetela") || v.includes("pantela")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("lancero")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("lonsdale")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("gigante")) return "/uxui/cigaricons/gordo.svg";
      if (v.includes("gordo")) return "/uxui/cigaricons/gordo.svg";
      if (v.includes("toro")) return "/uxui/cigaricons/toro.svg";
      if (v.includes("robusto")) return "/uxui/cigaricons/robusto.svg";
      if (v.includes("corona extra")) return "/uxui/cigaricons/corona.svg";
      if (v.includes("petit corona")) return "/uxui/cigaricons/petitcorona.svg";
      if (v.includes("corona")) return "/uxui/cigaricons/corona.svg";
    }

    if (group === "shape") {
      if (v.includes("parejo")) return "/uxui/cigaricons/robusto.svg";
      if (v.includes("torpedo")) return "/uxui/cigaricons/torpedo.svg";
      if (v.includes("presidente")) return "/uxui/cigaricons/presidente.svg";
      if (v.includes("pyramid") || v.includes("piramide") || v.includes("piramides")) return "/uxui/cigaricons/torpedo.svg";
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("culebra")) return "/uxui/cigaricons/lonsdale.svg";
    }

    return "";
  }

  function getShapeInfo(value = "") {
    const k = slugify(value);
    return SHAPE_INFO[k] || "";
  }

  function getField(r, keys) {
    for (const k of keys) {
      const v = r?.[k];
      if (v != null && String(v).trim() !== "") return String(v);
    }
    return "";
  }

  function hasActiveFilters(g) {
    const f = g?.filters || {};
    for (const k of Object.keys(f)) {
      if (f[k] instanceof Set && f[k].size) return true;
    }
    return false;
  }

  function rowMatchesFilters(row, g) {
    const f = g?.filters || {};

    const manufacturer = norm(getField(row, ["Manufacturer", "manufacturer"]));
    const brand = norm(getField(row, ["Brand", "brand", "Brand aka", "brand_aka"]));
    const vitola = norm(getField(row, ["Vitola", "vitola", "Style", "style"]));
    const ring = norm(getField(row, ["RG", "Ring", "ring"]));
    const length = norm(getField(row, ["Length", "length"]));
    const strength = norm(getField(row, ["Strength", "strength"]));
    const shape = norm(getField(row, ["Shape", "shape"]));
    const shade = norm(getField(row, ["Wrapper Shade", "WrapperShade", "wrapperShade", "shade"]));

    const checks = [
      ["manufacturer", manufacturer],
      ["brand", brand],
      ["vitola", vitola],
      ["ring", ring],
      ["length", length],
      ["strength", strength],
      ["shape", shape],
      ["shade", shade],
    ];

    for (const [key, val] of checks) {
      const set = f[key];
      if (set instanceof Set && set.size) {
        if (!set.has(val)) return false;
      }
    }

    const q = norm(g?.q).toLowerCase();
    if (q) {
      const cigarName = norm(getField(row, ["Cigar", "Cigar Name", "Name", "cigar", "cigar_name"]));
      const line = norm(getField(row, ["Line", "line"]));
      const hay = `${manufacturer} ${brand} ${line} ${cigarName} ${vitola} ${shade} ${strength} ${shape} ${ring} ${length}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  }

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
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
      return obj;
    });
  }

  function buildBrandSummary(rows) {
    const map = new Map();

    for (const r of rows) {
      const brand = norm(getField(r, ["Brand", "brand", "Brand aka", "brand_aka"])) || "Unknown";
      const manufacturer = norm(getField(r, ["Manufacturer", "manufacturer"]));

      if (!map.has(brand)) map.set(brand, { brand, manufacturer, count: 0 });
      const o = map.get(brand);
      o.count += 1;
      if (!o.manufacturer && manufacturer) o.manufacturer = manufacturer;
    }

    return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand));
  }

  function renderAppliedChips(g) {
    if (!appliedRoot) return;

    const chips = [];
    const f = g.filters || {};

    for (const key of ["manufacturer", "brand", "vitola", "ring", "length", "strength", "shape", "shade"]) {
      const set = f[key];
      if (!(set instanceof Set) || !set.size) continue;

      for (const val of set) {
        const label = `${key}: ${val}`;
        chips.push(`
          <div class="af-chip" data-chip-key="${escapeHtml(key)}" data-chip-val="${escapeHtml(val)}">
            <span>${escapeHtml(label)}</span>
            <button class="af-chip__x" type="button" aria-label="Remove ${escapeHtml(label)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        `);
      }
    }

    if ((g.q && g.q.trim()) || hasActiveFilters(g)) {
      chips.push(`
        <div class="af-chip af-clear">
          <span>Clear</span>
          <button class="af-chip__x" type="button" id="af-clear-all" aria-label="Clear all filters">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `);
    }

    appliedRoot.innerHTML = chips.join("");

    $$(".af-chip", appliedRoot).forEach((chip) => {
      const xBtn = $(".af-chip__x", chip);
      if (!xBtn) return;

      xBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (xBtn.id === "af-clear-all") {
          g.q = "";
          for (const k of Object.keys(g.filters)) g.filters[k] = new Set();
          if (searchInput) searchInput.value = "";
          renderAll();
          return;
        }

        const key = chip.getAttribute("data-chip-key");
        const val = chip.getAttribute("data-chip-val");
        if (!key || !val) return;

        const set = g.filters[key];
        if (set instanceof Set) set.delete(val);
        renderAll();
      });
    });
  }

  function renderBrandsGrid(summary) {
    if (!listRoot) return;

    listRoot.innerHTML = `
      <div class="brands-grid">
        ${summary.map((c) => {
          const icon = iconPathFor("brand", c.brand);
          const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
          return `
            <a href="${href}" aria-label="${escapeHtml(c.brand)}">
              <img src="${escapeHtml(icon)}" alt="${escapeHtml(c.brand)}"
                   loading="lazy" decoding="async"
                   onerror="this.style.opacity='.18'; this.style.filter='grayscale(1)';" />
              <div class="category-name">${escapeHtml(c.brand)}</div>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderResultsRows(summary) {
    if (!listRoot) return;

    listRoot.innerHTML = `
      <div class="cigars-results">
        ${summary.map((c) => {
          const icon = iconPathFor("brand", c.brand);
          const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
          return `
            <a class="brand-row" href="${href}" style="text-decoration:none; color:inherit;">
              <img class="row-ico" src="${escapeHtml(icon)}" alt=""
                   loading="lazy" decoding="async"
                   onerror="this.style.display='none';" />

              <div class="brand-row-left">
                <div class="brand-row-title">${escapeHtml(c.brand)}</div>
                <div class="brand-row-sub">${escapeHtml(c.manufacturer || "—")}</div>
              </div>

              <div class="brand-row-right">
                <div class="brand-row-msrp">${escapeHtml(String(c.count))}</div>
                <div style="font:700 20px/1 -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui; color: rgba(255,255,255,.55);">›</div>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderAll() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;

    renderAppliedChips(g);

    const filteredRows = (DATA_ROWS || []).filter((r) => rowMatchesFilters(r, g));
    const summary = buildBrandSummary(filteredRows);

    const qOn = !!(g.q && g.q.trim());
    const filtersOn = hasActiveFilters(g);

    if (!summary.length) {
      if (listRoot) listRoot.innerHTML = `<div class="cigars-empty">No results.</div>`;
      return;
    }

    if (qOn || filtersOn) renderResultsRows(summary);
    else renderBrandsGrid(summary);
  }

  function orderByCustomList(values, order, aliases = {}) {
    const list = uniqSorted(values);
    const orderMap = new Map();

    order.forEach((item, index) => {
      orderMap.set(item.toLowerCase(), index);
    });

    return list.sort((a, b) => {
      const aa = (aliases[a.toLowerCase()] || a).toLowerCase();
      const bb = (aliases[b.toLowerCase()] || b).toLowerCase();

      const ai = orderMap.has(aa) ? orderMap.get(aa) : 999;
      const bi = orderMap.has(bb) ? orderMap.get(bb) : 999;

      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  }

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
      }
    }

    for (const v of list) {
      const k = v.toLowerCase();
      if (!seen.has(k)) ordered.push(v);
    }

    return ordered;
  }

  function orderVitolas(values) {
    return orderByCustomList(values, VITOLA_ORDER, {
      pantela: "panetela",
    });
  }

  function orderShapes(values) {
    return orderByCustomList(values, SHAPE_ORDER, {
      pyramide: "pyramid",
      piramide: "pyramid",
      piramides: "pyramid",
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
    if (key === "vitola") return orderVitolas(cleaned);
    if (key === "shape") return orderShapes(cleaned);

    return cleaned;
  }

  function countSelectedForKey(key) {
    return state.selected[key] instanceof Set ? state.selected[key].size : 0;
  }

  function ensureInjectedStyles() {
    if ($("#cigars-inline-filter-style")) return;

    const style = document.createElement("style");
    style.id = "cigars-inline-filter-style";
    style.textContent = `
      .fm.fm--inline .fm__sheet{
        max-height:88vh;
      }

      .fm.fm--inline .fm__header{
        padding:18px 18px 14px;
      }

      .fm.fm--inline .fm__title{
        font-weight:800;
      }

      .fm.fm--inline .fm__body{
        display:block;
        padding:0;
        overflow:auto;
      }

      .fm.fm--inline .fm__stack{
        padding:0 18px 8px;
      }

      .fm.fm--inline .fm__section{
        border-top:1px solid rgba(15,26,44,.06);
      }

      .fm.fm--inline .fm__section-btn{
        width:100%;
        border:0;
        background:transparent;
        display:grid;
        grid-template-columns:1fr auto auto;
        gap:12px;
        align-items:center;
        padding:18px 6px;
        text-align:left;
        cursor:pointer;
        appearance:none;
      }

      .fm.fm--inline .fm__section-title{
        font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-size:22px;
        font-weight:600;
        letter-spacing:-.02em;
        color:#0f1a2c;
      }

      .fm.fm--inline .fm__section-meta{
        min-width:26px;
        height:26px;
        padding:0 8px;
        border-radius:999px;
        background:#eef2ff;
        color:#6f85d8;
        font-size:15px;
        font-weight:700;
        display:grid;
        place-items:center;
      }

      .fm.fm--inline .fm__section-toggle{
        width:24px;
        text-align:center;
        color:#6f85d8;
        font-size:32px;
        line-height:1;
        font-weight:400;
      }

      .fm.fm--inline .fm__section-content{
        padding:0 0 16px;
      }

      .fm.fm--inline .fm__search-row{
        margin:0 0 14px;
      }

      .fm.fm--inline .fm__row{
        display:grid;
        grid-template-columns:38px minmax(0,1fr) auto 140px;
        gap:10px;
        align-items:center;
        padding:14px 12px;
        border-radius:18px;
        border:1px solid rgba(15,26,44,.08);
        background:#fff;
        margin-bottom:12px;
      }

      .fm.fm--inline .fm__cb{
        width:28px;
        height:28px;
        border-radius:9px;
        border:2px solid rgba(15,26,44,.18);
        background:#fff;
        display:grid;
        place-items:center;
      }

      .fm.fm--inline .fm__cb.is-checked{
        background:#eef2ff;
        border-color:#8ea4eb;
        color:#8ea4eb;
      }

      .fm.fm--inline .fm__cb svg{
        width:18px;
        height:18px;
      }

      .fm.fm--inline .fm__label{
        min-width:0;
        font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-size:18px;
        font-weight:600;
        letter-spacing:-.02em;
        color:#0f1a2c;
      }

      .fm.fm--inline .fm__row.is-selected .fm__label{
        color:#0f1a2c;
      }

      .fm.fm--inline .fm__info{
        width:24px;
        height:24px;
        border:0;
        background:transparent;
        color:#8d96a8;
        font-size:18px;
        font-weight:600;
        line-height:1;
        display:grid;
        place-items:center;
        cursor:pointer;
        padding:0;
        appearance:none;
      }

      .fm.fm--inline .fm__icon{
        width:140px;
        min-width:140px;
        height:22px;
        display:flex;
        align-items:center;
        justify-content:flex-start;
        overflow:visible;
      }

      .fm.fm--inline .fm__icon img{
        height:14px;
        width:auto;
        max-width:132px;
        object-fit:contain;
        display:block;
        transform:scaleX(-1);
        transform-origin:center;
      }

      .fm.fm--inline .fm__icon--brand img,
      .fm.fm--inline .fm__icon--manufacturer img{
        transform:none;
      }

      .fm.fm--inline .fm__search-input{
        font-weight:500;
      }

      .fm.fm--inline .fm__btn{
        font-weight:600;
      }

      .fm.fm--inline .fm__info-sheet{
        position:absolute;
        left:18px;
        right:18px;
        bottom:92px;
        border-radius:18px;
        background:#fff;
        border:1px solid rgba(15,26,44,.08);
        box-shadow:0 18px 40px rgba(15,26,44,.14);
        padding:14px 16px;
        display:none;
      }

      .fm.fm--inline .fm__info-sheet.is-open{
        display:block;
      }

      .fm.fm--inline .fm__info-title{
        margin:0 0 6px;
        font-size:18px;
        line-height:1.2;
        font-weight:700;
        color:#0f1a2c;
      }

      .fm.fm--inline .fm__info-text{
        margin:0;
        font-size:15px;
        line-height:1.35;
        font-weight:500;
        color:rgba(15,26,44,.72);
      }

      .fm.fm--inline .fm__info-close{
        position:absolute;
        top:10px;
        right:10px;
        width:28px;
        height:28px;
        border:0;
        background:transparent;
        color:#8d96a8;
        font-size:22px;
        line-height:1;
        display:grid;
        place-items:center;
        cursor:pointer;
        padding:0;
        appearance:none;
      }

      .fm.fm--inline .fm__actions{
        position:relative;
        z-index:2;
        background:#fff;
      }

      .fm.fm--inline .fm__empty{
        padding:8px 8px 12px;
        color:rgba(15,26,44,.48);
        font-size:16px;
        font-weight:500;
      }

      @media (max-width:430px){
        .fm.fm--inline .fm__row{
          grid-template-columns:34px minmax(0,1fr) auto 118px;
          gap:10px;
          padding:13px 10px;
        }

        .fm.fm--inline .fm__icon{
          width:118px;
          min-width:118px;
        }

        .fm.fm--inline .fm__icon img{
          max-width:110px;
          height:13px;
        }

        .fm.fm--inline .fm__label{
          font-size:17px;
        }
      }

      @media (max-width:390px){
        .fm.fm--inline .fm__row{
          grid-template-columns:32px minmax(0,1fr) auto 104px;
          gap:8px;
        }

        .fm.fm--inline .fm__icon{
          width:104px;
          min-width:104px;
        }

        .fm.fm--inline .fm__icon img{
          max-width:96px;
          height:12px;
        }

        .fm.fm--inline .fm__label{
          font-size:16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureInjectedStyles();

    if (!modalRoot) {
      modalRoot = document.createElement("div");
      modalRoot.id = "filter-modal";
      modalRoot.className = "fm fm--hidden fm--inline";
      modalRoot.hidden = true;
      modalRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(modalRoot);
    } else {
      modalRoot.classList.add("fm--inline");
    }

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
            <div class="fm__stack" id="fm-stack"></div>
          </div>

          <div class="fm__info-sheet" id="fm-info-sheet" aria-live="polite">
            <button class="fm__info-close" type="button" id="fm-info-close" aria-label="Close info">×</button>
            <h3 class="fm__info-title" id="fm-info-title"></h3>
            <p class="fm__info-text" id="fm-info-text"></p>
          </div>

          <div class="fm__actions">
            <button class="fm__btn fm__btn--reset" type="button" id="fm-reset">Reset</button>
            <button class="fm__btn fm__btn--apply" type="button" id="fm-apply">Apply</button>
          </div>
        </div>
      `;
    }
  }

  function closeInfoSheet() {
    $("#fm-info-sheet", modalRoot)?.classList.remove("is-open");
  }

  function openInfoSheet(title, text) {
    const sheet = $("#fm-info-sheet", modalRoot);
    const titleEl = $("#fm-info-title", modalRoot);
    const textEl = $("#fm-info-text", modalRoot);

    if (!sheet || !titleEl || !textEl) return;

    titleEl.textContent = title;
    textEl.textContent = text;
    sheet.classList.add("is-open");
  }

  function renderInlineSections() {
    const stack = $("#fm-stack", modalRoot);
    if (!stack) return;

    stack.innerHTML = CATEGORIES.map((c) => {
      const count = countSelectedForKey(c.key);
      const isOpen = c.key === state.activeKey;
      const values = getValuesForKey(c.key);
      const q = isOpen ? norm(state.activeSearch).toLowerCase() : "";
      const filtered = isOpen
        ? (!q ? values : values.filter((v) => norm(v).toLowerCase().includes(q)))
        : [];

      const rows = isOpen
        ? filtered.length
          ? filtered.map((v) => {
              const label = norm(v);
              const isSelected = state.selected[c.key].has(label);

              const brandOrManufacturerIcon =
                c.key === "manufacturer" || c.key === "brand"
                  ? iconPathFor(c.key, label)
                  : "";

              const cigarIcon =
                c.key === "vitola" || c.key === "shape"
                  ? getCigarFilterIcon(label, c.key)
                  : "";

              const iconSrc = brandOrManufacturerIcon || cigarIcon;
              const iconClass =
                c.key === "manufacturer"
                  ? "fm__icon fm__icon--manufacturer"
                  : c.key === "brand"
                  ? "fm__icon fm__icon--brand"
                  : "fm__icon fm__icon--cigar";

              const infoBtn =
                c.key === "shape" && getShapeInfo(label)
                  ? `<button class="fm__info" type="button" data-info="${escapeHtml(label)}" aria-label="About ${escapeHtml(label)}">ℹ</button>`
                  : `<span class="fm__info" aria-hidden="true"></span>`;

              const cb = isSelected
                ? `<div class="fm__cb is-checked" aria-hidden="true">
                     <svg viewBox="0 0 24 24" aria-hidden="true">
                       <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                     </svg>
                   </div>`
                : `<div class="fm__cb" aria-hidden="true"></div>`;

              const icon = iconSrc
                ? `<div class="${iconClass}">
                     <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" decoding="async"
                          onerror="this.style.display='none';" />
                   </div>`
                : `<div class="${iconClass}" aria-hidden="true"></div>`;

              return `
                <div class="fm__row ${isSelected ? "is-selected" : ""}" data-key="${escapeHtml(c.key)}" data-value="${escapeHtml(label)}">
                  ${cb}
                  <div class="fm__label">${escapeHtml(label)}</div>
                  ${infoBtn}
                  ${icon}
                </div>
              `;
            }).join("")
          : `<div class="fm__empty">No options found.</div>`
        : "";

      const search =
        isOpen
          ? `
            <div class="fm__search-row">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                      fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
              </svg>

              <input class="fm__search-input" id="fm-search-inline" placeholder="Search" autocomplete="off" value="${escapeHtml(state.activeSearch)}" />

              <button class="fm__mic-btn" type="button" aria-label="Clear search" id="fm-search-clear">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
                        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          `
          : "";

      return `
        <div class="fm__section">
          <button class="fm__section-btn" type="button" data-cat="${escapeHtml(c.key)}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="fm__section-title">${escapeHtml(c.label)}</span>
            <span class="fm__section-meta">${count}</span>
            <span class="fm__section-toggle">${isOpen ? "−" : "+"}</span>
          </button>
          ${isOpen ? `<div class="fm__section-content">${search}${rows}</div>` : ""}
        </div>
      `;
    }).join("");

    $$(".fm__section-btn", stack).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-cat");
        if (!key) return;
        state.activeKey = key;
        state.activeSearch = "";
        closeInfoSheet();
        renderInlineSections();

        const inp = $("#fm-search-inline", modalRoot);
        inp?.focus();
      });
    });

    $$(".fm__row", stack).forEach((row) => {
      row.addEventListener("click", (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest(".fm__info")) return;

        const key = row.getAttribute("data-key") || "";
        const val = row.getAttribute("data-value") || "";
        if (!key || !val || !(state.selected[key] instanceof Set)) return;

        if (state.selected[key].has(val)) state.selected[key].delete(val);
        else state.selected[key].add(val);

        renderInlineSections();
      });
    });

    $$("[data-info]", stack).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const label = btn.getAttribute("data-info") || "";
        const text = getShapeInfo(label);
        if (!text) return;
        openInfoSheet(label, text);
      });
    });

    const inlineSearch = $("#fm-search-inline", modalRoot);
    inlineSearch?.addEventListener("input", () => {
      state.activeSearch = inlineSearch.value || "";
      renderInlineSections();
    });

    $("#fm-search-clear", modalRoot)?.addEventListener("click", () => {
      state.activeSearch = "";
      renderInlineSections();
      $("#fm-search-inline", modalRoot)?.focus();
    });
  }

  function openModal() {
    ensureModal();
    modalRoot.hidden = false;
    modalRoot.classList.remove("fm--hidden");
    modalRoot.classList.add("is-open");
    modalRoot.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("sheet-open");

    renderInlineSections();

    window.setTimeout(() => {
      $("#fm-search-inline", modalRoot)?.focus();
    }, 60);
  }

  function closeModal() {
    if (!modalRoot) return;
    closeInfoSheet();
    modalRoot.classList.remove("is-open");
    modalRoot.classList.add("fm--hidden");
    modalRoot.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("sheet-open");
    window.setTimeout(() => {
      if (!modalRoot.classList.contains("is-open")) {
        modalRoot.hidden = true;
      }
    }, 260);
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
    g.q = (searchInput?.value || g.q || "").toString();
    renderAll();
  }

  function resetLocalSelections() {
    for (const k of Object.keys(state.selected)) {
      state.selected[k].clear();
    }
    closeInfoSheet();
    renderInlineSections();
  }

  searchInput?.addEventListener("input", () => {
    ensureGlobalState();
    window.__CIGAR_FILTER_STATE__.q = (searchInput.value || "").toString();
    renderAll();
  });

  openBtn?.addEventListener("click", () => {
    syncLocalFromGlobal();
    openModal();
  });

  document.addEventListener("click", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest("[data-fm-close]")) {
      closeModal();
      return;
    }

    if (t.closest("#fm-info-close")) {
      closeInfoSheet();
      return;
    }

    if (t.closest("#fm-reset")) {
      resetLocalSelections();
      return;
    }

    if (t.closest("#fm-apply")) {
      pushLocalToGlobal();
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;

    const infoSheet = $("#fm-info-sheet", modalRoot);
    if (infoSheet?.classList.contains("is-open")) {
      closeInfoSheet();
      return;
    }

    closeModal();
  });

  async function init() {
    try {
      ensureGlobalState();

      if (searchInput) searchInput.value = window.__CIGAR_FILTER_STATE__.q || "";

      if (Array.isArray(window.__CIGAR_SHEET_ROWS__) && window.__CIGAR_SHEET_ROWS__.length) {
        DATA_ROWS = window.__CIGAR_SHEET_ROWS__;
      } else {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
        const text = await res.text();
        const parsed = parseCSV(text);
        DATA_ROWS = rowsToObjects(parsed);
        window.__CIGAR_SHEET_ROWS__ = DATA_ROWS;
      }

      renderAll();
    } catch (err) {
      console.error("cigars.js init error:", err);
      if (listRoot) listRoot.innerHTML = `<div class="cigars-empty">Failed to load cigars.</div>`;
    }
  }

  init();
})();
