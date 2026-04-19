/* /pos/cigars/brand.js
   Brand page
   - Loads cigar rows from Google Sheets CSV
   - Loads brand metadata from /data/brands.json
   - Brand header/icon resolved from data/brands.json first
   - Row icons pull from /img/icons/brands/{slug}.svg then .png
   - Brand-specific filtering
   - Bands sheet
   - Tabbed bottom-sheet filters matching main cigars page
   - Vitola/shape SVG icons in brand filters
   - Shape info buttons
   - Cleaner brand-row layout
   - Add-to-invoice sheet with stick/box toggle
   - Vertical quantity wheel (1–99)
   - Brand icon only on rows
   - Better detail-page opening fallback
   - Manufacturer subtitle under brand title only when not duplicate
   - Padron bands driven from Line column
*/

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const BRANDS_URL = "/data/brands.json";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brandTitle = $("#brand-title");
  const brandIconImg = $("#brand-icon-img");
  const searchInput = $("#brand-search");
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");
  const seg = $("#wrapper-seg");
  const segSwitch = $("#wrapper-switch");
  const segBtns = $$(".seg-btn", seg || document);
  const listEl = $("#brand-list");
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");
  const backBtn = $("#back-btn");
  const brandSearchBtn = $("#brandSearchBtn");

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

  const FILTER_CATEGORIES = [
    { key: "vitola", label: "Vitolas" },
    { key: "ring", label: "Ring" },
    { key: "length", label: "Length" },
    { key: "strength", label: "Strength" },
    { key: "shape", label: "Shape" },
    { key: "shade", label: "Wrap. Shade" },
  ];

  const DEFAULT_STICK_STOCK = 89;
  const DEFAULT_BOX_STOCK = 9;
  const DEFAULT_BOX_QTY = 20;
  const DEFAULT_MSRP = 0;

  const state = {
    brand: "",
    brandQuery: "",
    brandMeta: null,
    brandsAll: [],
    rowsAll: [],
    search: "",
    wrapperMode: "all",
    bandSelected: new Set(),
    filters: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
    activeFilterKey: "vitola",
    activeFilterSearch: "",
  };

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }

  function normalizeFilenamePart(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function esc(s) {
    return String(s ?? "")
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
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();
  }

  function normalizeLoose(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/["'’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqSorted(values) {
    const set = new Set();
    for (const value of values || []) {
      const s = norm(value);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function parseMoneyValue(v) {
    const cleaned = String(v || "").replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }

  function fmtMoney(v) {
    return Number(v || 0).toFixed(2);
  }

  function parseCSV(text) {
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cur.push(field);
          field = "";
        } else if (ch === "\n") {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if (ch !== "\r") {
          field += ch;
        }
      }
    }

    cur.push(field);
    rows.push(cur);
    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "_");
  }

  function mapRows(csv) {
    const header = csv[0] || [];
    const keys = header.map(normalizeHeader);
    const out = [];

    for (let i = 1; i < csv.length; i++) {
      const r = csv[i];
      if (!r || r.every((c) => !String(c || "").trim())) continue;

      const obj = {};
      keys.forEach((k, idx) => {
        obj[k] = (r[idx] ?? "").trim();
      });
      out.push(obj);
    }

    return out;
  }

  function getField(r, keys) {
    for (const k of keys) {
      if (r && r[k] != null && String(r[k]).trim() !== "") {
        return String(r[k]).trim();
      }
    }
    return "";
  }

  function resolveBrandVal(r) {
    return getField(r, ["brand", "brand_name", "manufacturer_brand", "cigar_brand"]);
  }

  function resolveManufacturerVal(r) {
    return getField(r, ["manufacturer", "maker"]);
  }

  function resolveDetailKey(r) {
    return getField(r, ["key", "cigar_id", "id", "row_id"]);
  }

  function resolveName(r) {
    return getField(r, ["cigar", "name"]);
  }

  function resolveLine(r) {
    return getField(r, ["line", "series"]);
  }

  function resolveDisplayName(r) {
    const line = resolveLine(r);
    const name = resolveName(r);
    if (line && name) return `${line} ${name}`.replace(/\s+/g, " ").trim();
    return (line || name || "").replace(/\s+/g, " ").trim();
  }

  function resolveVitola(r) {
    return getField(r, ["vitola", "style", "vitola_name", "size"]);
  }

  function resolvePriceNumber(r) {
    const raw = getField(r, ["msrp"]);
    const parsed = parseMoneyValue(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function resolvePrice(r) {
    const price = resolvePriceNumber(r);
    return price > 0 ? fmtMoney(price) : "—";
  }

  function resolveBoxMsrpNumber(r) {
    const raw = getField(r, ["box_msrp", "box_price", "box_retail"]);
    const parsed = parseMoneyValue(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;

    const stick = resolvePriceNumber(r);
    const count = resolveBoxCount(r);
    const derived = stick * count;
    return Number.isFinite(derived) && derived > 0 ? derived : 0;
  }

  function resolveBoxPrice(r) {
    const price = resolveBoxMsrpNumber(r);
    return price > 0 ? fmtMoney(price) : "—";
  }

  function resolveRing(r) {
    return getField(r, ["ring", "ring_gauge", "rg"]);
  }

  function resolveLength(r) {
    return getField(r, ["length"]);
  }

  function resolveShape(r) {
    return getField(r, ["shape"]);
  }

  function resolveWrapper(r) {
    return getField(r, ["wrapper"]);
  }

  function resolveBinder(r) {
    return getField(r, ["binder"]);
  }

  function resolveFiller(r) {
    return getField(r, ["filler"]);
  }

  function resolveOrigin(r) {
    return getField(r, ["origin", "country_of_origin", "country"]);
  }

  function resolveStrength(r) {
    return getField(r, ["strength"]);
  }

  function resolveShade(r) {
    return getField(r, ["wrapper_shade", "wrapper_shade_type", "shade", "wrapper"]);
  }

  function resolveBrandImage(r) {
    return getField(r, ["brand_img", "brand_image", "brandicon", "brand_icon"]);
  }

  function resolveBoxCount(r) {
    const raw = getField(r, [
      "box_count",
      "box_qty",
      "box_quantity",
      "box",
      "count_per_box",
      "cigars_per_box",
      "qty_per_box",
    ]);
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOX_QTY;
  }

  function resolveStickStock(r) {
    const raw = getField(r, [
      "stock",
      "qty",
      "quantity",
      "inventory",
      "in_stock",
      "stick_stock",
      "single_stock",
    ]);
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_STICK_STOCK;
  }

  function resolveBoxStock(r) {
    const raw = getField(r, [
      "box_stock",
      "boxes",
      "boxes_in_stock",
      "inventory_boxes",
      "box_inventory",
    ]);
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_BOX_STOCK;
  }

  function resolveIsCuban(r) {
    const explicit = getField(r, ["cuban", "is_cuban"]);
    if (explicit) {
      const v = explicit.toLowerCase();
      if (["yes", "true", "1", "cuban"].includes(v)) return true;
      if (["no", "false", "0", "non-cuban", "non cuban"].includes(v)) return false;
    }
    return resolveOrigin(r).toLowerCase() === "cuba";
  }

  function buildGeneratedImageNames(r) {
    const brand = normalizeFilenamePart(resolveBrandVal(r) || state.brand);
    const line = normalizeFilenamePart(resolveLine(r));
    const cigar = normalizeFilenamePart(resolveName(r));
    const vitola = normalizeFilenamePart(resolveVitola(r));
    const names = [];

    if (brand && line && cigar) names.push(`${brand}${line}${cigar}`);
    if (brand && line && cigar && vitola) names.push(`${brand}${line}${cigar}${vitola}`);
    if (line && cigar) names.push(`${line}${cigar}`);
    if (line && cigar && vitola) names.push(`${line}${cigar}${vitola}`);

    return Array.from(new Set(names));
  }

  function brandDisplayName() {
    return state.brandMeta?.name || state.brand || "Brand";
  }

  function brandSlug() {
    return normalizeBrand(state.brandMeta?.slug || state.brandMeta?.name || state.brand || state.brandQuery);
  }

  function brandIconCandidates() {
    const metaImage = normalizeAssetPath(
      state.brandMeta?.image ||
      state.brandMeta?.icon ||
      state.brandMeta?.svg ||
      state.brandMeta?.img
    );

    const slug = brandSlug();
    const out = [];

    if (metaImage) out.push(metaImage);
    if (slug) {
      out.push(`/img/icons/brands/${slug}.svg`);
      out.push(`/img/icons/brands/${slug}.png`);
    }

    const sheetRow = state.rowsAll.find(
      (r) => normalizeBrand(resolveBrandVal(r)) === brandSlug()
    );
    const fromSheet = normalizeAssetPath(sheetRow ? resolveBrandImage(sheetRow) : "");
    if (fromSheet) out.push(fromSheet);

    return Array.from(new Set(out.filter(Boolean)));
  }

  function brandIconPath() {
    const list = brandIconCandidates();
    return list[0] || "";
  }

  function bindImageFallback(img, candidates = [], finalBehavior = "hide") {
    if (!img) return;

    const list = Array.from(new Set((candidates || []).filter(Boolean)));
    if (!list.length) {
      if (finalBehavior === "hide") img.style.visibility = "hidden";
      return;
    }

    let idx = 0;
    img.style.visibility = "";
    img.onerror = () => {
      idx += 1;
      if (idx < list.length) {
        img.src = list[idx];
      } else {
        img.onerror = null;
        if (finalBehavior === "hide") {
          img.style.visibility = "hidden";
        }
      }
    };
    img.src = list[0];
  }

  function findBrandMeta(query, brands) {
    const q = normalizeBrand(query);
    if (!q || !Array.isArray(brands)) return null;

    return (
      brands.find((b) => normalizeBrand(b.slug) === q) ||
      brands.find((b) => normalizeBrand(b.name) === q) ||
      brands.find((b) => {
        const slug = normalizeBrand(b.slug);
        const name = normalizeBrand(b.name);
        return !!slug && (slug.includes(q) || q.includes(slug) || name.includes(q) || q.includes(name));
      }) ||
      null
    );
  }

  async function loadBrandsMeta() {
    try {
      const res = await fetch(`${BRANDS_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`brands.json fetch failed: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("[brand.js] brands.json load failed:", err);
      return [];
    }
  }

  function getPadronBandLabelFromLine(line) {
    const raw = norm(line);
    const lc = raw.toLowerCase();

    if (!raw) return "";
    if (lc.includes("50th") || lc.includes("60th")) return "Padron Series";
    if (lc.includes("family reserve")) return "Family Reserve";
    if (lc.includes("1964")) return "1964 Anniversary";
    if (lc.includes("1926")) return "1926";
    if (lc.includes("black")) return "Black Series";
    if (lc.includes("damaso")) return "Damaso";
    if (lc.includes("1926 serie")) return "1926";
    if (lc.includes("serie 1926")) return "1926";
    if (lc.includes("serie 1964")) return "1964 Anniversary";
    if (lc.includes("1964 anniversary")) return "1964 Anniversary";
    return "Padron Series";
  }

  function getPadronBandArtFromLabel(label) {
    const lc = norm(label).toLowerCase();

    if (lc.includes("family reserve")) return "/img/icons/padronfamilyreserveband.svg";
    if (lc.includes("1964")) return "/img/icons/padron1964anniversaryband.svg";
    if (lc.includes("1926")) return "/img/icons/padron1926serieband.svg";
    if (lc.includes("black")) return "/img/icons/padronblackseriesband.svg";
    if (lc.includes("damaso")) return "/img/icons/padrondamasoband.svg";
    return "/img/icons/padronseriesband.svg";
  }

  function resolveBand(r) {
    const direct = getField(r, ["band", "band_key", "band_group", "band_name"]);
    if (direct && normalizeBrand(state.brand) !== "padron") return direct;

    if (normalizeBrand(state.brand) === "padron") {
      return getPadronBandLabelFromLine(resolveLine(r));
    }

    return direct || "";
  }

  function resolveBandArt(r) {
    const direct = getField(r, [
      "band_art",
      "band_image",
      "band_img",
      "band_art_url",
      "band_url",
    ]);
    if (direct && normalizeBrand(state.brand) !== "padron") return direct;

    if (normalizeBrand(state.brand) === "padron") {
      return getPadronBandArtFromLabel(resolveBand(r));
    }

    return direct || "";
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
      if (v.includes("pyramid") || v.includes("piramide") || v.includes("piramides")) {
        return "/uxui/cigaricons/torpedo.svg";
      }
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("culebra")) return "/uxui/cigaricons/lonsdale.svg";
    }

    return "";
  }

  function getShapeInfo(value = "") {
    return SHAPE_INFO[slugify(value).replace(/-/g, "")] || SHAPE_INFO[slugify(value)] || "";
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

  function uniqSortedBrand(vals, numeric = false) {
    const arr = Array.from(new Set((vals || []).map((v) => String(v || "").trim()).filter(Boolean)));
    return arr.sort((a, b) => {
      if (!numeric) return a.localeCompare(b);
      return parseFloat(a) - parseFloat(b);
    });
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

  function buildFilterData(rows) {
    return {
      vitola: orderVitolas(rows.map(resolveVitola)),
      ring: uniqSortedBrand(rows.map(resolveRing), true),
      length: uniqSortedBrand(rows.map(resolveLength), true),
      strength: uniqSortedBrand(rows.map(resolveStrength)),
      shape: orderShapes(rows.map(resolveShape)),
      shade: uniqSortedBrand(rows.map(resolveShade)),
    };
  }

  function countSelectedForKey(key) {
    return state.filters[key] instanceof Set ? state.filters[key].size : 0;
  }

  function ensureInjectedStyles() {
    if ($("#brand-inline-filter-style")) return;

    const style = document.createElement("style");
    style.id = "brand-inline-filter-style";
    style.textContent = `
      .fm.fm--tabs .fm__sheet{
        max-height:88vh;
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

      .fm.fm--tabs .fm__header-left{
        display:flex;
        flex-direction:column;
        gap:10px;
        min-width:0;
        flex:1 1 auto;
      }

      .fm.fm--tabs .fm__title{
        font-weight:800;
      }

      .fm.fm--tabs .fm__body{
        display:block;
        padding:0 0 0;
        overflow:hidden;
      }

      .fm.fm--tabs .fm__tabbar{
        display:flex;
        gap:10px;
        overflow:auto;
        padding:0 18px 14px;
        -ms-overflow-style:none;
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
        font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-size:15px;
        font-weight:500;
        letter-spacing:-.01em;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        cursor:pointer;
        appearance:none;
        white-space:nowrap;
      }

      .fm.fm--tabs .fm__tab.is-active{
        background:#ffffff;
        color:#0f1a2c;
        border-color:rgba(15,26,44,.10);
        box-shadow:0 10px 20px rgba(15,26,44,.06);
      }

      .fm.fm--tabs .fm__tab-count{
        min-width:18px;
        height:18px;
        padding:0 6px;
        border-radius:999px;
        background:#e8eefc;
        color:#5f7edc;
        font-size:11px;
        font-weight:600;
        display:grid;
        place-items:center;
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

      .fm.fm--tabs .fm__list{
        overflow:auto;
        padding:0 18px 12px;
      }

      .fm.fm--tabs .fm__row{
        display:grid;
        grid-template-columns:30px minmax(0,1fr) auto 150px;
        gap:12px;
        align-items:center;
        min-height:58px;
        padding:10px 12px;
        border-radius:16px;
        border:1px solid rgba(15,26,44,.08);
        background:#fff;
        margin-bottom:10px;
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

      .fm.fm--tabs .fm__cb svg{
        width:14px;
        height:14px;
      }

      .fm.fm--tabs .fm__label{
        min-width:0;
        font-family:var(--font-display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
        font-size:17px;
        font-weight:600;
        letter-spacing:-.02em;
        color:#0f1a2c;
      }

      .fm.fm--tabs .fm__info{
        width:24px;
        height:24px;
        border:0;
        background:transparent;
        color:#97a0b0;
        font-size:16px;
        font-weight:500;
        line-height:1;
        display:grid;
        place-items:center;
        cursor:pointer;
        padding:0;
        appearance:none;
      }

      .fm.fm--tabs .fm__icon{
        width:150px;
        min-width:150px;
        height:22px;
        display:flex;
        align-items:center;
        justify-content:flex-start;
        overflow:visible;
      }

      .fm.fm--tabs .fm__icon img{
        height:12px;
        width:auto;
        max-width:118px;
        object-fit:contain;
        display:block;
      }

      .fm.fm--tabs .fm__search-input{
        font-weight:500;
      }

      .fm.fm--tabs .fm__btn{
        font-weight:600;
      }

      .fm.fm--tabs .fm__info-sheet{
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

      .fm.fm--tabs .fm__info-sheet.is-open{
        display:block;
      }

      .fm.fm--tabs .fm__info-title{
        margin:0 0 6px;
        font-size:18px;
        line-height:1.2;
        font-weight:700;
        color:#0f1a2c;
      }

      .fm.fm--tabs .fm__info-text{
        margin:0;
        font-size:15px;
        line-height:1.35;
        font-weight:500;
        color:rgba(15,26,44,.72);
      }

      .fm.fm--tabs .fm__info-close{
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

      .fm.fm--tabs .fm__actions{
        position:relative;
        z-index:2;
        background:#fff;
      }

      .fm.fm--tabs .fm__empty{
        padding:16px 6px 10px;
        color:rgba(15,26,44,.48);
        font-size:16px;
        font-weight:500;
      }

      @media (max-width:430px){
        .fm.fm--tabs .fm__header{
          padding:18px 18px 10px;
        }

        .fm.fm--tabs .fm__panel{
          max-height:calc(88vh - 160px);
        }

        .fm.fm--tabs .fm__row{
          grid-template-columns:28px minmax(0,1fr) auto 132px;
          gap:10px;
          min-height:56px;
          padding:10px 10px;
        }

        .fm.fm--tabs .fm__icon{
          width:132px;
          min-width:132px;
        }

        .fm.fm--tabs .fm__icon img{
          max-width:104px;
          height:12px;
        }

        .fm.fm--tabs .fm__label{
          font-size:16px;
        }
      }

      @media (max-width:390px){
        .fm.fm--tabs .fm__row{
          grid-template-columns:26px minmax(0,1fr) auto 118px;
          gap:8px;
        }

        .fm.fm--tabs .fm__icon{
          width:118px;
          min-width:118px;
        }

        .fm.fm--tabs .fm__icon img{
          max-width:90px;
          height:11px;
        }

        .fm.fm--tabs .fm__tab{
          padding:0 12px;
          font-size:14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  let filterModal = null;
  let invoiceSheet = null;

  function ensureFilterModal() {
    ensureInjectedStyles();

    if (filterModal) return filterModal;

    const modal = document.createElement("div");
    modal.id = "brand-filter-modal";
    modal.className = "fm fm--hidden fm--tabs";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
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

    document.body.appendChild(modal);

    function renderTabs() {
      const tabbar = $("#fm-tabbar", modal);
      if (!tabbar) return;

      tabbar.innerHTML = FILTER_CATEGORIES.map((c) => {
        const active = c.key === state.activeFilterKey ? " is-active" : "";
        const count = countSelectedForKey(c.key);

        return `
          <button class="fm__tab${active}" type="button" data-cat="${esc(c.key)}">
            <span>${esc(c.label)}</span>
            ${count ? `<span class="fm__tab-count">${count}</span>` : ""}
          </button>
        `;
      }).join("");

      $$(".fm__tab", tabbar).forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.getAttribute("data-cat");
          if (!key) return;
          state.activeFilterKey = key;
          state.activeFilterSearch = "";
          closeInfoSheet();
          renderTabs();
          renderList();
          const inp = $("#fm-search-inline", modal);
          if (inp) {
            inp.value = "";
            inp.focus();
          }
        });
      });
    }

    function renderList() {
      const list = $("#fm-list", modal);
      const input = $("#fm-search-inline", modal);
      if (!list) return;

      if (input) input.value = state.activeFilterSearch;

      const data = buildFilterData(applyWrapperMode([...state.rowsAll]));
      const key = state.activeFilterKey;
      const values = data[key] || [];
      const selectedSet = state.filters[key];
      const q = norm(state.activeFilterSearch).toLowerCase();

      const filtered = !q
        ? values
        : values.filter((v) => norm(v).toLowerCase().includes(q));

      if (!filtered.length) {
        list.innerHTML = `<div class="fm__empty">No options found.</div>`;
        return;
      }

      list.innerHTML = filtered.map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);
        const cigarIcon =
          key === "vitola" || key === "shape"
            ? getCigarFilterIcon(label, key)
            : "";

        const infoBtn =
          key === "shape" && getShapeInfo(label)
            ? `<button class="fm__info" type="button" data-info="${esc(label)}" aria-label="About ${esc(label)}">i</button>`
            : `<span class="fm__info" aria-hidden="true"></span>`;

        const cb = isSelected
          ? `<div class="fm__cb is-checked" aria-hidden="true">
               <svg viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>`
          : `<div class="fm__cb" aria-hidden="true"></div>`;

        const icon = cigarIcon
          ? `<div class="fm__icon">
               <img src="${esc(cigarIcon)}" alt="" loading="lazy" decoding="async"
                    onerror="this.style.display='none';" />
             </div>`
          : `<div class="fm__icon" aria-hidden="true"></div>`;

        return `
          <div class="fm__row ${isSelected ? "is-selected" : ""}" data-key="${esc(key)}" data-value="${esc(label)}">
            ${cb}
            <div class="fm__label">${esc(label)}</div>
            ${infoBtn}
            ${icon}
          </div>
        `;
      }).join("");

      $$(".fm__row", list).forEach((row) => {
        row.addEventListener("click", (e) => {
          const target = e.target;
          if (target instanceof Element && target.closest(".fm__info")) return;

          const rowKey = row.getAttribute("data-key") || "";
          const val = row.getAttribute("data-value") || "";
          if (!rowKey || !val || !(state.filters[rowKey] instanceof Set)) return;

          if (state.filters[rowKey].has(val)) state.filters[rowKey].delete(val);
          else state.filters[rowKey].add(val);

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
      $("#fm-info-sheet", modal)?.classList.remove("is-open");
    }

    function openInfoSheet(title, text) {
      const sheet = $("#fm-info-sheet", modal);
      const titleEl = $("#fm-info-title", modal);
      const textEl = $("#fm-info-text", modal);

      if (!sheet || !titleEl || !textEl) return;

      titleEl.textContent = title;
      textEl.textContent = text;
      sheet.classList.add("is-open");
    }

    function open() {
      state.activeFilterKey = state.activeFilterKey || "vitola";
      state.activeFilterSearch = "";
      closeInfoSheet();
      renderTabs();
      renderList();

      modal.hidden = false;
      modal.classList.remove("fm--hidden");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("sheet-open");

      window.setTimeout(() => {
        $("#fm-search-inline", modal)?.focus();
      }, 60);
    }

    function close() {
      closeInfoSheet();
      modal.classList.remove("is-open");
      modal.classList.add("fm--hidden");
      modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sheet-open");
      window.setTimeout(() => {
        if (!modal.classList.contains("is-open")) {
          modal.hidden = true;
        }
      }, 260);
    }

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.closest("[data-fm-close]")) {
        close();
        return;
      }

      if (t.closest("#fm-info-close")) {
        closeInfoSheet();
        return;
      }

      if (t.closest("#fm-reset")) {
        Object.values(state.filters).forEach((set) => set.clear());
        closeInfoSheet();
        renderTabs();
        renderList();
        return;
      }

      if (t.closest("#fm-apply")) {
        close();
        applyAll();
        return;
      }

      if (t.closest("#fm-search-clear")) {
        state.activeFilterSearch = "";
        renderList();
        $("#fm-search-inline", modal)?.focus();
      }
    });

    modal.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.id !== "fm-search-inline") return;
      state.activeFilterSearch = t.value || "";
      renderList();
    });

    filterModal = { open, close };
    return filterModal;
  }

  function ensureInvoiceSheet() {
    if (invoiceSheet) return invoiceSheet;

    const root = document.createElement("div");
    root.className = "invoice-sheet";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");

    root.innerHTML = `
      <div class="invoice-sheet__backdrop" data-invoice-close></div>
      <div class="invoice-sheet__card" role="dialog" aria-modal="true" aria-label="Add to Invoice">
        <div class="invoice-sheet__head">
          <h2 class="invoice-sheet__title">Add to Invoice</h2>
          <div class="invoice-sheet__name" id="invoice-sheet-name"></div>
          <button class="invoice-sheet__close" type="button" aria-label="Close" data-invoice-close>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="invoice-sheet__body">
          <div class="invoice-type-switch" id="invoice-type-switch"></div>

          <div class="invoice-picker-card">
            <div class="invoice-picker-card__top">
              <div class="invoice-picker-card__meta">
                <div class="invoice-picker-card__kind" id="invoice-kind-label"></div>
                <div class="invoice-picker-card__each" id="invoice-each-label"></div>
              </div>

              <div class="invoice-picker-card__total">
                <div class="invoice-picker-card__total-label">Total</div>
                <div class="invoice-picker-card__total-value" id="invoice-total-value"></div>
              </div>
            </div>

            <div class="invoice-wheel">
              <div class="invoice-wheel__highlight"></div>
              <div class="invoice-wheel__scroller" id="invoice-wheel-scroller"></div>
            </div>
          </div>
        </div>

        <div class="invoice-sheet__actions">
          <button class="invoice-sheet__add" type="button" id="invoice-add-btn">Add</button>
          <button class="invoice-sheet__cancel" type="button" data-invoice-close>Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const ui = {
      root,
      name: $("#invoice-sheet-name", root),
      switchEl: $("#invoice-type-switch", root),
      kindLabel: $("#invoice-kind-label", root),
      eachLabel: $("#invoice-each-label", root),
      totalValue: $("#invoice-total-value", root),
      wheel: $("#invoice-wheel-scroller", root),
      addBtn: $("#invoice-add-btn", root),
    };

    const localState = {
      row: null,
      options: [],
      selectedType: "stick",
      qty: 1,
      onConfirm: null,
      itemHeight: 44,
    };

    function getOption(type) {
      return localState.options.find((opt) => opt.type === type) || null;
    }

    function getSelectedOption() {
      return getOption(localState.selectedType) || localState.options[0] || null;
    }

    function renderTypeSwitch() {
      ui.switchEl.innerHTML = localState.options.map((opt) => `
        <button class="invoice-type-btn${opt.type === localState.selectedType ? " is-active" : ""}" type="button" data-type="${esc(opt.type)}">
          <span class="invoice-type-btn__label">${esc(opt.label)}</span>
          <span class="invoice-type-btn__price">$${esc(fmtMoney(opt.unitPrice))}</span>
        </button>
      `).join("");

      $$("[data-type]", ui.switchEl).forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.getAttribute("data-type") || "stick";
          if (!getOption(type)) return;
          localState.selectedType = type;
          renderTypeSwitch();
          renderSummary();
        });
      });
    }

    function renderWheel() {
      const items = [];
      for (let i = 1; i <= 99; i++) {
        items.push(`
          <div class="invoice-wheel__item${i === localState.qty ? " is-active" : ""}" data-qty="${i}">
            ${i}
          </div>
        `);
      }
      ui.wheel.innerHTML = items.join("");
    }

    function renderSummary() {
      const option = getSelectedOption();
      if (!option) return;

      ui.kindLabel.textContent = option.label;
      ui.eachLabel.textContent = `$${fmtMoney(option.unitPrice)} each`;
      ui.totalValue.textContent = `$${fmtMoney(option.unitPrice * localState.qty)}`;

      $$(".invoice-wheel__item", ui.wheel).forEach((el) => {
        const isActive = Number(el.getAttribute("data-qty")) === localState.qty;
        el.classList.toggle("is-active", isActive);
      });
    }

    function scrollWheelToQty(qty, smooth = false) {
      const paddingTop = 62;
      const top = paddingTop + (qty - 1) * localState.itemHeight;
      ui.wheel.scrollTo({
        top,
        behavior: smooth ? "smooth" : "auto",
      });
    }

    function snapWheel() {
      const paddingTop = 62;
      const raw = (ui.wheel.scrollTop - paddingTop) / localState.itemHeight;
      const qty = Math.min(99, Math.max(1, Math.round(raw) + 1));
      localState.qty = qty;
      renderSummary();
      scrollWheelToQty(qty, true);
    }

    let wheelSnapTimer = null;
    ui.wheel.addEventListener("scroll", () => {
      const paddingTop = 62;
      const raw = (ui.wheel.scrollTop - paddingTop) / localState.itemHeight;
      const qty = Math.min(99, Math.max(1, Math.round(raw) + 1));
      if (qty !== localState.qty) {
        localState.qty = qty;
        renderSummary();
      }

      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = window.setTimeout(() => {
        snapWheel();
      }, 90);
    });

    ui.wheel.addEventListener("click", (e) => {
      const item = e.target instanceof Element ? e.target.closest(".invoice-wheel__item") : null;
      if (!item) return;
      const qty = Number(item.getAttribute("data-qty") || "1");
      localState.qty = Math.min(99, Math.max(1, qty));
      renderSummary();
      scrollWheelToQty(localState.qty, true);
    });

    function open(row, onConfirm) {
      const stickPrice = resolvePriceNumber(row);
      const boxPrice = resolveBoxMsrpNumber(row);

      const options = [];
      if (stickPrice > 0) {
        options.push({ type: "stick", label: "Stick", unitPrice: stickPrice });
      }
      if (boxPrice > 0) {
        options.push({ type: "box", label: "Box", unitPrice: boxPrice });
      }

      if (!options.length) return;

      localState.row = row;
      localState.options = options;
      localState.selectedType = options[0].type;
      localState.qty = 1;
      localState.onConfirm = onConfirm;

      ui.name.textContent = resolveDisplayName(row) || "Cigar";
      renderTypeSwitch();
      renderWheel();
      renderSummary();

      root.hidden = false;
      root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("sheet-open");

      window.setTimeout(() => {
        scrollWheelToQty(localState.qty, false);
      }, 20);
    }

    function close() {
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sheet-open");
      window.setTimeout(() => {
        if (!root.classList.contains("is-open")) root.hidden = true;
      }, 220);
    }

    root.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.closest("[data-invoice-close]")) {
        close();
        return;
      }

      if (t.closest("#invoice-add-btn")) {
        const option = getSelectedOption();
        if (!option || typeof localState.onConfirm !== "function") return;

        localState.onConfirm({
          type: option.type,
          qty: localState.qty,
          unitPrice: option.unitPrice,
        });

        if (navigator.vibrate) navigator.vibrate(12);
        close();
      }
    });

    invoiceSheet = { open, close };
    return invoiceSheet;
  }

  function ensureBrandManufacturerMeta() {
    const titleBlock = document.querySelector(".brand-title-block");
    if (!titleBlock) return null;

    let meta = titleBlock.querySelector(".brand-manufacturer");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "brand-manufacturer";
      titleBlock.appendChild(meta);
    }
    return meta;
  }

  function setBrandHeader() {
    const displayBrand = brandDisplayName();

    if (brandTitle) brandTitle.textContent = displayBrand || "Brand";

    const manufacturerMeta = ensureBrandManufacturerMeta();
    const firstRow = state.rowsAll[0];
    const manufacturer = firstRow ? resolveManufacturerVal(firstRow) : "";

    if (manufacturerMeta) {
      const show =
        manufacturer &&
        normalizeBrand(manufacturer) !== normalizeBrand(displayBrand);

      manufacturerMeta.textContent = show ? manufacturer : "";
      manufacturerMeta.style.display = show ? "" : "none";
    }

    if (!brandIconImg) return;

    brandIconImg.alt = displayBrand || "Brand";
    bindImageFallback(brandIconImg, brandIconCandidates(), "hide");
  }

  function openBandsSheet() {
    if (!sheetBands) return;
    sheetBands.hidden = false;
    document.documentElement.classList.add("sheet-open");
  }

  function closeBandsSheet() {
    if (!sheetBands) return;
    sheetBands.hidden = true;
    document.documentElement.classList.remove("sheet-open");
  }

  function makeDetailHref(r) {
    const detailKey = resolveDetailKey(r);
    if (detailKey) {
      return `/pos/cigars/cigar.html?key=${encodeURIComponent(detailKey)}`;
    }

    const fallbackPipeKey = [state.brand, resolveDisplayName(r), resolveVitola(r)]
      .filter(Boolean)
      .join("|");

    if (fallbackPipeKey) {
      return `/pos/cigars/cigar.html?key=${encodeURIComponent(fallbackPipeKey)}`;
    }

    const slug = slugify(
      [resolveBrandVal(r), resolveLine(r), resolveName(r), resolveVitola(r)]
        .filter(Boolean)
        .join(" ")
    );

    return `/pos/cigars/cigar.html?slug=${encodeURIComponent(slug)}`;
  }

  function openDetail(r) {
    window.location.href = makeDetailHref(r);
  }

  function applyWrapperMode(rows) {
    if (normalizeBrand(state.brand) !== "padron") return rows;
    if (state.wrapperMode === "all") return rows;

    return rows.filter((r) => {
      const shade = resolveShade(r).toLowerCase();
      const name = resolveName(r).toLowerCase();

      if (state.wrapperMode === "maduro") {
        return shade.includes("maduro") || name.includes("maduro");
      }

      if (state.wrapperMode === "natural") {
        return shade.includes("natural") || name.includes("natural");
      }

      return true;
    });
  }

  function applySearch(rows) {
    const q = String(state.search || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const displayName = resolveDisplayName(r).toLowerCase();
      const vitola = resolveVitola(r).toLowerCase();
      const ring = resolveRing(r).toLowerCase();
      const length = resolveLength(r).toLowerCase();
      const manufacturer = resolveManufacturerVal(r).toLowerCase();
      const line = resolveLine(r).toLowerCase();

      return (
        displayName.includes(q) ||
        vitola.includes(q) ||
        ring.includes(q) ||
        length.includes(q) ||
        manufacturer.includes(q) ||
        line.includes(q)
      );
    });
  }

  function applyBandSelected(rows) {
    if (!state.bandSelected.size) return rows;

    return rows.filter((r) => {
      const band = resolveBand(r);
      return band && state.bandSelected.has(band);
    });
  }

  function applyFilterSets(rows) {
    return rows.filter((r) => {
      const vitola = resolveVitola(r);
      const ring = resolveRing(r);
      const length = resolveLength(r);
      const strength = resolveStrength(r);
      const shape = resolveShape(r);
      const shade = resolveShade(r);

      if (state.filters.vitola.size && !state.filters.vitola.has(vitola)) return false;
      if (state.filters.ring.size && !state.filters.ring.has(ring)) return false;
      if (state.filters.length.size && !state.filters.length.has(length)) return false;
      if (state.filters.strength.size && !state.filters.strength.has(strength)) return false;
      if (state.filters.shape.size && !state.filters.shape.has(shape)) return false;
      if (state.filters.shade.size && !state.filters.shade.has(shade)) return false;

      return true;
    });
  }

  function buildCartItem(r, type = "stick") {
    const detailKey = resolveDetailKey(r);
    const isBox = type === "box";
    const unitPrice = isBox ? resolveBoxMsrpNumber(r) : resolvePriceNumber(r);

    return {
      key: `${detailKey || `${normalizeBrand(state.brand)}|${resolveDisplayName(r)}|${resolveVitola(r)}`}|${type}`,
      type: "cigar",
      purchaseType: type,
      category: "Cigars",
      id: detailKey || resolveName(r),
      brand: state.brand,
      manufacturer: resolveManufacturerVal(r),
      line: resolveLine(r),
      cigar: resolveName(r),
      name: `${resolveDisplayName(r)}${isBox ? " (Box)" : ""}`,
      displayName: resolveDisplayName(r),
      vitola: resolveVitola(r),
      ring: resolveRing(r),
      length: resolveLength(r),
      shape: resolveShape(r),
      wrapper: resolveWrapper(r),
      binder: resolveBinder(r),
      filler: resolveFiller(r),
      origin: resolveOrigin(r),
      shade: resolveShade(r),
      strength: resolveStrength(r),
      image: brandIconPath(),
      msrp: unitPrice,
      boxCount: resolveBoxCount(r),
      url: makeDetailHref(r),
    };
  }

  function openAddSheet(r) {
    const sheet = ensureInvoiceSheet();
    sheet.open(r, ({ type, qty }) => {
      const item = buildCartItem(r, type);
      const current = window.cigarOSCart?.getItemQty?.(item) || 0;
      window.cigarOSCart?.setQty?.(item, current + qty);
    });
  }

  function renderList(rows) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      return;
    }

    const rowIconCandidates = brandIconCandidates();
    const rowIconPath = rowIconCandidates[0] || "";

    rows.forEach((r) => {
      const priceText = resolvePrice(r);
      const isCuban = resolveIsCuban(r);

      const row = document.createElement("article");
      row.className = "brand-row";
      if (isCuban) row.setAttribute("data-cuban", "true");

      row.innerHTML = `
        <img class="row-ico" src="${esc(rowIconPath)}" alt="" loading="lazy" />

        <div class="brand-row-left">
          <div class="brand-row-title-wrap">
            <div class="brand-row-title">${esc(resolveDisplayName(r) || "Unnamed cigar")}</div>
            ${isCuban ? `<div class="brand-row-flag" aria-hidden="true">🇨🇺</div>` : ``}
          </div>
          <div class="brand-row-sub">${esc(resolveVitola(r) || "—")}</div>
        </div>

        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(priceText)}</div>
          <button class="qty-btn qty-btn--plus" type="button" aria-label="Add to invoice">+</button>
        </div>
      `;

      const icon = $(".row-ico", row);
      const left = $(".brand-row-left", row);
      const title = $(".brand-row-title", row);
      const plusBtn = $(".qty-btn--plus", row);

      bindImageFallback(icon, rowIconCandidates, "hide");

      left?.addEventListener("click", () => openDetail(r));
      title?.addEventListener("click", () => openDetail(r));
      icon?.addEventListener("click", () => openDetail(r));

      plusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        openAddSheet(r);
      });

      listEl.appendChild(row);
    });
  }

  function getBandOptions(rows) {
    const map = new Map();

    rows.forEach((r) => {
      const label = resolveBand(r);
      const art = resolveBandArt(r);

      if (label === "50th Anniversary" || label === "60th Anniversary") return;
      if (!label) return;
      if (!map.has(label)) map.set(label, { key: label, label, src: art });
    });

    const PADRON_ORDER = [
      "1926",
      "Padron Series",
      "Damaso",
      "1964 Anniversary",
      "Family Reserve"
    ];

    return Array.from(map.values()).sort((a, b) => {
      const ai = PADRON_ORDER.indexOf(a.label);
      const bi = PADRON_ORDER.indexOf(b.label);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  function renderBandOptions(opts) {
    if (!bandsOptions) return;

    bandsOptions.innerHTML = "";

    if (!opts.length) {
      bandsOptions.innerHTML = `<div class="empty">No bands available for this brand.</div>`;
      return;
    }

    opts.forEach((b) => {
      const card = document.createElement("div");
      card.className = "band-card";
      card.innerHTML = `
        <img class="band-art" src="${esc(b.src)}" alt="" loading="lazy" />
        <div class="band-meta">
          <div class="band-name">${esc(b.label)}</div>
          <input class="band-check" type="checkbox" ${state.bandSelected.has(b.key) ? "checked" : ""} />
        </div>
      `;

      const cb = $(".band-check", card);
      cb?.addEventListener("change", () => {
        if (cb.checked) state.bandSelected.add(b.key);
        else state.bandSelected.delete(b.key);
      });

      bandsOptions.appendChild(card);
    });
  }

  function applyAll() {
    let rows = [...state.rowsAll];
    rows = applyWrapperMode(rows);
    rows = applyFilterSets(rows);
    rows = applyBandSelected(rows);
    rows = applySearch(rows);
    renderList(rows);
    setBrandHeader();
  }

  function setWrapperMode(mode) {
    state.wrapperMode = mode;
    seg?.setAttribute("data-state", mode);

    segBtns.forEach((b) => {
      b.classList.toggle("is-on", b.dataset.state === mode);
    });

    applyAll();
  }

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  btnFilters?.addEventListener("click", () => {
    ensureFilterModal().open();
  });

  btnBands?.addEventListener("click", () => {
    const opts = getBandOptions(state.rowsAll);
    renderBandOptions(opts);
    openBandsSheet();
  });

  bandsConfirm?.addEventListener("click", () => {
    closeBandsSheet();
    applyAll();
  });

  segSwitch?.addEventListener("click", () => {
    if (normalizeBrand(state.brand) !== "padron") return;

    if (state.wrapperMode === "maduro") setWrapperMode("natural");
    else if (state.wrapperMode === "natural") setWrapperMode("all");
    else setWrapperMode("maduro");
  });

  segBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (normalizeBrand(state.brand) !== "padron") return;
      setWrapperMode(b.dataset.state || "all");
    });
  });

  brandSearchBtn?.addEventListener("click", () => {
    window.openGlobalSearch?.();
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("[data-sheet-close]")) closeBandsSheet();
    if (t === sheetBands) closeBandsSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeBandsSheet();
      if (filterModal) filterModal.close();
      if (invoiceSheet) invoiceSheet.close();
    }
  });

  document.addEventListener("cigaros:cart-changed", () => applyAll());

  async function boot() {
    if (!listEl) return;

    state.brandQuery = (getParam("brand") || "Padron").trim();
    state.brandsAll = await loadBrandsMeta();
    state.brandMeta = findBrandMeta(state.brandQuery, state.brandsAll);
    state.brand = state.brandMeta?.name || state.brandQuery;

    const isPadron = normalizeBrand(state.brand) === "padron";

    if (btnBands) {
      btnBands.style.display = isPadron ? "" : "none";
    }

    if (seg) {
      if (isPadron) {
        seg.style.display = "";
        seg.setAttribute("data-state", state.wrapperMode);
      } else {
        seg.style.display = "none";
        state.wrapperMode = "all";
      }
    }

    segBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.state === state.wrapperMode));

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const txt = await res.text();
    const rows = mapRows(parseCSV(txt));

    const needles = Array.from(
      new Set(
        [
          normalizeBrand(state.brandQuery),
          normalizeBrand(state.brandMeta?.slug),
          normalizeBrand(state.brandMeta?.name),
          normalizeBrand(state.brand),
        ].filter(Boolean)
      )
    );

    const exact = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return needles.includes(rb);
    });

    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb && needles.some((n) => rb.includes(n) || n.includes(rb));
    });

    const manufacturerFallback = rows.filter((r) => {
      const rm = normalizeBrand(resolveManufacturerVal(r));
      return needles.includes(rm);
    });

    state.rowsAll = (exact.length ? exact : fuzzy.length ? fuzzy : manufacturerFallback).map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    setBrandHeader();

    if (!state.rowsAll.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      return;
    }

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if (listEl) {
      listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
    }
  });
})();
