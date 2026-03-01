/* /shops/shop.js
   Shop page loader (FIXED)
   - Uses ?shop=slug
   - Tries /data/shops/{slug}.json first (since you clearly have that)
   - Falls back to /shops/shops.json lookup by slug
*/

(() => {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  function getParam(name) {
    const url = new URL(window.location.href);
    return (url.searchParams.get(name) || "").trim();
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false) return false;
    if (v == null) return false;
    return ["1", "true", "yes", "y", "x"].includes(String(v).toLowerCase());
  }

  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt ?? "").toString();
  }

  function normalizeShop(obj, slug) {
    // Supports BOTH formats:
    // A) { slug, name, city, state, address, phone, website, amenities:{...} }
    // B) { Shop, City, ST, Address, Phone, Website, Indoor, TVs, BYOB, ... }

    const name = obj.name || obj.Shop || "";
    const city = obj.city || obj.City || "";
    const state = obj.state || obj.ST || "";
    const address = obj.address || obj.Address || "";
    const phone = obj.phone || obj.Phone || "";
    const website = obj.website || obj.Website || "";
    const brands = obj.brands || obj.Brands || [];

    const amenities = obj.amenities || {
      indoor: obj.Indoor,
      tvs: obj.TVs,
      byob: obj.BYOB,
      outdoor: obj.Outdoor,
      food: obj.Food,
      alcohol: obj.Alcohol,
      noalcohol: obj["No Alcohol"] || obj.NoAlcohol,
      quiet: obj.Quiet,
      livemusic: obj["Live Music"] || obj.LiveMusic,
      taa: obj.TAA
    };

    return {
      slug: obj.slug || slug || "",
      name,
      city,
      state,
      address,
      phone,
      website,
      brands,
      amenities
    };
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;
    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.amenities.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(shop.amenities.tvs), icon: "/img/icons/tv.svg", alt: "TVs" },
      { ok: isTruthy(shop.amenities.byob), icon: "/img/icons/byob.svg", alt: "BYOB" }
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
        const tab = document.getElementById("spTabBrands");
        if (tab) tab.click();
      };
    }

    if (dirBtn) {
      dirBtn.onclick = () => {
        const dest = shop.address || `${shop.name} ${shop.city} ${shop.state}`;
        window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`, "_blank", "noopener");
      };
    }
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  async function loadShop(slug) {
    // 1) Preferred: per-shop JSON file
    try {
      const obj = await fetchJson(`/data/shops/${slug}.json`);
      return normalizeShop(obj, slug);
    } catch (_) {}

    // 2) Fallback: find in /shops/shops.json
    const arr = await fetchJson("/shops/shops.json");
    const found =
      arr.find(s => (s.slug || "").toLowerCase() === slug.toLowerCase()) ||
      arr.find(s => (s.Shop || "").toLowerCase().replace(/\s/g, "") === slug.toLowerCase()) ||
      arr.find(s => (s.name || "").toLowerCase().replace(/\s/g, "") === slug.toLowerCase());

    if (!found) throw new Error(`Shop not found for slug: ${slug}`);
    return normalizeShop(found, slug);
  }

  function setLogo(slug, shopName) {
    const img = $("#spLogo");
    if (!img) return;

    // Prefer slug-based icon naming: img/icons/shops/{slug}.svg
    const cleanSlug = (slug || "").toLowerCase().replace(/\s/g, "");
    const cleanName = (shopName || "").toLowerCase().replace(/\s/g, "");

    const tryList = [
      `/img/icons/shops/${cleanSlug}.svg`,
      `/img/icons/shops/${cleanSlug}.png`,
      `/img/icons/shops/${cleanName}.svg`,
      `/img/icons/shops/${cleanName}.png`
    ];

    let i = 0;
    img.onerror = () => {
      i++;
      if (i < tryList.length) img.src = tryList[i];
      else img.removeAttribute("src");
    };

    img.src = tryList[0];
  }

  async function init() {
    const slug = getParam("shop") || "justthetip";

    const shop = await loadShop(slug);

    safeText($("#spName"), shop.name);
    safeText($("#spCity"), `${shop.city}${shop.state ? `, ${shop.state}` : ""}`);

    setLogo(shop.slug, shop.name);
    renderAmenities(shop);
    wireDock(shop);
  }

  init().catch(err => {
    console.error(err);
  });
})();
