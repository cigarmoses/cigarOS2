/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v10)

   Fixes:
   ✅ Loads canonical per-shop JSON first: /data/shops/<canonical>.json (e.g. justthetip.json)
   ✅ Keeps legacy fallback to shops.json array lists
   ✅ Brands button opens a real Brands sheet (grid of SVG logos)
   ✅ Removes faint black background/line behind the shop logo icon
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

  // removes all non-alnum (for filenames + canonical ids)
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

  // Canonical shop id for file names: "just-the-tip" -> "justthetip"
  function canonicalShopId(s) {
    return sanitizeLogoName(String(s || "").trim().toLowerCase());
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
    { key: "taa", icon: "/img/icons/taa.svg", label: "TAA" },
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

    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    for (const rawKey of Object.keys(shop)) {
      const nk = normalizeKey(rawKey);

      if (AMENITIES.some(a => a.key === nk)) {
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
    if (document.getElementById("spInjectedV10")) return;

    const css = `
      .sp-status { position: absolute !important; top: 18px !important; right: 18px !important; left: auto !important; }
      #spStatusPill { font-size: 12px !important; padding: 6px 14px !important; letter-spacing: 0 !important; font-weight: 600 !important; }

      /* City text: regular weight */
      .sp-city, .sp-city span, #spCity { font-weight: 400 !important; letter-spacing: -0.02em !important; }
      .sp-city { color: #8e8e93 !important; }

      /* ✅ Kill any faint black line/box behind the shop logo */
      .sp-logo-center,
      .sp-logo-center * {
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        border: none !important;
        filter: none !important;
        -webkit-filter: none !important;
      }
      #spLogo {
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        border: none !important;
        filter: none !important;
        -webkit-filter: none !important;
      }

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
      .sp-dock a{
        flex:1 1 0;
        height: 54px;
        border-radius: 16px;
        border: 1px solid rgba(0,0,0,.05);
        background: rgba(255,255,255,.80);
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

      /* ✅ Brands sheet (bottom sheet) */
      .sp-brands-overlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.25);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: none;
        z-index: 9999;
      }
      .sp-brands-sheet{
        position: absolute;
        left: 0; right: 0; bottom: 0;
        background: rgba(255,255,255,.96);
        border-top-left-radius: 22px;
        border-top-right-radius: 22px;
        box-shadow: 0 -18px 60px rgba(0,0,0,.18);
        max-height: 72vh;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,.06);
      }
      .sp-brands-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .sp-brands-title{
        font-size: 16px;
        font-weight: 900;
        letter-spacing: -0.01em;
        color: #0b0b0c;
      }
      .sp-brands-close{
        border:none;
        background: rgba(0,0,0,.06);
        height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        font-weight: 900;
        color:#0b0b0c;
      }
      .sp-brands-body{
        padding: 14px 14px 22px;
        overflow: auto;
        max-height: calc(72vh - 54px);
      }
      .sp-brand-grid{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .sp-brand-tile{
        background: rgba(242,242,247,.9);
        border: 1px solid rgba(0,0,0,.05);
        border-radius: 16px;
        padding: 10px;
        display:flex;
        align-items:center;
        justify-content:center;
        height: 74px;
      }
      .sp-brand-tile img{
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter:none;
      }
      .sp-brand-empty{
        color:#8e8e93;
        font-weight: 700;
        padding: 10px 2px;
      }
    `;

    const style = document.createElement("style");
    style.id = "spInjectedV10";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------- icons (dock) ----------------
  function iconSvg(type) {
    const sw = 1.75;

    if (type === "call") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2c-9.2-.7-16.5-8-17.2-17.2A2 2 0 0 1 4.6 2h3a2 2 0 0 1 2 1.7c.2 1.2.5 2.4 1 3.5a2 2 0 0 1-.5 2.1L8.9 10.5a16 16 0 0 0 4.6 4.6l1.2-1.2a2 2 0 0 1 2.1-.5c1.1.5 2.3.8 3.5 1A2 2 0 0 1 22 16.9z" stroke-width="${sw}" fill="none"/>
      </svg>`;
    }

    if (type === "cigar") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 14c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v2H3v-2z" stroke-width="${sw}" fill="none"/>
        <path d="M17 12h3.2c.9 0 1.6.7 1.6 1.6V16c0 .9-.7 1.6-1.6 1.6H17V12z" stroke-width="${sw}" fill="none"/>
        <path d="M6 12v5" stroke-width="${sw}" />
        <path d="M10 12v5" stroke-width="${sw}" />
        <path d="M14 12v5" stroke-width="${sw}" />
      </svg>`;
    }

    return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c-3.9 0-7 3.1-7 7 0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z" class="sp-dock-ico-fill"/>
      <circle cx="12" cy="9" r="2.4" fill="#fff"/>
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
    const direct = toStr(shop[dayName] ?? shop[dayName.toLowerCase()]);
    if (direct) return direct;
    const short = dayName.slice(0, 3);
    return toStr(shop[short] ?? shop[short.toLowerCase()]);
  }

  function getAnyHoursPresent(shop) {
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    return days.some(d => {
      const v = getHoursForDay(shop, d);
      const s = String(v || "").trim();
      if (!s) return false;
      if (["-", "—", "n/a", "na"].includes(s.toLowerCase())) return false;
      return true;
    });
  }

  function getTodayName() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  }

  function getEventsText(shop) {
    return toStr(shop.events) || toStr(shop.Events) || toStr(shop.update) || toStr(shop.Update) || toStr(shop.notes) || toStr(shop.Notes) || "";
  }

  // ---------------- brands sheet ----------------
  function ensureBrandsSheet() {
    injectStylesOnce();
    let overlay = document.querySelector(".sp-brands-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "sp-brands-overlay";
    overlay.innerHTML = `
      <div class="sp-brands-sheet" role="dialog" aria-modal="true" aria-label="Brands">
        <div class="sp-brands-head">
          <div class="sp-brands-title">Brands</div>
          <button type="button" class="sp-brands-close" aria-label="Close">Close</button>
        </div>
        <div class="sp-brands-body">
          <div class="sp-brand-empty">No brands listed yet.</div>
          <div class="sp-brand-grid" aria-label="Brand logos"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = overlay.querySelector(".sp-brands-close");
    close.addEventListener("click", () => hideBrandsSheet());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideBrandsSheet();
    });

    return overlay;
  }

  function showBrandsSheet(shop) {
    const overlay = ensureBrandsSheet();
    const grid = overlay.querySelector(".sp-brand-grid");
    const empty = overlay.querySelector(".sp-brand-empty");

    const slugs = parseBrands(shop);
    grid.innerHTML = "";

    if (!slugs.length) {
      empty.style.display = "";
      overlay.style.display = "block";
      return;
    }

    empty.style.display = "none";

    slugs.forEach((slug) => {
      const s = sanitizeLogoName(slug); // safety
      if (!s) return;

      const tile = document.createElement("div");
      tile.className = "sp-brand-tile";

      const img = document.createElement("img");
      img.src = `/img/icons/brands/${s}.svg`;
      img.alt = s;

      // if missing svg, just remove tile (no ugly broken image)
      img.onerror = () => tile.remove();

      tile.appendChild(img);
      grid.appendChild(tile);
    });

    overlay.style.display = "block";
  }

  function hideBrandsSheet() {
    const overlay = document.querySelector(".sp-brands-overlay");
    if (overlay) overlay.style.display = "none";
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

    // Dock: Call | Brands | Directions
    const dock = document.createElement("div");
    dock.className = "sp-dock";
    dock.innerHTML = `
      ${phone ? `<a href="tel:${phone.replace(/[^\d+]/g, "")}" aria-label="Call">${iconSvg("call")}<div>Call</div></a>` : ""}
      <a href="#" data-action="brands" aria-label="Brands">${iconSvg("cigar")}<div>Brands</div></a>
      <a href="${directions}" target="_blank" rel="noopener" aria-label="Directions">${iconSvg("dir")}<div>Directions</div></a>
    `;
    bottom.appendChild(dock);

    // Segmented: Hours | About | Events
    const seg = document.createElement("div");
    seg.className = "sp-seg";
    seg.innerHTML = `
      <button type="button" data-tab="hours" aria-selected="true">Hours</button>
      <button type="button" data-tab="about" aria-selected="false">About</button>
      <button type="button" data-tab="events" aria-selected="false">Events</button>
    `;
    bottom.appendChild(seg);

    const panels = document.createElement("div");
    panels.className = "sp-panels";

    // HOURS
    const hasAnyHours = getAnyHoursPresent(shop);
    const today = getTodayName();
    const todayHours = getHoursForDay(shop, today);

    const hoursCard = document.createElement("div");
    hoursCard.className = "sp-card";
    hoursCard.setAttribute("data-panel", "hours");
    hoursCard.innerHTML = `
      <h3>Hours</h3>
      ${
        hasAnyHours
          ? `<div class="sp-muted">${escapeHtml(today)} • ${escapeHtml(todayHours || "—")}</div>`
          : `<div class="sp-muted">Coming soon</div>`
      }
    `;

    // ABOUT
    const aboutCard = document.createElement("div");
    aboutCard.className = "sp-card sp-hidden";
    aboutCard.setAttribute("data-panel", "about");
    aboutCard.innerHTML = `
      <h3>About</h3>
      <div class="sp-muted">${escapeHtml(toStr(shop.about) || "Details coming soon.")}</div>
    `;

    // EVENTS
    const eventsText = getEventsText(shop);
    const eventsCard = document.createElement("div");
    eventsCard.className = "sp-card sp-hidden";
    eventsCard.setAttribute("data-panel", "events");
    eventsCard.innerHTML = `
      <h3>Events</h3>
      ${eventsText ? `<div class="sp-muted">${escapeHtml(eventsText)}</div>` : `<div class="sp-muted">No events posted yet.</div>`}
    `;

    panels.appendChild(hoursCard);
    panels.appendChild(aboutCard);
    panels.appendChild(eventsCard);
    bottom.appendChild(panels);
    top.appendChild(bottom);

    function setTab(tab) {
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
      });
      panels.querySelectorAll("[data-panel]").forEach((p) => {
        p.classList.toggle("sp-hidden", p.getAttribute("data-panel") !== tab);
      });
    }

    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      setTab(btn.dataset.tab);
    });

    // ✅ Dock: Brands opens sheet
    dock.addEventListener("click", (e) => {
      const a = e.target.closest('a[data-action="brands"]');
      if (!a) return;
      e.preventDefault();
      showBrandsSheet(shop);
    });

    setTab("hours");
  }

  // ---------------- render shop ----------------
  function renderShop(shop) {
    injectStylesOnce();

    const shopName = shop.name || shop.Shop || "Shop";
    const features = normalizeFeatures(shop);

    // Name
    const nameEl
