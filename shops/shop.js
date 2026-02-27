/* /shops/shop.js
   Public Shop Page (Centered Layout + Bottom Section v12.5)

   ✅ Use with: <script src="/shops/shop.js?v=12.5"></script>

   Data:
   ✅ Loads per-shop JSON first:
      /data/shops/{fileSlug}.json   (ex: justthetip.json)
   ✅ Fallback:
      /shops/shops.json (array)

   UI (THIS VERSION):
   ✅ Removes OPEN green pill (text-only "Open"/"Closed" in green/red)
   ✅ Adds "Amenities" label + icons row (order: Indoor, TVs, BYOB)
   ✅ Amenities row sits ABOVE dock (handled by HTML order)
   ✅ TAA stays top-right (shows only if TAA truthy)
   ✅ Uses existing HTML dock + segmented panels (Overview/Brands/Updates)
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

    if (/\s/.test(raw) || /[A-Z]/.test(raw)) return raw;

    const clean = sanitizeLogoName(raw);

    if (BRAND_LABEL_MAP[clean]) return BRAND_LABEL_MAP[clean];

    if (/[_-]/.test(raw)) {
      const spaced = raw
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([a-z])/g, "$1 $2")
        .trim();
      return titleCaseWords(spaced || raw);
    }

    let w = clean;
    for (const t of BRAND_TOKENS) w = w.replaceAll(t, ` ${t} `);

    w = w.replace(/\s+/g, " ").trim();
    if (!w) return titleCaseWords(clean);

    const parts = w.split(" ").filter(Boolean).map((p) => p.toLowerCase());
    const keepLower = new Set(["de", "del", "la"]);
    const out = parts.map((p) => {
      if (keepLower.has(p)) return p;
      if (p === "st") return "St";
      if (p === "co") return "Co";
      return p[0].toUpperCase() + p.slice(1);
    });

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

  // ---------------- features / amenities ----------------
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

      // direct known keys
      if (nk in FEATURE_ALIASES) {
        bag[nk] = isTruthy(shop[rawKey]);
        continue;
      }

      // alias match
      for (const targetKey of Object.keys(FEATURE_ALIASES)) {
        if (FEATURE_ALIASES[targetKey].includes(nk)) {
          bag[targetKey] = isTruthy(shop[rawKey]);
        }
      }
    }

    if (bag.noalcohol === true) bag.alcohol = false;
    return bag;
  }

  // ---------------- open/closed (text-only) ----------------
  function getOpenClosed(shop) {
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

    // default if no flags present
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

  function setStatusText(shop) {
    const el = $("#spStatusText");
    if (!el) return;

    const status = getOpenClosed(shop);
    if (status === "OPEN") {
      el.textContent = "Open";
      el.classList.remove("sp-closed");
      el.classList.add("sp-open");
    } else {
      el.textContent = "Closed";
      el.classList.remove("sp-open");
      el.classList.add("sp-closed");
    }
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

  // ---------------- render: amenities (order exactly requested) ----------------
  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    const panel = $("#spAmenPanel");
    if (!row || !panel) return;

    const features = normalizeFeatures(shop);

    // Order: Indoor seating, TVs, BYOB
    const items = [
      { ok: isTruthy(features.indoor), icon: "/img/icons/indoorseating.svg", label: "Indoor Seating" },
      { ok: isTruthy(features.tvs), icon: "/img/icons/tv.svg", label: "TV" },
      { ok: isTruthy(features.byob), icon: "/img/icons/byob.svg", label: "BYOB" },
    ].filter((x) => x.ok);

    row.innerHTML = "";

    if (!items.length) {
      // If nothing, hide the whole amenities block
      panel.style.display = "none";
      return;
    }

    panel.style.display = "";

    items.forEach((a) => {
      const img = document.createElement("img");
      img.className = "sp-amen-icon";
      img.src = `${a.icon}?v=${Date.now()}`;
      img.alt = a.label;
      row.appendChild(img);
    });
  }

  // ---------------- render: TAA badge (top-right) ----------------
  function renderTaa(shop) {
    const taaEl = $("#spTaaIcon");
    if (!taaEl) return;

    const features = normalizeFeatures(shop);
    const hasTaa = isTruthy(features.taa) || isTruthy(shop.TAA) || isTruthy(shop.taa);

    taaEl.style.display = hasTaa ? "block" : "none";
    if (hasTaa) {
      if (!taaEl.getAttribute("src")) taaEl.setAttribute("src", "/img/icons/taa.svg");
      taaEl.setAttribute("alt", "TAA");
    }
  }

  // ---------------- render: overview section ----------------
  function renderOverview(shop) {
    // Contact values
    const phone = getPhone(shop);
    const website = toStr(shop.website || shop.Website);
    const addr = [
      toStr(shop.address1 || shop.address || shop.Address),
      toStr(shop.city || shop.City),
      toStr(shop.state || shop.ST || shop.State),
      toStr(shop.zip || shop.Zip),
    ]
      .filter(Boolean)
      .join(", ");

    const phoneEl = $("#spPhoneVal");
    const webEl = $("#spWebVal");
    const addrEl = $("#spAddrVal");

    if (phoneEl) phoneEl.textContent = phone || "—";
    if (webEl) webEl.textContent = website || "—";
    if (addrEl) addrEl.textContent = addr || "—";

    // Hours
    const hoursNowEl = $("#spHoursNow");
    const hoursListEl = $("#spHoursList");

    if (hoursNowEl) hoursNowEl.textContent = "—";

    if (hoursListEl) {
      hoursListEl.innerHTML = "";

      const hasAnyHours = getAnyHoursPresent(shop);
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

      if (!hasAnyHours) {
        // Show “Coming soon” as a single row
        const row = document.createElement("div");
        row.className = "sp-hour-row";
        row.innerHTML = `<div class="sp-hour-d">Hours</div><div class="sp-hour-v">Coming soon</div>`;
        hoursListEl.appendChild(row);
        return;
      }

      days.forEach((d) => {
        const v = toStr(getHoursForDay(shop, d));
        const show = v && !["-", "—", "n/a", "na"].includes(v.trim().toLowerCase()) ? v : "—";
        const row = document.createElement("div");
        row.className = "sp-hour-row";
        row.innerHTML = `<div class="sp-hour-d">${escapeHtml(d)}</div><div class="sp-hour-v">${escapeHtml(show)}</div>`;
        hoursListEl.appendChild(row);
      });
    }
  }

  // ---------------- render: brands section ----------------
  function renderBrands(shop) {
    const chipsEl = $("#spBrandChips");
    const emptyEl = $("#spBrandsEmpty");
    const viewAllBtn = $("#spViewAllBrands");

    if (!chipsEl || !emptyEl) return;

    const brands = parseBrands(shop);

    chipsEl.innerHTML = "";

    if (!brands.length) {
      emptyEl.style.display = "block";
      if (viewAllBtn) viewAllBtn.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    if (viewAllBtn) viewAllBtn.style.display = "";

    // show up to 10 chips
    const show = brands.slice(0, 10);
    show.forEach((b) => {
      const chip = document.createElement("div");
      chip.className = "sp-chip";
      chip.textContent = prettyBrandLabel(b) || b;
      chipsEl.appendChild(chip);
    });

    // wire "View all" to open sheet modal (grid)
    if (viewAllBtn) {
      viewAllBtn.onclick = () => openBrandsSheet(brands);
    }
  }

  // ---------------- Brands sheet modal (grid) ----------------
  function openBrandsSheet(brandsRaw) {
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

    // wire close
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

    // wire search
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
  }

  // ---------------- render: updates section ----------------
  function renderUpdates(shop) {
    const timeEl = $("#spUpdateTime");
    const textEl = $("#spUpdateText");
    const postBtn = $("#spPostUpdate");

    const updates = toStr(shop.updates || shop.Updates || shop.update || shop.Update || shop.notes || shop.Notes);

    if (timeEl) timeEl.textContent = "—";
    if (textEl) textEl.textContent = updates || "No updates yet.";

    // "Post update" is admin-only later; disable for now (visual only)
    if (postBtn) {
      postBtn.style.display = "none";
    }
  }

  // ---------------- dock wiring ----------------
  function wireDock(shop) {
    const phone = getPhone(shop);
    const directionsUrl = buildDirectionsUrl(shop);

    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const msgBtn = $("#spActMsg");
    const dirBtn = $("#spActDir");

    const website = toStr(shop.website || shop.Website);

    if (callBtn) {
      callBtn.addEventListener("click", () => {
        if (!phone) return;
        window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      });
      if (!phone) callBtn.classList.add("is-disabled");
    }

    if (webBtn) {
      webBtn.addEventListener("click", () => {
        if (!website) return;
        const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
        window.open(url, "_blank", "noopener");
      });
      if (!website) webBtn.classList.add("is-disabled");
    }

    if (msgBtn) {
      msgBtn.addEventListener("click", () => {
        if (!phone) return;
        window.location.href = `sms:${phone.replace(/[^\d+]/g, "")}`;
      });
      if (!phone) msgBtn.classList.add("is-disabled");
    }

    if (dirBtn) {
      dirBtn.addEventListener("click", () => {
        window.open(directionsUrl, "_blank", "noopener");
      });
    }

    // City line also opens directions
    const addrBtn = $("#spAddressBtn");
    if (addrBtn) {
      addrBtn.addEventListener("click", () => {
        window.open(directionsUrl, "_blank", "noopener");
      });
    }
  }

  // ---------------- segmented control wiring ----------------
  function wireTabs() {
    const tabOverview = $("#spTabOverview");
    const tabBrands = $("#spTabBrands");
    const tabUpdates = $("#spTabUpdates");

    const panelOverview = $("#spPanelOverview");
    const panelBrands = $("#spPanelBrands");
    const panelUpdates = $("#spPanelUpdates");

    const tabs = [
      { btn: tabOverview, panel: panelOverview },
      { btn: tabBrands, panel: panelBrands },
      { btn: tabUpdates, panel: panelUpdates },
    ].filter((x) => x.btn && x.panel);

    function setActive(btnToActivate) {
      tabs.forEach(({ btn, panel }) => {
        const on = btn === btnToActivate;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
        panel.classList.toggle("is-active", on);
      });
    }

    tabs.forEach(({ btn }) => {
      btn.addEventListener("click", () => setActive(btn));
    });
  }

  // ---------------- top section render ----------------
  async function renderTop(shop) {
    const nameEl = $("#spName");
    const cityText = $("#spCity");
    const logoImg = $("#spLogo");

    const name = toStr(shop.name || shop.Shop || shop.shop || shop.Title) || "Shop Name";
    const city = toStr(shop.city || shop.City) || "City";
    const st = toStr(shop.state || shop.ST || shop.State) || "ST";

    if (nameEl) applyNameClampAndSize(nameEl, name);
    if (cityText) cityText.textContent = `${city}, ${st}`;

    renderTaa(shop);

    // Load shop logo
    if (logoImg) {
      const base = sanitizeLogoName(name);
      const svgUrl = `/img/icons/shops/${base}.svg?v=${Date.now()}`;
      const pngUrl = `/img/icons/shops/${base}.png?v=${Date.now()}`;
      await loadLogoWithoutOutline(logoImg, svgUrl, pngUrl);
    }

    setStatusText(shop);
    renderAmenities(shop);
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

    try {
      const shop = await loadShopData(fileSlug);

      // top + header pieces
      await renderTop(shop);

      // sections
      renderOverview(shop);
      renderBrands(shop);
      renderUpdates(shop);

      // interactions
      wireDock(shop);
      wireTabs();
    } catch (e) {
      const nameEl = $("#spName");
      if (nameEl) nameEl.textContent = "Shop not found";
      const cityText = $("#spCity");
      if (cityText) cityText.textContent = "—";
      const statusEl = $("#spStatusText");
      if (statusEl) {
        statusEl.textContent = "—";
        statusEl.classList.remove("sp-open", "sp-closed");
      }
      console.error(e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
