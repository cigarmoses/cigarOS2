/* /shops/shop-page.js
   FULL REPLACEMENT
   - Loads shop by ?shop=slug  (slug has NO hyphens)
   - Uses /data/shops/{slug}.json when available, merges missing fields from /shops/shops.json
   - Shop logo: tries SVG then PNG fallback
   - Only shows TAA badge when true
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanStr(v) { return String(v ?? "").trim(); }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getSlugFromUrl() {
    const u = new URL(window.location.href);
    // IMPORTANT: your slugs are already no-hyphen; keep exactly as provided
    return (u.searchParams.get("shop") || "").trim().toLowerCase();
  }

  function normalizeShop(raw, fallbackSlug) {
    const slug = cleanStr(raw.slug || raw.Slug || raw.slug_id || fallbackSlug).toLowerCase();

    const name = cleanStr(raw.name || raw.Shop || raw.shop);
    const city = cleanStr(raw.city || raw.City);
    const state = cleanStr(raw.state || raw.ST || raw.State);

    const amenities =
      raw.amenities && typeof raw.amenities === "object"
        ? raw.amenities
        : { taa: raw.TAA };

    return { slug, name, city, state, amenities, raw };
  }

  function mergePreferA(a, b) {
    // Prefer values from "a"; if missing/blank, use "b"
    const out = { ...b, ...a };

    const prefer = (key) => {
      const av = cleanStr(a?.[key]);
      const bv = cleanStr(b?.[key]);
      out[key] = av ? av : bv;
    };

    prefer("slug");
    prefer("name");
    prefer("city");
    prefer("state");

    // Amenities shallow merge (prefer a)
    out.amenities = { ...(b?.amenities || {}), ...(a?.amenities || {}) };

    // Keep raw
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

  function findInMaster(arr, slug) {
    if (!Array.isArray(arr)) return null;
    const s = String(slug || "").trim().toLowerCase();
    if (!s) return null;

    return (
      arr.find((x) => String(x.slug || x.Slug || "").trim().toLowerCase() === s) ||
      null
    );
  }

  async function loadShop(slug) {
    let masterArr = [];
    try {
      masterArr = await fetchJson(`/shops/shops.json`);
    } catch (e) {
      masterArr = [];
    }

    // Try per-shop first
    if (slug) {
      try {
        const perRaw = await fetchJson(`/data/shops/${encodeURIComponent(slug)}.json`);
        const per = normalizeShop(perRaw, slug);

        // Merge missing fields from master
        const masterHitRaw = findInMaster(masterArr, slug);
        if (masterHitRaw) {
          const master = normalizeShop(masterHitRaw, slug);
          return mergePreferA(per, master);
        }

        return per;
      } catch (e) {
        // fall through to master-only
      }
    }

    // Master-only fallback
    if (!Array.isArray(masterArr) || !masterArr.length) {
      return normalizeShop({ slug, name: "Shop", city: "", state: "" }, slug);
    }

    if (slug) {
      const hit = findInMaster(masterArr, slug);
      if (hit) return normalizeShop(hit, slug);
    }

    return normalizeShop(masterArr[0], slug);
  }

  function setShopLogo(slug) {
    const img = $("#spLogo");
    if (!img || !slug) return;

    const svg = `/img/icons/shops/${slug}.svg`;
    const png = `/img/icons/shops/${slug}.png`;

    img.alt = slug;

    img.onerror = () => {
      // if SVG fails, try PNG; if PNG fails, hide
      img.onerror = () => { img.style.display = "none"; };
      img.src = png;
    };

    img.src = svg;
  }

  function renderHeader(shop) {
    const nameEl = $("#spName");
    const cityEl = $("#spCity");

    if (nameEl) nameEl.textContent = shop.name || "Shop";

    const cityState = [shop.city, shop.state].filter(Boolean).join(", ");
    if (cityEl) cityEl.textContent = cityState || "—";
  }

  function renderTAABadge(shop) {
    const taaEl = $("#spTaa");
    if (!taaEl) return;

    const taa = isTruthy(shop.amenities?.taa) || isTruthy(shop.raw?.TAA);
    taaEl.hidden = !taa;
  }

  async function init() {
    const slug = getSlugFromUrl();
    const shop = await loadShop(slug);

    renderHeader(shop);
    setShopLogo(shop.slug || slug);
    renderTAABadge(shop);
  }

  init().catch((err) => console.error("[shop-page.js] init failed:", err));
})();
