/* /shops/shop.js
   FULL REPLACEMENT FILE
   - Loads the correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, falls back to /shops/shops.json
   - Uses slug for logo lookup (svg -> png fallback)
   - Only shows TAA badge when true
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
    // Supports BOTH shapes:
    // 1) Per-shop JSON: { slug, name, city, state, address, phone, website, amenities:{...}, brands:[...] }
    // 2) Sheet rows: { Shop, City, ST, Address, Phone, Website, BYOB, TVs, Indoor, ... }

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

    return { slug, name, city, state, address, phone, website, email, instagram, amenities, brands, raw };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  async function loadShop(slug) {
    // 1) Try per-shop JSON
    if (slug) {
      try {
        const per = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json`);
        return normalizeShop(per, slug);
      } catch (e) {
        // fall through
      }
    }

    // 2) Fallback: shops.json array
    const arr = await fetchJson(`/shops/shops.json`);
    if (!Array.isArray(arr) || !arr.length) throw new Error("shops.json is empty");

    if (slug) {
      // try matching on slug fields first, then normalized shop name
      const hit =
        arr.find(x => String(x.slug || x.Slug || "").trim().toLowerCase() === slug) ||
        arr.find(x => String(x.Shop || x.name || "").trim().toLowerCase().replace(/\s+/g, "") === slug.replace(/\s+/g, ""));
      if (hit) return normalizeShop(hit, slug);
    }

    // last resort: first item (only if no slug was provided)
    return normalizeShop(arr[0], slug);
  }

  async function setLogo(slug) {
    const img = $("#spLogo");
    if (!img) return;

    // Prefer slug-based icons:
    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    // Try svg first
    img.onerror = () => {
      // try png
      img.onerror = () => {
        // hide if missing
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
    // If your HTML has a TAA badge element, we only show when true
    const badge = $("#spTaaBadge");
    if (!badge) return;

    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    badge.style.display = taa ? "" : "none";
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", alt: "TV" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", alt: "BYOB" },
      { ok: isTruthy(shop.amenities?.food), icon: "/img/icons/food.svg", alt: "Food" },
      { ok: isTruthy(shop.amenities?.alcohol), icon: "/img/icons/alcohol.svg", alt: "Alcohol" },
      { ok: isTruthy(shop.amenities?.taa), icon: "/img/icons/taa.svg", alt: "TAA" }
    ].filter(i => i.ok);

    items.forEach(a => {
      const img = document.createElement("img");
      img.src = a.icon;
      img.alt = a.alt;
      img.className = "sp-amen-icon";
      row.appendChild(img);
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
        const tab = $("#spTabBrands");
        if (tab) tab.click();
      };
    }

    if (dirBtn) {
      dirBtn.onclick = () => {
        // Prefer full address; fall back to city/state
        const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
        if (!dest) return;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }
  }

  async function init() {
    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    await setLogo(shop.slug || slug);
    renderTAABadge(shop);
    renderAmenities(shop);
    wireDock(shop);
  }

  init().catch(err => {
    console.error("[shop.js] init failed:", err);
  });
})();
