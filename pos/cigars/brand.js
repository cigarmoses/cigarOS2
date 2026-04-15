/* /pos/cigars/brand.js
   Brand page
   - Loads cigar rows from Google Sheets CSV
   - Brand-specific filtering
   - Bands sheet
   - Inline bottom-sheet filters
   - Cart qty steppers
   - Vitola/shape SVG icons in brand filters
   - Shape info buttons
   - Brand-row inventory layout
   - Brand icon only on rows
   - Better detail-page opening fallback
   - Manufacturer subtitle under brand title
*/

(() => {
  "use strict";

  const CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

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

  const state = {
    brand: "",
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

  function parseMoneyValue(v) {
    const cleaned = String(v || "").replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(v) {
    const n = parseMoneyValue(v);
    return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
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
    return getField(r, ["cigar"]);
  }

  function resolveLine(r) {
    return getField(r, ["line"]);
  }

  function resolveDisplayName(r) {
    const line = resolveLine(r);
    const name = resolveName(r);

    if (line && name) return `${line} ${name}`.replace(/\s+/g, " ").trim();
    return (line || name || "").replace(/\s+/g, " ").trim();
  }

  function resolveVitola(r) {
    return getField(r, ["vitola", "style", "vitola_name"]);
  }

  function resolvePrice(r) {
    return fmtMoney(getField(r, ["msrp", "price", "cost", "cigar_cost"]));
  }

  function resolvePriceNumber(r) {
    return parseMoneyValue(getField(r, ["msrp", "price", "cost", "cigar_cost"]));
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

  function resolveImage(r) {
    return getField(r, ["cigar_img", "image", "img", "photo", "cigar_image"]);
  }

  function resolveBrandImage(r) {
    return getField(r, ["brand_img", "brand_image", "brandicon", "brand_icon"]);
  }

  function resolveUrl(r) {
    return getField(r, ["url", "link", "href", "page_url", "product_url", "slug_url"]);
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
    return Number.isFinite(n) && n > 0 ? n : 0;
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
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_STICK_STOCK;
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
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_BOX_STOCK;
  }

  function resolveIsCuban(r) {
    const explicit = getField(r, ["cuban", "is_cuban"]);
    if (explicit) {
      const v = explicit.toLowerCase();
      if (["yes", "true", "1", "cuban"].includes(v)) return true;
      if (["no", "false", "0", "non-cuban", "non cuban"].includes(v)) return false;
    }

    const origin = resolveOrigin(r).toLowerCase();
    return origin === "cuba";
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

  function brandIconPath() {
    const row = state.rowsAll.find((r) => normalizeBrand(resolveBrandVal(r)) === normalizeBrand(state.brand));
    const fromSheet = normalizeAssetPath(row ? resolveBrandImage(row) : "");
    if (fromSheet) return fromSheet;
    return `/img/icons/brands/${normalizeBrand(state.brand)}.svg`;
  }

  function listRowImageCandidates(r) {
    const candidates = [];
    const fromSheet = normalizeAssetPath(resolveImage(r));
    const brandFolder = normalizeBrand(resolveBrandVal(r) || state.brand);

    if (fromSheet) candidates.push(fromSheet);

    buildGeneratedImageNames(r).forEach((name) => {
      candidates.push(`/img/cigars/${brandFolder}/${name}.png`);
    });

    candidates.push(brandIconPath());

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function listRowIconPath() {
    return brandIconPath();
  }

  function bindImageFallback(img, candidates = []) {
    if (!img) return;

    let idx = 0;
    const fallbackList = Array.isArray(candidates) && candidates.length ? candidates : [brandIconPath()];

    img.addEventListener("error", () => {
      idx += 1;
      if (idx < fallbackList.length) img.src = fallbackList[idx];
      else img.src = brandIconPath();
    });
  }

  function resolveBand(r) {
    const direct = getField(r, ["band", "band_key", "band_group", "band_name"]);
    if (direct) return direct;

    if (normalizeBrand(state.brand) !== "padron") return "";

    const full = `${resolveName(r)} ${resolveVitola(r)} ${resolveShade(r)}`.toLowerCase();

    if (full.includes("family reserve")) return "Family Reserve";
    if (full.includes("1964") || full.includes("anniversary")) return "1964 Anniversary";
    if (full.includes("1926")) return "1926";
    if (full.includes("black")) return "Black Series";
    if (full.includes("damaso")) return "Damaso";

    return "Padron Series";
  }

  function resolveBandArt(r) {
    const direct = getField(r, ["band_art", "band_image", "band_img", "band_art_url", "band_url"]);
    if (direct) return direct;

    if (normalizeBrand(state.brand) !== "padron") return "";

    const full = `${resolveName(r)} ${resolveVitola(r)} ${resolveShade(r)}`.toLowerCase();

    if (full.includes("family reserve")) return "/img/icons/padronfamilyreserveband.svg";
    if (full.includes("1964") || full.includes("anniversary")) return "/img/icons/padron1964anniversaryband.svg";
    if (full.includes("1926")) return "/img/icons/padron1926serieband.svg";
    if (full.includes("black")) return "/img/icons/padronblackseriesband.svg";
    if (full.includes("damaso")) return "/img/icons/padrondamasoband.svg";

    return "/img/icons/padronseriesband.svg";
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
    const arr = Array.from(new Set(vals.map((v) => String(v || "").trim()).filter(Boolean)));
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

  let filterModal = null;

  function ensureFilterModal() {
    ensureInjectedStyles();

    if (filterModal) return filterModal;

    const modal = document.createElement("div");
    modal.className = "fm fm--hidden fm--inline";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="fm__backdrop" data-fm-close></div>
      <div class="fm__sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="fm__header">
          <h2 class="fm__title">Filters</h2>
          <button class="fm__close" type="button" data-fm-close aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
            </svg>
          </button>
        </div>

        <div class="fm__body">
          <div class="fm__stack"></div>
        </div>

        <div class="fm__info-sheet" aria-live="polite">
          <button class="fm__info-close" type="button" aria-label="Close info">×</button>
          <h3 class="fm__info-title"></h3>
          <p class="fm__info-text"></p>
        </div>

        <div class="fm__actions">
          <button class="fm__btn fm__btn--reset" type="button" data-fm-clear>Reset</button>
          <button class="fm__btn fm__btn--apply" type="button" data-fm-apply>Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const stack = $(".fm__stack", modal);
    const infoSheet = $(".fm__info-sheet", modal);
    const infoTitle = $(".fm__info-title", modal);
    const infoText = $(".fm__info-text", modal);
    const infoClose = $(".fm__info-close", modal);

    let dataByKey = {};

    function closeInfoSheet() {
      infoSheet?.classList.remove("is-open");
    }

    function openInfoSheet(title, text) {
      if (!infoSheet || !infoTitle || !infoText) return;
      infoTitle.textContent = title;
      infoText.textContent = text;
      infoSheet.classList.add("is-open");
    }

    function renderInlineSections() {
      stack.innerHTML = FILTER_CATEGORIES.map((c) => {
        const count = countSelectedForKey(c.key);
        const isOpen = c.key === state.activeFilterKey;
        const values = dataByKey[c.key] || [];
        const q = isOpen ? norm(state.activeFilterSearch).toLowerCase() : "";
        const filtered = isOpen
          ? (!q ? values : values.filter((v) => norm(v).toLowerCase().includes(q)))
          : [];

        const search = isOpen
          ? `
            <div class="fm__search-row">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
                <path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              </svg>
              <input class="fm__search-input" type="search" id="fm-search-inline" placeholder="Search" value="${esc(state.activeFilterSearch)}" />
              <button class="fm__mic-btn" type="button" aria-label="Clear search" id="fm-search-clear">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 15a3 3 0 0 0 3-3V8a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" fill="currentColor"></path>
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                </svg>
              </button>
            </div>
          `
          : "";

        const rows = isOpen
          ? filtered.length
            ? filtered.map((value) => {
                const label = norm(value);
                const isSelected = state.filters[c.key].has(label);
                const icon = getCigarFilterIcon(label, c.key);
                const shapeInfo = c.key === "shape" ? getShapeInfo(label) : "";

                const infoBtn = shapeInfo
                  ? `<button class="fm__info" type="button" data-info="${esc(label)}" aria-label="About ${esc(label)}">ℹ</button>`
                  : `<span class="fm__info" aria-hidden="true"></span>`;

                return `
                  <div class="fm__row ${isSelected ? " is-selected" : ""}" data-key="${esc(c.key)}" data-value="${esc(label)}">
                    <span class="fm__cb${isSelected ? " is-checked" : ""}">
                      ${isSelected ? `
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                      ` : ""}
                    </span>
                    <span class="fm__label">${esc(label)}</span>
                    ${infoBtn}
                    <span class="fm__icon">${icon ? `<img src="${esc(icon)}" alt="">` : ""}</span>
                  </div>
                `;
              }).join("")
            : `<div class="fm__empty">No options found.</div>`
          : "";

        return `
          <div class="fm__section">
            <button class="fm__section-btn" type="button" data-cat="${esc(c.key)}" aria-expanded="${isOpen ? "true" : "false"}">
              <span class="fm__section-title">${esc(c.label)}</span>
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
          state.activeFilterKey = key;
          state.activeFilterSearch = "";
          closeInfoSheet();
          renderInlineSections();
          $("#fm-search-inline", modal)?.focus();
        });
      });

      $$(".fm__row", stack).forEach((row) => {
        row.addEventListener("click", (e) => {
          const target = e.target;
          if (target instanceof Element && target.closest(".fm__info")) return;

          const key = row.getAttribute("data-key") || "";
          const value = row.getAttribute("data-value") || "";
          if (!key || !value) return;

          if (state.filters[key].has(value)) state.filters[key].delete(value);
          else state.filters[key].add(value);

          closeInfoSheet();
          renderInlineSections();
        });
      });

      $$("[data-info]", stack).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const value = btn.getAttribute("data-info") || "";
          const text = getShapeInfo(value);
          if (!text) return;
          openInfoSheet(value, text);
        });
      });

      const inlineSearch = $("#fm-search-inline", modal);
      inlineSearch?.addEventListener("input", () => {
        state.activeFilterSearch = inlineSearch.value || "";
        renderInlineSections();
      });

      $("#fm-search-clear", modal)?.addEventListener("click", () => {
        state.activeFilterSearch = "";
        renderInlineSections();
        $("#fm-search-inline", modal)?.focus();
      });
    }

    function open(data) {
      dataByKey = data;
      state.activeFilterKey = "vitola";
      state.activeFilterSearch = "";
      closeInfoSheet();
      renderInlineSections();
      modal.hidden = false;
      modal.classList.remove("fm--hidden");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("sheet-open");
    }

    function close() {
      closeInfoSheet();
      modal.classList.remove("is-open");
      modal.classList.add("fm--hidden");
      modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sheet-open");
      window.setTimeout(() => {
        if (!modal.classList.contains("is-open")) modal.hidden = true;
      }, 260);
    }

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("[data-fm-close]")) {
        close();
        return;
      }
      if (t && t.closest && t.closest("[data-fm-clear]")) {
        Object.values(state.filters).forEach((set) => set.clear());
        closeInfoSheet();
        renderInlineSections();
        return;
      }
      if (t && t.closest && t.closest("[data-fm-apply]")) {
        close();
        applyAll();
        return;
      }
    });

    infoClose?.addEventListener("click", () => {
      closeInfoSheet();
    });

    filterModal = { open, close };
    return filterModal;
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
    if (brandTitle) brandTitle.textContent = state.brand || "Brand";

    const manufacturerMeta = ensureBrandManufacturerMeta();
    const firstRow = state.rowsAll[0];
    const manufacturer = firstRow ? resolveManufacturerVal(firstRow) : "";

    if (manufacturerMeta) {
      manufacturerMeta.textContent = manufacturer || "";
      manufacturerMeta.style.display = manufacturer ? "" : "none";
    }

    if (!brandIconImg) return;

    brandIconImg.style.visibility = "";
    brandIconImg.src = brandIconPath();
    brandIconImg.onerror = () => {
      brandIconImg.style.visibility = "hidden";
    };
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

    const fallbackPipeKey = [
      state.brand,
      resolveDisplayName(r),
      resolveVitola(r)
    ].filter(Boolean).join("|");

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
      return (
        displayName.includes(q) ||
        vitola.includes(q) ||
        ring.includes(q) ||
        length.includes(q) ||
        manufacturer.includes(q)
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

  function buildCartItem(r) {
    const detailKey = resolveDetailKey(r);
    return {
      key: detailKey || `${normalizeBrand(state.brand)}|${resolveDisplayName(r)}|${resolveVitola(r)}`,
      type: "cigar",
      category: "Cigars",
      id: detailKey || resolveName(r),
      brand: state.brand,
      manufacturer: resolveManufacturerVal(r),
      line: resolveLine(r),
      cigar: resolveName(r),
      name: resolveDisplayName(r),
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
      msrp: resolvePriceNumber(r),
      image: listRowIconPath(),
      url: makeDetailHref(r)
    };
  }

  function getRowQty(item) {
    return window.cigarOSCart?.getItemQty?.(item) || 0;
  }

  function showBoxPurchasePrompt(r) {
    const displayName = resolveDisplayName(r) || "this box";
    const boxQty = resolveBoxCount(r) || 20;
    const msrp = resolvePriceNumber(r);
    const perCigar = boxQty > 0 && msrp > 0 ? (msrp / boxQty).toFixed(2) : "0.00";

    window.alert(`Purchase box of ${displayName}?\n(${boxQty} cigars per box) @ $${perCigar} per cigar`);
  }

  function renderList(rows) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(state.brand)}</div>`;
      return;
    }

    rows.forEach((r) => {
      const item = buildCartItem(r);
      const qty = getRowQty(item);
      const priceText = resolvePrice(r) || "—";
      const iconPath = brandIconPath();
      const stickStock = resolveStickStock(r);
      const boxStock = resolveBoxStock(r);
      const manufacturer = resolveManufacturerVal(r);
      const isCuban = resolveIsCuban(r);

      const row = document.createElement("article");
      row.className = "brand-row";
      if (isCuban) row.setAttribute("data-cuban", "true");

      row.innerHTML = `
        <img class="row-ico" src="${esc(iconPath)}" alt="" loading="lazy" />

        <div class="brand-row-left">
          <div class="brand-row-title-wrap">
            <div class="brand-row-title">${esc(resolveDisplayName(r) || "Unnamed cigar")}</div>
            ${isCuban ? `<div class="brand-row-flag" aria-hidden="true">🇨🇺</div>` : ``}
          </div>
          <div class="brand-row-sub">${esc(resolveVitola(r) || "—")}</div>
        </div>

        <div class="brand-row-right">
          <div class="brand-row-topline">
            <div class="brand-row-stick-stock">${esc(String(stickStock))}</div>
            <div class="brand-row-msrp">${esc(priceText)}</div>
          </div>

          <div class="brand-row-bottomline">
            <button class="brand-row-box-stock" type="button" aria-label="Box stock">
              <span class="brand-row-box-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <path d="M4 7.5V16l8 4 8-4V7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <path d="M12 11v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="brand-row-box-value">${esc(String(boxStock))}</span>
            </button>

            <div class="brand-row-qty">
              <button class="qty-btn qty-btn--minus" type="button" aria-label="Decrease">−</button>
              <span class="qty-value">${qty}</span>
              <button class="qty-btn qty-btn--plus" type="button" aria-label="Increase">+</button>
            </div>
          </div>
        </div>
      `;

      const icon = $(".row-ico", row);
      const left = $(".brand-row-left", row);
      const title = $(".brand-row-title", row);
      const minusBtn = $(".qty-btn--minus", row);
      const plusBtn = $(".qty-btn--plus", row);
      const boxBtn = $(".brand-row-box-stock", row);

      bindImageFallback(icon, [iconPath]);

      left?.addEventListener("click", () => openDetail(r));
      title?.addEventListener("click", () => openDetail(r));
      icon?.addEventListener("click", () => openDetail(r));

      boxBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        showBoxPurchasePrompt(r);
      });

      plusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = window.cigarOSCart?.getItemQty?.(item) || 0;
        window.cigarOSCart?.setQty?.(item, current + 1);
      });

      minusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = window.cigarOSCart?.getItemQty?.(item) || 0;
        window.cigarOSCart?.setQty?.(item, Math.max(0, current - 1));
      });

      listEl.appendChild(row);
    });
  }

  function getBandOptions(rows) {
    if (normalizeBrand(state.brand) === "padron") {
      return [
        { key: "Padron Series", label: "Padron Series", src: "/img/icons/padronseriesband.svg" },
        { key: "Family Reserve", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
        { key: "1926", label: "1926", src: "/img/icons/padron1926serieband.svg" },
        { key: "Black Series", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
        { key: "Damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
        { key: "1964 Anniversary", label: "1964 Anniversary", src: "/img/icons/padron1964anniversaryband.svg" }
      ];
    }

    const map = new Map();
    rows.forEach((r) => {
      const label = resolveBand(r);
      const art = resolveBandArt(r);
      if (!label || !art) return;
      if (!map.has(label)) map.set(label, { key: label, label, src: art });
    });

    return Array.from(map.values());
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
    ensureFilterModal().open(buildFilterData(applyWrapperMode([...state.rowsAll])));
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
    }
  });

  document.addEventListener("cigaros:cart-changed", () => applyAll());

  async function boot() {
    if (!listEl) return;

    state.brand = (getParam("brand") || "Padron").trim();

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
    const normalizedPageBrand = normalizeBrand(state.brand);

    const exact = rows.filter((r) => normalizeBrand(resolveBrandVal(r)) === normalizedPageBrand);
    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb && (rb.includes(normalizedPageBrand) || normalizedPageBrand.includes(rb));
    });

    const manufacturerFallback = rows.filter((r) => normalizeBrand(resolveManufacturerVal(r)) === normalizedPageBrand);

    state.rowsAll = (exact.length ? exact : fuzzy.length ? fuzzy : manufacturerFallback).map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    setBrandHeader();

    if (!state.rowsAll.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(state.brand)}</div>`;
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
