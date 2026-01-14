/* /pos/cigars/favorites.js
   Favorites page controller (Cigars)

   Fixes:
   ✅ Brands + Cigars now render (no blank page)
   ✅ Reads multiple legacy + current localStorage keys safely
   ✅ Works with arrays of strings OR objects
   ✅ Creates list containers if the HTML doesn’t have them
   ✅ Nice empty states instead of nothing
   ✅ Brand click -> brand POS page
   ✅ Cigar click -> brand POS page (if brand known), else cigars home
*/

(() => {
  // --- Routes (adjust if your paths differ) ---
  const ROUTE_CIGARS_HOME = "/pos/cigars/";
  const ROUTE_BRAND_PAGE = "/pos/cigars/brand/"; // expects ?brand=...

  // --- LocalStorage keys (we support many to avoid breakage) ---
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

  // Some builds store everything under one object key:
  const BUNDLE_KEYS = [
    "pos:favorites",
    "pos_favorites",
    "favorites",
    "cigar:favorites",
    "cigars:favorites",
  ];

  // --- DOM helpers ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeName(s = "") {
    return String(s).trim();
  }

  function toSlugish(s = "") {
    return normalizeName(s).toLowerCase();
  }

  // --- Safe storage reads ---
  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function firstNonEmptyArray(keys) {
    for (const k of keys) {
      const v = readJson(k);
      if (Array.isArray(v) && v.length) return v;
      // Some older formats store as object map: { "Padron": true, ... }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const arr = Object.keys(v).filter((x) => v[x]);
        if (arr.length) return arr;
      }
    }
    return [];
  }

  function readBundle() {
    for (const k of BUNDLE_KEYS) {
      const v = readJson(k);
      if (!v) continue;
      // Expected shapes:
      // { brands: [...], cigars: [...] }
      // { favoriteBrands: [...], favoriteCigars: [...] }
      // { brands: {Padron:true}, cigars:{...} }
      if (typeof v === "object") return v;
    }
    return null;
  }

  // --- Mount points: find headings by text, then ensure a UL exists after each ---
  function findSectionByHeadingText(text) {
    const headings = $$("h1,h2,h3,h4,div,span,p").filter((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      return t === text.toLowerCase();
    });
    return headings[0] || null;
  }

  function ensureListContainer(afterEl, id) {
    if (!afterEl) return null;

    // If there is already a list-like element nearby, use it.
    const next =
      afterEl.nextElementSibling ||
      afterEl.parentElement?.querySelector(`#${id}`) ||
      null;

    if (next && (next.id === id || next.matches?.("ul,ol,div"))) {
      if (!next.id) next.id = id;
      return next;
    }

    // Create a simple container
    const wrap = document.createElement("div");
    wrap.id = id;
    wrap.style.marginTop = "10px";
    wrap.style.marginBottom = "22px";
    afterEl.insertAdjacentElement("afterend", wrap);
    return wrap;
  }

  // Primary mount points (use existing if your HTML already has these)
  const brandsMount =
    $("#favorites-brands") ||
    $("#fav-brands") ||
    $("#favBrands") ||
    $("#favoritesBrands") ||
    ensureListContainer(findSectionByHeadingText("Brands"), "favorites-brands");

  const cigarsMount =
    $("#favorites-cigars") ||
    $("#fav-cigars") ||
    $("#favCigars") ||
    $("#favoritesCigars") ||
    ensureListContainer(findSectionByHeadingText("Cigars"), "favorites-cigars");

  // If nothing is found (worst case), mount to body so user sees *something*
  const fallbackMount = document.body;

  // --- Parse favorites into consistent arrays of objects ---
  function normalizeBrandArray(arr) {
    // supports ["Padron", ...] OR [{brand:"Padron"}, ...]
    const out = [];
    for (const item of arr || []) {
      if (typeof item === "string") {
        const name = normalizeName(item);
        if (name) out.push({ brand: name });
      } else if (item && typeof item === "object") {
        const name =
          normalizeName(item.brand || item.name || item.title || item.value);
        if (name) out.push({ brand: name });
      }
    }
    // dedupe
    const seen = new Set();
    return out.filter((x) => {
      const k = toSlugish(x.brand);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function normalizeCigarArray(arr) {
    // supports:
    // ["Padron 1926 No. 9", ...]
    // [{ cigar:"No.9", brand:"Padron", line:"1926", msrp:"..." }, ...]
    // [{ id:"padron|1926|no9", ...}]
    const out = [];
    for (const item of arr || []) {
      if (typeof item === "string") {
        const name = normalizeName(item);
        if (name) out.push({ cigar: name });
      } else if (item && typeof item === "object") {
        const cigar =
          normalizeName(item.cigar || item.name || item.title || item.value);
        const brand = normalizeName(item.brand || item.maker || item.manufacturer);
        const line = normalizeName(item.line || item.series || item.collection);
        const id = normalizeName(item.id || item.key || item.uid);
        const msrp = item.msrp ?? item.price ?? item.MSRP ?? "";
        if (cigar || id) out.push({ cigar, brand, line, id, msrp });
      }
    }

    // dedupe by (brand|line|cigar|id)
    const seen = new Set();
    return out.filter((x) => {
      const k = toSlugish([x.brand, x.line, x.cigar, x.id].filter(Boolean).join("|"));
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // --- Read favorites from storage (bundle + individual keys) ---
  function loadFavorites() {
    const bundle = readBundle();

    let brandsRaw = [];
    let cigarsRaw = [];

    // bundle patterns
    if (bundle) {
      brandsRaw =
        bundle.brands ||
        bundle.favoriteBrands ||
        bundle.favBrands ||
        bundle.brandFavorites ||
        [];
      cigarsRaw =
        bundle.cigars ||
        bundle.favoriteCigars ||
        bundle.favCigars ||
        bundle.cigarFavorites ||
        [];
      // map objects pattern
      if (brandsRaw && typeof brandsRaw === "object" && !Array.isArray(brandsRaw)) {
        brandsRaw = Object.keys(brandsRaw).filter((k) => brandsRaw[k]);
      }
      if (cigarsRaw && typeof cigarsRaw === "object" && !Array.isArray(cigarsRaw)) {
        cigarsRaw = Object.keys(cigarsRaw).filter((k) => cigarsRaw[k]);
      }
    }

    // fallback to individual keys
    if (!Array.isArray(brandsRaw) || brandsRaw.length === 0) {
      brandsRaw = firstNonEmptyArray(BRAND_KEYS);
    }
    if (!Array.isArray(cigarsRaw) || cigarsRaw.length === 0) {
      cigarsRaw = firstNonEmptyArray(CIGAR_KEYS);
    }

    return {
      brands: normalizeBrandArray(brandsRaw),
      cigars: normalizeCigarArray(cigarsRaw),
    };
  }

  // --- Renderers ---
  function renderEmpty(mount, title, subtitle) {
    if (!mount) return;
    mount.innerHTML = `
      <div style="padding:12px 0 18px; color:#6b7280; font-size:14px; line-height:1.35;">
        <div style="font-weight:700; color:#0f1a2c; margin-bottom:4px;">${escapeHtml(
          title
        )}</div>
        <div>${escapeHtml(subtitle)}</div>
      </div>
    `;
  }

  function renderBrandList(mount, brands) {
    if (!mount) return;

    if (!brands.length) {
      renderEmpty(
        mount,
        "No favorite brands yet",
        "Tap the star on a brand page to save it here."
      );
      return;
    }

    mount.innerHTML = `
      <div class="fav-list">
        ${brands
          .map((b) => {
            const brand = b.brand;
            const href = `${ROUTE_BRAND_PAGE}?brand=${encodeURIComponent(brand)}`;
            return `
              <a class="fav-row" href="${href}" style="display:flex; align-items:center; gap:12px; padding:12px 0; text-decoration:none;">
                <div style="width:38px; height:38px; border-radius:10px; background:#f3f5f8; display:flex; align-items:center; justify-content:center; flex:0 0 auto;">
                  <span style="font-size:16px; font-weight:800; color:#0f1a2c;">★</span>
                </div>
                <div style="min-width:0;">
                  <div style="font-weight:800; color:#0f1a2c; font-size:18px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(
                    brand
                  )}</div>
                </div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderCigarList(mount, cigars) {
    if (!mount) return;

    if (!cigars.length) {
      renderEmpty(
        mount,
        "No favorite cigars yet",
        "Tap the star on a cigar detail to save it here."
      );
      return;
    }

    mount.innerHTML = `
      <div class="fav-list">
        ${cigars
          .map((c) => {
            const cigarName = c.cigar || c.id || "Cigar";
            const subtitle = [c.brand, c.line].filter(Boolean).join(" • ");
            const target =
              c.brand
                ? `${ROUTE_BRAND_PAGE}?brand=${encodeURIComponent(c.brand)}${
                    c.line ? `&line=${encodeURIComponent(c.line)}` : ""
                  }&q=${encodeURIComponent(cigarName)}`
                : ROUTE_CIGARS_HOME;

            const msrp =
              c.msrp !== "" && c.msrp != null
                ? String(c.msrp)
                : "";

            return `
              <a class="fav-row" href="${target}" style="display:flex; align-items:center; gap:12px; padding:12px 0; text-decoration:none;">
                <div style="width:38px; height:38px; border-radius:10px; background:#f3f5f8; display:flex; align-items:center; justify-content:center; flex:0 0 auto;">
                  <span style="font-size:16px; font-weight:800; color:#0f1a2c;">★</span>
                </div>
                <div style="min-width:0; flex:1 1 auto;">
                  <div style="font-weight:800; color:#0f1a2c; font-size:18px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(
                    cigarName
                  )}</div>
                  ${
                    subtitle
                      ? `<div style="margin-top:4px; color:#6b7280; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(
                          subtitle
                        )}</div>`
                      : ""
                  }
                </div>
                ${
                  msrp
                    ? `<div style="flex:0 0 auto; font-weight:800; color:#0f1a2c; font-size:14px;">${escapeHtml(
                        msrp
                      )}</div>`
                    : ""
                }
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  // --- Boot ---
  function boot() {
    const fav = loadFavorites();

    // If mounts missing, don’t fail — render to body with headings
    if (!brandsMount || !cigarsMount) {
      const wrap = document.createElement("div");
      wrap.style.padding = "18px 16px 24px";

      wrap.innerHTML = `
        <div style="font-weight:900; font-size:22px; color:#0f1a2c; margin-top:10px;">Brands</div>
        <div id="__brands_mount"></div>
        <div style="font-weight:900; font-size:22px; color:#0f1a2c; margin-top:20px;">Cigars</div>
        <div id="__cigars_mount"></div>
      `;
      fallbackMount.appendChild(wrap);

      renderBrandList($("#__brands_mount"), fav.brands);
      renderCigarList($("#__cigars_mount"), fav.cigars);
      return;
    }

    renderBrandList(brandsMount, fav.brands);
    renderCigarList(cigarsMount, fav.cigars);
  }

  // Run once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
