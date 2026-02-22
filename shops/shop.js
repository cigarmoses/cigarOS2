/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v5)

   Keeps your current top layout working:
   - Center logo + name + city/state
   - Top-left SHOP pill
   - Top-right OPEN/CLOSED pill (+ optional TAA icon under it)
   - Amenities row in the panel

   NEW (my recommended bottom section):
   ✅ Action Dock (Call / Web / Message / Directions)
   ✅ Segmented content (Overview | Brands | Updates)
   ✅ Hours card + Contact card (Overview)
   ✅ Brand chips (Brands)
   ✅ Status update card (Updates)

   Notes:
   - Injects its own minimal CSS so you don’t have to edit shop.css yet.
   - Gracefully hides actions/cards if data is missing.
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
  // Add icons as you create them; missing icons auto-remove.
  const AMENITIES = [
    { key: "alcohol", icon: "/img/icons/alcohol.svg", label: "Alcohol" },
    { key: "byob", icon: "/img/icons/byob.svg", label: "BYOB" },
    { key: "noalcohol", icon: "/img/icons/noalcohol.svg", label: "No Alcohol" },
    { key: "food", icon: "/img/icons/food.svg", label: "Food" },
    { key: "tvs", icon: "/img/icons/tv.svg", label: "TVs" },
    { key: "outdoor", icon: "/img/icons/outdoor.svg", label: "Outdoor" },
    { key: "indoor", icon: "/img/icons/indoor.svg", label: "Indoor" },
    { key: "quiet", icon: "/img/icons/quiet.svg", label: "Quiet" },
    { key: "livemusic", icon: "/img/icons/livemusic.svg", label: "Live Music" },
    { key: "taa", icon: "/img/icons/taa.svg", label: "TAA" },
  ];

  function normalizeFeatures(shop) {
    const bag = {};

    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    for (const k of Object.keys(shop)) {
      const nk = normalizeKey(k);
      if (AMENITIES.some(a => a.key === nk)) bag[nk] = isTruthy(shop[k]);
    }

    // No Alcohol overrides Alcohol
    if (bag.noalcohol === true) bag.alcohol = false;

    return bag;
  }

  // ---------------- status open/closed ----------------
  function getOpenClosed(shop) {
    // You can wire this to a true live-hours system later.
    // For now: honor explicit fields if present; default OPEN if unspecified.
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

    // If neither open nor closed provided, default OPEN (matches your preference so far)
    if (!("open" in shop) && !("Open" in shop) && !("closed" in shop) && !("Closed" in shop) && !shop.status && !shop.Status) {
      return "OPEN";
    }

    return open ? "OPEN" : "CLOSED";
  }

  // ---------------- name formatting (max 2 lines + auto size) ----------------
  function splitNameTwoLines(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) return [words.join(" "), ""].filter(Boolean);

    // Balance by character count to keep two lines visually even
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
    const [l1, l2] = splitNameTwoLines(name);
    el.innerHTML = l2 ? `${escapeHtml(l1)}<br>${escapeHtml(l2)}` : escapeHtml(l1);

    const len = String(name || "").length;
    let px = 44;
    if (len > 18) px = 40;
    if (len > 26) px = 36;
    if (len > 34) px = 32;
    if (len > 44) px = 28;

    el.style.fontSize = `${px}px`;
    el.style.lineHeight = "1.05";
  }

  // ---------------- bottom section (dock + segmented) ----------------
  function injectBottomStylesOnce() {
    if (document.getElementById("spBottomStyles")) return;

    const css = `
      /* Bottom section (iOS 26-ish glass cards) */
      .sp-bottom { margin-top: 18px; }
      .sp-dock {
        display:flex; gap:12px; justify-content:space-between;
        padding: 12px;
        border-radius: 22px;
        background: rgba(255,255,255,.75);
        border: 1px solid #ededf0;
        box-shadow: 0 12px 30px rgba(0,0,0,.06);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }
      .sp-dock a, .sp-dock button{
        flex:1 1 0;
        height: 54px;
        border-radius: 16px;
        border: 1px solid #ededf0;
        background: rgba(255,255,255,.9);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap: 6px;
        padding: 0;
        text-decoration:none;
        color:#0b0b0c;
        font-weight: 800;
        font-size: 12px;
      }
      .sp-dock .sp-dock-ico{
        width: 20px; height: 20px;
        stroke: #0b0b0c; fill: none;
      }
      .sp-dock .sp-dock-ico-fill{ fill: #0b0b0c; stroke: none; }

      .sp-seg {
        margin-top: 14px;
        padding: 6px;
        border-radius: 18px;
        background: #f2f2f7;
        border: 1px solid #ededf0;
        display:flex; gap: 6px;
      }
      .sp-seg button{
        flex:1 1 0;
        height: 38px;
        border-radius: 14px;
        border: none;
        background: transparent;
        font-weight: 900;
        font-size: 14px;
        color: #6e6e73;
      }
      .sp-seg button[aria-selected="true"]{
        background: #fff;
        color: #0b0b0c;
        box-shadow: 0 8px 18px rgba(0,0,0,.08);
      }

      .sp-panels{ margin-top: 12px; }
      .sp-card{
        background: rgba(255,255,255,.92);
        border: 1px solid #ededf0;
        border-radius: 24px;
        padding: 16px;
        box-shadow: 0 14px 40px rgba(0,0,0,.06);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .sp-card + .sp-card{ margin-top: 12px; }

      .sp-card h3{
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: -0.01em;
        color:#0b0b0c;
      }
      .sp-muted{ color:#8e8e93; font-weight: 700; }
      .sp-row{
        display:flex; justify-content:space-between; align-items:center;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid #ededf0;
      }
      .sp-row:first-of-type{ border-top: none; padding-top: 0; }
      .sp-k{ color:#6e6e73; font-weight: 800; }
      .sp-v{ color:#0b0b0c; font-weight: 900; text-align:right; }

      .sp-chips{ display:flex; flex-wrap: wrap; gap: 8px; }
      .sp-chip{
        padding: 8px 12px;
        border-radius: 999px;
        background: #f2f2f7;
        border: 1px solid #ededf0;
        font-weight: 900;
        font-size: 13px;
        color:#0b0b0c;
      }

      .sp-update{
        font-size: 15px;
        font-weight: 800;
        line-height: 1.35;
        color:#0b0b0c;
        white-space: pre-wrap;
      }
      .sp-update-meta{
        margin-top: 10px;
        font-size: 13px;
        font-weight: 800;
        color:#8e8e93;
      }
      .sp-hidden{ display:none !important; }
    `;

    const style = document.createElement("style");
    style.id = "spBottomStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function iconSvg(type) {
    // Minimal inline SVGs (no external dependencies)
    if (type === "call") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2c-9.2-.7-16.5-8-17.2-17.2A2 2 0 0 1 4.6 2h3a2 2 0 0 1 2 1.7c.2 1.2.5 2.4 1 3.5a2 2 0 0 1-.5 2.1L8.9 10.5a16 16 0 0 0 4.6 4.6l1.2-1.2a2 2 0 0 1 2.1-.5c1.1.5 2.3.8 3.5 1A2 2 0 0 1 22 16.9z" stroke-width="2" fill="none"/>
      </svg>`;
    }
    if (type === "web") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke-width="2"/>
        <path d="M3 12h18" stroke-width="2"/>
        <path d="M12 3c2.5 2.6 3.9 5.8 4 9-.1 3.2-1.5 6.4-4 9-2.5-2.6-3.9-5.8-4-9 .1-3.2 1.5-6.4 4-9z" stroke-width="2" fill="none"/>
      </svg>`;
    }
    if (type === "msg") {
      return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" stroke-width="2" fill="none"/>
      </svg>`;
    }
    // directions
    return `<svg class="sp-dock-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2c-3.9 0-7 3.1-7 7 0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7z" class="sp-dock-ico-fill"/>
      <circle cx="12" cy="9" r="2.4" fill="#fff"/>
    </svg>`;
  }

  function parseBrands(shop) {
    const raw =
      shop.brands ??
      shop.Brands ??
      shop["Cigar brands"] ??
      shop["Cigar Brands"] ??
      shop.cigarbrands ??
      shop.CigarBrands;

    if (Array.isArray(raw)) return raw.map(toStr).filter(Boolean);

    const s = toStr(raw);
    if (!s) return [];

    // comma, pipe, slash, newline separated
    return s
      .split(/[,|\n/]+/g)
      .map((x) => toStr(x))
      .filter(Boolean);
  }

  function getStatusUpdate(shop) {
    // Where your “Facebook-like” post could live for now
    return (
      toStr(shop.update) ||
      toStr(shop.Update) ||
      toStr(shop.statusUpdate) ||
      toStr(shop.StatusUpdate) ||
      toStr(shop.notes) ||
      toStr(shop.Notes) ||
      ""
    );
  }

  function getPhone(shop) {
    // Prefer cell then phone, support different column names
    return (
      toStr(shop.cell || shop.Cell) ||
      toStr(shop.phone || shop.Phone) ||
      toStr(shop["Phone #"]) ||
      ""
    );
  }

  function normalizeWebsite(shop) {
    const raw = toStr(shop.website || shop.Website || shop.web || shop.Web);
    if (!raw) return "";
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }

  function getHoursForDay(shop, dayName) {
    // Support columns like "Monday", "Tuesday", etc. OR "Mon"
    const direct = toStr(shop[dayName] ?? shop[dayName.toLowerCase()]);
    if (direct) return direct;

    const short = dayName.slice(0, 3);
    return toStr(shop[short] ?? shop[short.toLowerCase()]);
  }

  function getTodayName() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  }

  function buildBottomSection(shop) {
    injectBottomStylesOnce();

    const top = document.querySelector(".sp-top");
    if (!top) return;

    // Remove prior bottom section if re-rendering
    const existing = document.querySelector(".sp-bottom");
    if (existing) existing.remove();

    const bottom = document.createElement("div");
    bottom.className = "sp-bottom";

    const phone = getPhone(shop);
    const website = normalizeWebsite(shop);
    const directions = buildDirectionsUrl(shop);

    // Basic message action: SMS if phone, else email if present
    const email = toStr(shop.email || shop.Email);
    const msgHref = phone ? `sms:${phone.replace(/[^\d+]/g, "")}` : (email ? `mailto:${email}` : "");

    // Dock (only show buttons with destinations)
    const dock = document.createElement("div");
    dock.className = "sp-dock";
    dock.innerHTML = `
      ${phone ? `<a href="tel:${phone.replace(/[^\d+]/g, "")}" aria-label="Call">${iconSvg("call")}<div>Call</div></a>` : ""}
      ${website ? `<a href="${website}" target="_blank" rel="noopener" aria-label="Website">${iconSvg("web")}<div>Web</div></a>` : ""}
      ${msgHref ? `<a href="${msgHref}" aria-label="Message">${iconSvg("msg")}<div>Message</div></a>` : ""}
      <a href="${directions}" target="_blank" rel="noopener" aria-label="Directions">${iconSvg("dir")}<div>Directions</div></a>
    `;

    // If dock has < 2 actions (unlikely), still render; but keep spacing consistent
    bottom.appendChild(dock);

    // Segmented
    const seg = document.createElement("div");
    seg.className = "sp-seg";
    seg.innerHTML = `
      <button type="button" data-tab="overview" aria-selected="true">Overview</button>
      <button type="button" data-tab="brands" aria-selected="false">Brands</button>
      <button type="button" data-tab="updates" aria-selected="false">Updates</button>
    `;
    bottom.appendChild(seg);

    // Panels
    const panels = document.createElement("div");
    panels.className = "sp-panels";

    // Overview cards
    const today = getTodayName();
    const todayHours = getHoursForDay(shop, today);
    const hoursLines = [
      ["Today", todayHours || "—"],
      ["Mon", getHoursForDay(shop, "Monday") || "—"],
      ["Tue", getHoursForDay(shop, "Tuesday") || "—"],
      ["Wed", getHoursForDay(shop, "Wednesday") || "—"],
      ["Thu", getHoursForDay(shop, "Thursday") || "—"],
      ["Fri", getHoursForDay(shop, "Friday") || "—"],
      ["Sat", getHoursForDay(shop, "Saturday") || "—"],
      ["Sun", getHoursForDay(shop, "Sunday") || "—"],
    ];

    const hoursCard = document.createElement("div");
    hoursCard.className = "sp-card";
    hoursCard.setAttribute("data-panel", "overview");
    hoursCard.innerHTML = `
      <h3>Hours</h3>
      <div class="sp-muted">${escapeHtml(today)} • ${escapeHtml(todayHours || "—")}</div>
      <div style="margin-top:10px">
        ${hoursLines
          .slice(1) // show weekly below (Mon..Sun)
          .map(([k, v]) => `<div class="sp-row"><div class="sp-k">${escapeHtml(k)}</div><div class="sp-v">${escapeHtml(v)}</div></div>`)
          .join("")}
      </div>
    `;

    const contactCard = document.createElement("div");
    contactCard.className = "sp-card";
    contactCard.setAttribute("data-panel", "overview");
    contactCard.innerHTML = `
      <h3>Contact</h3>
      <div class="sp-row"><div class="sp-k">Website</div><div class="sp-v">${website ? escapeHtml(website.replace(/^https?:\/\//, "")) : "—"}</div></div>
      <div class="sp-row"><div class="sp-k">Phone</div><div class="sp-v">${phone ? escapeHtml(phone) : "—"}</div></div>
      <div class="sp-row"><div class="sp-k">Email</div><div class="sp-v">${email ? escapeHtml(email) : "—"}</div></div>
    `;

    // Brands
    const brands = parseBrands(shop);
    const brandsCard = document.createElement("div");
    brandsCard.className = "sp-card sp-hidden";
    brandsCard.setAttribute("data-panel", "brands");
    brandsCard.innerHTML = `
      <h3>Brands</h3>
      ${brands.length
        ? `<div class="sp-chips">${brands.slice(0, 40).map(b => `<span class="sp-chip">${escapeHtml(b)}</span>`).join("")}</div>`
        : `<div class="sp-muted">No brands listed yet.</div>`
      }
    `;

    // Updates
    const update = getStatusUpdate(shop);
    const updatesCard = document.createElement("div");
    updatesCard.className = "sp-card sp-hidden";
    updatesCard.setAttribute("data-panel", "updates");
    updatesCard.innerHTML = `
      <h3>Today</h3>
      ${update
        ? `<div class="sp-update">${escapeHtml(update)}</div>`
        : `<div class="sp-muted">No update yet.</div>`
      }
      <div class="sp-update-meta">${update ? "Just now" : ""}</div>
    `;

    panels.appendChild(hoursCard);
    panels.appendChild(contactCard);
    panels.appendChild(brandsCard);
    panels.appendChild(updatesCard);

    bottom.appendChild(panels);

    // Segmented behavior
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

    // Attach under amenities panel if it exists; otherwise just append to top
    top.appendChild(bottom);

    // Hide empty dock buttons container spacing issues: if only 1 action, stretch fine
    // If zero (shouldn't happen due to Directions), still OK.

    // Default tab
    setTab("overview");
  }

  // ---------------- render shop ----------------
  function renderShop(shop) {
    const shopName = shop.name || shop.Shop || "Shop";
    const features = normalizeFeatures(shop);

    // Name: max 2 lines + auto size
    const nameEl = $("#spName");
    if (nameEl) applyNameClampAndSize(nameEl, shopName);

    // City line
    const cityEl = $("#spCity");
    if (cityEl) {
      const cityLine =
        [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
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

    // TAA icon under status (only if true)
    const taaEl = $("#spTaaIcon");
    if (taaEl) taaEl.style.display = features.taa === true ? "" : "none";

    // Logo load
    const logoEl = $("#spLogo");
    if (logoEl) {
      const base = sanitizeLogoName(shopName);
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

    // Maps click
    const addrBtn = $("#spAddressBtn");
    if (addrBtn) {
      addrBtn.onclick = () => window.open(buildDirectionsUrl(shop), "_blank", "noopener");
    }

    // Amenities row
    const row = $("#spAmenRow");
    const panel = $("#spAmenPanel");
    if (row && panel) {
      row.innerHTML = "";
      const enabled = AMENITIES.filter(a => features[a.key] === true);

      enabled.forEach(a => {
        const img = document.createElement("img");
        img.className = "sp-amen-icon";
        img.src = a.icon;
        img.alt = a.label;
        img.onerror = () => img.remove();
        row.appendChild(img);
      });

      panel.style.display = enabled.length ? "" : "none";
    }

    // Build the new bottom section (dock + segmented cards)
    buildBottomSection(shop);
  }

  // ---------------- boot ----------------
  async function boot() {
    const slug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);
      const list = await res.json();

      const shop =
        list.find(s => String(s.slug || "").toLowerCase() === slug) ||
        list.find(s => sanitizeLogoName(s.name || s.Shop) === sanitizeLogoName(slug)) ||
        list.find(s => String(s.name || s.Shop || "").toLowerCase().includes(slug)) ||
        list[0];

      if (!shop) throw new Error("No shops found in shops.json");

      renderShop(shop);
    } catch (err) {
      console.error(err);

      // Fail-safe UI
      const nameEl = $("#spName");
      if (nameEl) nameEl.textContent = "Shop not found";

      const cityEl = $("#spCity");
      if (cityEl) cityEl.textContent = "—";

      const panel = $("#spAmenPanel");
      if (panel) panel.style.display = "none";

      const taaEl = $("#spTaaIcon");
      if (taaEl) taaEl.style.display = "none";

      const statusEl = $("#spStatusPill");
      if (statusEl) {
        statusEl.textContent = "CLOSED";
        statusEl.setAttribute("data-status", "closed");
      }

      // Still build a bottom section with Directions only
      buildBottomSection({});
    }
  }

  boot();
})();
