/* /pos/cigars/favorites.js
   Favorites page controller

   Fixes:
   ✅ Uses your favorites.html mounts:
      - #fav-brands-grid
      - #fav-cigars-list
      - #fav-status
   ✅ Reads multiple legacy + current localStorage keys safely
   ✅ Works with arrays of strings OR objects OR object-maps
   ✅ Shows empty states instead of a blank page
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const brandsGrid = $("#fav-brands-grid");
  const cigarsList = $("#fav-cigars-list");
  const statusEl = $("#fav-status");
  const backBtn = $("#fav-back");

  const ROUTE_BRAND_PAGE = "/pos/cigars/brand/"; // expects ?brand=...
  const ROUTE_CIGARS_HOME = "/pos/cigars/";

  // Support many storage key variants so we don’t break when you rename keys
  const BRAND_KEYS = [
    "pos:favorites:brands",
    "pos_favorites_brands",
    "favorites:brands",
    "favoriteBrands",
    "favBrands",
    "brands:favorites",
  ];

  const CIGAR_KEYS = [
    "pos:favorites:cigars",
    "pos_favorites_cigars",
    "favorites:cigars",
    "favoriteCigars",
    "favCigars",
    "cigars:favorites",
  ];

  const BUNDLE_KEYS = [
    "pos:favorites",
    "pos_favorites",
    "favorites",
    "cigar:favorites",
    "cigars:favorites",
  ];

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function norm(s = "") {
    return String(s || "").trim();
  }

  function slug(s = "") {
    return norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function objectMapToArray(v) {
    // { "Padron": true, "Davidoff": true } -> ["Padron","Davidoff"]
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    return Object.keys(v).filter((k) => v[k]);
  }

  function firstNonEmpty(keys) {
    for (const k of keys) {
      const v = readJson(k);
      if (Array.isArray(v) && v.length) return v;
      const mapArr = objectMapToArray(v);
      if (mapArr.length) return mapArr;
    }
    return [];
  }

  function readBundle() {
    for (const k of BUNDLE_KEYS) {
      const v = readJson(k);
      if (v && typeof v === "object") return v;
    }
    return null;
  }

  function normalizeBrandArray(arr) {
    const out = [];
    const seen = new Set();

    for (const item of arr || []) {
      let name = "";
      if (typeof item === "string") name = norm(item);
      else if (item && typeof item === "object") name = norm(item.brand || item.name || item.title || item.value);

      if (!name) continue;
      const key = slug(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ brand: name });
    }
    return out;
  }

  function normalizeCigarArray(arr) {
    const out = [];
    const seen = new Set();

    for (const item of arr || []) {
      let cigar = "";
      let brand = "";
      let line = "";
      let msrp = "";

      if (typeof item === "string") {
        cigar = norm(item);
      } else if (item && typeof item === "object") {
        cigar = norm(item.cigar || item.name || item.title || item.value);
        brand = norm(item.brand || item.maker || item.manufacturer);
        line = norm(item.line || item.series || item.collection);
        msrp = norm(item.msrp ?? item.price ?? item.MSRP ?? "");
      }

      if (!cigar && !brand && !line) continue;

      const key = slug([brand, line, cigar].filter(Boolean).join("|"));
      if (!key || seen.has(key)) continue;
      seen.add(key);

      out.push({ cigar, brand, line, msrp });
    }

    return out;
  }

  function loadFavorites() {
    const bundle = readBundle();

    let brandsRaw = [];
    let cigarsRaw = [];

    if (bundle) {
      brandsRaw =
        bundle.brands ||
        bundle.favoriteBrands ||
        bundle.favBrands ||
        bundle.brandFavorites ||
        objectMapToArray(bundle.brands) ||
        [];

      cigarsRaw =
        bundle.cigars ||
        bundle.favoriteCigars ||
        bundle.favCigars ||
        bundle.cigarFavorites ||
        objectMapToArray(bundle.cigars) ||
        [];
    }

    if (!Array.isArray(brandsRaw) || brandsRaw.length === 0) brandsRaw = firstNonEmpty(BRAND_KEYS);
    if (!Array.isArray(cigarsRaw) || cigarsRaw.length === 0) cigarsRaw = firstNonEmpty(CIGAR_KEYS);

    return {
      brands: normalizeBrandArray(brandsRaw),
      cigars: normalizeCigarArray(cigarsRaw),
    };
  }

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = msg;
  }

  function hideStatus() {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  function renderBrands(brands) {
    if (!brandsGrid) return;

    if (!brands.length) {
      brandsGrid.innerHTML = "";
      showStatus("No favorites yet. Tap the star on a brand or cigar to save it here.");
      return;
    }

    hideStatus();

    // Match your /pos/cigars/ brand tile feel as closely as possible via classes you already use.
    brandsGrid.innerHTML = brands
      .map(({ brand }) => {
        const href = `${ROUTE_BRAND_PAGE}?brand=${encodeURIComponent(brand)}`;
        return `
          <a class="brand-tile" href="${href}" style="text-decoration:none;">
            <div class="brand-tile-inner">
              <div class="brand-icon" aria-hidden="true">★</div>
              <div class="brand-name">${escapeHtml(brand)}</div>
            </div>
          </a>
        `;
      })
      .join("");
  }

  function renderCigars(cigars) {
    if (!cigarsList) return;

    if (!cigars.length) {
      cigarsList.innerHTML = "";
      return;
    }

    cigarsList.innerHTML = cigars
      .map(({ cigar, brand, line, msrp }) => {
        const title = cigar || "Cigar";
        const subtitle = [brand, line].filter(Boolean).join(" • ");
        const href = brand
          ? `${ROUTE_BRAND_PAGE}?brand=${encodeURIComponent(brand)}${line ? `&line=${encodeURIComponent(line)}` : ""}&q=${encodeURIComponent(title)}`
          : ROUTE_CIGARS_HOME;

        return `
          <a class="brand-row" href="${href}" style="text-decoration:none;">
            <div class="brand-row-left">
              <div class="brand-row-title">${escapeHtml(title)}</div>
              ${subtitle ? `<div class="brand-row-sub">${escapeHtml(subtitle)}</div>` : ""}
            </div>
            <div class="brand-row-right">
              ${msrp ? `<div class="brand-row-msrp">${escapeHtml(msrp)}</div>` : ""}
            </div>
          </a>
        `;
      })
      .join("");
  }

  function boot() {
    backBtn?.addEventListener("click", () => history.back());

    if (!brandsGrid || !cigarsList) {
      showStatus("Favorites page mounts missing: #fav-brands-grid or #fav-cigars-list.");
      return;
    }

    const fav = loadFavorites();
    renderBrands(fav.brands);
    renderCigars(fav.cigars);

    // If there ARE favorites but still nothing renders, it means your storage keys differ.
    // This console log makes that obvious immediately.
    console.log("[favorites.js] loaded favorites:", fav);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
