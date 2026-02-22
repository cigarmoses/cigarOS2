/* /shops/shop.js
   Public Shop Page (Top Card Layout v2)
   - Loads shop data from /shops/shops.json
   - Logo loads from /img/icons/shops/<sanitizedname>.svg (fallback .png)
   - Amenities render as ICON ROW (no labels), only if columns are checked
   - Address click opens Apple Maps directions (+ ETA)
   - Website button is a pill that always says "WEB"
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
    const lat = Number(shop.latitude ?? shop.lat);
    const lng = Number(shop.longitude ?? shop.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const addressParts = [
      toStr(shop.address1 || shop.address),
      toStr(shop.city),
      toStr(shop.state),
      toStr(shop.zip),
    ].filter(Boolean);

    const fallbackAddress = addressParts.join(", ");
    const q = hasCoords ? `${lat},${lng}` : (fallbackAddress || shop.name || "");
    const qEnc = encodeURIComponent(q);

    return `https://maps.apple.com/?daddr=${qEnc}&dirflg=d`;
  }

  // ---------- amenities ----------
  // Add icons here as you create them.
  // Keys must match your shops.json columns (case-insensitive handled below).
  const AMENITIES = [
    { key: "alcohol", label: "Alcohol", icon: "/img/icons/alcohol.svg" },
    { key: "byob", label: "BYOB", icon: "/img/icons/byob.svg" },          // if you add later
    { key: "noalcohol", label: "No Alcohol", icon: "/img/icons/noalcohol.svg" }, // if you add later
    { key: "food", label: "Food", icon: "/img/icons/food.svg" },
    { key: "tvs", label: "TVs", icon: "/img/icons/tv.svg" },              // if you add later
    { key: "outdoor", label: "Outdoor", icon: "/img/icons/outdoor.svg" }, // if you add later
    { key: "indoor", label: "Indoor", icon: "/img/icons/indoor.svg" },    // if you add later
    { key: "quiet", label: "Quiet", icon: "/img/icons/quiet.svg" },       // if you add later
    { key: "livemusic", label: "Live Music", icon: "/img/icons/livemusic.svg" }, // if you add later
    { key: "taa", label: "TAA", icon: "/img/icons/taa.svg" },
  ];

  function normalizeFeatureBag(shop) {
    // Supports:
    // A) shop.features = { food: true, alcohol: "x", ... }
    // B) flat columns directly on shop row: shop.Food, shop.Alcohol, etc.
    const bag = {};

    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[String(k).trim().toLowerCase()] = isTruthy(shop.features[k]);
      }
    }

    // Pull flat keys too (your sheet-style column names)
    for (const k of Object.keys(shop)) {
      const nk = String(k).trim().toLowerCase().replace(/\s+/g, "");
      // only map likely amenity keys
      if (AMENITIES.some(a => a.key === nk)) {
        bag[nk] = isTruthy(shop[k]);
      }
      // handle explicit "No Alcohol" override if column exists
      if (nk === "noalcohol") bag[nk] = isTruthy(shop[k]);
    }

    // No Alcohol overrides Alcohol
    if (bag.noalcohol === true) bag.alcohol = false;

    return bag;
  }

  function renderShop(shop) {
    // ---------- header ----------
    $("#spName").textContent = shop.name || shop.Shop || "Shop";
    $("#spPill").textContent = "SHOP";

    // City line text
    const cityLine =
      [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
        .filter(Boolean)
        .join(", ") ||
      toStr(shop.address1 || shop.Address || "") ||
      "";

    $("#spCity").textContent = cityLine;

    // ---------- logo ----------
    const logoEl = $("#spLogo");
    const shopName = shop.name || shop.Shop || "Shop";
    const base = sanitizeLogoName(shopName);
    const svgPath = `/img/icons/shops/${base}.svg`;
    const pngPath = `/img/icons/shops/${base}.png`;

    logoEl.src = svgPath;
    logoEl.alt = `${shopName} logo`;

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

    // ---------- website (WEB pill) ----------
    const webEl = $("#spWebsite");
    const rawWebsite = toStr(shop.website || shop.Website);

    if (rawWebsite) {
      const url = rawWebsite.startsWith("http") ? rawWebsite : `https://${rawWebsite}`;
      webEl.href = url;
      webEl.style.display = "";
    } else {
      webEl.style.display = "none";
      webEl.removeAttribute("href");
    }

    // ---------- follow (UI only for now) ----------
    const followBtn = $("#spFollowBtn");
    followBtn.addEventListener("click", () => {
      const t = $("#spFollowText");
      const isFollowing = followBtn.getAttribute("data-following") === "1";
      followBtn.setAttribute("data-following", isFollowing ? "0" : "1");
      t.textContent = isFollowing ? "Follow" : "Following";
    });

    // ---------- amenities row ----------
    const features = normalizeFeatureBag(shop);

    const row = $("#spAmenRow");
    row.innerHTML = "";

    const enabled = AMENITIES.filter(a => features[a.key] === true);

    enabled.forEach(a => {
      const img = document.createElement("img");
      img.className = "sp-amen-icon";
      img.src = a.icon;
      img.alt = a.label;

      // If an icon file doesn't exist yet, fail silently by hiding it
      img.onerror = () => { img.remove(); };

      row.appendChild(img);
    });

    row.style.display = enabled.length ? "flex" : "none";
  }

  async function boot() {
    const slug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);
      const list = await res.json();

      const shop =
        list.find(s => String(s.slug || "").toLowerCase() === slug) ||
        list.find(s => String(s.Shop || s.name || "").toLowerCase().includes(slug)) ||
        list[0];

      if (!shop) throw new Error("No shops found in shops.json");

      renderShop(shop);
    } catch (err) {
      console.error(err);
      $("#spName").textContent = "Shop not found";
      $("#spPill").textContent = "SHOP";
      $("#spAddressBtn").style.display = "none";
      $("#spWebsite").style.display = "none";
      $("#spAmenRow").style.display = "none";
    }
  }

  boot();
})();
