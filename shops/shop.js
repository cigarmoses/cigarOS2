/* /shops/shop.js
   Public Shop Page (Centered Layout v4)

   Updates:
   ✅ Shop name forced to max 2 lines + auto font sizing based on length
   ✅ For the current example, force status pill to OPEN
   ✅ Amenities panel uses white background (CSS)
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

    if (shop.features && typeof shop.features === "object") {
      for (const k of Object.keys(shop.features)) {
        bag[normalizeKey(k)] = isTruthy(shop.features[k]);
      }
    }

    for (const k of Object.keys(shop)) {
      const nk = normalizeKey(k);
      if (AMENITIES.some(a => a.key === nk)) {
        bag[nk] = isTruthy(shop[k]);
      }
    }

    if (bag.noalcohol === true) bag.alcohol = false;
    return bag;
  }

  // ---- name formatting: max 2 lines + auto sizing ----
  function splitNameTwoLines(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) return [words.join(" "), ""].filter(Boolean);

    // Greedy balance by character count
    const total = words.join(" ").length;
    let bestIdx = 1;
    let bestDiff = Infinity;

    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const diff = Math.abs(a.length - b.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    const line1 = words.slice(0, bestIdx).join(" ");
    const line2 = words.slice(bestIdx).join(" ");
    return [line1, line2];
  }

  function applyNameClampAndSize(el, name) {
    // Always render in at most 2 lines
    const [l1, l2] = splitNameTwoLines(name);
    el.innerHTML = l2 ? `${escapeHtml(l1)}<br>${escapeHtml(l2)}` : escapeHtml(l1);

    // Auto size based on length (simple, predictable)
    const len = String(name || "").length;

    // Base sizes tuned to your layout
    // Short names: big / Long names: smaller
    let px = 44;
    if (len > 18) px = 40;
    if (len > 26) px = 36;
    if (len > 34) px = 32;
    if (len > 44) px = 28;

    el.style.fontSize = `${px}px`;
    el.style.lineHeight = "1.05";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderShop(shop) {
    const shopName = shop.name || shop.Shop || "Shop";

    // Name: max 2 lines + auto-sized
    applyNameClampAndSize($("#spName"), shopName);

    // City line
    const cityLine =
      [toStr(shop.city || shop.City), toStr(shop.state || shop.ST || shop.State)]
        .filter(Boolean)
        .join(", ");

    $("#spCity").textContent = cityLine || "—";

    // ✅ Force OPEN for this example (per your instruction)
    const statusEl = $("#spStatusPill");
    statusEl.textContent = "OPEN";
    statusEl.setAttribute("data-status", "open");

    // TAA icon only if true
    const features = normalizeFeatures(shop);
    const taaEl = $("#spTaaIcon");
    taaEl.style.display = features.taa === true ? "" : "none";

    // Logo load
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

    // Maps click
    $("#spAddressBtn").addEventListener("click", () => {
      window.open(buildDirectionsUrl(shop), "_blank", "noopener");
    });

    // Amenities row inside panel
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

    $("#spAmenPanel").style.display = enabled.length ? "" : "none";
  }

  async function boot() {
    const slug = (getParam("shop") || "").trim().toLowerCase();

    try {
      const res = await fetch("/shops/shops.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`shops.json HTTP ${res.status}`);
      const list = await res.json();

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

      const statusEl = $("#spStatusPill");
      statusEl.textContent = "OPEN";
      statusEl.setAttribute("data-status", "open");
    }
  }

  boot();
})();
