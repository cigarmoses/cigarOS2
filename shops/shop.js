/* /shops/shop.js
   Public Shop Page — HARDENED FALLBACKS (v13.8)

   Data:
   1) Always load master list: /shops/shops.json
   2) Optionally merge per-shop overrides if present: /data/shops/<slug>.json
      (This is where brands/photos/specials can live later.)

   IMPORTANT:
   - Brands are OPTIONAL. Missing brands must NOT break the page.
   - If no brands, show “Brands coming soon”.
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---------- helpers ----------
  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function toStr(v) {
    return v == null ? "" : String(v).trim();
  }

  function slugify(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sanitizeLogoKey(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "t", "yes", "y", "x", "✓", "check", "checked"].includes(s);
  }

  function normalizeState(row) {
    const st = toStr(row.state || row.ST);
    const state = toStr(row.State);
    return (st || state).toUpperCase();
  }

  function getName(row) { return toStr(row.name || row.Shop); }
  function getSlug(row) { return toStr(row.slug) || slugify(getName(row)); }
  function getLogoKey(row) { return toStr(row.logoKey) || sanitizeLogoKey(getName(row)); }

  function getAddress1(row) { return toStr(row.address1 || row.Address); }
  function getCity(row) { return toStr(row.city || row.City); }
  function getZip(row) { return toStr(row.zip || row.Zip); }
  function getPhone(row) { return toStr(row.phone || row.Phone); }
  function getWebsite(row) { return toStr(row.website || row.Website); }
  function getEmail(row) { return toStr(row.email || row.Email); }
  function getInstagram(row) { return toStr(row.instagram || row.Instagram); }

  function getLat(row) {
    const v = row.lat ?? row.Latitude;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function getLng(row) {
    const v = row.lng ?? row.Longitude;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getHours(row) {
    if (row.hours && typeof row.hours === "object") return row.hours;
    return {
      mon: toStr(row.Monday),
      tue: toStr(row.Tuesday),
      wed: toStr(row.Wednesday),
      thu: toStr(row.Thursday),
      fri: toStr(row.Friday),
      sat: toStr(row.Saturday),
      sun: toStr(row.Sunday),
    };
  }

  function getFeatures(row) {
    if (row.features && typeof row.features === "object") return row.features;

    const noAlcohol =
      isTruthy(row["No Alcohol"]) || isTruthy(row["No alcohol"]) || isTruthy(row["NoAlcohol"]);

    const features = {
      food: isTruthy(row.Food),
      alcohol: isTruthy(row.Alcohol),
      taa: isTruthy(row.TAA),
      byob: isTruthy(row.BYOB),
      noAlcohol
    };

    if (features.noAlcohol) features.alcohol = false;
    return features;
  }

  function buildDirectionsUrl(row) {
    const lat = getLat(row);
    const lng = getLng(row);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const address = [
      getAddress1(row),
      getCity(row),
      normalizeState(row),
      getZip(row),
    ].filter(Boolean).join(", ");

    const q = hasCoords ? `${lat},${lng}` : (address || getName(row));
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  async function fetchJsonOrNull(path) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function deepMerge(base, override) {
    // simple merge: override wins, objects merged shallowly
    const out = { ...(base || {}) };
    for (const k of Object.keys(override || {})) {
      const bv = out[k];
      const ov = override[k];
      if (bv && ov && typeof bv === "object" && typeof ov === "object" && !Array.isArray(bv) && !Array.isArray(ov)) {
        out[k] = { ...bv, ...ov };
      } else {
        out[k] = ov;
      }
    }
    return out;
  }

  // ---------- amenities (only the 3 ready icons) ----------
  const AMENITIES = [
    { key: "food", label: "Food", icon: "/img/icons/food.svg" },
    { key: "alcohol", label: "Alcohol", icon: "/img/icons/alcohol.svg" },
    { key: "taa", label: "TAA", icon: "/img/icons/taa.svg" }
  ];

  function renderAmenGrid(features) {
    const grid = $("#spAmenGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (features.noAlcohol) features.alcohol = false;

    const enabled = AMENITIES.filter(a => features[a.key] === true);
    enabled.forEach(a => {
      const tile = document.createElement("div");
      tile.className = "sp-amen";
      tile.innerHTML = `
        <div class="sp-amen-ico" aria-hidden="true"><img src="${a.icon}" alt="" /></div>
        <div class="sp-amen-label">${a.label}</div>
      `;
      grid.appendChild(tile);
    });

    const section = document.querySelector(".sp-amenities");
    if (section) section.style.display = enabled.length ? "" : "none";
  }

  function renderTop(shop) {
    const name = getName(shop);
    const slug = getSlug(shop);

    $("#spName").textContent = name || "Shop";
    const pill = $("#spPill");
    if (pill) pill.textContent = "SHOP";

    const city = getCity(shop);
    const state = normalizeState(shop);
    const cityLine = [city, state].filter(Boolean).join(", ");
    $("#spCity").textContent = cityLine || getAddress1(shop) || "";

    // Logo
    const logoEl = $("#spLogo");
    const key = getLogoKey(shop);
    const svgPath = `/img/icons/shops/${key}.svg`;
    const pngPath = `/img/icons/shops/${key}.png`;

    logoEl.src = svgPath;
    logoEl.alt = `${name || "Shop"} logo`;
    logoEl.onerror = function () {
      if (logoEl.src.endsWith(".svg")) {
        logoEl.src = pngPath;
        return;
      }
      logoEl.onerror = null;
      logoEl.src = "/img/icons/shops/default.png";
    };

    // TAA badge
    const taaIcon = $("#spTaaIcon");
    const features = getFeatures(shop);
    if (taaIcon) taaIcon.style.display = features.taa ? "" : "none";

    // Web
    const webA = $("#spWebsite");
    const websiteRaw = getWebsite(shop);
    if (webA) {
      if (websiteRaw) {
        const url = websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`;
        webA.href = url;
        webA.style.display = "";
      } else {
        webA.style.display = "none";
      }
    }

    // Clickable address (maps)
    const addrBtn = $("#spAddressBtn");
    if (addrBtn) {
      addrBtn.onclick = () => window.open(buildDirectionsUrl(shop), "_blank", "noopener");
    }

    // Dock: Call
    const callBtn = $("#spActCall");
    if (callBtn) {
      const phone = getPhone(shop);
      callBtn.style.display = phone ? "" : "none";
      callBtn.onclick = () => {
        if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      };
    }

    // Dock: Directions
    const dirBtn = $("#spActDir");
    if (dirBtn) {
      dirBtn.onclick = () => window.open(buildDirectionsUrl(shop), "_blank", "noopener");
    }

    // Dock: Instagram
    const igBtn = $("#spActInstagram");
    if (igBtn) {
      const ig = getInstagram(shop);
      if (!ig) {
        igBtn.style.display = "none";
      } else {
        igBtn.style.display = "";
        const handle = ig.replace(/^@/, "").trim();
        igBtn.onclick = () => window.open(`https://instagram.com/${encodeURIComponent(handle)}`, "_blank", "noopener");
      }
    }

    // Dock: Brands (optional)
    const brandsBtn = $("#spActBrands");
    if (brandsBtn) {
      brandsBtn.onclick = () => openBrandsModal(shop);
    }

    // Amenities grid
    renderAmenGrid(features);

    // Store current shop on window for debugging
    window.__shop = { slug, shop };
  }

  function openBrandsModal(shop) {
    const modal = $("#spBrandsModal");
    const grid = $("#spBrandsGrid");
    const closeBg = $("#spBrandsCloseBg");
    const closeBtn = $("#spBrandsCloseBtn");

    if (!modal || !grid) return;

    // Accept brands from:
    // - per-shop JSON: shop.brands (array)
    // - master: shop.brands (array) (optional)
    const brands = Array.isArray(shop.brands) ? shop.brands : [];

    grid.innerHTML = "";

    if (!brands.length) {
      grid.innerHTML = `<div class="sp-empty">Brands coming soon.</div>`;
    } else {
      brands.forEach(b => {
        // allow string or object
        const name = typeof b === "string" ? b : (b?.name || "");
        const icon = typeof b === "string" ? null : (b?.icon || null);

        const item = document.createElement("div");
        item.className = "sp-brand";
        item.innerHTML = icon
          ? `<img src="${icon}" alt="" /><div class="sp-brand-name">${name}</div>`
          : `<div class="sp-brand-name">${name}</div>`;
        grid.appendChild(item);
      });
    }

    modal.hidden = false;

    const close = () => { modal.hidden = true; };
    if (closeBg) closeBg.onclick = close;
    if (closeBtn) closeBtn.onclick = close;
  }

  async function boot() {
    const wanted = (getParam("shop") || "").trim().toLowerCase();

    try {
      const master = await fetchJsonOrNull("/shops/shops.json");
      if (!Array.isArray(master) || !master.length) throw new Error("Master shops.json missing/empty");

      // find in master by slug
      const base = master.find(s => getSlug(s).toLowerCase() === wanted) || null;
      if (!base) throw new Error(`Shop slug not found in master: ${wanted}`);

      // optional per-shop JSON (for brands/photos later)
      const per = await fetchJsonOrNull(`/data/shops/${wanted}.json`);
      const merged = per ? deepMerge(base, per) : base;

      renderTop(merged);
    } catch (err) {
      console.error(err);
      $("#spName").textContent = "Shop not found";
      $("#spCity").textContent = "City, ST";
      const taaIcon = $("#spTaaIcon");
      if (taaIcon) taaIcon.style.display = "none";
      const section = document.querySelector(".sp-amenities");
      if (section) section.style.display = "none";
    }
  }

  boot();
})();
