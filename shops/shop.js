/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v12.4)

   ✅ Use with: <script src="/shops/shop.js?v=12.4"></script>

   Data:
   ✅ Loads per-shop JSON first:
      /data/shops/{fileSlug}.json   (ex: justthetip.json)
   ✅ Fallback:
      /shops/shops.json (array)

   UI:
   1) SHOP pill + TAA badge TOP RIGHT stacked (TAA smaller)
   2) Status moved into dock row. Dock order: Status | Call | Directions | Brands
   3) No default-open panel. Segmented shows, nothing selected until tap.
   4) Remove thin black outline on shop logo background (strip SVG rect strokes when possible)
   5) Dock: remove the individual “button background boxes” (icons/text float on bar)
   6) Segmented labels use SF Pro Display Bold feel
   7) Brands sheet: larger iOS-style title (SF Pro Display heavy)
   8) Brand names: improved spacing (mapping + token heuristics)
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---------------- helpers ----------------
  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function toStr(v) {
    return v == null ? "" : String(v).trim();
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "t", "yes", "y", "x", "✓", "check", "checked", "open"].includes(s);
  }

  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCaseWords(s) {
    const clean = String(s || "").trim();
    if (!clean) return "";
    return clean
      .split(/\s+/g)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  // ---------------- brand label improvements ----------------
  // Hand-map the most common “no-space” slugs that show up ugly in the sheet.
  // (Add more anytime you see one.)
  const BRAND_LABEL_MAP = {
    aganorsaleaf: "Aganorsa Leaf",
    allsaints: "All Saints",
    blacklabeltradingco: "Black Label Trading Co",
    cigarclowns: "Cigar Clowns",
    feriotego: "FeriO Tego",
    hoyodemonterrey: "Hoyo de Monterrey",
    rockypatel: "Rocky Patel",
    oscarvalladares: "Oscar Valladares",
    blacklabeltradingcompany: "Black Label Trading Company",
  };

  // Token-based spacing for common words inside smashed slugs.
  const BRAND_TOKENS = [
    "tradingcompany",
    "blacklabel",
    "rockypatel",
    "hoyodemonterrey",
    "oscarvalladares",
    "tradingco",
    "trading",
    "company",
    "cigars",
    "cigar",
    "label",
    "saints",
    "leaf",
    "montecristo",
    "monterrey",
    "de",
    "del",
    "la",
    "san",
    "st",
  ].sort((a, b) => b.length - a.length);

  function prettyBrandLabel(rawSlug) {
    const raw = String(rawSlug || "").trim();
    if (!raw) return "";

    // If already “nice” (contains spaces or uppercase), keep it.
    if (/\s/.test(raw) || /[A-Z]/.test(raw)) return raw;

    const clean = sanitizeLogoName(raw);

    // Exact map first
    if (BRAND_LABEL_MAP[clean]) return BRAND_LABEL_MAP[clean];

    // If it has separators, easy:
    if (/[_-]/.test(raw)) {
      const spaced = raw
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([a-z])/g, "$1 $2")
        .trim();
      return titleCaseWords(spaced || raw);
    }

    // Heuristic: insert spaces around known tokens in smashed strings.
    let w = clean;
    for (const t of BRAND_TOKENS) w = w.replaceAll(t, ` ${t} `);

    // cleanup
    w = w.replace(/\s+/g, " ").trim();
    if (!w) return titleCaseWords(clean);

    // Preserve small words
    const parts = w.split(" ").filter(Boolean).map((p) => p.toLowerCase());
    const keepLower = new Set(["de", "del", "la"]);
    const out = parts.map((p) => {
      if (keepLower.has(p)) return p;
      if (p === "st") return "St";
      if (p === "co") return "Co";
      return p[0].toUpperCase() + p.slice(1);
    });

    // Special casing for “FeriO”
    return out.join(" ").replace(/\bFerio\b/g, "FeriO");
  }

  // ---------------- url builders ----------------
  function buildDirectionsUrl(shop) {
    const lat = Number(shop.latitude ?? shop.lat ?? shop.Latitude);
    const lng = Number(shop.longitude ?? shop.lng ?? shop.Longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const addressParts = [
      toStr(shop.address1 || shop.address || shop.Address),
      toStr(shop.city || shop.City),
      toStr(shop.state || shop.ST || shop.State),
      toStr(shop.zip || shop.Zip),
    ].filter(Boolean);

    const fallbackAddress = addressParts.join(", ");
    const q = hasCoords ? `${lat},${lng}` : fallbackAddress || shop.name || shop.Shop || "";
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // ---------------- amenities ----------------
  // NOTE: TAA intentionally not here (top-right only)
  const AMENITIES = [
    { key: "alcohol", icon: "/img/icons/alcohol.svg", label: "Alcohol" },
    { key: "byob", icon: "/img/icons/byob.svg", label: "BYOB" },
    { key: "noalcohol", icon: "/img/icons/noalcohol.svg", label: "No Alcohol" },
    { key: "food", icon: "/img/icons/food.svg", label: "Food" },
    { key: "tvs", icon: "/img/icons/tv.svg", label: "TVs" },
    { key: "outdoor", icon: "/img/icons/outdoorseating.svg", label: "Outdoor" },
    { key: "indoor", icon: "/img/icons/indoorseating.svg", label: "Indoor" },
    { key: "quiet", icon: "/img/icons/quietzone.svg", label: "Quiet" },
    { key: "livemusic", icon: "/img/icons/livemusic.svg", label: "Live Music" },
  ];

  const FEATURE_ALIASES = {
    alcohol: ["alcohol"],
    byob: ["byob"],
    noalcohol: ["noalcohol", "no_alcohol", "noalc"],
    food: ["food"],
    tvs: ["tvs", "tv"],
    outdoor: ["outdoor", "outdoorseating"],
    indoor: ["indoor", "indoorseating"],
    quiet: ["quiet", "quietzone"],
    livemusic: ["livemusic", "live", "music", "livemus"],
    taa: ["taa"],
  };

  function normalizeFeatures(shop) {
    const bag = {};

    if (shop.amenities && typeof shop.amenities === "object") {
      for (const k of Object.keys(shop.amenities)) {
        bag[normalizeKey(k)] = isTruthy(shop.amenities[k]);
      }
    }

    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    for (const rawKey of Object.keys(shop)) {
      const nk = normalizeKey(rawKey);

      if (AMENITIES.some((a) => a.key === nk) || nk === "taa") {
        bag[nk] = isTruthy(shop[rawKey]);
        continue;
      }

      for (const targetKey of Object.keys(FEATURE_ALIASES)) {
        if (FEATURE_ALIASES[targetKey].includes(nk)) {
          bag[targetKey] = isTruthy(shop[rawKey]);
        }
      }
    }

    if (bag.noalcohol === true) bag.alcohol = false;
    return bag;
  }

  // ---------------- open/closed ----------------
  function getOpenClosed(shop) {
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

    // default
    if (
      !("open" in shop) &&
      !("Open" in shop) &&
      !("closed" in shop) &&
      !("Closed" in shop) &&
      !shop.status &&
      !shop.Status
    ) {
      return "OPEN";
    }

    return open ? "OPEN" : "CLOSED";
  }

  // ---------------- name formatting ----------------
  function splitNameTwoLinesBalanced(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) return [words.join(" "), ""].filter(Boolean);

    let bestIdx = 1;
    let bestDiff = Infinity;

    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    return [words.slice(0, bestIdx).join(" "), words.slice(bestIdx).join(" ")];
  }

  function applyNameClampAndSize(el, name) {
    const clean = String(name || "").trim();
    const len = clean.length;

    const SHOULD_SPLIT = len >= 18;

    if (!SHOULD_SPLIT) {
      el.textContent = clean;
    } else {
      const [l1, l2] = splitNameTwoLinesBalanced(clean);
      el.innerHTML = l2 ? `${escapeHtml(l1)}<br>${escapeHtml(l2)}` : escapeHtml(l1);
    }

    let px = 44;
    if (len > 18) px = 40;
    if (len > 26) px = 36;
    if (len > 34) px = 32;
    if (len > 44) px = 28;

    el.style.fontSize = `${px}px`;
    el.style.lineHeight = "1.05";
  }

  // ---------------- SVG outline removal for logo ----------------
  async function loadSvgStripRectStroke(svgUrl) {
    const res = await fetch(svgUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("svg fetch failed");
    const text = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) throw new Error("no svg root");

    // remove stroke from first few rects (outer rounded backgrounds)
    const rects = Array.from(svg.querySelectorAll("rect"));
    rects.forEach((r, idx) => {
      if (idx > 2) return;

      const stroke = (r.getAttribute("stroke") || "").toLowerCase();
      if (stroke && stroke !== "none") {
        r.setAttribute("stroke", "none");
        r.removeAttribute("stroke-width");
      }

      const style = r.getAttribute("style");
      if (style && /stroke\s*:/i.test(style)) {
        r.setAttribute(
          "style",
          style
            .replace(/stroke\s*:\s*[^;]+;?/gi, "stroke:none;")
            .replace(/stroke-width\s*:\s*[^;]+;?/gi, "")
        );
      }
    });

    const serialized = new XMLSerializer().serializeToString(svg);
    const b64 = btoa(unescape(encodeURIComponent(serialized)));
    return `data:image/svg+xml;base64,${b64}`;
  }

  async function loadLogoWithoutOutline(imgEl, svgUrl, pngUrl) {
    try {
      imgEl.src = await loadSvgStripRectStroke(svgUrl);
      imgEl.onerror = null;
    } catch {
      imgEl.src = pngUrl;
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = "/img/icons/shops/default.png";
      };
    }
  }

  // ---------------- injected styling ----------------
  function injectStylesOnce() {
    if (document.getElementById("spInjectedV12_4")) return;

    const css = `
      /* Move SHOP pill to top-right */
      .sp-pill-left{
        position:absolute !important;
        top:18px !important;
        right:18px !important;
        left:auto !important;
      }

      /* Hide legacy status pill (status now in dock) */
      .sp-status{ display:none !important; }
      #spStatusPill{ display:none !important; }

      /* TAA badge stacked under SHOP pill (smaller) */
      #spTaaIcon{
        position:absolute !important;
        top:54px !important;
        right:18px !important;
        width:62px !important;
        height:auto !important;
        opacity:1 !important;
        filter:none !important;
        -webkit-filter:none !important;
      }

      /* City */
      .sp-city, .sp-city span, #spCity{
        font-weight:400 !important;
        letter-spacing:-0.02em !important;
      }
      .sp-city{ color:#8e8e93 !important; }

      /* Amenities: kill any outline/background artifacts */
      #spAmenPanel{ background:transparent !important; border:none !important; box-shadow:none !important; }
      #spAmenRow{ background:transparent !important; }
      #spAmenRow img, .sp-amen-icon, .sp-amen-icon *{
        background:transparent !important;
        border:0 !important;
        outline:0 !important;
        box-shadow:none !important;
        filter:none !important;
        -webkit-filter:none !important;
      }
      .sp-amen-icon{ display:block !important; border-radius:0 !important; }

      /* Hide any legacy blocks */
      .sp-legacy-hide{ display:none !important; }

      /* Bottom */
      .sp-bottom{ margin-top:18px; }

      /* Dock bar */
      .sp-dock{
        display:flex;
        gap:14px;
        justify-content:space-between;
        align-items:center;
        padding: 12px 14px;
        border-radius: 22px;
        background: rgba(255,255,255,.70);
        border: 1px solid rgba(0,0,0,.05);
        box-shadow: 0 12px 30px rgba(0,0,0,.06);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      /* ✅ Remove the individual “button boxes” in the dock */
      .sp-dock a, .sp-dock .sp-dock-static{
        flex:1 1 0;
        min-width:0;
        height: 56px;
        border:none !important;
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap: 6px;
        padding: 0;
        text-decoration:none;
        color:#0b0b0c;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
      }

      /* keep tap feel, but no card */
      .sp-dock a:active{ transform: scale(.99); }

      /* Icon + label sizing */
      .sp-dock .sp-dock-ico{ width:22px; height:22px; stroke:#0b0b0c; fill:none; }
      .sp-dock .sp-dock-img{
        width:24px; height:24px;
        object-fit:contain;
        display:block;
        border:none !important;
        outline:none !important;
        background:transparent !important;
        box-shadow:none !important;
        filter:none !important;
        -webkit-filter:none !important;
      }
      .sp-dock .sp-dock-label{
        font-size: 13px;
        font-weight: 800;
        letter-spacing: -0.01em;
        line-height: 1;
      }

      /* Status pill inside dock (keeps pill shape) */
      .sp-status-mini{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding: 8px 14px;
        border-radius: 999px;
        font-weight: 900;
        font-size: 13px;
        letter-spacing: 0;
        color:#fff;
        min-width: 92px;
      }
      .sp-status-mini[data-status="open"]{ background: rgba(52,199,89,.92); }
      .sp-status-mini[data-status="closed"]{ background: rgba(142,142,147,.90); }

      /* Segmented (no default selected) */
      .sp-seg{
        margin-top:14px;
        padding:6px;
        border-radius:18px;
        background: rgba(242,242,247,.75);
        border:1px solid rgba(0,0,0,.05);
        display:flex; gap:6px;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      .sp-seg button{
        flex:1 1 0;
        height:38px;
        border-radius:14px;
        border:none;
        background:transparent;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
        font-weight: 900;
        font-size: 15px;
        letter-spacing: -0.02em;
        color:#8e8e93;
      }
      .sp-seg button[aria-selected="true"]{
        background: rgba(255,255,255,.90);
        color:#0b0b0c;
        box-shadow:none;
      }

      .sp-panels{ margin-top:12px; }
      .sp-card{
        background: rgba(255,255,255,.92);
        border: 1px solid rgba(0,0,0,.05);
        border-radius:24px;
        padding:16px;
        box-shadow: 0 14px 40px rgba(0,0,0,.06);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .sp-card + .sp-card{ margin-top:12px; }
      .sp-card h3{
        margin:0 0 8px 0;
        font-size:16px;
        font-weight:900;
        letter-spacing:-0.01em;
        color:#0b0b0c;
      }
      .sp-muted{ color:#8e8e93; font-weight:700; }
      .sp-hidden{ display:none !important; }

      /* Brands sheet */
      .sp-sheet-backdrop{
        position:fixed; inset:0;
        background: rgba(0,0,0,.18);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index:9999;
        display:flex; align-items:flex-end; justify-content:center;
        padding:10px;
      }
      .sp-sheet{
        width: min(560px, 100%);
        background: rgba(255,255,255,.94);
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 22px;
        box-shadow: 0 24px 80px rgba(0,0,0,.20);
        overflow:hidden;
      }
      .sp-sheet-header{
        padding: 16px 14px 12px 16px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .sp-sheet-topline{
        display:flex; align-items:center; justify-content:space-between;
      }
      /* ✅ Larger iOS-like title */
      .sp-sheet-title{
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
        font-size: 26px;
        font-weight: 950;
        letter-spacing: -0.02em;
      }
      .sp-sheet-close{
        width:40px; height:40px;
        border-radius:20px;
        border:1px solid rgba(0,0,0,.08);
        background: rgba(255,255,255,.88);
        display:grid; place-items:center;
        font-size:20px;
        cursor:pointer;
        color:#007aff;
      }

      .sp-sheet-search{
        display:flex;
        align-items:center;
        gap:10px;
        padding:12px 14px;
        border-radius:16px;
        background: rgba(242,242,247,.90);
        border:1px solid rgba(0,0,0,.06);
      }
      .sp-sheet-search input{
        width:100%;
        border:none;
        outline:none;
        background:transparent;
        font-size:16px;
        font-weight:600;
        letter-spacing:-0.01em;
        color:#0b0b0c;
        font-family: inherit;
      }
      .sp-sheet-search input::placeholder{
        color:#8e8e93;
        font-weight:600;
      }

      .sp-sheet-body{
        max-height: 52vh;
        overflow:auto;
        padding:14px 14px 16px 14px;
      }

      .sp-brand-grid{
        display:grid;
        grid-template-columns: repeat(3, 1fr);
        gap:12px;
      }
      @media (min-width:420px){
        .sp-brand-grid{ grid-template-columns: repeat(4, 1fr); }
      }

      .sp-brand-tile{
        border: 1px solid rgba(0,0,0,.06);
        background: rgba(255,255,255,.82);
        border-radius:16px;
        padding:10px 10px 8px 10px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:8px;
        min-height:86px;
      }
      .sp-brand-tile img{
        max-width:100%;
        max-height:44px;
        object-fit:contain;
        border:none !important;
        outline:none !important;
        background:transparent !important;
        box-shadow:none !important;
        filter:none !important;
        -webkit-filter:none !important;
      }
      .sp-brand-name{
        font-size:11px;
        font-weight:400;
        letter-spacing:-0.2px;
        color:#6e6e73;
        text-align:center;
        line-height:1.15;
        max-width:100%;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .sp-brand-fallback{
        font-weight:900;
        font-size:11px;
        color:#6e6e73;
        text-align:center;
        line-height:1.15;
      }
    `;

    const style = document.createElement("style");
    style.id = "spInjectedV12_4";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------- dock icons ----------------
  function iconSvg(type) {
    const sw = 1.75;

    if (type === "call") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2c-9.2-.7-16.5-8-17.2-17.2A2 2 0 0 1 4.6 2h3a2 2 0 0 1 2 1.7c.2 1.2.5 2.4 1 3.5a2 2 0 0 1-.5 2.1L8.9 10.5a16 16 0 0 0 4.6 4.6l1.2-1.2a2 2 0 0 1 2.1-.5c1.1.5 2.3.8 3.5 1A2 2 0 0 1 22 16.9z" stroke-width="${sw}" fill="none"/>
      </svg>`;
    }

    // Directions pin
    return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-7.7 7-13a7 7 0 0 0-14 0c0 5.3 7 13 7 13z" stroke-width="${sw}" fill="none"/>
      <circle cx="12" cy="8.5" r="2.3" stroke-width="${sw}" fill="none"></circle>
    </svg>`;
  }

  // ---------------- data helpers ----------------
  function parseBrands(shop) {
    const raw = shop.brands ?? shop.Brands ?? shop["Cigar brands"] ?? shop["Cigar Brands"];
    if (Array.isArray(raw)) return raw.map(toStr).filter(Boolean);

    const s = toStr(raw);
    if (!s) return [];
    return s.split(/[,|\n/]+/g).map((x) => toStr(x)).filter(Boolean);
  }

  function getPhone(shop) {
    return toStr(shop.cell || shop.Cell) || toStr(shop.phone || shop.Phone) || "";
  }

  function getHoursForDay(shop, dayName) {
    if (shop.hours && typeof shop.hours === "object") {
      const k = dayName.slice(0, 3).toLowerCase();
      const v = toStr(shop.hours[k]);
      if (v) return v;
    }
    const direct = toStr(shop[dayName] ?? shop[dayName.toLowerCase()]);
    if (direct) return direct;
    const short = dayName.slice(0, 3);
    return toStr(shop[short] ?? shop[short.toLowerCase()]);
  }

  function getAnyHoursPresent(shop) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days.some((d) => {
      const v = getHoursForDay(shop, d);
      const s = String(v || "").trim();
      if (!s) return false;
      if (["-", "—", "n/a", "na"].includes(s.toLowerCase())) return false;
      return true;
    });
  }

  // ---------------- Brands sheet ----------------
  function openBrandsSheet(brandsRaw) {
    injectStylesOnce();

    const brands = (brandsRaw || []).map(toStr).filter(Boolean);

    const existing = document.querySelector(".sp-sheet-backdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "sp-sheet-backdrop";

    const sheet = document.createElement("div");
    sheet.className = "sp-sheet";

    const header = document.createElement("div");
    header.className = "sp-sheet-header";
    header.innerHTML = `
      <div class="sp-sheet-topline">
        <div class="sp-sheet-title">Brands</div>
        <button type="button" class="sp-sheet-close" aria-label="Close">×</button>
      </div>
      <div class="sp-sheet-search">
        <input type="search" placeholder="Search brands…" aria-label="Search brands" />
      </div>
    `;

    const body = document.createElement("div");
    body.className = "sp-sheet-body";

    const grid = document.createElement("div");
    grid.className = "sp-brand-grid";

    function renderGrid(list) {
      grid.innerHTML = "";

      if (!list.length) {
        body.innerHTML = `<div class="sp-muted">No brands listed yet.</div>`;
        return;
      }

      body.innerHTML = "";
      body.appendChild(grid);

      list.forEach((slug) => {
        const clean = sanitizeLogoName(slug);
        const label = prettyBrandLabel(slug);

        const tile = document.createElement("div");
        tile.className = "sp-brand-tile";

        const nameEl = document.createElement("div");
        nameEl.className = "sp-brand-name";
        nameEl.textContent = label || clean;

        const img = document.createElement("img");
        img.alt = label || clean;
        img.loading = "lazy";
        img.src = `/img/icons/brands/${clean}.svg?v=${Date.now()}`;
        img.onerror = () => {
          if (img.src.includes(".svg")) {
            img.src = `/img/icons/brands/${clean}.png?v=${Date.now()}`;
            return;
          }
          img.remove();
          const fb = document.createElement("div");
          fb.className = "sp-brand-fallback";
          fb.textContent = label || clean;
          tile.insertBefore(fb, nameEl);
        };

        tile.appendChild(img);
        tile.appendChild(nameEl);
        grid.appendChild(tile);
      });
    }

    renderGrid(brands);

    sheet.appendChild(header);
    sheet.appendChild(body);
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    const input = header.querySelector('input[type="search"]');
    if (input) {
      input.addEventListener("input", () => {
        const q = String(input.value || "").trim().toLowerCase();
        if (!q) return renderGrid(brands);
        const filtered = brands.filter((b) => {
          const label = prettyBrandLabel(b).toLowerCase();
          const raw = String(b).toLowerCase();
          return label.includes(q) || raw.includes(q);
        });
        renderGrid(filtered);
      });
      setTimeout(() => input.focus({ preventScroll: true }), 60);
    }

    function close() {
      backdrop.remove();
    }

    header.querySelector(".sp-sheet-close")?.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });

    document.addEventListener(
      "keydown",
      function onKey(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          close();
        }
      },
      { once: true }
    );
  }

  // ---------------- bottom section build ----------------
  function buildBottomSection(shop) {
    injectStylesOnce();

    const top = document.querySelector(".sp-top");
    if (!top) return;

    // Remove any previous bottom
    const existing = document.querySelector(".sp-bottom");
    if (existing) existing.remove();

    // Hide/remove legacy sections if they exist in HTML
    [
      ".sp-actions",
      ".sp-actions-row",
      ".sp-tabs",
      ".sp-tabs-row",
      ".sp-overview",
      ".sp-contact",
      ".sp-section",
      ".sp-panels-legacy",
      "#spOverview",
      "#spContact",
    ].forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.classList.add("sp-legacy-hide")));

    const bottom = document.createElement("div");
    bottom.className = "sp-bottom";

    const phone = getPhone(shop);
    const directions = buildDirectionsUrl(shop);
    const status = getOpenClosed(shop);

    // Dock order: Status | Call | Directions | Brands
    const dock = document.createElement("div");
    dock.className = "sp-dock";

    // Status (static)
    {
      const stat = document.createElement("div");
      stat.className = "sp-dock-static";
      stat.innerHTML = `<div class="sp-status-mini" data-status="${status.toLowerCase()}">${escapeHtml(status)}</div>`;
      dock.appendChild(stat);
    }

    // Call
    {
      const a = document.createElement("a");
      a.setAttribute("aria-label", "Call");
      if (phone) {
        a.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
        a.innerHTML = `${iconSvg("call")}<div class="sp-dock-label">Call</div>`;
      } else {
        a.href = "#";
        a.style.opacity = "0.35";
        a.style.pointerEvents = "none";
        a.innerHTML = `${iconSvg("call")}<div class="sp-dock-label">Call</div>`;
      }
      dock.appendChild(a);
    }

    // Directions
    {
      const a = document.createElement("a");
      a.href = directions;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Directions");
      a.innerHTML = `${iconSvg("dir")}<div class="sp-dock-label">Directions</div>`;
      dock.appendChild(a);
    }

    // Brands
    {
      const a = document.createElement("a");
      a.href = "#";
      a.dataset.action = "brands";
      a.setAttribute("aria-label", "Brands");
      a.innerHTML = `<img class="sp-dock-img" src="/img/icons/brands.svg?v=${Date.now()}" alt="" aria-hidden="true"/><div class="sp-dock-label">Brands</div>`;
      dock.appendChild(a);
    }

    bottom.appendChild(dock);

    // Segmented (no default selected)
    const seg = document.createElement("div");
    seg.className = "sp-seg";
    seg.innerHTML = `
      <button type="button" data-tab="hours" aria-selected="false">Hours</button>
      <button type="button" data-tab="about" aria-selected="false">About</button>
      <button type="button" data-tab="events" aria-selected="false">Events</button>
    `;
    bottom.appendChild(seg);

    // Panels exist, but hidden by default until user taps
    const panels = document.createElement("div");
    panels.className = "sp-panels";

    const hasAnyHours = getAnyHoursPresent(shop);

    const hoursCard = document.createElement("div");
    hoursCard.className = "sp-card sp-hidden";
    hoursCard.setAttribute("data-panel", "hours");
    if (!hasAnyHours) {
      hoursCard.innerHTML = `<h3>Hours</h3><div class="sp-muted">Coming soon</div>`;
    } else {
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const rows = days
        .map((d) => {
          const v = toStr(getHoursForDay(shop, d));
          const show = v && !["-", "—", "n/a", "na"].includes(v.trim().toLowerCase()) ? v : "—";
          return `<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(0,0,0,.06);padding-top:10px;">
              <div style="font-weight:900;color:#1c1c1e;">${escapeHtml(d)}</div>
              <div style="font-weight:800;color:#8e8e93;text-align:right;max-width:60%;">${escapeHtml(show)}</div>
            </div>`;
        })
        .join("");
      hoursCard.innerHTML = `<h3>Hours</h3><div style="display:grid;gap:10px;">${rows.replace(
        'border-top:1px solid rgba(0,0,0,.06);padding-top:10px;',
        ""
      )}</div>`;
    }

    const aboutCard = document.createElement("div");
    aboutCard.className = "sp-card sp-hidden";
    aboutCard.setAttribute("data-panel", "about");
    const website = toStr(shop.website || shop.Website);
    const email = toStr(shop.email || shop.Email);
    const addr = [
      toStr(shop.address1 || shop.address || shop.Address),
      toStr(shop.city || shop.City),
      toStr(shop.state || shop.ST || shop.State),
      toStr(shop.zip || shop.Zip),
    ]
      .filter(Boolean)
      .join(", ");
    aboutCard.innerHTML = `
      <h3>About</h3>
      <div class="sp-muted" style="display:grid;gap:10px;">
        <div><strong style="color:#1c1c1e;">Phone</strong><div>${escapeHtml(phone || "—")}</div></div>
        <div><strong style="color:#1c1c1e;">Website</strong><div>${website ? escapeHtml(website) : "—"}</div></div>
        <div><strong style="color:#1c1c1e;">Email</strong><div>${email ? escapeHtml(email) : "—"}</div></div>
        <div><strong style="color:#1c1c1e;">Address</strong><div>${addr ? escapeHtml(addr) : "—"}</div></div>
      </div>
    `;

    const eventsCard = document.createElement("div");
    eventsCard.className = "sp-card sp-hidden";
    eventsCard.setAttribute("data-panel", "events");
    const events = toStr(shop.events || shop.Events || shop.updates || shop.Updates);
    eventsCard.innerHTML = `<h3>Events</h3><div class="sp-muted">${events ? escapeHtml(events) : "Coming soon"}</div>`;

    panels.appendChild(hoursCard);
    panels.appendChild(aboutCard);
    panels.appendChild(eventsCard);

    bottom.appendChild(panels);

    top.parentElement?.appendChild(bottom);

    // Wire dock: brands
    dock.querySelector('[data-action="brands"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      openBrandsSheet(parseBrands(shop));
    });

    // Seg interactions: no default; toggle selected & show panel
    const segBtns = Array.from(seg.querySelectorAll("button"));
    function setActive(tab) {
      segBtns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
      Array.from(panels.querySelectorAll(".sp-card")).forEach((c) => c.classList.add("sp-hidden"));
      const panel = panels.querySelector(`[data-panel="${tab}"]`);
      if (panel) panel.classList.remove("sp-hidden");
    }

    segBtns.forEach((b) => {
      b.addEventListener("click", () => setActive(b.dataset.tab));
    });
  }

  // ---------------- top section render ----------------
  async function renderTop(shop) {
    injectStylesOnce();

    // Elements (support either ids or classes)
    const titleEl = $("#spTitle") || $(".sp-title-center");
    const cityBtn = $("#spCityBtn") || $(".sp-city");
    const cityText = $("#spCity") || cityBtn?.querySelector("span") || cityBtn;
    const logoWrap = $(".sp-logo-center");
    const logoImg = (logoWrap && logoWrap.querySelector("img")) || $("#spLogo") || $("#spLogoImg");
    const taaEl = $("#spTaaIcon");

    const name = toStr(shop.name || shop.Shop || shop.shop || shop.Title) || "Shop Name";
    const city = toStr(shop.city || shop.City) || "City";
    const st = toStr(shop.state || shop.ST || shop.State) || "ST";

    if (titleEl) applyNameClampAndSize(titleEl, name);
    if (cityText) cityText.textContent = `${city}, ${st}`;

    // directions click on city line
    if (cityBtn) {
      cityBtn.addEventListener("click", () => {
        window.open(buildDirectionsUrl(shop), "_blank", "noopener");
      });
    }

    // TAA badge show/hide (top-right only)
    const features = normalizeFeatures(shop);
    const hasTaa = isTruthy(features.taa) || isTruthy(shop.TAA) || isTruthy(shop.taa);
    if (taaEl) {
      taaEl.style.display = hasTaa ? "block" : "none";
      if (hasTaa) {
        if (!taaEl.getAttribute("src")) taaEl.setAttribute("src", "/img/icons/taa.svg");
        taaEl.setAttribute("alt", "TAA");
      }
    }

    // Load shop logo (center)
    if (logoImg) {
      const base = sanitizeLogoName(name);
      const svgUrl = `/img/icons/shops/${base}.svg?v=${Date.now()}`;
      const pngUrl = `/img/icons/shops/${base}.png?v=${Date.now()}`;
      await loadLogoWithoutOutline(logoImg, svgUrl, pngUrl);
    }

    // Amenities row (render up to 3 true items)
    const amenRow = $("#spAmenRow") || $(".sp-amen-row");
    if (amenRow) {
      amenRow.innerHTML = "";
      const show = AMENITIES.filter((a) => isTruthy(features[a.key])).slice(0, 3);
      show.forEach((a) => {
        const img = document.createElement("img");
        img.className = "sp-amen-icon";
        img.src = `${a.icon}?v=${Date.now()}`;
        img.alt = a.label;
        amenRow.appendChild(img);
      });
    }

    buildBottomSection(shop);
  }

  // ---------------- data loading ----------------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${url}`);
    return res.json();
  }

  async function loadShopData(fileSlug) {
    // 1) per-shop json
    try {
      return await fetchJson(`/data/shops/${fileSlug}.json?v=${Date.now()}`);
    } catch {
      // 2) fallback legacy list
      const arr = await fetchJson(`/shops/shops.json?v=${Date.now()}`);
      if (!Array.isArray(arr)) throw new Error("legacy shops.json not an array");
      const hit =
        arr.find((s) => slugify(s.shop || s.Shop || s.name || s.Name) === fileSlug) ||
        arr.find((s) => slugify(s.name || s.Shop || s.shop) === fileSlug) ||
        arr.find((s) => sanitizeLogoName(s.name || s.Shop || s.shop) === sanitizeLogoName(fileSlug));
      if (!hit) throw new Error("shop not found");
      return hit;
    }
  }

  // ---------------- init ----------------
  async function init() {
    const fileSlug = toStr(getParam("shop")) || "shop";
    injectStylesOnce();

    try {
      const shop = await loadShopData(fileSlug);
      await renderTop(shop);
    } catch (e) {
      const titleEl = $("#spTitle") || $(".sp-title-center");
      if (titleEl) titleEl.textContent = "Shop not found";
      const cityText = $("#spCity") || $(".sp-city");
      if (cityText) cityText.textContent = "—";
      console.error(e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
