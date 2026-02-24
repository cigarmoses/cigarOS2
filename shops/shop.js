/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v12)

   ✅ Cache-proof behavior when used with: <script src="/shops/shop.js?v=12"></script>

   ✅ Loads per-shop JSON first (no dashes in filename):
      /data/shops/{fileSlug}.json  (ex: justthetip.json)

   ✅ Fallback to legacy /shops/shops.json list

   ✅ Brands button uses /img/icons/brands.svg

   ✅ Brands button opens bottom sheet with:
      - Search bar
      - SVG grid: /img/icons/brands/{brandSlug}.svg (fallback .png)
      - Brand name under icon (SF Pro regular, -0.2 tracking)

   ✅ Remove thin “outline” on dock buttons (keep subtle shadow)

   ✅ Remove TAA icon from the middle amenities row (TAA stays top-right only)

   ✅ Top-right TAA badge:
      - width matches OPEN pill width (approx)
      - moved down a bit
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

  // removes all non-alnum (for filenames + per-shop JSON filenames)
  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  // turns "Shelly’s Back Room" -> "shellys-back-room"
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
      .map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : "")
      .join(" ");
  }

  function prettyBrandLabel(slug) {
    // If owner gave a nice label already (contains space / uppercase), keep it
    const raw = String(slug || "").trim();
    if (!raw) return "";
    const hasSpace = /\s/.test(raw);
    const hasUpper = /[A-Z]/.test(raw);
    if (hasSpace || hasUpper) return raw;

    // Otherwise, best-effort prettify
    const spaced = raw
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([0-9])/g, "$1 $2")
      .replace(/([0-9])([a-z])/g, "$1 $2")
      .trim();

    // Note: "blacklabeltradingco" stays "Blacklabeltradingco" (we don't have a dictionary yet)
    return titleCaseWords(spaced || raw);
  }

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
    const q = hasCoords ? `${lat},${lng}` : (fallbackAddress || shop.name || shop.Shop || "");
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // ---------------- amenities ----------------
  // NOTE: TAA is intentionally NOT in this list (it should NOT render in the middle row)
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

    // Keep TAA parsing for the top-right badge:
    taa: ["taa"],
  };

  function normalizeFeatures(shop) {
    const bag = {};

    // ✅ per-shop nested amenities support
    if (shop.amenities && typeof shop.amenities === "object") {
      for (const k of Object.keys(shop.amenities)) {
        bag[normalizeKey(k)] = isTruthy(shop.amenities[k]);
      }
    }

    // legacy "features" object support
    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    // legacy flat columns support
    for (const rawKey of Object.keys(shop)) {
      const nk = normalizeKey(rawKey);

      // Only map keys we know
      if (
        AMENITIES.some(a => a.key === nk) ||
        nk === "taa"
      ) {
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

  // ---------------- status open/closed ----------------
  function getOpenClosed(shop) {
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

    if (!("open" in shop) && !("Open" in shop) && !("closed" in shop) && !("Closed" in shop) && !shop.status && !shop.Status) {
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

  // ---------------- injected styling ----------------
  function injectStylesOnce() {
    if (document.getElementById("spInjectedV12")) return;

    const css = `
      .sp-status { position: absolute !important; top: 18px !important; right: 18px !important; left: auto !important; }
      #spStatusPill { font-size: 12px !important; padding: 6px 14px !important; letter-spacing: 0 !important; font-weight: 600 !important; }

      .sp-city, .sp-city span, #spCity { font-weight: 400 !important; letter-spacing: -0.02em !important; }
      .sp-city { color: #8e8e93 !important; }

      .sp-logo-center img { filter: none !important; -webkit-filter:none !important; }

      /* ✅ TAA badge: move down + approximate OPEN pill width */
      #spTaaIcon{
        position: absolute !important;
        top: 54px !important;         /* moved down under OPEN */
        right: 18px !important;
        width: 78px !important;       /* approx OPEN pill width */
        height: auto !important;
        opacity: 1 !important;
        filter: none !important;
        -webkit-filter: none !important;
      }

      /* ✅ HARD KILL: any hairline outline around amenity icons */
      #spAmenPanel, #spAmenRow { background: transparent !important; border: none !important; box-shadow: none !important; }
      #spAmenRow img,
      .sp-amen-icon,
      .sp-amen-icon * {
        background: transparent !important;
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        filter: none !important;
        -webkit-filter: none !important;
      }
      .sp-amen-icon { display:block !important; border-radius: 0 !important; }

      /* ---------------- Dock + Seg ---------------- */
      .sp-bottom { margin-top: 18px; }

      .sp-dock {
        display:flex; gap:12px; justify-content:space-between;
        padding: 12px;
        border-radius: 22px;
        background: rgba(255,255,255,.70);
        border: 1px solid rgba(0,0,0,.05);
        box-shadow: 0 12px 30px rgba(0,0,0,.06);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      /* ✅ remove the little outline on the dock buttons (keep subtle shadow) */
      .sp-dock a{
        flex:1 1 0;
        height: 54px;
        border-radius: 16px;
        border: none !important;                         /* remove outline */
        background: rgba(255,255,255,.84);
        box-shadow: 0 10px 24px rgba(0,0,0,.06);         /* subtle shadow */
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap: 6px;
        padding: 0;
        text-decoration:none;
        color:#0b0b0c;
        font-weight: 800;
        font-size: 12px;
      }

      .sp-dock .sp-dock-ico{ width: 22px; height: 22px; stroke: #0b0b0c; fill: none; }
      .sp-dock .sp-dock-ico-fill{ fill: #0b0b0c; stroke: none; }

      .sp-dock .sp-dock-img{
        width: 24px;
        height: 24px;
        object-fit: contain;
        display:block;
        border: none !important;
        outline: none !important;
        background: transparent !important;
        box-shadow: none !important;
        filter: none !important;
        -webkit-filter: none !important;
      }

      .sp-seg {
        margin-top: 14px;
        padding: 6px;
        border-radius: 18px;
        background: rgba(242,242,247,.75);
        border: 1px solid rgba(0,0,0,.05);
        display:flex; gap: 6px;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      .sp-seg button{
        flex:1 1 0;
        height: 38px;
        border-radius: 14px;
        border: none;
        background: transparent;
        font-weight: 800;
        font-size: 14px;
        color: #8e8e93;
      }
      .sp-seg button[aria-selected="true"]{
        background: rgba(255,255,255,.90);
        color: #0b0b0c;
        box-shadow: none;
      }

      .sp-panels{ margin-top: 12px; }
      .sp-card{
        background: rgba(255,255,255,.92);
        border: 1px solid rgba(0,0,0,.05);
        border-radius: 24px;
        padding: 16px;
        box-shadow: 0 14px 40px rgba(0,0,0,.06);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .sp-card + .sp-card{ margin-top: 12px; }
      .sp-card h3{ margin: 0 0 8px 0; font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color:#0b0b0c; }
      .sp-muted{ color:#8e8e93; font-weight: 700; }
      .sp-hidden{ display:none !important; }

      /* -------- Brands sheet -------- */
      .sp-sheet-backdrop{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.18);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 9999;
        display:flex; align-items:flex-end; justify-content:center;
        padding: 10px;
      }
      .sp-sheet{
        width: min(560px, 100%);
        background: rgba(255,255,255,.94);
        border: 1px solid rgba(0,0,0,.08);
        border-radius: 22px;
        box-shadow: 0 24px 80px rgba(0,0,0,.20);
        overflow: hidden;
      }
      .sp-sheet-header{
        padding: 14px 14px 12px 16px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        display:flex;
        flex-direction:column;
        gap: 10px;
      }
      .sp-sheet-topline{
        display:flex; align-items:center; justify-content:space-between;
      }
      .sp-sheet-title{ font-size: 18px; font-weight: 900; letter-spacing: -0.01em; }
      .sp-sheet-close{
        width: 36px; height: 36px;
        border-radius: 18px;
        border: 1px solid rgba(0,0,0,.08);
        background: rgba(255,255,255,.85);
        display:grid; place-items:center;
        font-size: 18px;
        cursor: pointer;
      }

      .sp-sheet-search{
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(242,242,247,.85);
        border: 1px solid rgba(0,0,0,.06);
      }
      .sp-sheet-search input{
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #0b0b0c;
        font-family: inherit;
      }
      .sp-sheet-search input::placeholder{
        color:#8e8e93;
        font-weight: 600;
      }

      .sp-sheet-body{
        max-height: 52vh;
        overflow:auto;
        padding: 14px 14px 16px 14px;
      }

      .sp-brand-grid{
        display:grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      @media (min-width: 420px){
        .sp-brand-grid{ grid-template-columns: repeat(4, 1fr); }
      }

      .sp-brand-tile{
        border: 1px solid rgba(0,0,0,.06);
        background: rgba(255,255,255,.82);
        border-radius: 16px;
        padding: 10px 10px 8px 10px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap: 8px;
        min-height: 86px;
      }
      .sp-brand-tile img{
        max-width: 100%;
        max-height: 44px;
        object-fit: contain;
        border: none !important;
        outline: none !important;
        background: transparent !important;
        box-shadow:none !important;
        filter:none !important;
        -webkit-filter:none !important;
      }

      /* ✅ Brand name under icon: SF Pro Display regular feel + -0.2 tracking */
      .sp-brand-name{
        font-size: 11px;
        font-weight: 400;
        letter-spacing: -0.2px; /* tracking */
        color: #6e6e73;
        text-align: center;
        line-height: 1.15;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sp-brand-fallback{
        font-weight: 900;
        font-size: 11px;
        color:#6e6e73;
        text-align:center;
        line-height: 1.15;
      }
    `;

    const style = document.createElement("style");
    style.id = "spInjectedV12";
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
      <path d="M12 2c-3.9 0-7 3.1-7 7
