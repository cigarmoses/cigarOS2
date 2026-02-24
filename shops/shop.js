/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v10)

   Fixes:
   ✅ Loads per-shop JSON first: /data/shops/<normalized>.json  (e.g. justthetip.json)
   ✅ Brands button opens a scrollable brand-logo sheet (from shop.brands slugs)
   ✅ Hard-remove faint black outline/background behind the shop logo image
   ✅ Keeps segmented tabs: Hours | About | Events
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

  // removes all non-alnum (for filenames / canonical IDs)
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

      if (AMENITIES.some((a) => a.key === nk)) {
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
      String(shop.status || shop.Status || "")
        .trim()
        .toLowerCase() === "open";

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

  // ---------------- injected styling ----------------
  function injectStylesOnce() {
    if (document.getElementById("spInjectedV10")) return;

    const css = `
      .sp-status { position: absolute !important; top: 18px !important; right: 18px !important; left: auto !important; }
      #spStatusPill { font-size: 12px !important; padding: 6px 14px !important; letter-spacing: 0 !important; font-weight: 600 !important; }

      /* City: regular weight + tighter tracking */
      .sp-city, .sp-city span, #spCity {
        font-weight: 400 !important;
        letter-spacing: -0.02em !important;
      }
      .sp-city { color: #8e8e93 !important; }

      /* ✅ Kill the faint outline/shadow behind the shop logo */
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

      /* -------- Brands sheet -------- */
      .sp-sheet-mask{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.18);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display:none;
        z-index: 9999;
      }
      .sp-sheet{
        position: absolute;
        left: 12px; right: 12px; bottom: 12px;
        max-height: 70vh;
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(0,0,0,.06);
        border-radius: 26px;
        box-shadow: 0 30px 80px rgba(0,0,0,.20);
        overflow: hidden;
        display:flex;
        flex-direction:column;
      }
      .sp-sheet-hd{
        padding: 14px 16px 10px 16px;
        display:flex; align-items:center; justify-content:space-between;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .sp-sheet-hd .t{
        font-weight: 900;
        letter-spacing: -0.01em;
        font-size: 16px;
        color:#0b0b0c;
      }
      .sp-sheet-close{
        width: 34px; height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,.06);
        background: rgba(255,255,255,.85);
        font-weight: 900;
        cursor: pointer;
      }
      .sp-sheet-bd{
        padding: 14px 14px 18px 14px;
        overflow:auto;
        -webkit-overflow-scrolling: touch;
      }
      .sp-brand-grid{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .sp-brand{
        border: 1px solid rgba(0,0,0,.06);
        background: rgba(255,255,255,.85);
        border-radius: 18px;
        padding: 10px;
        display:flex;
        align-items:center;
        justify-content:center;
        height: 74px;
      }
      .sp-brand img{
        max-width: 100%;
        max-height: 44px;
        object-fit: contain;
        display:block;
        background: transparent !important;
        border: none !important;
        box-shadow:none !important;
        outline:none !important;
      }
      .sp-sheet-note{
        color:#8e8e93;
        font-weight: 700;
        font-size: 13px;
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

    // cigar icon
    if (type === "cigar") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 14c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v2H3v-2z" stroke-width="${sw}" fill="none"/>
        <path d="M17 12h3.2c.9 0 1.6.7 1.6 1.6V16c0 .9-.7 1.6-1.6 1.6H17V12z" stroke-width="${sw}" fill="none"/>
        <path d="M6 12v5" stroke-width="${sw}" />
        <path d="M10 12v5" stroke-width="${sw}" />
        <path d="M14 12v5" stroke-width="${sw}" />
      </svg>`;
    }

    // directions
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
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days.some((d) => {
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

  // ---------------- brands sheet ----------------
  function ensureBrandsSheet() {
    injectStylesOnce();
    let mask = document.querySelector(".sp-sheet-mask");
    if (mask) return mask;

    mask = document.createElement("div");
    mask.className = "sp-sheet-mask";
    mask.innerHTML = `
      <div class="sp-sheet" role="dialog" aria-modal="true" aria-label="Brands">
        <div class="sp-sheet-hd">
          <div class="t">Brands</div>
          <button type="button" class="sp-sheet-close" aria-label="Close">✕</button>
        </div>
        <div class="sp-sheet-bd">
          <div class="sp-sheet-note">Loading…</div>
        </div>
      </div>
    `;

    document.body.appendChild(mask);

    // close handlers
    mask.addEventListener("click", (e) => {
      if (e.target === mask) closeBrandsSheet();
    });
    mask.querySelector(".sp-sheet-close").addEventListener("click", closeBrandsSheet);

    // ESC
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrandsSheet();
    });

    return mask;
  }

  function openBrandsSheet(shop) {
    const mask = ensureBrandsSheet();
    const body = mask.querySelector(".sp-sheet-bd");
    const brands = parseBrands(shop);

    if (!brands.length) {
      body.innerHTML = `<div class="sp-sheet-note">No brands listed yet.</div>`;
    } else {
      body.innerHTML = `
        <div class="sp-brand-grid">
          ${brands
            .map((slug) => {
              const clean = sanitizeLogoName(slug);
              const src = `/img/icons/brands/${clean}.svg`;
              return `<div class="sp-brand"><img loading="lazy" src="${src}" alt="${escapeHtml(slug)}"></div>`;
            })
            .join("")}
        </div>
      `;

      // Remove tiles that fail to load (prevents broken icon boxes)
      body.querySelectorAll("img").forEach((img) => {
        img.onerror = () => {
          const tile = img.closest(".sp-brand");
          if (tile) tile.remove();
        };
      });
    }

    mask.style.display = "block";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeBrandsSheet() {
    const mask = document.querySelector(".sp-sheet-mask");
    if (!mask) return;
    mask.style.display = "none";
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
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

    // HOURS panel
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

    // ABOUT panel (keep simple for now)
    const aboutCard = document.createElement("div");
    aboutCard.className = "sp-card sp-hidden";
    aboutCard.setAttribute("data-panel", "about");
    aboutCard.innerHTML = `
      <h3>About</h3>
      <div class="sp-muted">${escapeHtml(toStr(shop.about || shop.About || "") || "Details coming soon.")}</div>
    `;

    // EVENTS panel
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

    // ✅ Dock: Brands opens brand logo sheet (does not change tabs)
    dock.addEventListener("click", (e) => {
      const a = e.target.closest('a[data-action="brands"]');
      if (!a) return;
      e.preventDefault();
      openBrandsSheet(shop);
    });

    setTab("hours");
  }

  // ---------------- render shop ----------------
  function renderShop(shop) {
    injectStylesOnce();

    const shopName = shop.name || shop.Shop || "Shop";
    const features = normalizeFeatures(shop);

    // Name
    const nameEl = $("#spName");
    if (nameEl) applyNameClampAndSize(nameEl, shopName);

    // City
    const cityEl = $("#spCity");
    if (cityEl) {
      const cityLine = [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
        .filter(Boolean)
        .join(", ");
      cityEl.textContent = cityLine || "—";
    }

    // Status pill
    const status = getOpenClosed(shop);
    const statusEl = $("#spStatusPill");
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.setAttribute("data-status", status.toLowerCase());
    }

    // TAA icon
    const taaEl = $("#spTaaIcon");
    if (taaEl) taaEl.style.display = features.taa === true ? "" : "none";

    // Logo
    const logoEl = $("#spLogo");
    if (logoEl) {
      // Prefer shop.slug if present, else filename from name
      const base = sanitizeLogoName(shop.slug || shopName);
      const svgPath = `/img/icons/shops/${base}.svg`;
      const pngPath = `/img/icons/shops/${base}.png`;

      logoEl.src = svgPath;
      logoEl.alt = `${shopName} logo`;

      logoEl.onerror = function () {
        if (logoEl.src.endsWith(".svg")) {
          logoEl.src = pngPath;
          return;
        }
        logoEl.onerror = null;
        logoEl.src = "/img/icons/shops/default.png";
      };
    }

    // Maps click (if present)
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
        img.src = a.icon;
        img.alt = a.label;
        img.onerror = () => img.remove();
        row.appendChild(img);
      });

      panel.style.display = enabled.length ? "" : "none";
    }

    buildBottomSection(shop);
  }

  // ---------------- data loading ----------------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("json")) {
      const txt = await res.text();
      try {
        return JSON.parse(txt);
      } catch {
        throw new Error(`${url} returned non-JSON (content-type: ${ct || "unknown"})`);
      }
    }

    return await res.json();
  }

  // for array fallback
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
    const slugParamRaw = (getParam("shop") || "").trim();

    try {
      if (!slugParamRaw) throw new Error("Missing ?shop= param");

      // ✅ Canonical per-shop filename (no dashes)
      const fileSlug = sanitizeLogoName(slugParamRaw);

      // 1) Try per-shop object first (your new system)
      const perShopUrls = [
        `/data/shops/${fileSlug}.json?v=${Date.now()}`,
      ];

      for (const u of perShopUrls) {
        try {
          const obj = await fetchJson(u);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            renderShop(obj);
            return;
          }
        } catch {
          // continue
        }
      }

      // 2) Fallback: legacy array files
      const listUrls = [
        `/shops/shops.json?v=${Date.now()}`,
        `/shops.json?v=${Date.now()}`,
        `./shops.json?v=${Date.now()}`,
        `/data/shops.json?v=${Date.now()}`,
      ];

      let list = null;
      let lastErr = null;
      for (const u of listUrls) {
        try {
          const data = await fetchJson(u);
          if (Array.isArray(data) && data.length) {
            list = data;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }
      if (!list) throw lastErr || new Error("Shop data loaded but was empty or not an array");

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
