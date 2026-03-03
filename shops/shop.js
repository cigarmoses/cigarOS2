/* /shops/shop.js
   Public Shop Page (TOP section only) — Supports BOTH schemas:
   A) NEW clean schema (recommended):
      { slug, name, logoKey, address1, city, state, zip, phone, website, email, instagram, lat, lng, hours:{mon..sun}, features:{...} }

   B) Old spreadsheet schema:
      { Shop, Address, City, ST/State, Zip, Phone, Website, Email, Instagram, Latitude, Longitude, Monday..Sunday, Alcohol, Food, TAA, "No Alcohol"/"No alcohol", ... }

   Logos:
   /img/icons/shops/<logoKey>.svg (fallback .png)
   If no logoKey, derives from name.
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

  function isTruthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return ["1", "true", "t", "yes", "y", "x", "✓", "check", "checked"].includes(s);
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

  function normalizeState(row) {
    // NEW schema uses row.state; old uses ST/State
    const st = toStr(row.state || row.ST);
    const state = toStr(row.State);
    return (st || state).toUpperCase();
  }

  function getName(row) {
    return toStr(row.name || row.Shop);
  }

  function getSlug(row) {
    return toStr(row.slug) || slugify(getName(row));
  }

  function getLogoKey(row) {
    // NEW schema: logoKey; fallback: derive from name
    return toStr(row.logoKey) || sanitizeLogoKey(getName(row));
  }

  function getAddress1(row) {
    return toStr(row.address1 || row.Address);
  }

  function getCity(row) {
    return toStr(row.city || row.City);
  }

  function getZip(row) {
    return toStr(row.zip || row.Zip);
  }

  function getPhone(row) {
    return toStr(row.phone || row.Phone);
  }

  function getWebsite(row) {
    return toStr(row.website || row.Website);
  }

  function getEmail(row) {
    return toStr(row.email || row.Email);
  }

  function getInstagram(row) {
    return toStr(row.instagram || row.Instagram);
  }

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
    // NEW schema
    if (row.hours && typeof row.hours === "object") return row.hours;

    // OLD schema
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
    // NEW schema
    if (row.features && typeof row.features === "object") return row.features;

    // OLD schema (best-effort)
    const noAlcohol =
      isTruthy(row["No Alcohol"]) || isTruthy(row["No alcohol"]) || isTruthy(row["NoAlcohol"]);

    const features = {
      food: isTruthy(row.Food),
      alcohol: isTruthy(row.Alcohol),
      taa: isTruthy(row.TAA),
      byob: isTruthy(row.BYOB),
      noAlcohol
    };

    // override
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

  // Only icons you said are READY right now:
  const AMENITIES = [
    { key: "food", label: "Food", icon: "/img/icons/food.svg" },
    { key: "alcohol", label: "Alcohol", icon: "/img/icons/alcohol.svg" },
    { key: "taa", label: "TAA", icon: "/img/icons/taa.svg" }
  ];

  function renderTop(row) {
    const name = getName(row);
    const state = normalizeState(row);
    const city = getCity(row);

    $("#spName").textContent = name || "Shop";
    $("#spPill").textContent = "SHOP";

    const cityLine = [city, state].filter(Boolean).join(", ");
    $("#spCity").textContent = cityLine || getAddress1(row) || "";

    // Website
    const webEl = $("#spWebsite");
    const websiteRaw = getWebsite(row);
    if (websiteRaw) {
      const url = websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`;
      webEl.textContent = url.replace(/^https?:\/\//, "");
      webEl.href = url;
      webEl.style.display = "";
    } else {
      webEl.style.display = "none";
    }

    // Logo
    const logoEl = $("#spLogo");
    const key = getLogoKey(row);
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

    // Address click -> Apple Maps
    $("#spAddressBtn").onclick = () => {
      window.open(buildDirectionsUrl(row), "_blank", "noopener");
    };

    // Follow toggle placeholder
    const followBtn = $("#spFollowBtn");
    followBtn.onclick = () => {
      const t = $("#spFollowText");
      const isFollowing = followBtn.getAttribute("data-following") === "1";
      followBtn.setAttribute("data-following", isFollowing ? "0" : "1");
      t.textContent = isFollowing ? "Follow" : "Following";
    };

    // More
    $("#spMoreBtn").onclick = () => alert("More options (v1 placeholder)");

    // Amenities GRID
    const grid = $("#spAmenGrid");
    grid.innerHTML = "";

    const features = getFeatures(row);

    // No Alcohol overrides Alcohol (NEW schema already should be correct, but enforce anyway)
    if (features.noAlcohol) features.alcohol = false;

    const enabled = AMENITIES.filter(a => features[a.key] === true);
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

    document.querySelector(".sp-amenities").style.display = enabled.length ? "" : "none";
  }

  async function boot() {
    const wantedSlug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);

      const list = await res.json();
      if (!Array.isArray(list) || !list.length) throw new Error("No shops in shops.json");

      const row =
        list.find(r => getSlug(r).toLowerCase() === wantedSlug) ||
        list[0];

      if (!row) throw new Error("No matching shop");

      renderTop(row);
    } catch (err) {
      console.error(err);
      $("#spName").textContent = "Shop not found";
      $("#spPill").textContent = "SHOP";
      $("#spAddressBtn").style.display = "none";
      $("#spWebsite").style.display = "none";
      document.querySelector(".sp-amenities").style.display = "none";
    }
  }

  boot();
})();
