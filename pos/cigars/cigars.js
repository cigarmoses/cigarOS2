/* /pos/cigars/cigars.js
   POS Cigars (Main)
   - Loads cigar sheet CSV
   - Brands grid
   - Search + filter bottom sheet
   - Horizontal tab filter modal
   - Vitola + Shape ordering
   - Vitola/shape SVG icons in filters
   - Shape info buttons
   - Include Cubans toggle
   - Smart favorite brands rail
   - Hardened filter-button binding
*/
(() => {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const searchInput = $("#cigars-search-input");
  const listRoot = $("#cigarsList");
  const appliedRoot = $("#cigarsAppliedFilters");
  const favBrandsRoot = $("#favBrandsScroll");
  let modalRoot = $("#filter-modal");
  let DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__)
    ? window.__CIGAR_SHEET_ROWS__
    : [];
  const STARTER_RAIL_BRANDS = [
    "Padron",
    "Davidoff",
    "Opus X",
    "Arturo Fuente",
    "Aladino",
    "Rocky Patel",
  ];
  const FAVORITE_BRANDS_KEY = "cigaros_favorite_brands";
  const RECENT_BRANDS_KEY = "cigaros_recent_brands";
  const MAX_RECENT_BRANDS = 12;
  const MAX_RAIL_BRANDS = 8;
  const LONG_PRESS_MS = 420;
  const VITOLA_ORDER = [
    "Robusto",
    "Toro",
    "Gordo",
    "Petit Corona",
    "Corona",
    "Corona Extra",
    "Lonsdale",
    "Lancero",
    "Panetela",
    "Cigarillo",
    "Churchill",
    "Double Corona",
    "Gigante",
    "Gran Corona",
    "Torpedo", 
    "Sampler", 
  ];
  const SHAPE_ORDER = [
    "Parejo",
    "Torpedo",
    "Presidente",
    "Pyramid",
    "Perfecto",
    "Chisel",
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
    chisel:
      "A cigar shape with a flattened, chisel-like head instead of a rounded cap.",
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
    includeCubans: false,
  };
  function ensureGlobalState() {
    if (!window.__CIGAR_FILTER_STATE__) {
      window.__CIGAR_FILTER_STATE__ = {
        q: "",
        includeCubans: false,
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
      return;
    }
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
    g.includeCubans = !!g.includeCubans;
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
      if (s && s !== "-") set.add(s);
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
  function readJsonArray(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }
  function writeJsonArray(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
  function getFavoriteBrands() {
    return readJsonArray(FAVORITE_BRANDS_KEY).map(norm).filter(Boolean);
  }
  function setFavoriteBrands(arr) {
    const unique = Array.from(new Set(arr.map(norm).filter(Boolean)));
    writeJsonArray(FAVORITE_BRANDS_KEY, unique);
  }
  function isFavoriteBrand(name) {
    const target = norm(name).toLowerCase();
    return getFavoriteBrands().some((b) => norm(b).toLowerCase() === target);
  }
  function toggleFavoriteBrand(name) {
    const target = norm(name);
    if (!target) return false;
    const current = getFavoriteBrands();
    const exists = current.some((b) => norm(b).toLowerCase() === target.toLowerCase());
    const next = exists
      ? current.filter((b) => norm(b).toLowerCase() !== target.toLowerCase())
      : [target, ...current];
    setFavoriteBrands(next);
    return !exists;
  }
  function getRecentBrands() {
    return readJsonArray(RECENT_BRANDS_KEY).map(norm).filter(Boolean);
  }
  function pushRecentBrand(name) {
    const target = norm(name);
    if (!target) return;
    const next = [
      target,
      ...getRecentBrands().filter((b) => norm(b).toLowerCase() !== target.toLowerCase()),
    ].slice(0, MAX_RECENT_BRANDS);
    writeJsonArray(RECENT_BRANDS_KEY, next);
  }
  function getCigarFilterIcon(value = "", group = "") {
    const v = String(value || "").toLowerCase().trim();
    if (group === "vitola") {
      if (v.includes("gran corona")) return "/uxui/cigaricons/grancorona.svg";
      if (v.includes("double corona")) return "/uxui/cigaricons/doublecorona.svg";
      if (v.includes("churchill")) return "/uxui/cigaricons/churchill.svg";
      if (v.includes("lancero")) return "/uxui/cigaricons/lancero.svg";
      if (v.includes("lonsdale")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("gigante")) return "/uxui/cigaricons/gigante.svg";
      if (v.includes("gordo")) return "/uxui/cigaricons/gordo.svg";
      if (v.includes("toro")) return "/uxui/cigaricons/toro.svg";
      if (v.includes("robusto")) return "/uxui/cigaricons/robusto.svg";
      if (v.includes("corona extra")) return "/uxui/cigaricons/coronaextra.svg";
      if (v.includes("petit corona")) return "/uxui/cigaricons/petitcorona.svg";
      if (v.includes("corona")) return "/uxui/cigaricons/corona.svg";
      if (v.includes("belicoso")) return "/uxui/cigaricons/belicoso.svg";
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("pyramid") || v.includes("piramide") || v.includes("piramides")) {
        return "/uxui/cigaricons/pyramid.svg";
      }
      if (v.includes("panetela") || v.includes("pantela")) return "/uxui/cigaricons/panetela.svg";
      if (v.includes("figurado")) return "/uxui/cigaricons/figurado.svg";
      if (v.includes("salomon")) return "/uxui/cigaricons/salomon.svg";
      if (v.includes("presidente")) return "/uxui/cigaricons/presidente.svg";
      if (v.includes("chisel")) return "/uxui/cigaricons/chisel.svg";
      if (v.includes("cigarillo")) return "/uxui/cigaricons/cigarillo.svg";
      if (v.includes("diademas")) return "/uxui/cigaricons/diademas.svg";
      if (v.includes("rothschild")) return "/uxui/cigaricons/rothschild.svg";
      if (v.includes("torpedo")) return "/uxui/cigaricons/torpedo.svg";

    }
    if (group === "shape") {
      if (v.includes("parejo")) return "/uxui/cigaricons/parejo.svg";
      if (v.includes("torpedo")) return "/uxui/cigaricons/torpedo.svg";
      if (v.includes("presidente")) return "/uxui/cigaricons/presidente.svg";
      if (v.includes("pyramid") || v.includes("piramide") || v.includes("piramides")) {
        return "/uxui/cigaricons/pyramid.svg";
      }
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("chisel")) return "/uxui/cigaricons/chisel.svg";
      if (v.includes("culebra")) return "/uxui/cigaricons/culebra.svg";
      if (v.includes("belicoso")) return "/uxui/cigaricons/belicoso.svg";
      if (v.includes("figurado")) return "/uxui/cigaricons/figurado.svg";
      if (v.includes("gigante")) return "/uxui/cigaricons/gigante.svg";
      if (v.includes("diademas")) return "/uxui/cigaricons/diademas.svg";
      if (v.includes("salomon")) return "/uxui/cigaricons/salomon.svg";
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
  function isTruthyLike(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "x", "cuban"].includes(s);
  }
  function isCubanRow(row) {
    const brand = norm(getField(row, ["Brand", "brand", "Brand aka", "brand_aka"])).toLowerCase();
    const manufacturer = norm(getField(row, ["Manufacturer", "manufacturer"])).toLowerCase();
    const origin = norm(
      getField(row, ["Origin", "origin", "Country", "country", "Country of Origin", "country_of_origin"])
    ).toLowerCase();
    const cubanField = getField(row, ["Cuban", "cuban", "Is Cuban", "is_cuban"]);
    if (isTruthyLike(cubanField)) return true;
    if (origin.includes("cuba") || origin.includes("cuban")) return true;
    if (brand.includes("(cuban)") || manufacturer.includes("(cuban)")) return true;
    return false;
  }
  function hasActiveFilters(g) {
    const f = g?.filters || {};
    for (const k of Object.keys(f)) {
      if (f[k] instanceof Set && f[k].size) return true;
    }
    return false;
  }
  function rowMatchesFilters(row, g) {
    if (!g?.includeCubans && isCubanRow(row)) return false;
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
      const hay =
        `${manufacturer} ${brand} ${line} ${cigarName} ${vitola} ${shade} ${strength} ${shape} ${ring} ${length}`.toLowerCase();
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
  function getSmartRailBrands(summary) {
    const favorites = getFavoriteBrands();
    const recents = getRecentBrands();
    const summaryByNorm = new Map(summary.map((b) => [norm(b.brand).toLowerCase(), b]));
    function findBrandObject(name) {
      const target = norm(name).toLowerCase();
      if (summaryByNorm.has(target)) return summaryByNorm.get(target);
      return (
        summary.find((b) => {
          const brand = norm(b.brand).toLowerCase();
          return brand === target || brand.includes(target) || target.includes(brand);
        }) || {
          brand: name,
          manufacturer: "",
          count: 0,
        }
      );
    }
    const orderedNames = [...favorites, ...recents, ...STARTER_RAIL_BRANDS];
    const deduped = [];
    const seen = new Set();
    orderedNames.forEach((name) => {
      const key = norm(name).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(findBrandObject(name));
    });
    return deduped.slice(0, MAX_RAIL_BRANDS);
  }
  function bindSmartRailEvents(root) {
    if (!root) return;
    $$(".fav-brand-card", root).forEach((el) => {
      const brand = el.getAttribute("data-brand") || "";
      if (!brand) return;
      let pressTimer = null;
      let longPressTriggered = false;
      const startPress = () => {
        longPressTriggered = false;
        clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => {
          longPressTriggered = true;
          const on = toggleFavoriteBrand(brand);
          renderAll();
          if (navigator.vibrate) navigator.vibrate(on ? 18 : 10);
        }, LONG_PRESS_MS);
      };
      const cancelPress = () => {
        clearTimeout(pressTimer);
      };
      el.addEventListener("pointerdown", startPress);
      el.addEventListener("pointerup", cancelPress);
      el.addEventListener("pointerleave", cancelPress);
      el.addEventListener("pointercancel", cancelPress);
      el.addEventListener("click", (e) => {
        if (longPressTriggered) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        pushRecentBrand(brand);
      });
    });
  }
  function renderFavoriteBrands(summary) {
    if (!favBrandsRoot) return;
    const brands = getSmartRailBrands(summary);
    favBrandsRoot.innerHTML = brands
      .map((b) => {
        const href = `/pos/cigars/brand/?brand=${encodeURIComponent(b.brand)}`;
        const icon = iconPathFor("brand", b.brand);
        const favorite = isFavoriteBrand(b.brand);
        const recent = getRecentBrands().some(
          (r) => norm(r).toLowerCase() === norm(b.brand).toLowerCase()
        );
        return `
          <a
            class="fav-brand-card${favorite ? " is-favorite" : ""}${recent ? " is-recent" : ""}"
            href="${href}"
            data-brand="${escapeHtml(b.brand)}"
            aria-label="${escapeHtml(b.brand)}"
            title="Tap to open · Long press to favorite"
          >
            <div class="fav-brand-icon">
              <img
                src="${escapeHtml(icon)}"
                alt="${escapeHtml(b.brand)}"
                loading="lazy"
                decoding="async"
                onerror="this.style.opacity='.18'; this.style.filter='grayscale(1)';"
              />
              ${favorite ? `<span class="fav-brand-badge" aria-hidden="true">★</span>` : ``}
            </div>
            <div class="fav-brand-name">${escapeHtml(b.brand)}</div>
          </a>
        `;
      })
      .join("");
    bindSmartRailEvents(favBrandsRoot);
  }
  function renderAppliedChips(g) {
    if (!appliedRoot) return;
    const chips = [];
    const f = g.filters || {};
    if (g.includeCubans) {
      chips.push(`
        <div class="af-chip" data-chip-key="includeCubans" data-chip-val="true">
          <span>Include Cubans 🇨🇺</span>
          <button class="af-chip__x" type="button" aria-label="Disable Include Cubans">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `);
    }
    for (const key of [
      "manufacturer",
      "brand",
      "vitola",
      "ring",
      "length",
      "strength",
      "shape",
      "shade",
    ]) {
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
    if ((g.q && g.q.trim()) || hasActiveFilters(g) || g.includeCubans) {
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
          g.includeCubans = false;
          for (const k of Object.keys(g.filters)) g.filters[k] = new Set();
          if (searchInput) searchInput.value = "";
          renderAll();
          return;
        }
        const key = chip.getAttribute("data-chip-key");
        const val = chip.getAttribute("data-chip-val");
        if (key === "includeCubans") {
          g.includeCubans = false;
          renderAll();
          return;
        }
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
        ${summary
          .map((c) => {
            const icon = iconPathFor("brand", c.brand);
            const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
            return `
              <a href="${href}" aria-label="${escapeHtml(c.brand)}" data-brand-link="${escapeHtml(c.brand)}">
                <img src="${escapeHtml(icon)}" alt="${escapeHtml(c.brand)}"
                     loading="lazy" decoding="async"
                     onerror="this.style.opacity='.18'; this.style.filter='grayscale(1)';" />
                <div class="category-name">${escapeHtml(c.brand)}</div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;
    $$("[data-brand-link]", listRoot).forEach((el) => {
      el.addEventListener("click", () => {
        const brand = el.getAttribute("data-brand-link") || "";
        pushRecentBrand(brand);
      });
    });
  }
  function renderResultsRows(summary) {
    if (!listRoot) return;
    listRoot.innerHTML = `
      <div class="cigars-results">
        ${summary
          .map((c) => {
            const icon = iconPathFor("brand", c.brand);
            const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
            return `
              <a class="brand-row" href="${href}" style="text-decoration:none; color:inherit;" data-brand-link="${escapeHtml(c.brand)}">
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
          })
          .join("")}
      </div>
    `;
    $$("[data-brand-link]", listRoot).forEach((el) => {
      el.addEventListener("click", () => {
        const brand = el.getAttribute("data-brand-link") || "";
        pushRecentBrand(brand);
      });
    });
  }
  function renderAll() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;
    renderAppliedChips(g);
    const filteredRows = (DATA_ROWS || []).filter((r) => rowMatchesFilters(r, g));
    const summary = buildBrandSummary(filteredRows);
    renderFavoriteBrands(buildBrandSummary(DATA_ROWS || []));
    const qOn = !!(g.q && g.q.trim());
    const filtersOn = hasActiveFilters(g);
    if (!summary.length) {
      if (listRoot) listRoot.innerHTML = `<div class="cigars-empty">No results.</div>`;
      return;
    }
    if (qOn || filtersOn || g.includeCubans) renderResultsRows(summary);
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
    const visibleRows = DATA_ROWS.filter((row) => state.includeCubans || !isCubanRow(row));
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
    for (const r of visibleRows) {
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
    #filter-modal.fm{
      z-index:99999;
    }

    #filter-modal .fm__sheet{
      left:50% !important;
      right:auto !important;
      width:calc(100vw - 24px) !important;
      max-width:430px !important;
      transform:translate(-50%, 110%) !important;
      max-height:88vh;
    }

    #filter-modal.is-open .fm__sheet{
      transform:translate(-50%, 0) !important;
    }

    .fm.fm--tabs .fm__header{
      padding:18px 18px 10px;
      border-bottom:none;
    }

    .fm.fm--tabs .fm__header-top{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }

    .fm.fm--tabs .fm__body{
      display:block;
      padding:0;
      overflow:hidden;
    }

    .fm.fm--tabs .fm__tabbar{
      display:flex;
      gap:10px;
      overflow:auto;
      padding:0 18px 14px;
      scrollbar-width:none;
    }

    .fm.fm--tabs .fm__tabbar::-webkit-scrollbar{
      display:none;
    }

    .fm.fm--tabs .fm__tab{
      flex:0 0 auto;
      min-height:38px;
      padding:0 14px;
      border-radius:999px;
      border:1px solid rgba(15,26,44,.08);
      background:#f4f6fa;
      color:rgba(15,26,44,.68);
      font-size:15px;
      font-weight:600;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      cursor:pointer;
      white-space:nowrap;
    }

    .fm.fm--tabs .fm__tab.is-active{
      background:#fff;
      color:#0f1a2c;
      box-shadow:0 10px 20px rgba(15,26,44,.06);
    }

    .fm.fm--tabs .fm__panel{
      display:flex;
      flex-direction:column;
      min-height:0;
      max-height:calc(88vh - 164px);
    }

    .fm.fm--tabs .fm__search-wrap{
      padding:0 18px 10px;
    }

    .fm.fm--tabs .fm__search-row{
      margin:0;
    }

    .fm.fm--tabs .fm__cuban-row{
      display:none;
    }

    .fm.fm--tabs .fm__list{
      overflow:auto;
      padding:0 18px 12px;
    }

    .fm.fm--tabs .fm__row{
      display:grid;
      grid-template-columns:30px 150px 1fr;
      gap:12px;
      align-items:center;
      min-height:58px;
      padding:10px 12px;
      border-radius:16px;
      border:1px solid rgba(15,26,44,.08);
      background:#fff;
      margin-bottom:10px;
    }

    .fm.fm--tabs .fm__row--logo{
      grid-template-columns:30px 42px minmax(0,1fr);
    }

    .fm.fm--tabs .fm__cb{
      width:22px;
      height:22px;
      border-radius:7px;
      border:2px solid rgba(15,26,44,.18);
      background:#fff;
      display:grid;
      place-items:center;
    }

    .fm.fm--tabs .fm__cb.is-checked{
      background:#eef2ff;
      border-color:#8ea4eb;
      color:#8ea4eb;
    }

    .fm.fm--tabs .fm__label{
      grid-column:2;
      min-width:0;
      font-size:17px;
      font-weight:700;
      letter-spacing:-.02em;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__info{
      display:none;
    }

    .fm.fm--tabs .fm__icon{
      grid-column:3;
      width:100%;
      min-width:0;
      height:42px;
      display:flex;
      align-items:center;
      justify-content:flex-start;
      overflow:visible;
    }

    .fm.fm--tabs .fm__icon img{
      height:32px;
      width:100%;
      max-width:100%;
      object-fit:contain;
      object-position:left center;
      display:block;
      transform:none !important;
    }

    .fm.fm--tabs .fm__icon--brand,
    .fm.fm--tabs .fm__icon--manufacturer{
      grid-column:auto;
      width:42px;
      min-width:42px;
      height:42px;
      justify-content:center;
    }

    .fm.fm--tabs .fm__icon--brand img,
    .fm.fm--tabs .fm__icon--manufacturer img{
      width:36px;
      height:36px;
      max-width:36px;
      object-fit:contain;
    }

    .fm.fm--tabs .fm__actions{
      position:relative;
      z-index:2;
      background:#fff;
    }

    @media (max-width:430px){
      .fm.fm--tabs .fm__row{
        grid-template-columns:28px 132px 1fr;
        gap:10px;
      }

      .fm.fm--tabs .fm__icon img{
        height:30px;
      }

      .fm.fm--tabs .fm__label{
        font-size:16px;
      }
    }

    @media (max-width:390px){
      .fm.fm--tabs .fm__row{
        grid-template-columns:26px 118px 1fr;
        gap:8px;
      }

      .fm.fm--tabs .fm__icon img{
        height:28px;
      }
    }
  `;

  document.head.appendChild(style);
}
   
    ensureInjectedStyles();
    if (!modalRoot) {
      modalRoot = document.createElement("div");
      modalRoot.id = "filter-modal";
      modalRoot.className = "fm fm--hidden fm--tabs";
      modalRoot.hidden = true;
      modalRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(modalRoot);
    } else {
      modalRoot.classList.add("fm--tabs");
    }
    if (!modalRoot.querySelector(".fm__sheet")) {
      modalRoot.innerHTML = `
        <div class="fm__backdrop" data-fm-close></div>
        <div class="fm__sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div class="fm__header">
            <div class="fm__header-top">
              <div class="fm__header-left">
                <h2 class="fm__title">Filters</h2>
              </div>
              <button class="fm__close" type="button" aria-label="Close filters" data-fm-close>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="fm__body">
            <div class="fm__tabbar" id="fm-tabbar"></div>
            <div class="fm__panel">
              <div class="fm__search-wrap">
                <div class="fm__search-row">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                          fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  </svg>
                  <input class="fm__search-input" id="fm-search-inline" placeholder="Search" autocomplete="off" />
                  <button class="fm__mic-btn" type="button" aria-label="Clear search" id="fm-search-clear">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
                            fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                      <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                      <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="fm__cuban-row">
                <button class="fm__cuban-toggle" type="button" id="fm-cuban-toggle" aria-label="Include Cubans">
                  <span class="fm__cuban-check">✓</span>
                  <span class="fm__cuban-text">Include Cubans 🇨🇺</span>
                </button>
              </div>
              <div class="fm__list" id="fm-list"></div>
            </div>
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
  function renderCubanToggle() {
    const btn = $("#fm-cuban-toggle", modalRoot);
    if (!btn) return;
    btn.classList.toggle("is-on", !!state.includeCubans);
  }
  function renderTabs() {
    const tabbar = $("#fm-tabbar", modalRoot);
    if (!tabbar) return;
    tabbar.innerHTML = CATEGORIES
      .map((c) => {
        const active = c.key === state.activeKey ? " is-active" : "";
        const count = countSelectedForKey(c.key);
        return `
          <button class="fm__tab${active}" type="button" data-cat="${escapeHtml(c.key)}">
            <span>${escapeHtml(c.label)}</span>
            ${count ? `<span class="fm__tab-count">${count}</span>` : ""}
          </button>
        `;
      })
      .join("");
    $$(".fm__tab", tabbar).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-cat");
        if (!key) return;
        state.activeKey = key;
        state.activeSearch = "";
        closeInfoSheet();
        renderTabs();
        renderList();
        const inp = $("#fm-search-inline", modalRoot);
        if (inp) {
          inp.value = "";
          inp.focus();
        }
      });
    });
  }
  function renderList() {
    const list = $("#fm-list", modalRoot);
    const input = $("#fm-search-inline", modalRoot);
    if (!list) return;
    if (input) input.value = state.activeSearch;
    const key = state.activeKey;
    const values = getValuesForKey(key);
    const selectedSet = state.selected[key];
    const q = norm(state.activeSearch).toLowerCase();
    const filtered = !q ? values : values.filter((v) => norm(v).toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = `<div class="fm__empty">No options found.</div>`;
      return;
    }
    list.innerHTML = filtered
      .map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);
        const isLogoRow = key === "manufacturer" || key === "brand";
        const brandOrManufacturerIcon = isLogoRow ? iconPathFor(key, label) : "";
        const cigarIcon =
          key === "vitola" || key === "shape" ? getCigarFilterIcon(label, key) : "";
        const iconSrc = brandOrManufacturerIcon || cigarIcon;
        const iconClass =
          key === "manufacturer"
            ? "fm__icon fm__icon--manufacturer"
            : key === "brand"
            ? "fm__icon fm__icon--brand"
            : "fm__icon fm__icon--cigar";
        const infoBtn =
          key === "shape" && getShapeInfo(label)
            ? `<button class="fm__info" type="button" data-info="${escapeHtml(label)}" aria-label="About ${escapeHtml(label)}">i</button>`
            : isLogoRow
            ? ""
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
        if (isLogoRow) {
          return `
            <div class="fm__row fm__row--logo ${isSelected ? "is-selected" : ""}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(label)}">
              ${cb}
              ${icon}
              <div class="fm__label">${escapeHtml(label)}</div>
            </div>
          `;
        }
        return `
          <div class="fm__row ${isSelected ? "is-selected" : ""}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(label)}">
            ${cb}
            <div class="fm__label">${escapeHtml(label)}</div>
            ${infoBtn}
            ${icon}
          </div>
        `;
      })
      .join("");
    $$(".fm__row", list).forEach((row) => {
      row.addEventListener("click", (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest(".fm__info")) return;
        const rowKey = row.getAttribute("data-key") || "";
        const val = row.getAttribute("data-value") || "";
        if (!rowKey || !val || !(state.selected[rowKey] instanceof Set)) return;
        if (state.selected[rowKey].has(val)) state.selected[rowKey].delete(val);
        else state.selected[rowKey].add(val);
        closeInfoSheet();
        renderTabs();
        renderList();
      });
    });
    $$("[data-info]", list).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const label = btn.getAttribute("data-info") || "";
        const text = getShapeInfo(label);
        if (!text) return;
        openInfoSheet(label, text);
      });
    });
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
  function openModal() {
    ensureModal();
    renderCubanToggle();
    modalRoot.hidden = false;
    modalRoot.classList.remove("fm--hidden");
    modalRoot.classList.add("is-open");
    modalRoot.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("sheet-open");
    renderTabs();
    renderList();
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
    state.includeCubans = !!g.includeCubans;
  }
  function pushLocalToGlobal() {
    ensureGlobalState();
    const g = window.__CIGAR_FILTER_STATE__;
    for (const k of Object.keys(state.selected)) {
      g.filters[k] = new Set([...state.selected[k]]);
    }
    g.includeCubans = !!state.includeCubans;
    g.q = (searchInput?.value || g.q || "").toString();
    renderAll();
  }
  function resetLocalSelections() {
    for (const k of Object.keys(state.selected)) {
      state.selected[k].clear();
    }
    state.includeCubans = false;
    closeInfoSheet();
    renderCubanToggle();
    renderTabs();
    renderList();
  }
  function openFiltersFromButton(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    syncLocalFromGlobal();
    openModal();
  }
  function bindFilterButton(root = document) {
    const buttons = root.querySelectorAll?.(
      "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
    );
    if (!buttons || !buttons.length) return;
    buttons.forEach((btn) => {
      if (btn.__cigarsFilterBound) return;
      btn.__cigarsFilterBound = true;
      btn.addEventListener("click", openFiltersFromButton, { passive: false });
      btn.addEventListener("pointerup", openFiltersFromButton, { passive: false });
      btn.addEventListener("touchend", openFiltersFromButton, { passive: false });
    });
  }
  function observeForFilterButton() {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          bindFilterButton(n);
          if (
            n.matches?.(
              "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
            )
          ) {
            bindFilterButton(document);
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  searchInput?.addEventListener("input", () => {
    ensureGlobalState();
    window.__CIGAR_FILTER_STATE__.q = (searchInput.value || "").toString();
    renderAll();
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const filterBtn = target.closest(
      "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
    );
    if (filterBtn) {
      openFiltersFromButton(e);
      return;
    }
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    if (target.closest("[data-fm-close]")) {
      closeModal();
      return;
    }
    if (target.closest("#fm-info-close")) {
      closeInfoSheet();
      return;
    }
    if (target.closest("#fm-reset")) {
      resetLocalSelections();
      return;
    }
    if (target.closest("#fm-apply")) {
      pushLocalToGlobal();
      closeModal();
      return;
    }
    if (target.closest("#fm-search-clear")) {
      state.activeSearch = "";
      renderList();
      $("#fm-search-inline", modalRoot)?.focus();
      return;
    }
    if (target.closest("#fm-cuban-toggle")) {
      state.includeCubans = !state.includeCubans;
      closeInfoSheet();
      renderCubanToggle();
      renderTabs();
      renderList();
    }
  });
  document.addEventListener("input", (e) => {
    if (!modalRoot || modalRoot.classList.contains("fm--hidden")) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.id !== "fm-search-inline") return;
    state.activeSearch = t.value || "";
    renderList();
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
      ensureModal();
      if (searchInput) searchInput.value = window.__CIGAR_FILTER_STATE__.q || "";
      bindFilterButton(document);
      observeForFilterButton();
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
      if (listRoot) {
        listRoot.innerHTML = `<div class="cigars-empty">Failed to load cigars.</div>`;
      }
    }
  }
  init();
})();
