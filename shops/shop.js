/* /shops/shop.js
   Public Shop Page (TOP section only for v1)

   Features:
   - Loads a shop by slug (?shop=smoke-inn-psl)
   - Renders header + actions + amenity tiles
   - Address click opens Maps (directions + ETA)
   - Amenities render ONLY if that field is truthy (x/X/true/1/yes/y)

   NOTE:
   Replace SHOPS_DB with your real "master list" source later:
   - JSON file
   - Google Sheet CSV
   - API
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---------- helpers ----------
  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1","true","t","yes","y","x","✓","check","checked"].includes(s);
  }

  // Build a directions URL. Prefer Apple Maps on iOS/macOS; Google Maps elsewhere is fine too.
  function buildDirectionsUrl({ address, lat, lng, name }) {
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const q = hasCoords ? `${lat},${lng}` : (address || name || "");
    const qEnc = encodeURIComponent(q);

    // Apple Maps directions (best UX on iOS)
    // daddr = destination
    return `https://maps.apple.com/?daddr=${qEnc}&dirflg=d`;
  }

  // ---------- amenity config ----------
  // Put your actual SVGs here.
  // Recommended path: /img/icons/amenities/<key>.svg
  const AMENITIES = [
    { key: "food", label: "Food", icon: "/img/icons/amenities/food.svg" },
    { key: "alcohol", label: "Alcohol", icon: "/img/icons/amenities/alcohol.svg" },
    { key: "byob", label: "BYOB", icon: "/img/icons/amenities/byob.svg" },
    { key: "tvs", label: "TVs", icon: "/img/icons/amenities/tvs.svg" },
    { key: "indoorSeating", label: "Indoor seating", icon: "/img/icons/amenities/indoor-seating.svg" },
    { key: "outdoorSeating", label: "Outdoor seating", icon: "/img/icons/amenities/outdoor-seating.svg" },
    { key: "onlineOrdering", label: "Online ordering", icon: "/img/icons/amenities/online-ordering.svg" },
    { key: "byoc", label: "BYOC (cigar)", icon: "/img/icons/amenities/byoc.svg" },
    { key: "quietSpace", label: "Quiet space available", icon: "/img/icons/amenities/quiet-space.svg" },
  ];

  // ---------- temporary local DB (replace with master list) ----------
  const SHOPS_DB = [
    {
      slug: "smoke-inn-psl",
      name: "Smoke Inn PSL",
      pill: "SHOP",
      cityLine: "Port Saint Lucie, FL",
      website: "https://smokeinn.com",
      address: "Smoke Inn PSL, Port Saint Lucie, FL",
      lat: null,
      lng: null,
      logo: "/img/shops/smoke-inn-psl/logo.png",

      // Amenities (only render if checked)
      food: "x",
      alcohol: "x",
      byob: "",
      tvs: "x",
      indoorSeating: "x",
      outdoorSeating: "x",
      onlineOrdering: "x",
      byoc: "x",
      quietSpace: "",
    },
  ];

  function getShopBySlug(slug) {
    return SHOPS_DB.find(s => s.slug === slug) || null;
  }

  // ---------- render ----------
  function renderShop(shop) {
    // Header
    $("#spName").textContent = shop.name || "Shop";
    $("#spPill").textContent = (shop.pill || "SHOP").toUpperCase();

    const logoEl = $("#spLogo");
    logoEl.src = shop.logo || "/img/shops/default-logo.png";
    logoEl.alt = `${shop.name || "Shop"} logo`;

    // Address line (click -> maps)
    $("#spCity").textContent = shop.cityLine || "";

    const addressBtn = $("#spAddressBtn");
    addressBtn.addEventListener("click", () => {
      const url = buildDirectionsUrl(shop);
      window.open(url, "_blank", "noopener");
    });

    // Website
    const webEl = $("#spWebsite");
    if (shop.website) {
      webEl.textContent = shop.website.replace(/^https?:\/\//, "");
      webEl.href = shop.website;
      webEl.style.display = "";
    } else {
      webEl.style.display = "none";
    }

    // Follow button (v1 UI only)
    const followBtn = $("#spFollowBtn");
    followBtn.addEventListener("click", () => {
      // Replace with your CigarSocial follow action later.
      // For now just toggle UI state.
      const t = $("#spFollowText");
      const isFollowing = followBtn.getAttribute("data-following") === "1";
      followBtn.setAttribute("data-following", isFollowing ? "0" : "1");
      t.textContent = isFollowing ? "Follow" : "Following";
    });

    // More button (placeholder)
    $("#spMoreBtn").addEventListener("click", () => {
      // Later: share, report, copy link, etc.
      alert("More options (v1 placeholder)");
    });

    // Amenities (conditional)
    const grid = $("#spAmenGrid");
    grid.innerHTML = "";

    const enabled = AMENITIES.filter(a => isTruthy(shop[a.key]));
    enabled.forEach(a => {
      const tile = document.createElement("div");
      tile.className = "sp-amen";
      tile.innerHTML = `
        <div class="sp-amen-ico" aria-hidden="true">
          <img src="${a.icon}" alt="" />
        </div>
        <div class="sp-amen-label">${a.label}</div>
      `;
      grid.appendChild(tile);
    });

    // If none enabled, hide section
    const amenitiesSection = document.querySelector(".sp-amenities");
    amenitiesSection.style.display = enabled.length ? "" : "none";
  }

  // ---------- boot ----------
  const slug = (getParam("shop") || "smoke-inn-psl").trim();
  const shop = getShopBySlug(slug);

  if (!shop) {
    $("#spName").textContent = "Shop not found";
    $("#spPill").textContent = "SHOP";
    $("#spAddressBtn").style.display = "none";
    $("#spWebsite").style.display = "none";
    document.querySelector(".sp-amenities").style.display = "none";
    return;
  }

  renderShop(shop);
})();
