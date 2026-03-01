/* /shops/shop.js
   Public Shop Page – Data Loader + UI Wiring (FULL REPLACEMENT)
   v12.6

   ✅ Reads ?shop=slug
   ✅ Loads /data/shops/{slug}.json first
   ✅ Fallback: /shops/shops.json (find matching slug)
   ✅ Supports NEW per-shop JSON (name/city/state/amenities/hours/brands)
   ✅ Supports legacy shops.json rows (Shop/City/ST/Phone/Website/etc)
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---------- utils ----------
  function getParam(name) {
    const u = new URL(window.location.href);
    return (u.searchParams.get(name) || "").trim();
  }

  function toStr(v) {
    return v == null ? "" : String(v).trim();
  }

  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "t", "yes", "y", "x", "✓", "check", "checked", "open"].includes(s);
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

  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${url}`);
    return res.json();
  }

  // ---------- data getters (new + legacy) ----------
  function getName(shop) {
    return (
      toStr(shop.name) ||
      toStr(shop.Shop) ||
      toStr(shop.shop) ||
      toStr(shop.Title) ||
      "Shop"
    );
  }

  function getCity(shop) {
    return toStr(shop.city) || toStr(shop.City) || "";
  }

  function getState(shop) {
    return toStr(shop.state) || toStr(shop.ST) || toStr(shop.State) || "";
  }

  function getPhone(shop) {
    return toStr(shop.phone) || toStr(shop.Phone) || toStr(shop.cell) || toStr(shop.Cell) || "";
  }

  function getWebsite(shop) {
    return toStr(shop.website) || toStr(shop.Website) || "";
  }

  function getAddressString(shop) {
    const addr =
      toStr(shop.address) ||
      toStr(shop.Address) ||
      toStr(shop.address1) ||
      toStr(shop.address_1) ||
      "";

    const city = getCity(shop);
    const st = getState(shop);
    const zip = toStr(shop.zip) || toStr(shop.Zip) || "";

    const parts = [addr, city, st, zip].filter(Boolean);
    return parts.join(", ").trim();
  }

  function getCoords(shop) {
    const lat = Number(shop.latitude ?? shop.lat ?? shop.Latitude);
    const lng = Number(shop.longitude ?? shop.lng ?? shop.Longitude);
    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    return ok ? { lat, lng } : null;
  }

  function buildDirectionsUrl(shop) {
    const coords = getCoords(shop);
    const addr = getAddressString(shop);
    const q = coords ? `${coords.lat},${coords.lng}` : (addr || getName(shop));
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // ---------- amenities ----------
  // Prefer NEW: shop.amenities = { byob:true, tvs:true, indoor:true, ... }
  // Support LEGACY columns: BYOB, TVs, Indoor, Outdoor, Food, Alcohol, etc.
  function getAmenityBag(shop) {
    const bag = {};

    // New structure
    if (shop.amenities && typeof shop.amenities === "object") {
      for (const k of Object.keys(shop.amenities)) {
        bag[normalizeKey(k)] = isTruthy(shop.amenities[k]);
      }
    }

    // Legacy columns on the row
    for (const k of Object.keys(shop)) {
      const nk = normalizeKey(k);
      if (
        nk === "byob" ||
        nk === "tvs" ||
        nk === "tv" ||
        nk === "indoor" ||
        nk === "outdoor" ||
        nk === "food" ||
        nk === "alcohol" ||
        nk === "noalcohol" ||
        nk === "quiet" ||
        nk === "livemusic"
      ) {
        bag[nk === "tv" ? "tvs" : nk] = isTruthy(shop[k]);
      }
    }

    // normalize
    if (bag.noalcohol === true) bag.alcohol = false;

    return bag;
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    if (!row) return;

    row.innerHTML = "";

    const a = getAmenityBag(shop);

    const items = [
      { ok: isTruthy(a.indoor), icon: "/img/icons/indoorseating.svg", alt: "Indoor" },
      { ok: isTruthy(a.tvs), icon: "/img/icons/tv.svg", alt: "TVs" },
      { ok: isTruthy(a.byob), icon: "/img/icons/byob.svg", alt: "BYOB" },
    ].filter((i) => i.ok);

    items.forEach((it) => {
      const img = document.createElement("img");
      img.src = `${it.icon}?v=${Date.now()}`;
      img.className = "sp-amen-icon";
      img.alt = it.alt;
      row.appendChild(img);
    });
  }

  // ---------- logo ----------
  function setLogo(shop) {
    const img = $("#spLogo");
    if (!img) return;

    const base = sanitizeLogoName(getName(shop));
    const svg = `/img/icons/shops/${base}.svg?v=${Date.now()}`;
    const png = `/img/icons/shops/${base}.png?v=${Date.now()}`;

    img.onerror = () => {
      if (img.src.includes(".svg")) {
        img.src = png;
        return;
      }
      img.onerror = null;
    };

    img.src = svg;
  }

  // ---------- dock ----------
  function wireDock(shop) {
    const callBtn = $("#spActCall");
    const webBtn = $("#spActWeb");
    const brandsBtn = $("#spActBrands");
    const dirBtn = $("#spActDir");

    const phone = getPhone(shop);
    const website = getWebsite(shop);
    const dirUrl = buildDirectionsUrl(shop);

    if (callBtn) {
      callBtn.onclick = () => {
        if (!phone) return;
        window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      };
      callBtn.style.opacity = phone ? "1" : "0.35";
      callBtn.style.pointerEvents = phone ? "auto" : "none";
    }

    if (webBtn) {
      webBtn.onclick = () => {
        if (!website) return;
        const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
        window.open(url, "_blank", "noopener");
      };
      webBtn.style.opacity = website ? "1" : "0.35";
      webBtn.style.pointerEvents = website ? "auto" : "none";
    }

    if (brandsBtn) {
      brandsBtn.onclick = () => {
        // If your page has a Brands tab button, trigger it:
        const tab = document.getElementById("spTabBrands");
        if (tab) tab.click();
      };
    }

    if (dirBtn) {
      dirBtn.onclick = () => window.open(dirUrl, "_blank", "noopener");
    }
  }

  // ---------- load shop ----------
  async function loadShopData(slug) {
    // 1) per-shop json
    try {
      return await fetchJson(`/data/shops/${slug}.json?v=${Date.now()}`);
    } catch (e) {
      // 2) fallback list
      const arr = await fetchJson(`/shops/shops.json?v=${Date.now()}`);
      if (!Array.isArray(arr)) throw new Error("shops.json is not an array");

      const hit =
        arr.find((s) => slugify(s.slug || s.shop || s.Shop || s.name || s.Name) === slug) ||
        arr.find((s) => slugify(s.name || s.Shop || s.shop) === slug) ||
        arr.find((s) => sanitizeLogoName(s.name || s.Shop || s.shop) === sanitizeLogoName(slug));

      if (!hit) throw new Error(`Shop not found: ${slug}`);
      return hit;
    }
  }

  // ---------- render ----------
  function render(shop) {
    const nameEl = $("#spName");
    const cityEl = $("#spCity");

    const name = getName(shop);
    const city = getCity(shop);
    const st = getState(shop);

    if (nameEl) nameEl.textContent = name;
    if (cityEl) cityEl.textContent = `${city}${city && st ? ", " : ""}${st}`;

    setLogo(shop);
    renderAmenities(shop);
    wireDock(shop);
  }

  async function init() {
    const slug = getParam("shop") || "shop";

    try {
      const shop = await loadShopData(slug);
      render(shop);
    } catch (err) {
      console.error(err);
      const nameEl = $("#spName");
      const cityEl = $("#spCity");
      if (nameEl) nameEl.textContent = "Shop not found";
      if (cityEl) cityEl.textContent = "—";
    }
  }

  init();
})();
