/* /shops/shop.js
   FULL REPLACEMENT FILE (v13.3)
   - Loads correct shop by ?shop=slug
   - Prefers /data/shops/{slug}.json, falls back to /shops/shops.json
   - Uses slug for shop logo lookup (svg -> png fallback)
   - Only shows TAA badge when true (spTaaIcon)
   - Renders Brands as 4-across SVG grid with label underneath
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
      : (typeof raw.Brands === "string"
          ? raw.Brands.split(",").map(s => s.trim()).filter(Boolean)
          : []);

    return { slug, name, city, state, address, phone, website, email, instagram, amenities, brands, raw };
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

  async function setShopLogo(slug) {
    const img = $("#spLogo");
    if (!img) return;

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
    icon.style.display = taa ? "" : "none";
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities?.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(shop.amenities?.tvs), icon: "/img/icons/tv.svg", alt: "TV" },
      { ok: isTruthy(shop.amenities?.byob), icon: "/img/icons/byob.svg", alt: "BYOB" }
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
    const addrBtn = $("#spAddressBtn");

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

    const goDir = () => {
      const dest = shop.address || [shop.city, shop.state].filter(Boolean).join(", ");
      if (!dest) return;
      window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
    };

    if (dirBtn) dirBtn.onclick = goDir;
    if (addrBtn) addrBtn.onclick = goDir;
  }

  // ✅ Brand icon path helpers (brands folder)
  function brandIconCandidates(brandKey) {
    // preferred: /img/icons/brands/{key}.svg
    return [
      `/img/icons/brands/${brandKey}.svg`,
      `/img/icons/brand/${brandKey}.svg`,
      `/img/icons/brands/${brandKey}.png`,
      `/img/icons/brand/${brandKey}.png`
    ];
  }

  function renderBrandsGrid(shop) {
    const grid = $("#spBrandGrid");
    if (!grid) return;

    grid.innerHTML = "";

    const list = Array.isArray(shop.brands) ? shop.brands : [];
    if (!list.length) return;

    list.forEach((rawKey) => {
      const key = String(rawKey || "").trim().toLowerCase();
      if (!key) return;

      const item = document.createElement("div");
      item.className = "sp-brand-item";

      const img = document.createElement("img");
      img.className = "sp-brand-icon";
      img.alt = key;

      const label = document.createElement("div");
      label.className = "sp-brand-name";
      label.textContent = key;

      const candidates = brandIconCandidates(key);
      let idx = 0;
      img.onerror = () => {
        idx += 1;
        if (idx < candidates.length) {
          img.src = candidates[idx];
        } else {
          // if icon missing, hide icon but keep name (still useful)
          img.style.display = "none";
        }
      };
      img.src = candidates[idx];

      item.appendChild(img);
      item.appendChild(label);
      grid.appendChild(item);
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

    // ✅ NEW: grid brand render
    renderBrandsGrid(shop);
  }

  init().catch(err => {
    console.error("[shop.js] init failed:", err);
  });
})();
