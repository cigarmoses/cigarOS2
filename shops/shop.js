/* /shops/shop.js
   FULL REPLACEMENT FILE (v13.1)
   - Loads the correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, falls back to /shops/shops.json
   - Uses slug for logo lookup (svg -> png fallback)
   - Only shows TAA badge when true (spTaaIcon)
   - Panels CLOSED by default; tabs open panels
   - Amenity icons clickable w/ toast descriptions
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
    const email = (raw.email || raw.Email || "").toString().trim();
    const instagram = (raw.instagram || raw.Instagram || "").toString().trim();

    const amenities = raw.amenities && typeof raw.amenities === "object"
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
      : (typeof raw.Brands === "string" ? raw.Brands.split(",").map(s => s.trim()).filter(Boolean) : []);

    const hours = raw.hours && typeof raw.hours === "object" ? raw.hours : (raw.Hours || null);
    const about = (raw.about || raw.About || raw.events || raw.Events || "").toString().trim();
    const updates = (raw.updates || raw.Updates || "").toString().trim();

    return {
      slug,
      name,
      city,
      state,
      address,
      phone,
      website,
      email,
      instagram,
      amenities,
      brands,
      hours,
      about,
      updates,
      raw
    };
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

  async function setLogo(slug) {
    const img = $("#spLogo");
    if (!img || !slug) return;

    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    img.style.display = "";
    img.onerror = () => {
      img.onerror = () => {
        img.style.display = "none";
      };
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
    icon.style.display = taa ? "" : "none";
  }

  function toast(msg) {
    const el = $("#spAmenToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => el.classList.remove("is-show"), 1400);
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;
    row.innerHTML = "";

    const items = [
      {
        ok: isTruthy(shop.amenities?.indoor),
        icon: "/img/icons/indoorseating.svg",
        alt: "Indoor",
        msg: "Indoor seating available"
      },
      {
        ok: isTruthy(shop.amenities?.tvs),
        icon: "/img/icons/tv.svg",
        alt: "TV",
        msg: "TVs available"
      },
      {
        ok: isTruthy(shop.amenities?.byob),
        icon: "/img/icons/byob.svg",
        alt: "BYOB",
        msg: "BYOB friendly"
      }
    ].filter(i => i.ok);

    items.forEach(a => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sp-amen-btn";
      btn.setAttribute("aria-label", a.msg);
      btn.onclick = () => toast(a.msg);

      const img = document.createElement("img");
      img.src = a.icon;
      img.alt = a.alt;
      img.className = "sp-amen-icon";

      btn.appendChild(img);
      row.appendChild(btn);
    });
  }

  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");

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
      brandsBtn.onclick = () => {
        const tab = $("#spTabAbout"); // Brands button opens the About tab area by your current layout
        if (tab) tab.click();
      };
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
        window.open(`https://maps.apple.com/?q=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }
  }

  function setPanelsClosed(isClosed) {
    const panels = $("#spPanels");
    if (!panels) return;
    panels.classList.toggle("is-closed", !!isClosed);
  }

  function activateTab(which) {
    const tabHours = $("#spTabHours");
    const tabAbout = $("#spTabAbout");
    const tabUpdates = $("#spTabUpdates");

    const pHours = $("#spPanelHours");
    const pAbout = $("#spPanelAbout");
    const pUpdates = $("#spPanelUpdates");

    [tabHours, tabAbout, tabUpdates].forEach(b => b && b.classList.remove("is-active"));
    [pHours, pAbout, pUpdates].forEach(p => p && p.classList.remove("is-active"));

    if (which === "hours") { tabHours?.classList.add("is-active"); pHours?.classList.add("is-active"); }
    if (which === "about") { tabAbout?.classList.add("is-active"); pAbout?.classList.add("is-active"); }
    if (which === "updates") { tabUpdates?.classList.add("is-active"); pUpdates?.classList.add("is-active"); }

    setPanelsClosed(false);
  }

  function wireTabs() {
    const tabHours = $("#spTabHours");
    const tabAbout = $("#spTabAbout");
    const tabUpdates = $("#spTabUpdates");

    if (tabHours) tabHours.onclick = () => activateTab("hours");
    if (tabAbout) tabAbout.onclick = () => activateTab("about");
    if (tabUpdates) tabUpdates.onclick = () => activateTab("updates");

    // CLOSED by default on load
    setPanelsClosed(true);
  }

  function renderAboutUpdates(shop) {
    const about = $("#spAboutText");
    const upd = $("#spUpdateText");
    if (about) about.textContent = shop.about || "—";
    if (upd) upd.textContent = shop.updates || "No updates yet.";
  }

  function renderBrandsChips(shop) {
    const wrap = $("#spBrandChips");
    if (!wrap) return;
    wrap.innerHTML = "";
    (shop.brands || []).forEach(b => {
      const div = document.createElement("div");
      div.className = "sp-chip";
      div.textContent = b;
      wrap.appendChild(div);
    });
  }

  async function init() {
    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    await setLogo(shop.slug || slug);
    renderTAABadge(shop);
    renderAmenities(shop);
    wireDock(shop);

    // Panels/tabs behavior
    wireTabs();

    // Content
    renderAboutUpdates(shop);

    // If you later re-add a Brands panel grid, this is where we’ll hook it in.
    // (Keeping chips function here in case you already have #spBrandChips elsewhere.)
    renderBrandsChips(shop);
  }

  init().catch(err => {
    console.error("[shop.js] init failed:", err);
  });
})();
