/* /shops/shop.js
   Public Shop Page (TOP section only) — Spreadsheet JSON compatible
   Works with your exact keys:
   Alcohol, BYOB, No Alcohol, Food, TVs, Outdoor, Indoor, Quiet, Live Music, Chain, TAA,
   Shop, Address, City, ST, State, Zip, Phone, Latitude, Longitude,
   Monday..Sunday, Website, Email, Instagram, etc.

   Logo rule:
   /img/icons/shops/<sanitized shop name>.svg  (fallback .png)
   Example: "Fanatix cigar house" -> fanatixcigarhouse.svg

   Data file:
   /shops/shops.json  (recommended)
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

  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function slugify(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeState(row) {
    const st = toStr(row.ST);
    const state = toStr(row.State);
    return (st || state).toUpperCase();
  }

  function buildDirectionsUrl(row) {
    const lat = Number(row.Latitude);
    const lng = Number(row.Longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const address = [
      toStr(row.Address),
      toStr(row.City),
      normalizeState(row),
      toStr(row.Zip),
    ].filter(Boolean).join(", ");

    const q = hasCoords ? `${lat},${lng}` : (address || toStr(row.Shop));
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // Only icons you said are READY right now:
  const AMENITIES = [
    { key: "Food", label: "Food", icon: "/img/icons/food.svg" },
    { key: "Alcohol", label: "Alcohol", icon: "/img/icons/alcohol.svg" },
    { key: "TAA", label: "TAA", icon: "/img/icons/taa.svg" },
    // Later you’ll add more icons + keys here:
    // { key:"BYOB", label:"BYOB", icon:"/img/icons/byob.svg" }, etc.
  ];

  function renderTop(row) {
    // Title + SHOP pill
    $("#spName").textContent = toStr(row.Shop) || "Shop";
    $("#spPill").textContent = "SHOP";

    // Address line (clickable)
    const cityLine = [toStr(row.City), normalizeState(row)].filter(Boolean).join(", ");
    $("#spCity").textContent = cityLine || toStr(row.Address) || "";

    // Website
    const webEl = $("#spWebsite");
    const websiteRaw = toStr(row.Website);
    if (websiteRaw) {
      const url = websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`;
      webEl.textContent = url.replace(/^https?:\/\//, "");
      webEl.href = url;
      webEl.style.display = "";
    } else {
      webEl.style.display = "none";
    }

    // Logo (svg -> png -> default)
    const logoEl = $("#spLogo");
    const base = sanitizeLogoName(row.Shop);
    const svgPath = `/img/icons/shops/${base}.svg`;
    const pngPath = `/img/icons/shops/${base}.png`;

    logoEl.src = svgPath;
    logoEl.alt = `${toStr(row.Shop) || "Shop"} logo`;
    logoEl.onerror = function () {
      if (logoEl.src.endsWith(".svg")) {
        logoEl.src = pngPath;
        return;
      }
      logoEl.onerror = null;
      logoEl.src = "/img/icons/shops/default.png";
    };

    // Address click -> Apple Maps directions
    $("#spAddressBtn").onclick = () => {
      window.open(buildDirectionsUrl(row), "_blank", "noopener");
    };

    // Follow (UI toggle placeholder)
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

    // No Alcohol overrides Alcohol
    const noAlcohol = isTruthy(row["No Alcohol"]);
    const alcohol = noAlcohol ? false : isTruthy(row.Alcohol);

    const enabled = AMENITIES.filter(a => {
      if (a.key === "Alcohol") return alcohol === true;
      return isTruthy(row[a.key]);
    });

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

      // Match by slugified Shop name
      const row =
        list.find(r => slugify(r.Shop) === wantedSlug) ||
        list.find(r => toStr(r.Shop).toLowerCase() === wantedSlug) ||
        list[0];

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
