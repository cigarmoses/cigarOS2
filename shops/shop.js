/* /shops/shop.js
   Public Shop Page (Centered Layout v3)

   - Loads shop data from /shops/shops.json
   - Logo loads from /img/icons/shops/<sanitizedname>.svg (fallback .png)
   - Layout matches centered mock:
       • Logo centered
       • Name centered
       • City/state under in gray + GPS
       • Top-right OPEN/CLOSED
       • TAA icon under OPEN/CLOSED if applicable
       • Amenities inside rounded gray panel

   Live example requested: Fox Cigar Bar
   -> Use URL like: /shops/shop.html?shop=foxcigarbar
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

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
    return ["1", "true", "t", "yes", "y", "x", "✓", "check", "checked", "open"].includes(s);
  }

  function sanitizeLogoName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function buildDirectionsUrl(shop) {
    const lat = Number(shop.latitude ?? shop.lat ?? shop.Latitude);
    const lng = Number(shop.longitude ?? shop.lng ?? shop.Longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const addressParts = [
      toStr(shop.address1 || shop.address || shop.Address),
      toStr(shop.city || shop.City),
      toStr(shop.state || shop.ST || shop.State),
      toStr(shop.zip || shop.Zip),
    ].filter(Boolean);

    const fallbackAddress = addressParts.join(", ");
    const q = hasCoords ? `${lat},${lng}` : (fallbackAddress || shop.name || shop.Shop || "");
    return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }

  // Amenity icon mapping (add icons as you create them)
  // Keys must match normalized column names:
  // Alcohol, BYOB, Food, TVs, Outdoor, Indoor, Quiet, Live Music, TAA
  const AMENITIES = [
    { key: "alcohol", icon: "/img/icons/alcohol.svg", label: "Alcohol" },
    { key: "byob", icon: "/img/icons/byob.svg", label: "BYOB" },
    { key: "noalcohol", icon: "/img/icons/noalcohol.svg", label: "No Alcohol" },
    { key: "food", icon: "/img/icons/food.svg", label: "Food" },
    { key: "tvs", icon: "/img/icons/tv.svg", label: "TVs" },
    { key: "outdoor", icon: "/img/icons/outdoor.svg", label: "Outdoor" },
    { key: "indoor", icon: "/img/icons/indoor.svg", label: "Indoor" },
    { key: "quiet", icon: "/img/icons/quiet.svg", label: "Quiet" },
    { key: "livemusic", icon: "/img/icons/livemusic.svg", label: "Live Music" },
    { key: "taa", icon: "/img/icons/taa.svg", label: "TAA" },
  ];

  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeFeatures(shop) {
    const bag = {};

    // nested features object support
    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    // flat columns support (sheet-style)
    for (const k of Object.keys(shop)) {
      const nk = normalizeKey(k);
      if (AMENITIES.some(a => a.key === nk)) {
        bag[nk] = isTruthy(shop[k]);
      }
      // also catch common variants
      if (nk === "liveMusic") bag.livemusic = isTruthy(shop[k]);
    }

    // No Alcohol overrides Alcohol
    if (bag.noalcohol === true) bag.alcohol = false;

    return bag;
  }

  function getOpenClosed(shop) {
    // Supports these fields (any truthy = OPEN):
    // open, isOpen, status, Open, Closed (if closed truthy => CLOSED)
    const closed = isTruthy(shop.closed ?? shop.Closed);
    if (closed) return "CLOSED";

    const open =
      isTruthy(shop.open ?? shop.isOpen ?? shop.Open) ||
      String(shop.status || shop.Status || "").trim().toLowerCase() === "open";

    return open ? "OPEN" : "CLOSED";
  }

  function renderShop(shop) {
    const shopName = shop.name || shop.Shop || "Shop";
    $("#spName").textContent = shopName;

    // city line
    const cityLine =
      [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
        .filter(Boolean)
        .join(", ") || "";

    $("#spCity").textContent = cityLine || "—";

    // status pill
    const status = getOpenClosed(shop);
    const statusEl = $("#spStatusPill");
    statusEl.textContent = status;
    statusEl.setAttribute("data-status", status.toLowerCase());

    // TAA icon (only if true)
    const features = normalizeFeatures(shop);
    const taaEl = $("#spTaaIcon");
    if (features.taa === true) {
      taaEl.style.display = "";
    } else {
      taaEl.style.display = "none";
    }

    // logo load
    const logoEl = $("#spLogo");
    const base = sanitizeLogoName(shopName);
    const svgPath = `/img/icons/shops/${base}.svg`;
    const pngPath = `/img/icons/shops/${base}.png`;

    logoEl.src = svgPath;
    logoEl.alt = `${shopName} logo`;

    logoEl.onerror = function () {
      if (logoEl.src.endsWith(".svg")) {
        logoEl.src = pngPath;
        return;
      }
      logoEl.onerror = null;
      logoEl.src = "/img/icons/shops/default.png";
    };

    // maps click
    $("#spAddressBtn").addEventListener("click", () => {
      window.open(buildDirectionsUrl(shop), "_blank", "noopener");
    });

    // amenities row inside panel
    const row = $("#spAmenRow");
    row.innerHTML = "";

    const enabled = AMENITIES.filter(a => features[a.key] === true);

    enabled.forEach(a => {
      const img = document.createElement("img");
      img.className = "sp-amen-icon";
      img.src = a.icon;
      img.alt = a.label;
      img.onerror = () => img.remove(); // hide missing icons safely
      row.appendChild(img);
    });

    const panel = $("#spAmenPanel");
    panel.style.display = enabled.length ? "" : "none";
  }

  async function boot() {
    const slug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);
      const list = await res.json();

      // Prefer slug match, then name match
      const shop =
        list.find(s => String(s.slug || "").toLowerCase() === slug) ||
        list.find(s => sanitizeLogoName(s.name || s.Shop) === sanitizeLogoName(slug)) ||
        list.find(s => String(s.name || s.Shop || "").toLowerCase().includes(slug)) ||
        list[0];

      if (!shop) throw new Error("No shops found in shops.json");
      renderShop(shop);
    } catch (err) {
      console.error(err);
      $("#spName").textContent = "Shop not found";
      $("#spCity").textContent = "—";
      $("#spAmenPanel").style.display = "none";
      $("#spTaaIcon").style.display = "none";
      $("#spStatusPill").textContent = "CLOSED";
      $("#spStatusPill").setAttribute("data-status", "closed");
    }
  }

  boot();
})();
