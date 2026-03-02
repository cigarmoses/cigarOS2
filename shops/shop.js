/* /shops/shop.js
   v13.1 FULL REPLACEMENT
   - Loads correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, falls back to /shops/shops.json
   - Uses slug for shop logo lookup (svg -> png fallback)
   - ONLY shows TAA badge when true
   - Dock: Call/Web/Brands/Directions (Brands opens sheet with 4-across brand SVG grid)
   - Bottom segmented: Hours | About | Updates
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getSlugFromUrl() {
    const u = new URL(window.location.href);
    return (u.searchParams.get("shop") || "").trim().toLowerCase();
  }

  function normalizeShop(raw, fallbackSlug) {
    const slug =
      (raw.slug || raw.Slug || raw.slug_id || fallbackSlug || "")
        .toString()
        .trim()
        .toLowerCase();

    const name = (raw.name || raw.Shop || raw.shop || "").toString().trim();
    const city = (raw.city || raw.City || "").toString().trim();
    const state = (raw.state || raw.ST || raw.State || "").toString().trim();

    const address = (raw.address || raw.Address || "").toString().trim();
    const phone = (raw.phone || raw.Phone || raw.Cell || "").toString().trim();
    const website = (raw.website || raw.Website || "").toString().trim();

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
            taa: raw.TAA
          };

    const brands = Array.isArray(raw.brands)
      ? raw.brands
      : (typeof raw.Brands === "string"
          ? raw.Brands.split(",").map(s => s.trim()).filter(Boolean)
          : []);

    const about = (raw.about || raw.About || raw.notes || raw.Notes || "").toString().trim();
    const updates = (raw.updates || raw.Updates || "").toString().trim();

    const hours = raw.hours && typeof raw.hours === "object" ? raw.hours : null;

    return { slug, name, city, state, address, phone, website, amenities, brands, about, updates, hours, raw };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  async function loadShop(slug) {
    if (slug) {
      try {
        const per = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json`);
        return normalizeShop(per, slug);
      } catch (e) {
        // fall through
      }
    }

    const arr = await fetchJson(`/shops/shops.json`);
    if (!Array.isArray(arr) || !arr.length) throw new Error("shops.json is empty");

    if (slug) {
      const hit =
        arr.find(x => String(x.slug || x.Slug || "").trim().toLowerCase() === slug) ||
        arr.find(x => String(x.Shop || x.name || "").trim().toLowerCase().replace(/\s+/g, "") === slug.replace(/\s+/g, ""));
      if (hit) return normalizeShop(hit, slug);
    }

    return normalizeShop(arr[0], slug);
  }

  async function setShopLogo(shopSlug) {
    const img = $("#spLogo");
    if (!img) return;

    const slug = (shopSlug || "").trim().toLowerCase();
    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    img.onerror = () => {
      img.onerror = () => { img.style.display = "none"; };
      img.src = png;
    };
    img.src = svg;
  }

  function renderHeader(shop) {
    if ($("#spName")) $("#spName").textContent = shop.name || "Shop";
    if ($("#spCity")) $("#spCity").textContent = [shop.city, shop.state].filter(Boolean).join(", ");
  }

  function renderTAABadge(shop) {
    const icon = $("#spTaaIcon");
    if (!icon) return;

    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    icon.style.display = taa ? "block" : "none";
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;
    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", alt: "TV" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", alt: "BYOB" },
    ].filter(i => i.ok);

    items.forEach(a => {
      const img = document.createElement("img");
      img.src = a.icon;
      img.alt = a.alt;
      img.className = "sp-amen-icon";
      row.appendChild(img);
    });
  }

  function setDockDisabled(btn, disabled) {
    if (!btn) return;
    btn.classList.toggle("is-disabled", !!disabled);
  }

  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");

    setDockDisabled(callBtn, !shop.phone);
    setDockDisabled(webBtn, !shop.website);

    if (callBtn) {
      callBtn.onclick = () => {
        if (shop.phone) window.location.href = `tel:${shop.phone}`;
      };
    }

    if (webBtn) {
      webBtn.onclick = () => {
        if (shop.website) window.open(shop.website, "_blank", "noopener");
      };
    }

    if (brandsBtn) {
      brandsBtn.onclick = () => openBrandsSheet();
    }

    if (dirBtn) {
      dirBtn.onclick = () => {
        const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
        if (!dest) return;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }

    const addrBtn = $("#spAddressBtn");
    if (addrBtn) {
      addrBtn.onclick = () => {
        const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
        if (!dest) return;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }
  }

  function wireSegmented() {
    const tabs = [
      { tab: $("#spTabHours"), panel: $("#spPanelHours") },
      { tab: $("#spTabAbout"), panel: $("#spPanelAbout") },
      { tab: $("#spTabUpdates"), panel: $("#spPanelUpdates") },
    ];

    function activate(idx) {
      tabs.forEach((t, i) => {
        t.tab?.classList.toggle("is-active", i === idx);
        t.panel?.classList.toggle("is-active", i === idx);
      });
    }

    tabs.forEach((t, idx) => {
      if (t.tab) t.tab.onclick = () => activate(idx);
    });

    activate(0);
  }

  function renderAboutUpdates(shop) {
    const aboutEl = $("#spAboutText");
    if (aboutEl) {
      aboutEl.textContent = shop.about || "No details yet.";
      if (!shop.about) aboutEl.classList.add("sp-about-muted");
      else aboutEl.classList.remove("sp-about-muted");
    }

    const updEl = $("#spUpdateText");
    if (updEl) updEl.textContent = shop.updates || "No updates yet.";
  }

  function renderHours(shop) {
    const wrap = $("#spHoursList");
    if (!wrap) return;

    // If you don’t have hours yet, show "Coming soon" (and keep the dashes off the rows)
    const h = shop.hours;
    if (!h) {
      wrap.innerHTML = `<div class="sp-about-text sp-about-muted">Coming soon.</div>`;
      const now = $("#spHoursNow");
      if (now) now.textContent = "—";
      return;
    }

    const order = [
      ["mon", "Monday"],
      ["tue", "Tuesday"],
      ["wed", "Wednesday"],
      ["thu", "Thursday"],
      ["fri", "Friday"],
      ["sat", "Saturday"],
      ["sun", "Sunday"],
    ];

    wrap.innerHTML = "";
    order.forEach(([key, label]) => {
      const val = (h[key] || h[label] || "—").toString().trim();
      const row = document.createElement("div");
      row.className = "sp-hours-row";
      row.innerHTML = `
        <div class="sp-hours-day">${label}</div>
        <div class="sp-hours-val">${val || "—"}</div>
      `;
      wrap.appendChild(row);
    });

    const now = $("#spHoursNow");
    if (now) now.textContent = "—";
  }

  // ===== Brands sheet (4-across SVG icons, no shading) =====
  function openBrandsSheet() {
    const sheet = $("#spBrandsSheet");
    if (!sheet) return;
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeBrandsSheet() {
    const sheet = $("#spBrandsSheet");
    if (!sheet) return;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
  }

  function brandIconPath(slug) {
    const s = String(slug || "").trim().toLowerCase();
    // per your repo convention: /img/icons/brands (plural)
    return `/img/icons/brands/${s}.svg`;
  }

  function brandIconFallback(slug) {
    const s = String(slug || "").trim().toLowerCase();
    // fallback if you still have older path:
    return `/img/icons/brand/${s}.svg`;
  }

  function renderBrandsGrid(shop) {
    const grid = $("#spBrandGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const list = Array.isArray(shop.brands) ? shop.brands : [];
    if (!list.length) {
      grid.innerHTML = `<div class="sp-about-text sp-about-muted">No brands listed yet.</div>`;
      return;
    }

    list.forEach((b) => {
      const slug = String(b).trim().toLowerCase();
      if (!slug) return;

      const item = document.createElement("div");
      item.className = "sp-brand-item";

      const img = document.createElement("img");
      img.className = "sp-brand-icon";
      img.alt = slug;

      img.onerror = () => {
        img.onerror = () => { img.style.display = "none"; };
        img.src = brandIconFallback(slug);
      };
      img.src = brandIconPath(slug);

      const label = document.createElement("div");
      label.className = "sp-brand-label";
      label.textContent = slug;

      item.appendChild(img);
      item.appendChild(label);
      grid.appendChild(item);
    });
  }

  function wireBrandsSheet() {
    $("#spBrandsClose")?.addEventListener("click", closeBrandsSheet);
    $("#spBrandsBackdrop")?.addEventListener("click", closeBrandsSheet);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBrandsSheet();
    });
  }

  async function init() {
    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    await setShopLogo(shop.slug || slug);

    renderTAABadge(shop);
    renderAmenities(shop);
    wireDock(shop);

    wireSegmented();
    renderAboutUpdates(shop);
    renderHours(shop);

    wireBrandsSheet();
    renderBrandsGrid(shop);
  }

  init().catch(err => {
    console.error("[shop.js] init failed:", err);
  });
})();
