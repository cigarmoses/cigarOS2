/* /shops/shop.js
   Public Shop Page (TOP section only)
   - Loads shop data from /shops/shops.json
   - Logo loads from /img/icons/shops/<sanitizedname>.svg (fallback .png)
   - Amenities render in GRID, only if columns are checked
   - Address click opens Apple Maps directions (+ ETA)
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
    // match your repo filenames: lowercase, no spaces, no punctuation
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function buildDirectionsUrl(shop) {
    // Prefer coords if present
    const lat = shop.lat;
    const lng = shop.lng;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const addressParts = [
      toStr(shop.address1),
      toStr(shop.city),
      toStr(shop.state),
      toStr(shop.zip),
    ].filter(Boolean);

    const fallbackAddress = addressParts.join(", ");
    const q = hasCoords ? `${lat},${lng}` : (fallbackAddress || shop.name || "");
    const qEnc = encodeURIComponent(q);

    // Apple Maps directions (best iOS UX)
    return `https://maps.apple.com/?daddr=${qEnc}&dirflg=d`;
  }

  // ---------- amenities ----------
  // Only include icons you actually have right now.
  // As you add more icons, just extend this list.
  const AMENITIES = [
    { key: "food", label: "Food", icon: "/img/icons/food.svg" },
    { key: "alcohol", label: "Alcohol", icon: "/img/icons/alcohol.svg" },
    { key: "taa", label: "TAA", icon: "/img/icons/taa.svg" },
  ];

  function renderShop(shop) {
    // ---------- header ----------
    $("#spName").textContent = shop.name || "Shop";
    $("#spPill").textContent = "SHOP"; // outline pill handled in CSS

    // Address line text (clickable)
    const cityLine =
      [toStr(shop.city), toStr(shop.state)].filter(Boolean).join(", ") ||
      toStr(shop.address1) ||
      "";

    $("#spCity").textContent = cityLine;

    // Website
    const webEl = $("#spWebsite");
    if (shop.website) {
      const url = shop.website.startsWith("http")
        ? shop.website
        : `https://${shop.website}`;
      webEl.textContent = url.replace(/^https?:\/\//, "");
      webEl.href = url;
      webEl.style.display = "";
    } else {
      webEl.style.display = "none";
    }

    // ---------- logo ----------
    const logoEl = $("#spLogo");
    const base = sanitizeLogoName(shop.name);
    const svgPath = `/img/icons/shops/${base}.svg`;
    const pngPath = `/img/icons/shops/${base}.png`;

    logoEl.src = svgPath;
    logoEl.alt = `${shop.name || "Shop"} logo`;

    // fallback chain: svg -> png -> default
    logoEl.onerror = function () {
      if (logoEl.src.endsWith(".svg")) {
        logoEl.src = pngPath;
        return;
      }
      logoEl.onerror = null;
      logoEl.src = "/img/icons/shops/default.png";
    };

    // ---------- address click -> maps ----------
    const addressBtn = $("#spAddressBtn");
    addressBtn.addEventListener("click", () => {
      const url = buildDirectionsUrl(shop);
      window.open(url, "_blank", "noopener");
    });

    // ---------- follow (UI only for now) ----------
    const followBtn = $("#spFollowBtn");
    followBtn.addEventListener("click", () => {
      const t = $("#spFollowText");
      const isFollowing = followBtn.getAttribute("data-following") === "1";
      followBtn.setAttribute("data-following", isFollowing ? "0" : "1");
      t.textContent = isFollowing ? "Follow" : "Following";
    });

    // ---------- more (placeholder) ----------
    $("#spMoreBtn").addEventListener("click", () => {
      alert("More options (v1 placeholder)");
    });

    // ---------- features logic ----------
    // Support both formats:
    // A) features nested: shop.features.food
    // B) flat keys: shop.food
    const features = shop.features && typeof shop.features === "object"
      ? { ...shop.features }
      : {
          food: isTruthy(shop.food),
          alcohol: isTruthy(shop.alcohol),
          noAlcohol: isTruthy(shop.noAlcohol),
          taa: isTruthy(shop.taa),
        };

    // No Alcohol overrides Alcohol
    if (features.noAlcohol) features.alcohol = false;

    // ---------- amenities grid ----------
    const grid = $("#spAmenGrid");
    grid.innerHTML = "";

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

    // hide section if none
    document.querySelector(".sp-amenities").style.display = enabled.length ? "" : "none";
  }

  async function boot() {
    const slug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);
      const list = await res.json();

      // Find by slug, else first record
      const shop =
        list.find(s => String(s.slug || "").toLowerCase() === slug) ||
        list[0];

      if (!shop) throw new Error("No shops found in shops.json");

      renderShop(shop);
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
