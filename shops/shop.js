/* /shops/shop.js
   FULL REPLACEMENT FILE (v13.5)
   - Fixes wrong shop match by robust slugify + matching
   - Prefers /data/shops/{slug}.json but merges missing fields from /shops/shops.json
   - Correctly enables Call/Web when values exist (ignores "—", "NaN", etc.)
   - Instagram dock button works + hides only when truly missing
   - TAA badge shows only when true
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanVal(v) {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const low = s.toLowerCase();
    if (low === "—" || low === "-" || low === "nan" || low === "null" || low === "undefined") return "";
    if (s.includes("â")) return ""; // bad encoding artifacts
    return s;
  }

  function slugify(v) {
    const s = cleanVal(v).toLowerCase();
    if (!s) return "";
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "") // remove ALL non-alphanum
      .trim();
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getSlugFromUrl() {
    const u = new URL(window.location.href);
    return cleanVal(u.searchParams.get("shop")).toLowerCase();
  }

  function normalizeShop(raw, fallbackSlug) {
    // slug: prefer explicit slug fields; else slugify(shop name); else fallback
    const rawSlug = cleanVal(raw.slug || raw.Slug || raw.slug_id);
    const shopName = cleanVal(raw.name || raw.Shop || raw.shop);

    const slug =
      slugify(rawSlug) ||
      slugify(shopName) ||
      slugify(fallbackSlug) ||
      "";

    const name = shopName;

    const city = cleanVal(raw.city || raw.City);
    const state = cleanVal(raw.state || raw.ST || raw.State);

    const address = cleanVal(raw.address || raw.Address);
    const phone = cleanVal(raw.phone || raw.Phone || raw.Cell);
    const website = cleanVal(raw.website || raw.Website);
    const email = cleanVal(raw.email || raw.Email);
    const instagram = cleanVal(raw.instagram || raw.Instagram);

    const amenities =
      raw.amenities && typeof raw.amenities === "object"
        ? raw.amenities
        : {
            byob: raw.BYOB,
            tvs: raw.TVs,
            indoor: raw.Indoor,
            outdoor: raw.Outdoor,
            food: raw.Food,
            alcohol: raw.Alcohol,
            noalcohol: raw["No Alcohol"] || raw.NoAlcohol,
            quiet: raw.Quiet,
            livemusic: raw["Live Music"] || raw.LiveMusic,
            taa: raw.TAA,
          };

    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : typeof raw.Brands === "string"
      ? raw.Brands.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const hours =
      raw.hours && typeof raw.hours === "object"
        ? raw.hours
        : {
            mon: raw.mon || raw.Monday,
            tue: raw.tue || raw.Tuesday,
            wed: raw.wed || raw.Wednesday,
            thu: raw.thu || raw.Thursday,
            fri: raw.fri || raw.Friday,
            sat: raw.sat || raw.Saturday,
            sun: raw.sun || raw.Sunday,
          };

    return { slug, name, city, state, address, phone, website, email, instagram, amenities, brands, hours, raw };
  }

  function mergePreferA(a, b) {
    // Prefer A; if A is blank, use B
    const out = { ...b, ...a };

    const prefer = (key) => {
      const av = cleanVal(a?.[key]);
      const bv = cleanVal(b?.[key]);
      out[key] = av ? av : bv;
    };

    prefer("slug");
    prefer("name");
    prefer("city");
    prefer("state");
    prefer("address");
    prefer("phone");
    prefer("website");
    prefer("email");
    prefer("instagram");

    out.amenities = { ...(b?.amenities || {}), ...(a?.amenities || {}) };
    out.brands = (Array.isArray(a?.brands) && a.brands.length) ? a.brands : (Array.isArray(b?.brands) ? b.brands : []);
    out.hours = { ...(b?.hours || {}), ...(a?.hours || {}) };
    out.raw = a?.raw || b?.raw || {};

    return out;
  }

  function withCacheBust(url) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${Date.now()}`;
  }

  async function fetchJson(url) {
    const res = await fetch(withCacheBust(url), { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function findInMaster(arr, urlSlug) {
    if (!Array.isArray(arr) || !arr.length) return null;

    const s = slugify(urlSlug);
    if (!s) return null;

    // Try exact slug fields first, then slugified shop name
    return (
      arr.find((x) => slugify(x.slug || x.Slug || x.slug_id) === s) ||
      arr.find((x) => slugify(x.Shop || x.name || x.shop) === s) ||
      null
    );
  }

  async function loadShop(urlSlug) {
    // Always load master list for merge + reliable matching
    let masterArr = [];
    try {
      masterArr = await fetchJson(`/shops/shops.json`);
    } catch {
      masterArr = [];
    }

    const masterHitRaw = findInMaster(masterArr, urlSlug);
    const masterHit = masterHitRaw ? normalizeShop(masterHitRaw, urlSlug) : null;

    // Try per-shop JSON first
    if (urlSlug) {
      try {
        const perRaw = await fetchJson(`/data/shops/${encodeURIComponent(urlSlug)}.json`);
        const per = normalizeShop(perRaw, urlSlug);
        return masterHit ? mergePreferA(per, masterHit) : per;
      } catch {
        // fall through
      }
    }

    // Fallback to master only
    if (masterHit) return masterHit;

    if (!Array.isArray(masterArr) || !masterArr.length) throw new Error("shops.json is empty or failed to load");

    // last resort: first item
    return normalizeShop(masterArr[0], urlSlug);
  }

  async function setShopLogo(slug) {
    const img = $("#spLogo");
    if (!img) return;

    const s = slugify(slug);
    if (!s) return;

    const svg = `/img/icons/shops/${s}.svg`;
    const png = `/img/icons/shops/${s}.png`;

    img.onerror = () => {
      img.onerror = () => { img.style.display = "none"; };
      img.src = png;
    };
    img.src = svg;
  }

  function renderHeader(shop) {
    if ($("#spName")) $("#spName").textContent = cleanVal(shop.name) || "Shop";
    if ($("#spCity")) $("#spCity").textContent = [cleanVal(shop.city), cleanVal(shop.state)].filter(Boolean).join(", ");
  }

  function renderTAABadge(shop) {
    const taaIcon = $("#spTaaIcon");
    if (!taaIcon) return;

    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    taaIcon.style.display = taa ? "" : "none";
  }

  // Toast
  let toastTimer = null;
  function showToast(msg) {
    const el = $("#spToast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;

    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.hidden = true; }, 1600);
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", text: "Indoor seating available" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", text: "TVs available" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", text: "BYOB allowed" },
      { ok: isTruthy(shop.amenities?.food), icon: "/img/icons/food.svg", text: "Food available" },
      { ok: isTruthy(shop.amenities?.alcohol), icon: "/img/icons/alcohol.svg", text: "Alcohol available" },
    ].filter((i) => i.ok);

    items.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sp-amen-btn";
      btn.onclick = () => showToast(a.text);

      const img = document.createElement("img");
      img.src = a.icon;
      img.alt = a.text;
      img.className = "sp-amen-icon";

      btn.appendChild(img);
      row.appendChild(btn);
    });
  }

  function normalizeWebsiteUrl(v) {
    const s = cleanVal(v);
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  }

  function normalizeInstagramUrl(v) {
    const s = cleanVal(v);
    if (!s) return "";

    if (/^https?:\/\//i.test(s)) return s;

    const handle = s.replace(/^@/, "").trim();
    if (!handle) return "";

    return `https://instagram.com/${handle}`;
  }

  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");
    const igBtn = $("#spActInstagram");

    // CALL
    if (callBtn) {
      const phone = cleanVal(shop.phone);
      callBtn.onclick = () => { if (phone) window.location.href = `tel:${phone}`; };
      callBtn.disabled = !phone;
      callBtn.style.opacity = phone ? "" : ".45";
    }

    // WEB
    if (webBtn) {
      const url = normalizeWebsiteUrl(shop.website);
      webBtn.onclick = () => { if (url) window.open(url, "_blank", "noopener"); };
      webBtn.disabled = !url;
      webBtn.style.opacity = url ? "" : ".45";
    }

    // BRANDS
    if (brandsBtn) {
      brandsBtn.onclick = () => openBrandsModal(shop.brands || []);
    }

    // DIRECTIONS
    if (dirBtn) {
      const dest = cleanVal(shop.address) || [cleanVal(shop.city), cleanVal(shop.state)].filter(Boolean).join(", ");
      const ok = !!dest;
      dirBtn.onclick = () => { if (dest) window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener"); };
      dirBtn.disabled = !ok;
      dirBtn.style.opacity = ok ? "" : ".45";
    }

    // INSTAGRAM
    if (igBtn) {
      const igUrl = normalizeInstagramUrl(shop.instagram);
      if (!igUrl) {
        igBtn.style.display = "none";
      } else {
        igBtn.style.display = "";
        igBtn.onclick = () => window.open(igUrl, "_blank", "noopener");
        igBtn.disabled = false;
        igBtn.style.opacity = "";
      }
    }
  }

  // Tabs
  function closeAllPanels() {
    const tabs = [
      { tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];

    tabs.forEach((t) => {
      if (t.tab) {
        t.tab.classList.remove("is-active");
        t.tab.setAttribute("aria-selected", "false");
      }
      if (t.panel) {
        t.panel.classList.remove("is-active");
        t.panel.setAttribute("aria-hidden", "true");
      }
    });
  }

  function setActivePanel(which) {
    if (!which) return closeAllPanels();

    const tabs = [
      { key: "hours", tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { key: "about", tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { key: "updates", tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];

    tabs.forEach((t) => {
      const on = t.key === which;
      if (t.tab) {
        t.tab.classList.toggle("is-active", on);
        t.tab.setAttribute("aria-selected", on ? "true" : "false");
      }
      if (t.panel) {
        t.panel.classList.toggle("is-active", on);
        t.panel.setAttribute("aria-hidden", on ? "false" : "true");
      }
    });
  }

  function wireTabs() {
    const tHours = $("#spTabHours");
    const tAbout = $("#spTabAbout");
    const tUpdates = $("#spTabUpdates");
    if (tHours) tHours.onclick = () => setActivePanel("hours");
    if (tAbout) tAbout.onclick = () => setActivePanel("about");
    if (tUpdates) tUpdates.onclick = () => setActivePanel("updates");
  }

  function cleanHourValue(v) {
    return cleanVal(v);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderHours(shop) {
    const list = $("#spHoursList");
    const now = $("#spHoursNow");
    if (!list) return;

    const days = [
      ["Monday", cleanHourValue(shop.hours?.mon)],
      ["Tuesday", cleanHourValue(shop.hours?.tue)],
      ["Wednesday", cleanHourValue(shop.hours?.wed)],
      ["Thursday", cleanHourValue(shop.hours?.thu)],
      ["Friday", cleanHourValue(shop.hours?.fri)],
      ["Saturday", cleanHourValue(shop.hours?.sat)],
      ["Sunday", cleanHourValue(shop.hours?.sun)],
    ];

    const any = days.some((d) => d[1]);
    list.innerHTML = "";

    if (!any) {
      list.innerHTML = `<div class="sp-hours-row"><div class="sp-hours-day">Coming soon</div><div class="sp-hours-val">—</div></div>`;
      if (now) now.textContent = "—";
      return;
    }

    days.forEach(([day, val]) => {
      const v = val || "—";
      const row = document.createElement("div");
      row.className = "sp-hours-row";
      row.innerHTML = `<div class="sp-hours-day">${escapeHtml(day)}</div><div class="sp-hours-val">${escapeHtml(v)}</div>`;
      list.appendChild(row);
    });

    if (now) now.textContent = "—";
  }

  function renderAbout(shop) {
    const el = $("#spAbout");
    if (!el) return;

    const items = [
      ["Address", cleanVal(shop.address) || "—"],
      ["Phone", cleanVal(shop.phone) || "—"],
      ["Website", cleanVal(shop.website) || "—"],
      ["Instagram", cleanVal(shop.instagram) || "—"],
      ["Email", cleanVal(shop.email) || "—"],
    ];

    el.innerHTML = items.map(([k, v]) => `
      <div class="sp-about-item">
        <div class="sp-about-k">${escapeHtml(k)}</div>
        <div class="sp-about-v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  // Brands Modal
  function openBrandsModal(brands) {
    const modal = $("#spBrandsModal");
    const grid = $("#spBrandsGrid");
    if (!modal || !grid) return;

    grid.innerHTML = "";

    const list = Array.isArray(brands) ? brands : [];
    if (!list.length) {
      grid.innerHTML = `<div style="padding:10px 6px;color:#8e8e93;font-weight:600;">No brands listed.</div>`;
    } else {
      list.forEach((b) => {
        const slug = String(b || "").trim();
        if (!slug) return;

        const item = document.createElement("div");
        item.className = "sp-brand";

        const img = document.createElement("img");
        img.className = "sp-brand-ico";
        img.alt = slug;

        const svg = `/img/icons/brands/${encodeURIComponent(slug)}.svg`;
        const png = `/img/icons/brands/${encodeURIComponent(slug)}.png`;

        img.onerror = () => { img.onerror = null; img.src = png; };
        img.src = svg;

        const name = document.createElement("div");
        name.className = "sp-brand-name";
        name.textContent = slug;

        item.appendChild(img);
        item.appendChild(name);
        grid.appendChild(item);
      });
    }

    modal.hidden = false;
  }

  function closeBrandsModal() {
    const modal = $("#spBrandsModal");
    if (modal) modal.hidden = true;
  }

  function wireBrandsModal() {
    const bg = $("#spBrandsCloseBg");
    const btn = $("#spBrandsCloseBtn");
    if (bg) bg.onclick = closeBrandsModal;
    if (btn) btn.onclick = closeBrandsModal;

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrandsModal();
    });
  }

  async function init() {
    wireTabs();
    wireBrandsModal();

    const urlSlug = getSlugFromUrl();
    const shop = await loadShop(urlSlug);

    renderHeader(shop);
    await setShopLogo(shop.slug || urlSlug);
    renderTAABadge(shop);
    renderAmenities(shop);
    wireDock(shop);

    renderHours(shop);
    renderAbout(shop);

    setActivePanel(null);
  }

  init().catch((err) => console.error("[shop.js] init failed:", err));
})();
