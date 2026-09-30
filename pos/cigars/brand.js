/* /pos/cigars/brand.js */

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const BRANDS_URL = "/data/brands.json";
  const POS_CIGAR_FAVORITES_KEY = "cigaros_pos_favorites_cigars";

  const EUR_RATES = {
    USD: 1.15,
    CHF: 0.94,
    GBP: 0.84,
    CNY: 8.25,
    AED: 4.22,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brandTitle = $("#brand-title");
  const brandIconImg = $("#brand-icon-img");
  const searchInput = $("#brand-search");
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");
  const seg = $("#wrapper-seg");
  const segBtns = $$(".seg-btn", seg || document);
  const listEl = $("#brand-list");
  const backBtn = $("#back-btn");
  const brandSearchBtn = $("#brandSearchBtn");

  const state = {
    brand: "",
    brandQuery: "",
    brandMeta: null,
    brandsAll: [],
    rowsAll: [],
    search: "",
    wrapperMode: "all",
    filters: {
      bandArt: new Set(),
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
    actionRow: null,
    singleQty: 1,
    boxQty: 0,
  };

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

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
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

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
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
        if (ch === '"') inQuotes = true;
        else if (ch === ",") {
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
    const headers = csv[0] || [];
    const keys = headers.map(normalizeHeader);

    return csv
      .slice(1)
      .filter((r) => r && !r.every((c) => !String(c || "").trim()))
      .map((r) => {
        const obj = {};
        keys.forEach((k, i) => {
          obj[k] = (r[i] ?? "").trim();
        });
        return obj;
      });
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

  function resolveLine(r) {
    return getField(r, ["line", "series"]);
  }

  function resolveName(r) {
    return getField(r, ["cigar", "name"]);
  }

  function resolveVitola(r) {
    return getField(r, ["vitola", "style", "vitola_name", "size"]);
  }

  function resolveOrigin(r) {
    return getField(r, ["origin", "country_of_origin", "country"]);
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

  function resolveStrength(r) {
    return getField(r, ["strength"]);
  }

  function resolveShade(r) {
    return getField(r, ["wrapper_shade", "wrapper_shade_type", "shade", "wrapper"]);
  }

  // Band assignments come only from HUB's "Band art IMG" column.
  // A blank cell stays unassigned; Line IMG and cigar names are unrelated.
  function resolveBandArt(r) {
    const src = getField(r, ["band_art_img"]);
    // Accept the explicit 1926 path currently stored in HUB, using the
    // established artwork location. This never assigns a band to a blank row.
    if (src === "/img/icons/bandart/padron/band1926.svg") {
      return "/img/bandart/padron/band1926.svg";
    }
    return src;
  }

  // Display metadata only: this list never assigns a band to a cigar.
  const BAND_ART_META = [
    { src: "/img/bandart/padron/band1964.svg", label: "1964 Anniversary" },
    { src: "/img/bandart/padron/bandfamilyreserve.svg", label: "Family Reserve" },
    { src: "/img/bandart/padron/band1926.svg", label: "1926 Serie" },
    { src: "/img/bandart/padron/bandpadronseries.svg", label: "Padrón Series" },
    { src: "/img/bandart/padron/banddamaso.svg", label: "Damaso" },
    { src: "/img/bandart/padron/bandblack2.svg", label: "Black" },
    { src: "/img/bandart/padron/band50th.svg", label: "50th Anniversary" },
    { src: "/img/bandart/padron/band60th.svg", label: "60th Anniversary" },
    { src: "/img/bandart/padron/bandmillennium.svg", label: "Millennium" },
    { src: "/img/bandart/padron/bandhammeranddream2.svg", label: "Hammer & A Dream" },
  ];

  function bandArtOptions(paths) {
    const available = new Set(paths.filter(Boolean));
    const known = BAND_ART_META.filter(({ src }) => available.has(src));
    const knownPaths = new Set(BAND_ART_META.map(({ src }) => src));
    // Preserve any additional explicit HUB path, using the path as its label
    // until display metadata is added. Never substitute another band's art.
    const additional = [...available].filter((src) => !knownPaths.has(src))
      .map((src) => ({ src, label: src }));
    return [...known, ...additional];
  }

  function resolveBrandImage(r) {
    return getField(r, ["brand_img", "brand_image", "brandicon", "brand_icon"]);
  }

  function resolveLineImage(r) {
    return getField(r, ["line_img", "line_image", "lineicon", "line_icon", "brand_line_img"]);
  }

  function resolveDetailKey(r) {
    return getField(r, ["key", "cigar_id", "id", "row_id"]);
  }

  function resolvePriceNumber(r) {
    const raw = getField(r, ["msrp", "cigar_msrp", "cigar_retail"]);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function resolvePrice(r) {
    const n = resolvePriceNumber(r);
    return n > 0 ? n.toFixed(2) : "—";
  }

  function resolveBoxCount(r) {
    const raw = getField(r, ["box_count", "box_qty", "box_quantity", "count_per_box"]);
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  function resolveBoxMsrpNumber(r) {
    const raw = getField(r, ["box_msrp", "box_price", "box_retail"]);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
    return resolvePriceNumber(r) * resolveBoxCount(r);
  }

  function resolveDisplayName(r) {
    const line = resolveLine(r);
    const cigar = resolveName(r);
    return [line, cigar].filter(Boolean).join(" ").trim() || cigar || line || "";
  }

  function resolveFavoriteKey(r) {
    return (
      resolveDetailKey(r) ||
      [resolveBrandVal(r), resolveLine(r), resolveName(r), resolveVitola(r)]
        .filter(Boolean)
        .join("|")
    );
  }

  function readCigarFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(POS_CIGAR_FAVORITES_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function writeCigarFavorites(items) {
    localStorage.setItem(POS_CIGAR_FAVORITES_KEY, JSON.stringify(items));
  }

  function isCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    return readCigarFavorites().some((item) => item && item.key === key);
  }

  function saveCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    if (!key) return false;

    const current = readCigarFavorites();
    const exists = current.some((item) => item && item.key === key);

    if (exists) return false;

    current.push({
      type: "cigar",
      section: "cigars",
      key,
      brand: resolveBrandVal(r) || state.brand,
      line: resolveLine(r),
      cigar: resolveName(r),
      displayName: resolveDisplayName(r),
      vitola: resolveVitola(r),
      price: resolvePriceNumber(r),
      boxPrice: resolveBoxMsrpNumber(r),
      savedAt: Date.now(),
    });

    writeCigarFavorites(current);
    return true;
  }

  function removeCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    writeCigarFavorites(readCigarFavorites().filter((item) => item && item.key !== key));
  }

  function showToast(message) {
    let toast = document.querySelector(".pos-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pos-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-showing");

    window.clearTimeout(toast.__timer);
    toast.__timer = window.setTimeout(() => {
      toast.classList.remove("is-showing");
    }, 1300);
  }

function resolveIsCuban(r) {
  const explicit = getField(r, ["cuban", "is_cuban"]);

  if (explicit) {
    const v = explicit.toLowerCase().trim();
    if (["x", "yes", "true", "1", "cuban", "cuba"].includes(v)) return true;
    if (["no", "false", "0", "non-cuban", "non cuban"].includes(v)) return false;
  }

  const manufacturer = resolveManufacturerVal(r).toLowerCase();
  const origin = resolveOrigin(r).toLowerCase();

  return (
    manufacturer.includes("habanos") ||
    manufacturer.includes("habanos s.a") ||
    origin.includes("cuba") ||
    origin.includes("cuban")
  );
}

function brandDisplayName() {
  return state.brandMeta?.name || state.brand || state.brandQuery || "Brand";
}

function brandSlug() {
  return normalizeBrand(state.brandMeta?.slug || state.brandMeta?.name || state.brand || state.brandQuery);
}

function brandIconCandidates() {
  const sheetRow = state.rowsAll.find((r) => normalizeAssetPath(resolveBrandImage(r)));
  const fromSheet = normalizeAssetPath(sheetRow ? resolveBrandImage(sheetRow) : "");

  const metaImage = normalizeAssetPath(
    state.brandMeta?.image ||
      state.brandMeta?.icon ||
      state.brandMeta?.svg ||
      state.brandMeta?.img
  );

  const slug = brandSlug();
  const out = [];

  if (fromSheet) out.push(fromSheet);
  if (metaImage) out.push(metaImage);

  if (slug) {
    out.push(`/img/icons/brands/${slug}.svg`);
    out.push(`/img/icons/brands/${slug}.png`);
  }

  return Array.from(new Set(out.filter(Boolean)));
}

function brandIconPath() {
  return brandIconCandidates()[0] || "";
}

function rowIconCandidatesForRow(r) {
  const lineImg = normalizeAssetPath(resolveLineImage(r));
  const brandImg = normalizeAssetPath(resolveBrandImage(r));

  return Array.from(new Set([lineImg, brandImg, ...brandIconCandidates()].filter(Boolean)));
}

function rowIconPathForRow(r) {
  return rowIconCandidatesForRow(r)[0] || "";
}

function bindImageFallback(img, candidates = [], finalBehavior = "hide") {
  if (!img) return;

  const list = Array.from(new Set(candidates.filter(Boolean)));
  if (!list.length) {
    if (finalBehavior === "hide") img.style.visibility = "hidden";
    return;
  }

  let idx = 0;
  img.style.visibility = "";
  img.onerror = () => {
    idx++;
    if (idx < list.length) {
      img.src = list[idx];
    } else {
      img.onerror = null;
      if (finalBehavior === "hide") img.style.visibility = "hidden";
    }
  };

  img.src = list[0];
}

function makeDetailHref(r) {

  const detailKey = resolveDetailKey(r);

  // Use the sheet key whenever it exists
  if (detailKey && detailKey.trim()) {
    return `/pos/cigars/cigar.html?key=${encodeURIComponent(detailKey)}`;
  }

  // Otherwise build the exact pipe key the detail page expects
  const pipeKey = [
    resolveBrandVal(r),
    resolveDisplayName(r),
    resolveVitola(r),
    "stick"
  ]
    .map(v => String(v || "").trim())
    .join("|");

  console.log("DETAIL LINK:", pipeKey);

  return `/pos/cigars/cigar.html?key=${encodeURIComponent(pipeKey)}`;
}

function buildCartItem(r, type = "stick") {
  const isBox = type === "box";
  const unitPrice = isBox ? resolveBoxMsrpNumber(r) : resolvePriceNumber(r);

  const detailKey =
    resolveDetailKey(r) ||
    `${normalizeBrand(state.brand)}|${resolveDisplayName(r)}|${resolveVitola(r)}`;

  return {
    key: `${detailKey}|${type}`,
    detailKey,
    type: "cigar",
    purchaseType: type,
    category: "Cigars",

    id: detailKey,
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

    // Line image → Brand image → Brand icon
    image:
      normalizeAssetPath(resolveLineImage(r)) ||
      normalizeAssetPath(resolveBrandImage(r)) ||
      brandIconPath(),

    msrp: unitPrice,
    boxCount: resolveBoxCount(r),
    url: makeDetailHref(r),
  };
}

function money(n) {
  const num = Number(n || 0);

  return Number.isFinite(num)
    ? num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function ensureCurrencyPopupStyles() {
  if (document.getElementById("currency-popup-styles")) return;

  const style = document.createElement("style");
  style.id = "currency-popup-styles";
  style.textContent = `
    .currency-pop,
    .currency-card,
    .currency-card *{
      font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif !important;
      font-synthesis:none;
    }

    .currency-pop{
      position:fixed;
      inset:0;
      z-index:999999;
      display:grid;
      place-items:center;
      padding:24px;
      background:rgba(3,10,24,.42);
      backdrop-filter:blur(16px) saturate(1.1);
      -webkit-backdrop-filter:blur(16px) saturate(1.1);
    }

    .currency-card{
      width:min(350px, calc(100vw - 44px));
      max-height:85vh;
      overflow-y:auto;
      border-radius:30px;
      background:rgba(246,247,251,.94);
      color:#0f1728;
      padding:22px;
      box-shadow:0 24px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.74);
      border:1px solid rgba(255,255,255,.62);
    }

    .currency-top{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      margin-bottom:16px;
    }

    .currency-title{
      margin:0;
      font-size:34px;
      line-height:1;
      font-weight:700;
      letter-spacing:-.035em;
      color:#0f1728;
    }

    .currency-sub{
      margin-top:7px;
      font-size:18px;
      font-weight:400;
      letter-spacing:-.015em;
      line-height:1.2;
      color:rgba(15,23,40,.48);
    }

    .currency-x{
      width:42px;
      height:42px;
      border-radius:999px;
      border:0;
      background:rgba(15,23,40,.06);
      color:rgba(15,23,40,.58);
      font-size:30px;
      line-height:1;
      display:grid;
      place-items:center;
      cursor:pointer;
    }

    .currency-base{
      height:66px;
      border-radius:22px;
      background:rgba(255,255,255,.62);
      color:#0f1728;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 18px;
      margin-bottom:12px;
      border:1px solid rgba(15,23,40,.08);
    }

    .currency-base span{
      font-size:24px;
      font-weight:600;
      letter-spacing:-.025em;
    }

    .currency-row{
      min-height:70px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:0 6px;
      border-top:1px solid rgba(15,23,40,.08);
    }

    .currency-label{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .currency-flag{
      font-size:26px;
      line-height:1;
      flex:0 0 auto;
    }

    .currency-name-wrap{
      min-width:0;
      display:flex;
      flex-direction:column;
    }

    .currency-code{
      font-size:22px;
      font-weight:650;
      line-height:1;
      letter-spacing:-.025em;
      color:#0f1728;
    }

    .currency-country{
      margin-top:5px;
      font-size:16px;
      font-weight:400;
      line-height:1;
      letter-spacing:-.01em;
      color:rgba(15,23,40,.52);
    }

    .currency-value{
      font-size:22px;
      font-weight:400;
      letter-spacing:-.025em;
      color:#0f1728;
      white-space:nowrap;
    }

    .price-convert-btn{
      border:0;
      background:transparent;
      color:inherit;
      font:inherit;
      padding:0;
      margin:0;
      cursor:pointer;
      text-align:right;
    }
  `;

  document.head.appendChild(style);
}

function openCurrencyPopup(eurValue) {
  const eur = Number(String(eurValue || "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(eur) || eur <= 0) return;

  ensureCurrencyPopupStyles();

  document.querySelector(".currency-pop")?.remove();

  const pop = document.createElement("div");
  pop.className = "currency-pop";

  const usd = eur * EUR_RATES.USD;
  const chf = eur * EUR_RATES.CHF;
  const gbp = eur * EUR_RATES.GBP;
  const cny = eur * EUR_RATES.CNY;
  const aed = eur * EUR_RATES.AED;

  pop.innerHTML = `
    <div class="currency-card" role="dialog" aria-modal="true" aria-label="Currency conversion">
      <div class="currency-top">
        <div>
          <h3 class="currency-title">Currency</h3>
          <div class="currency-sub">Euro conversion estimate</div>
        </div>
        <button class="currency-x" type="button" aria-label="Close currency popup">×</button>
      </div>

      <div class="currency-base"><span>🇪🇺 € EUR</span><span>${money(eur)}</span></div>
      <div class="currency-row"><div class="currency-label"><span class="currency-flag">🇺🇸</span><span class="currency-name-wrap"><span class="currency-code">$ USD</span><span class="currency-country">United States</span></span></div><strong class="currency-value">${money(usd)}</strong></div>
      <div class="currency-row"><div class="currency-label"><span class="currency-flag">🇨🇭</span><span class="currency-name-wrap"><span class="currency-code">CHF</span><span class="currency-country">Switzerland</span></span></div><strong class="currency-value">${money(chf)}</strong></div>
      <div class="currency-row"><div class="currency-label"><span class="currency-flag">🇬🇧</span><span class="currency-name-wrap"><span class="currency-code">£ GBP</span><span class="currency-country">Great Britain</span></span></div><strong class="currency-value">${money(gbp)}</strong></div>
      <div class="currency-row"><div class="currency-label"><span class="currency-flag">🇨🇳</span><span class="currency-name-wrap"><span class="currency-code">¥ RMB</span><span class="currency-country">China</span></span></div><strong class="currency-value">${money(cny)}</strong></div>
      <div class="currency-row"><div class="currency-label"><span class="currency-flag">🇦🇪</span><span class="currency-name-wrap"><span class="currency-code">AED</span><span class="currency-country">United Arab Emirates</span></span></div><strong class="currency-value">${money(aed)}</strong></div>
    </div>
  `;

  document.body.appendChild(pop);

  pop.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.classList.contains("currency-pop") || target.closest(".currency-x")) pop.remove();
  });

  if (navigator.vibrate) navigator.vibrate(8);
}
  
  function ensureActionSheet() {
    if ($("#pos-action-sheet")) return;

    const sheet = document.createElement("div");
    sheet.id = "pos-action-sheet";
    sheet.className = "pos-action-sheet";
    sheet.hidden = true;

    sheet.innerHTML = `
      <div class="pos-action-backdrop" data-action-close></div>

      <div class="pos-action-card" role="dialog" aria-modal="true" aria-label="Add cigar">
        <div class="pos-action-title" id="pos-action-title">Cigar</div>

        <div class="pos-action-lines">
          <div class="pos-action-line">
            <div class="pos-action-line-top">
              <div class="pos-action-label">Single</div>
              <div class="pos-action-stepper">
                <button type="button" data-qty-minus="single">−</button>
                <span id="singleQty">1</span>
                <button type="button" data-qty-plus="single">+</button>
              </div>
            </div>
            <div class="pos-action-line-bottom">
              <span id="singleUnit">0.00</span>
              <span id="singleTotal">0.00</span>
            </div>
          </div>

          <div class="pos-action-line">
            <div class="pos-action-line-top">
              <div class="pos-action-label">Box</div>
              <div class="pos-action-stepper">
                <button type="button" data-qty-minus="box">−</button>
                <span id="boxQty">0</span>
                <button type="button" data-qty-plus="box">+</button>
              </div>
            </div>
            <div class="pos-action-line-bottom">
              <span id="boxUnit">0.00</span>
              <span id="boxTotal">0.00</span>
            </div>
          </div>
        </div>

        <div class="pos-action-total">
          <span>Total:</span>
          <strong id="actionTotal">$0.00</strong>
        </div>

        <div class="pos-action-buttons">
          <button type="button" class="pos-action-cancel" data-action-close>Cancel</button>
          <button type="button" class="pos-action-add" id="actionAddBtn">Add</button>
        </div>

        <button type="button" class="pos-action-favorite" id="actionFavoriteBtn">
          Save as Favorite
        </button>
      </div>
    `;

    document.body.appendChild(sheet);
  }

  function updateActionSheet() {
    const r = state.actionRow;
    if (!r) return;

    const singlePrice = resolvePriceNumber(r);
    const boxPrice = resolveBoxMsrpNumber(r);

    $("#singleQty").textContent = String(state.singleQty);
    $("#boxQty").textContent = String(state.boxQty);

    $("#singleUnit").textContent = money(singlePrice);
    $("#singleTotal").textContent = money(singlePrice * state.singleQty);

    $("#boxUnit").textContent = money(boxPrice);
    $("#boxTotal").textContent = money(boxPrice * state.boxQty);

    $("#actionTotal").textContent = `$${money(singlePrice * state.singleQty + boxPrice * state.boxQty)}`;

    const favBtn = $("#actionFavoriteBtn");
    if (favBtn) {
      const fav = isCigarFavorite(r);
      favBtn.textContent = fav ? "Saved as Favorite" : "Save as Favorite";
      favBtn.classList.toggle("is-saved", fav);
    }
  }

  function openActionSheet(r) {
    ensureActionSheet();

    state.actionRow = r;
    state.singleQty = 1;
    state.boxQty = 0;

    $("#pos-action-title").textContent = resolveDisplayName(r) || "Cigar";

    updateActionSheet();

    const sheet = $("#pos-action-sheet");
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("is-open"));

    if (navigator.vibrate) navigator.vibrate(8);
  }

  function closeActionSheet() {
    const sheet = $("#pos-action-sheet");
    if (!sheet) return;

    sheet.classList.remove("is-open");
    window.setTimeout(() => {
      if (!sheet.classList.contains("is-open")) sheet.hidden = true;
    }, 180);
  }

  function addActionItemsToCart() {
    const r = state.actionRow;
    if (!r) return;

    if (state.singleQty > 0) {
      const stickItem = buildCartItem(r, "stick");
      const currentQty = window.cigarOSCart?.getItemQty?.(stickItem) || 0;
      window.cigarOSCart?.setQty?.(stickItem, currentQty + state.singleQty);
    }

    if (state.boxQty > 0) {
      const boxItem = buildCartItem(r, "box");
      const currentQty = window.cigarOSCart?.getItemQty?.(boxItem) || 0;
      window.cigarOSCart?.setQty?.(boxItem, currentQty + state.boxQty);
    }

    if (navigator.vibrate) navigator.vibrate(12);

    showToast("Added to invoice");
    closeActionSheet();
  }

  function openDetail(r) {
    window.location.href = makeDetailHref(r);
  }

  function applySearch(rows) {
    const q = state.search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        resolveDisplayName(r),
        resolveVitola(r),
        resolveRing(r),
        resolveLength(r),
        resolveManufacturerVal(r),
        resolveLine(r),
        resolveOrigin(r),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }

  function applyFilterSets(rows) {
    return rows.filter((r) => {
      if (state.filters.bandArt.size && !state.filters.bandArt.has(resolveBandArt(r))) return false;
      if (state.filters.vitola.size && !state.filters.vitola.has(resolveVitola(r))) return false;
      if (state.filters.ring.size && !state.filters.ring.has(resolveRing(r))) return false;
      if (state.filters.length.size && !state.filters.length.has(resolveLength(r))) return false;
      if (state.filters.strength.size && !state.filters.strength.has(resolveStrength(r))) return false;
      if (state.filters.shape.size && !state.filters.shape.has(resolveShape(r))) return false;
      if (state.filters.shade.size && !state.filters.shade.has(resolveShade(r))) return false;
      return true;
    });
  }

  function renderList(rows) {
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      return;
    }

    rows.forEach((r) => {
      const rowIconCandidates = rowIconCandidatesForRow(r);
      const rowIconPath = rowIconPathForRow(r);
      const priceText = resolvePrice(r);
      const priceNumber = resolvePriceNumber(r);
      const isCuban = resolveIsCuban(r);

      const row = document.createElement("article");
      row.className = "brand-row";
      if (isCuban) row.setAttribute("data-cuban", "true");

      row.innerHTML = `
        <img class="row-ico" src="${esc(rowIconPath)}" alt="" loading="lazy" decoding="async" />

        <div class="brand-row-left">
          <div class="brand-row-title-wrap">
            <div class="brand-row-title">${esc(resolveDisplayName(r) || "Unnamed cigar")}</div>
            ${isCuban ? `<div class="brand-row-flag" aria-hidden="true">🇨🇺</div>` : ""}
          </div>
          <div class="brand-row-sub">${esc(resolveVitola(r) || "—")}</div>
        </div>

        <div class="brand-row-right">
          ${
            priceNumber > 0
              ? `<button class="brand-row-msrp price-convert-btn" type="button" data-eur="${esc(priceText)}" aria-label="Convert ${esc(priceText)} euros">${esc(priceText)}</button>`
              : `<div class="brand-row-msrp">—</div>`
          }
          <button class="qty-btn qty-btn--plus" type="button" aria-label="Open add menu">+</button>
        </div>
      `;

      const icon = $(".row-ico", row);
      const left = $(".brand-row-left", row);
      const title = $(".brand-row-title", row);
      const plusBtn = $(".qty-btn--plus", row);
      const priceBtn = $(".price-convert-btn", row);

      bindImageFallback(icon, rowIconCandidates, "hide");

      left?.addEventListener("click", () => openDetail(r));
      title?.addEventListener("click", () => openDetail(r));
      icon?.addEventListener("click", () => openDetail(r));

      priceBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCurrencyPopup(priceBtn.dataset.eur || priceText);
      });

      plusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        openActionSheet(r);
      });

      listEl.appendChild(row);
    });
  }

  function applyAll() {
    let rows = [...state.rowsAll];
    rows = applyFilterSets(rows);
    rows = applySearch(rows);
    renderList(rows);
    setBrandHeader();
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
      const show = manufacturer && normalizeBrand(manufacturer) !== normalizeBrand(displayBrand);
      const isCubanBrand = firstRow && resolveIsCuban(firstRow);

      manufacturerMeta.textContent = show ? `${isCubanBrand ? "🇨🇺 " : ""}${manufacturer}` : "";
      manufacturerMeta.style.display = show ? "" : "none";
    }

    if (!brandIconImg) return;

    brandIconImg.alt = displayBrand || "Brand";
    bindImageFallback(brandIconImg, brandIconCandidates(), "hide");
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
    } catch {
      return [];
    }
  }

  function chooseRowsForBrand(rows) {
    const query = normalizeBrand(state.brandQuery);
    const metaSlug = normalizeBrand(state.brandMeta?.slug);
    const metaName = normalizeBrand(state.brandMeta?.name);
    const stateBrand = normalizeBrand(state.brand);

    const needles = Array.from(new Set([query, metaSlug, metaName, stateBrand].filter(Boolean)));

    const CUBAN_CONFLICT_BRANDS = new Set([
      "cohiba",
      "montecristo",
      "hupmann",
      "hoyodemonterrey",
      "saintluisrey",
      "sanchopanza",
      "trinidad",
      "sancristobaldelahabana",
    ]);

    const isConflictBrand = needles.some((n) => CUBAN_CONFLICT_BRANDS.has(n));

    let exact = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return needles.includes(rb);
    });

    if (isConflictBrand) {
      const cubanRows = exact.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (exact.length) return exact;

    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb && needles.some((n) => rb.includes(n) || n.includes(rb));
    });

    if (isConflictBrand) {
      const cubanRows = fuzzy.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (fuzzy.length) return fuzzy;

    const manufacturerFallback = rows.filter((r) => {
      const rm = normalizeBrand(resolveManufacturerVal(r));
      return needles.includes(rm);
    });

    if (isConflictBrand) {
      const cubanRows = manufacturerFallback.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (manufacturerFallback.length) return manufacturerFallback;

    const loose = rows.filter((r) => {
      const brand = normalizeLoose(resolveBrandVal(r));
      const q = normalizeLoose(state.brandQuery);
      return brand && q && (brand.includes(q) || q.includes(brand));
    });

    if (isConflictBrand) {
      const cubanRows = loose.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    return loose;
  }

  // CigarOS brand-page Filters, including HUB-driven Band Art.
  (() => {
    if (!btnFilters || btnFilters.dataset.brandFiltersBound === "true") return;

    const fields = [
      { key: "bandArt", label: "Band Art", read: resolveBandArt },
      { key: "vitola", label: "Vitola", read: resolveVitola },
      { key: "ring", label: "Ring", read: resolveRing },
      { key: "length", label: "Length", read: resolveLength },
      { key: "strength", label: "Strength", read: resolveStrength },
      { key: "shape", label: "Shape", read: resolveShape },
      { key: "shade", label: "Wrapper Shade", read: resolveShade },
    ];
    const id = "brand-filter-modal";
    const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
    let modal = null;
    let draft = {};
    let active = "bandArt";
    let options = {};
    let savedOverflow = [];

    function ensureModal() {
      if (modal) return;

      // Reuse the filter styles already in brand.css. All additional rules
      // are scoped to this dialog, so cigar rows and other popups are untouched.
      const style = document.createElement("style");
      style.id = "brand-filter-repair-styles";
      style.textContent = `
        #${id} {
          position:fixed; inset:0; width:100%; height:100%;
          max-width:none; max-height:none; margin:0; padding:0;
          border:0; background:transparent; color:#0b1220;
          font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Arial,sans-serif;
        }
        #${id}:not([open]) { display:none !important; }
        #${id}[open] { display:block; opacity:1; pointer-events:auto; }
        #${id}::backdrop { background:transparent; }
        #${id}, #${id} * { box-sizing:border-box; }
        #${id} .fm__sheet {
          left:50%; right:auto; bottom:auto; max-height:none;
          transform:translateX(-50%) !important; transition:none;
          top:calc(12px + env(safe-area-inset-top,0px));
          height:min(720px,calc(100vh - 24px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));
          height:min(720px,calc(100dvh - 24px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));
        }
        #${id} .fm__body { padding:0; }
        #${id} .fm__panel { padding-bottom:0; }
        #${id} .fm__header { flex:0 0 auto; min-height:76px; }
        #${id} .fm__title { margin:0; font-size:30px; font-weight:700; }
        #${id} .fm__cat-btn { flex-shrink:0; }
        #${id} .fm__search-row { flex:0 0 auto; }
        #${id} .fm__item { cursor:pointer; }
        #${id} .fm__item-label { overflow-wrap:anywhere; }
        #${id} .fm__item input[type="checkbox"] {
          appearance:auto; -webkit-appearance:checkbox;
          display:block; position:static; opacity:1;
          width:22px; height:22px; margin:0; accent-color:#0a84ff;
        }
        #${id} .bfm-actions {
          display:flex; flex:0 0 auto; gap:12px; padding:14px 16px 16px;
          border-top:1px solid rgba(15,26,44,.08);
        }
        #${id} .bfm-actions button {
          flex:1; min-height:48px; border:0; border-radius:16px;
          font:600 17px -apple-system,BlinkMacSystemFont,"SF Pro Text",Arial,sans-serif;
          cursor:pointer; background:rgba(15,26,44,.07); color:#0b1220;
        }
        #${id} .bfm-actions [data-bfm-apply] { background:#0a84ff; color:white; }
        #${id} .fm__list { overscroll-behavior:contain; }
        #${id} .fm__list--bands { padding:8px 10px 18px; }
        #${id} .fm__band-option {
          position:relative; display:block; width:100%; margin:0 0 10px;
          padding:14px 14px 12px; border:1px solid rgba(15,26,44,.12);
          border-radius:20px; background:rgba(255,255,255,.85); cursor:pointer;
          transition:background .15s ease,border-color .15s ease,box-shadow .15s ease;
        }
        #${id} .fm__band-option.is-selected {
          background:rgba(10,132,255,.07); border-color:rgba(10,132,255,.5);
          box-shadow:inset 0 0 0 1px rgba(10,132,255,.12);
        }
        #${id} .fm__band-option:focus-within {
          outline:3px solid #0a84ff; outline-offset:2px;
        }
        #${id} .fm__band-art-wrap {
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:8px 0 10px;
}

#${id} .fm__band-art {
  display:block;
  width:90%;
  height:auto;
  max-width:none;
  max-height:none;
  object-fit:contain;
}

#${id} .fm__band-bottom {
  display:flex;
  align-items:center;
  gap:10px;
  min-height:30px;
}

#${id} .fm__band-label {
  flex:1;
  min-width:0;
  color:#0f1a2c;
  font-size:14px;
  line-height:1.15;
  font-weight:600;
  letter-spacing:-.01em;
  overflow-wrap:anywhere;
}
        #${id} .fm__band-check-ui {
          width:26px; height:26px; flex:0 0 26px; display:grid; place-items:center;
          border-radius:50%; border:1.5px solid rgba(15,26,44,.24);
          background:#fff; color:transparent;
        }
        #${id} .fm__band-check-ui svg { width:16px; height:16px; }
        #${id} .fm__band-option.is-selected .fm__band-check-ui {
          border-color:#0a84ff; background:#0a84ff; color:#fff;
        }
        #${id} .fm__band-checkbox {
          position:absolute !important; width:1px !important; height:1px !important;
          padding:0 !important; margin:0 !important; opacity:0 !important;
          overflow:hidden; clip-path:inset(50%);
        }
        @media (max-width:760px) {
          #${id} .fm__body { grid-template-rows:auto minmax(0,1fr); }
          #${id} .fm__cats { flex-direction:row; }
        }
      `;
      document.head.appendChild(style);

      // A native dialog keeps Filters above the bottom navigation and
      // contains keyboard focus without changing any other page's z-index.
      modal = document.createElement("dialog");
      modal.id = id;
      modal.className = "fm";
      modal.hidden = true;
      modal.setAttribute("aria-labelledby", "brand-filter-heading");
      modal.innerHTML = `
        <div class="fm__backdrop" data-bfm-close aria-hidden="true"></div>
        <div class="fm__sheet">
          <div class="fm__header">
            <h2 class="fm__title" id="brand-filter-heading">Filters</h2>
            <button class="fm__close" type="button" data-bfm-close aria-label="Close filters">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="fm__body">
            <div class="fm__cats" role="group" aria-label="Filter categories"></div>
            <div class="fm__panel">
              <div class="fm__search-row">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                </svg>
                <input class="fm__search-input" type="search" placeholder="Search options" aria-label="Search filter options" autocomplete="off" />
              </div>
              <div class="fm__list" role="group" aria-label="Filter options"></div>
            </div>
          </div>
          <div class="bfm-actions">
            <button type="button" data-bfm-clear>Clear</button>
            <button type="button" data-bfm-apply>Apply</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-bfm-close]")) return close();

        const category = target.closest("[data-bfm-category]");
        if (category) {
          active = category.dataset.bfmCategory;
          modal.querySelector(".fm__search-input").value = "";
          updateCategories();
          renderOptions();
          return;
        }
        if (target.closest("[data-bfm-clear]")) {
          fields.forEach(({ key }) => draft[key].clear());
          modal.querySelector(".fm__search-input").value = "";
          updateCategories();
          renderOptions();
          return;
        }
        if (target.closest("[data-bfm-apply]")) {
          fields.forEach(({ key }) => { state.filters[key] = new Set(draft[key]); });
          const count = fields.reduce((sum, { key }) => sum + state.filters[key].size, 0);
          btnFilters.textContent = count ? `Filters (${count})` : "Filters";
          close();
          applyAll();
        }
      });
      modal.addEventListener("change", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.matches("[data-bfm-value]")) return;
        if (input.checked) draft[active].add(input.value);
        else draft[active].delete(input.value);
        // Update in place so multi-select keeps scroll position and keyboard focus.
        input.closest(".fm__band-option")?.classList.toggle("is-selected", input.checked);
        updateCategories();
      });
      modal.querySelector(".fm__search-input").addEventListener("input", renderOptions);
      modal.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
      });
    }

    function updateCategories() {
      modal.querySelectorAll("[data-bfm-category]").forEach((button) => {
        const field = fields.find(({ key }) => key === button.dataset.bfmCategory);
        const selected = field.key === active;
        const count = draft[field.key].size;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.textContent = field.label + (count ? ` (${count})` : "");
      });
    }

    function renderOptions() {
      const query = modal.querySelector(".fm__search-input").value.trim().toLowerCase();
      const list = modal.querySelector(".fm__list");
      const field = fields.find(({ key }) => key === active);
      list.classList.toggle("fm__list--bands", active === "bandArt");
      if (active === "bandArt") {
        const bands = bandArtOptions(options.bandArt).filter(({ src, label }) =>
          !query || label.toLowerCase().includes(query) || src.toLowerCase().includes(query)
        );
        list.setAttribute("aria-label", "Band Art options");
        list.innerHTML = bands.length
          ? bands.map(({ src, label }) => `
              <label class="fm__band-option ${draft.bandArt.has(src) ? "is-selected" : ""}">
                <input class="fm__band-checkbox" type="checkbox" data-bfm-value
                  value="${esc(src)}" ${draft.bandArt.has(src) ? "checked" : ""} />
                <span class="fm__band-art-wrap">
                  <img class="fm__band-art" src="${esc(src)}" alt="" loading="lazy" decoding="async" />
                </span>
                <span class="fm__band-bottom">
                  <span class="fm__band-label">${esc(label)}</span>
                  <span class="fm__band-check-ui" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none"
                      stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>
                </span>
              </label>
            `).join("")
          : `<div class="fm__empty">${query ? "No matching options." : "No band artwork available."}</div>`;
        list.scrollTop = 0;
        return;
      }
      const values = options[active].filter((value) => value.toLowerCase().includes(query));
      list.setAttribute("aria-label", field.label + " options");
      list.innerHTML = values.length
        ? values.map((value) => `
            <label class="fm__item">
              <span class="fm__item-label">${esc(value)}</span>
              <input type="checkbox" data-bfm-value value="${esc(value)}" ${draft[active].has(value) ? "checked" : ""} />
            </label>
          `).join("")
        : '<div class="fm__empty">No matching options.</div>';
      list.scrollTop = 0;
    }

    function open() {
      ensureModal();
      if (modal.open) return;
      fields.forEach(({ key, read }) => {
        draft[key] = new Set(state.filters[key]);
        // Keep exact values so they match the existing applyFilterSets().
        options[key] = [...new Set(state.rowsAll.map(read).filter(Boolean))]
          .sort((a, b) => collator.compare(a, b));
      });
      modal.querySelector(".fm__cats").innerHTML = fields.map(({ key }) =>
        `<button class="fm__cat-btn" type="button" data-bfm-category="${key}"></button>`
      ).join("");
      modal.querySelector(".fm__search-input").value = "";
      updateCategories();
      renderOptions();

      modal.hidden = false;
      modal.classList.add("is-open");
      modal.showModal();
      savedOverflow = [document.documentElement, document.body].map((element) => ({
        element,
        value: element.style.getPropertyValue("overflow"),
        priority: element.style.getPropertyPriority("overflow"),
      }));
      savedOverflow.forEach(({ element }) => element.style.setProperty("overflow", "hidden"));
      btnFilters.setAttribute("aria-expanded", "true");
      // Focus a button, not the search field: avoid opening the phone keyboard.
      modal.querySelector("button[data-bfm-close]").focus({ preventScroll: true });
    }

    function close() {
      if (!modal?.open) return;
      modal.close();
      modal.classList.remove("is-open");
      modal.hidden = true;
      savedOverflow.forEach(({ element, value, priority }) => {
        if (value) element.style.setProperty("overflow", value, priority);
        else element.style.removeProperty("overflow");
      });
      savedOverflow = [];
      btnFilters.setAttribute("aria-expanded", "false");
      btnFilters.focus({ preventScroll: true });
      // Unapplied selections are discarded by cloning state on the next open.
    }

    btnFilters.dataset.brandFiltersBound = "true";
    btnFilters.setAttribute("aria-haspopup", "dialog");
    btnFilters.setAttribute("aria-controls", id);
    btnFilters.setAttribute("aria-expanded", "false");
    btnFilters.addEventListener("click", (event) => {
      event.preventDefault();
      open();
    });
  })();
  // End CigarOS brand-page Filters repair.

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  brandSearchBtn?.addEventListener("click", () => {
    window.openGlobalSearch?.();
  });

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-action-close]")) {
      closeActionSheet();
      return;
    }

    const singlePlus = target.closest("[data-qty-plus='single']");
    const singleMinus = target.closest("[data-qty-minus='single']");
    const boxPlus = target.closest("[data-qty-plus='box']");
    const boxMinus = target.closest("[data-qty-minus='box']");

    if (singlePlus) {
      state.singleQty += 1;
      updateActionSheet();
      return;
    }

    if (singleMinus) {
      state.singleQty = Math.max(0, state.singleQty - 1);
      updateActionSheet();
      return;
    }

    if (boxPlus) {
      state.boxQty += 1;
      updateActionSheet();
      return;
    }

    if (boxMinus) {
      state.boxQty = Math.max(0, state.boxQty - 1);
      updateActionSheet();
      return;
    }

    if (target.closest("#actionAddBtn")) {
      addActionItemsToCart();
      return;
    }

    if (target.closest("#actionFavoriteBtn")) {
      if (!state.actionRow) return;

      if (isCigarFavorite(state.actionRow)) {
        removeCigarFavorite(state.actionRow);
        showToast("Removed from Favorites");
      } else {
        saveCigarFavorite(state.actionRow);
        showToast("Saved to Favorites");
      }

      updateActionSheet();

      if (navigator.vibrate) navigator.vibrate(10);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelector(".currency-pop")?.remove();
      closeActionSheet();
    }
  });

  if (btnBands) btnBands.style.display = "none";
  if (seg) seg.style.display = "none";
  segBtns.forEach((b) => b.classList.remove("is-on"));

  async function boot() {
    if (!listEl) return;

    ensureActionSheet();
    ensureCurrencyPopupStyles();

    state.brandQuery = (getParam("brand") || "Padron").trim();

    state.brandsAll = await loadBrandsMeta();
    state.brandMeta = findBrandMeta(state.brandQuery, state.brandsAll);
    state.brand = state.brandMeta?.name || state.brandQuery;

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const txt = await res.text();
    const rows = mapRows(parseCSV(txt));

    const chosenRows = chooseRowsForBrand(rows);

    state.rowsAll = chosenRows.map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    if (!state.rowsAll.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      setBrandHeader();
      return;
    }

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if (listEl) listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
  });
})();
