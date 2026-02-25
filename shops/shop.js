/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v12.3)

   ✅ Use with: <script src="/shops/shop.js?v=12.3"></script>

   Data:
   ✅ Loads per-shop JSON first:
      /data/shops/{fileSlug}.json   (ex: justthetip.json)
   ✅ Fallback:
      /shops/shops.json  (array)

   UI (latest):
   1) SHOP pill + TAA badge = top-right stacked
   2) Status moved into dock row: Status | Call | Directions | Brands
   3) No default-open panel (seg bar only until tap)
   4) Strip thin outline from shop logo SVG outer rect
   5) NEW: Remove the individual “button boxes” behind OPEN/CALL/DIRECTIONS/BRANDS
      (keep ONLY the dock container background)
   6) NEW: Segmented labels (Hours/About/Events) look like SF Pro Display Bold
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

  function prettyBrandLabel(slug) {
    const raw = String(slug || "").trim();
    if (!raw) return "";
    const hasSpace = /\s/.test(raw);
    const hasUpper = /[A-Z]/.test(raw);
    if (hasSpace || hasUpper) return raw;

    const spaced = raw
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([0-9])/g, "$1 $2")
      .replace(/([0-9])([a-z])/g, "$1 $2")
      .trim();

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
    const q = hasCoords ? `${lat},${lng}` : fallbackAddress || shop.name || shop.Shop || "";
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // ---------------- amenities ----------------
  // NOTE: TAA intentionally not here (only top-right badge)
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

  // ---------------- status open/closed ----------------
  function getOpenClosed(shop) {
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

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

  // ---------------- SVG outline removal for shop logo ----------------
  async function loadLogoWithoutOutline(imgEl, svgUrl, pngUrl) {
    try {
      const res = await fetch(svgUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("svg fetch failed");
      const text = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) throw new Error("no svg root");

      const rects = Array.from(svg.querySelectorAll("rect"));
      rects.forEach((r, idx) => {
        if (idx > 3) return;

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
      imgEl.src = `data:image/svg+xml;base64,${b64}`;
      imgEl.onerror = null;
      return;
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
    if (document.getElementById("spInjectedV12_3")) return;

    const css = `
      /* SHOP pill -> top-right */
      .sp-pill-left{
        position:absolute !important;
        top:18px !important;
        right:18px !important;
        left:auto !important;
      }

      /* Hide legacy status pill (we render status in dock now) */
      .sp-status{ display:none !important; }
      #spStatusPill{ display:none !important; }

      /* TAA badge stacked under SHOP pill, smaller */
      #spTaaIcon{
        position:absolute !important;
        top:54px !important;
        right:18px !important;
        width:66px !important;
        height:auto !important;
        opacity:1 !important;
        filter:none !important;
        -webkit-filter:none !important;
      }

      /* City typography */
      .sp-city, .sp-city span, #spCity{
        font-weight:400 !important;
        letter-spacing:-0.02em !important;
      }
      .sp-city{ color:#8e8e93 !important; }

      /* Amenities panel/icon outline kill */
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

      /* Bottom */
      .sp-bottom{ margin-top:18px; }

      /* Dock container keeps background */
      .sp-dock{
        display:flex;
        gap:12px;
        justify-content:space-between;
        padding:12px;
        border-radius:22px;
        background: rgba(255,255,255,.70);
        border:1px solid rgba(0,0,0,.05);
        box-shadow: 0 12px 30px rgba(0,0,0,.06);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      /* ✅ NEW: remove the individual “button boxes” behind each item */
      .sp-dock a,
      .sp-dock .sp-dock-static{
        flex:1 1 0;
        height:54px;
        border-radius:16px;
        border:none !important;
        background: transparent !important;
        box-shadow: none !important;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:0;
        text-decoration:none;
        color:#0b0b0c;
        font-weight:800;
        font-size:12px;
      }

      .sp-dock .sp-dock-ico{
        width:22px;
        height:22px;
        stroke:#0b0b0c;
        fill:none;
        opacity: .45; /* matches your muted icons */
      }
      .sp-dock a > div{
        opacity: .55;
      }

      /* Brands icon image */
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
        opacity: .65;
      }

      /* Status pill inside dock stays visible */
      .sp-status-mini{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:7px 14px;
        border-radius:999px;
        font-weight:900;
        font-size:12px;
        letter-spacing:0;
        color:#fff;
        min-width:72px;
        box-shadow: 0 10px 22px rgba(0,0,0,.10);
      }
      .sp-status-mini[data-status="open"]{ background: rgba(52,199,89,.92); }
      .sp-status-mini[data-status="closed"]{ background: rgba(142,142,147,.90); }

      /* ✅ Segmented: SF Pro Display Bold look */
      .sp-seg{
        margin-top:14px;
        padding:6px;
        border-radius:18px;
        background: rgba(242,242,247,.75);
        border:1px solid rgba(0,0,0,.05);
        display:flex;
        gap:6px;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      .sp-seg button{
        flex:1 1 0;
        height:38px;
        border-radius:14px;
        border:none;
        background:transparent;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif !important;
        font-weight: 800 !important;          /* Bold */
        font-size: 15px !important;
        letter-spacing: -0.02em !important;   /* SF Pro vibe */
        color:#8e8e93;
        -webkit-font-smoothing: antialiased;
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
      .sp-card h3{
        margin:0 0 8px 0;
        font-size:16px;
        font-weight:900;
        letter-spacing:-0.01em;
        color:#0b0b0c;
      }
      .sp-muted{ color:#8e8e93; font-weight:700; }
      .sp-hidden{ display:none !important; }

      /* Brands sheet (unchanged) */
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
        padding: 14px 14px 12px 16px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .sp-sheet-topline{
        display:flex; align-items:center; justify-content:space-between;
      }
      .sp-sheet-title{ font-size:18px; font-weight:900; letter-spacing:-0.01em; }
      .sp-sheet-close{
        width:36px; height:36px;
        border-radius:18px;
        border:1px solid rgba(0,0,0,.08);
        background: rgba(255,255,255,.85);
        display:grid; place-items:center;
        font-size:18px;
        cursor:pointer;
      }
      .sp-sheet-search{
        display:flex;
        align-items:center;
        gap:10px;
        padding:10px 12px;
        border-radius:14px;
        background: rgba(242,242,247,.85);
        border:1px solid rgba(0,0,0,.06);
      }
      .sp-sheet-search input{
        width:100%;
        border:none;
        outline:none;
        background:transparent;
        font-size:15px;
        font-weight:600;
        letter-spacing:-0.01em;
        color:#0b0b0c;
        font-family: inherit;
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
    `;

    const style = document.createElement("style");
    style.id = "spInjectedV12_3";
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

    // Directions
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

  function getEventsText(shop) {
    return (
      toStr(shop.events) ||
      toStr(shop.Events) ||
      toStr(shop.update) ||
      toStr(shop.Update) ||
      toStr(shop.notes) ||
      toStr(shop.Notes) ||
      ""
    );
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

        const img = document.createElement("img");
        img.alt = label || clean;
        img.loading = "lazy";
        img.src = `/img/icons/brands/${clean}.svg?v=${Date.now()}`;

        const nameEl = document.createElement("div");
        nameEl.className = "sp-brand-name";
        nameEl.textContent = label || clean;

        img.onerror = () => {
          if (img.src.includes(".svg")) {
            img.src = `/img/icons/brands/${clean}.png?v=${Date.now()}`;
            return;
          }
          img.remove();
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
        if (e.key === "Escape") close();
      },
      { once: true }
    );
  }

  // ---------------- bottom section build ----------------
  function buildBottomSection(shop) {
    injectStylesOnce();

    const top = document.querySelector(".sp-top");
    if (!top) return;

    const existing = document.querySelector(".sp-bottom");
    if (existing) existing.remove();

    const bottom = document.createElement("div");
    bottom.className = "sp-bottom";

    const phone = getPhone(shop);
    const directions = buildDirectionsUrl(shop);
    const status = getOpenClosed(shop);

    // Dock: Status | Call | Directions | Brands
    const dock = document.createElement("div");
    dock.className = "sp-dock";

    const stat = document.createElement("div");
    stat.className = "sp-dock-static";
    stat.innerHTML = `<div class="sp-status-mini" data-status="${status.toLowerCase()}">${escapeHtml(
      status
    )}</div>`;
    dock.appendChild(stat);

    const call = document.createElement("a");
    call.setAttribute("aria-label", "Call");
    if (phone) {
      call.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      call.innerHTML = `${iconSvg("call")}<div>Call</div>`;
    } else {
      call.href = "#";
      call.style.opacity = "0.35";
      call.style.pointerEvents = "none";
      call.innerHTML = `${iconSvg("call")}<div>Call</div>`;
    }
    dock.appendChild(call);

    const dir = document.createElement("a");
    dir.href = directions;
    dir.target = "_blank";
    dir.rel = "noopener";
    dir.setAttribute("aria-label", "Directions");
    dir.innerHTML = `${iconSvg("dir")}<div>Directions</div>`;
    dock.appendChild(dir);

    const brandsBtn = document.createElement("a");
    brandsBtn.href = "#";
    brandsBtn.dataset.action = "brands";
    brandsBtn.setAttribute("aria-label", "Brands");
    brandsBtn.innerHTML = `<img class="sp-dock-img" src="/img/icons/brands.svg?v=${Date.now()}" alt="" aria-hidden="true"/><div>Brands</div>`;
    dock.appendChild(brandsBtn);

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

    // Panels hidden by default
    const panels = document.createElement("div");
    panels.className = "sp-panels";

    // Hours panel
    const hoursCard = document.createElement("div");
    hoursCard.className = "sp-card sp-hidden";
    hoursCard.setAttribute("data-panel", "hours");

    if (!getAnyHoursPresent(shop)) {
      hoursCard.innerHTML = `<h3>Hours</h3><div class="sp-muted">Coming soon</div>`;
    } else {
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const rows = days
        .map((d) => {
          const v = toStr(getHoursForDay(shop, d) || "—");
          return `<div class="sp-muted" style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid rgba(0,0,0,.06)"><span style="font-weight:900;color:#0b0b0c">${escapeHtml(
            d
          )}</span><span>${escapeHtml(v)}</span></div>`;
        })
        .join("");
      hoursCard.innerHTML = `<h3>Hours</h3><div>${rows}</div>`;
    }

    // About
    const aboutCard = document.createElement("div");
    aboutCard.className = "sp-card sp-hidden";
    aboutCard.setAttribute("data-panel", "about");
    aboutCard.innerHTML = `<h3>About</h3><div class="sp-muted">${escapeHtml(
      toStr(shop.about || shop.About || "Details coming soon.")
    )}</div>`;

    // Events
    const eventsText = getEventsText(shop);
    const eventsCard = document.createElement("div");
    eventsCard.className = "sp-card sp-hidden";
    eventsCard.setAttribute("data-panel", "events");
    eventsCard.innerHTML = `<h3>Events</h3>${
      eventsText
        ? `<div class="sp-muted">${escapeHtml(eventsText)}</div>`
        : `<div class="sp-muted">No events posted yet.</div>`
    }`;

    panels.appendChild(hoursCard);
    panels.appendChild(aboutCard);
    panels.appendChild(eventsCard);

    bottom.appendChild(panels);
    top.appendChild(bottom);

    function setTab(tabOrNull) {
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-selected", tabOrNull && b.dataset.tab === tabOrNull ? "true" : "false");
      });
      panels.querySelectorAll("[data-panel]").forEach((p) => {
        p.classList.toggle("sp-hidden", !tabOrNull || p.getAttribute("data-panel") !== tabOrNull);
      });
    }

    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;

      const currentlySelected = btn.getAttribute("aria-selected") === "true";
      if (currentlySelected) return setTab(null);
      setTab(btn.dataset.tab);
    });

    // no default open
    setTab(null);
  }

  // ---------------- render shop ----------------
  function renderShop(shop) {
    injectStylesOnce();
    window.__SHOP_CURRENT__ = shop;

    const shopName = shop.name || shop.Shop || "Shop";
    const features = normalizeFeatures(shop);

    const nameEl = $("#spName");
    if (nameEl) applyNameClampAndSize(nameEl, shopName);

    const cityEl = $("#spCity");
    if (cityEl) {
      const cityLine = [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
        .filter(Boolean)
        .join(", ");
      cityEl.textContent = cityLine || "—";
    }

    const taaEl = $("#spTaaIcon");
    if (taaEl) taaEl.style.display = features.taa === true ? "" : "none";

    const addrBtn = $("#spAddressBtn");
    if (addrBtn) addrBtn.onclick = () => window.open(buildDirectionsUrl(shop), "_blank", "noopener");

    // Amenities row
    const row = $("#spAmenRow");
    const panel = $("#spAmenPanel");
    if (row && panel) {
      row.innerHTML = "";
      const enabled = AMENITIES.filter((a) => features[a.key] === true);

      enabled.forEach((a) => {
        const img = document.createElement("img");
        img.className = "sp-amen-icon";
        img.src = `${a.icon}?v=${Date.now()}`;
        img.alt = a.label;
        img.onerror = () => img.remove();
        row.appendChild(img);
      });

      panel.style.display = enabled.length ? "" : "none";
    }

    // Shop logo (remove outline)
    const logoEl = $("#spLogo");
    if (logoEl) {
      const base = sanitizeLogoName(shopName);
      const svgPath = `/img/icons/shops/${base}.svg?v=${Date.now()}`;
      const pngPath = `/img/icons/shops/${base}.png?v=${Date.now()}`;
      logoEl.alt = `${shopName} logo`;
      loadLogoWithoutOutline(logoEl, svgPath, pngPath);
    }

    buildBottomSection(shop);
  }

  // ---------------- clicks (Brands) ----------------
  function wireGlobalClicks() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target.closest('[data-action="brands"]');
        if (!a) return;
        e.preventDefault();

        const shop = window.__SHOP_CURRENT__;
        const brands = shop ? parseBrands(shop) : [];
        openBrandsSheet(brands);
      },
      true
    );
  }

  // ---------------- data loading ----------------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    const txt = await res.text();
    return JSON.parse(txt);
  }

  function findShop(list, slugParam) {
    const want = slugify(slugParam);
    if (!want) return null;

    return (
      list.find((s) => slugify(s.slug) === want) ||
      list.find((s) => slugify(s.name || s.Shop) === want) ||
      list.find((s) => sanitizeLogoName(s.name || s.Shop) === sanitizeLogoName(want)) ||
      null
    );
  }

  // ---------------- boot ----------------
  async function boot() {
    wireGlobalClicks();

    const slugParamRaw = (getParam("shop") || "").trim();
    if (!slugParamRaw) {
      const nameEl = $("#spName");
      if (nameEl) nameEl.textContent = "Shop not found";
      return;
    }

    const fileSlug = sanitizeLogoName(slugParamRaw);

    // 1) Per-shop JSON first
    try {
      const obj = await fetchJson(`/data/shops/${fileSlug}.json?v=${Date.now()}`);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        renderShop(obj);
        return;
      }
    } catch {
      // continue
    }

    // 2) Legacy list fallback
    try {
      const list = await fetchJson(`/shops/shops.json?v=${Date.now()}`);
      if (!Array.isArray(list) || !list.length) throw new Error("shops.json empty or not array");

      const shop = findShop(list, slugParamRaw);
      if (!shop) throw new Error(`No matching shop for slug: "${slugParamRaw}"`);

      renderShop(shop);
    } catch (err) {
      console.error("SHOP PAGE ERROR:", err);

      const nameEl = $("#spName");
      if (nameEl) nameEl.textContent = "Shop not found";

      const cityEl = $("#spCity");
      if (cityEl) cityEl.textContent = "—";
    }
  }

  boot();
})();
