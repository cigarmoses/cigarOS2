(() => {
  "use strict";

  /*
    IMPORTANT:
    Replace this with your real Mapbox public token.
    Mapbox dashboard → Tokens → Default public token.
  */
  mapboxgl.accessToken = "PASTE_YOUR_MAPBOX_PUBLIC_TOKEN_HERE";

  const SHOPS_URL = "/shops/shops.json";
  const DEFAULT_CENTER = [-80.1918, 25.7617]; // Florida-ish default
  const DEFAULT_ZOOM = 6.4;

  const $ = (sel) => document.querySelector(sel);

  let map;
  let shops = [];
  let activeShop = null;
  let activeMarkerEl = null;
  const markers = [];

  function clean(v) {
    return String(v ?? "").trim();
  }

  function keyify(s) {
    return clean(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function num(v) {
    const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function getLat(shop) {
    return (
      num(shop.lat) ??
      num(shop.latitude) ??
      num(shop.Latitude) ??
      num(shop.LAT) ??
      num(shop.coords?.lat) ??
      num(shop.coordinates?.lat)
    );
  }

  function getLng(shop) {
    return (
      num(shop.lng) ??
      num(shop.lon) ??
      num(shop.longitude) ??
      num(shop.Longitude) ??
      num(shop.LNG) ??
      num(shop.coords?.lng) ??
      num(shop.coords?.lon) ??
      num(shop.coordinates?.lng) ??
      num(shop.coordinates?.lon)
    );
  }

  function shopName(shop) {
    return clean(shop.name || shop.Shop || shop.shop || "Shop");
  }

  function shopCityState(shop) {
    const city = clean(shop.city || shop.City);
    const state = clean(shop.state || shop.ST || shop.State);
    return [city, state].filter(Boolean).join(", ");
  }

  function shopKey(shop) {
    return keyify(shop.logoKey || shop.slug || shop.Slug || shop.slug_id || shopName(shop));
  }

  function shopUrl(shop) {
    return `/shops/shop-page.html?shop=${encodeURIComponent(shopKey(shop))}`;
  }

  function logoUrl(shop) {
    return `/img/icons/shops/${encodeURIComponent(shopKey(shop))}.svg`;
  }

  function normalizeHours(shop) {
    const h = shop.hours && typeof shop.hours === "object" ? shop.hours : {};
    return {
      sun: clean(h.sun || h.Sunday || shop.sun || shop.Sunday),
      mon: clean(h.mon || h.Monday || shop.mon || shop.Monday),
      tue: clean(h.tue || h.Tuesday || shop.tue || shop.Tuesday),
      wed: clean(h.wed || h.Wednesday || shop.wed || shop.Wednesday),
      thu: clean(h.thu || h.Thursday || shop.thu || shop.Thursday),
      fri: clean(h.fri || h.Friday || shop.fri || shop.Friday),
      sat: clean(h.sat || h.Saturday || shop.sat || shop.Saturday),
    };
  }

  function parseTime(str) {
    const s = clean(str);
    const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!m) return null;

    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ap = m[3].toUpperCase();

    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;

    return h * 60 + min;
  }

  function computeStatus(shop) {
    const hours = normalizeHours(shop);
    const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
    const today = clean(hours[key]);

    if (!today || today === "—") return null;

    const parts = today.split("-").map((s) => s.trim());
    if (parts.length !== 2) return null;

    let open = parseTime(parts[0]);
    let close = parseTime(parts[1]);

    if (open == null || close == null) return null;

    const now = new Date();
    let nowMin = now.getHours() * 60 + now.getMinutes();

    if (close < open) {
      close += 1440;
      if (nowMin < open) nowMin += 1440;
    }

    const isOpen = nowMin >= open && nowMin <= close;

    return {
      open: isOpen,
      label: isOpen ? `Open • Closes ${parts[1]}` : `Closed • Opens ${parts[0]}`
    };
  }

  async function loadShops() {
    const res = await fetch(`${SHOPS_URL}?v=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();

    shops = (Array.isArray(data) ? data : [])
      .map((shop) => {
        const lat = getLat(shop);
        const lng = getLng(shop);
        return { ...shop, _lat: lat, _lng: lng };
      })
      .filter((shop) => Number.isFinite(shop._lat) && Number.isFinite(shop._lng));
  }

  function initMap() {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 64,
      bearing: -18,
      antialias: true,
      attributionControl: false
    });

    map.on("load", () => {
      applyPremiumStyle();
      add3DBuildings();
      addShopMarkers();
      fitToShops();
    });
  }

  function applyPremiumStyle() {
    const layers = map.getStyle().layers || [];

    layers.forEach((layer) => {
      const id = layer.id;

      if (id.includes("water")) {
        map.setPaintProperty(id, "fill-color", "#9ed7ee");
        map.setPaintProperty(id, "fill-opacity", 1);
        return;
      }

      if (id.includes("land") || id.includes("background")) {
        if (layer.type === "background") {
          map.setPaintProperty(id, "background-color", "#e9e9ea");
        }

        if (layer.type === "fill") {
          map.setPaintProperty(id, "fill-color", "#ededee");
        }
      }

      if (id.includes("road")) {
        if (layer.type === "line") {
          map.setPaintProperty(id, "line-color", "#b9b9bd");
          map.setPaintProperty(id, "line-opacity", .72);
        }
      }

      if (
        id.includes("poi") ||
        id.includes("transit") ||
        id.includes("label") ||
        id.includes("settlement") ||
        id.includes("airport")
      ) {
        map.setLayoutProperty(id, "visibility", "none");
      }
    });

    map.setFog({
      color: "#ffffff",
      "high-color": "#d7d7da",
      "horizon-blend": 0.18
    });
  }

  function add3DBuildings() {
    const layers = map.getStyle().layers;
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
    )?.id;

    if (map.getLayer("cigaros-3d-buildings")) return;

    map.addLayer(
      {
        id: "cigaros-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "height"],
            0, "#d8d8da",
            80, "#a7a7ab",
            180, "#6f6f75"
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0,
            15.2, ["get", "height"]
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14, 0,
            15.2, ["get", "min_height"]
          ],
          "fill-extrusion-opacity": 0.92
        }
      },
      labelLayerId
    );
  }

  function addShopMarkers() {
    shops.forEach((shop) => {
      const el = document.createElement("button");
      el.className = "shop-pin";
      el.type = "button";
      el.setAttribute("aria-label", shopName(shop));

      el.addEventListener("click", () => {
        setActiveShop(shop, el);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom"
      })
        .setLngLat([shop._lng, shop._lat])
        .addTo(map);

      markers.push(marker);
    });
  }

  function setActiveShop(shop, markerEl) {
    if (activeMarkerEl) activeMarkerEl.classList.remove("is-active");

    activeShop = shop;
    activeMarkerEl = markerEl;
    activeMarkerEl.classList.add("is-active");

    map.easeTo({
      center: [shop._lng, shop._lat],
      zoom: Math.max(map.getZoom(), 15.4),
      pitch: 66,
      bearing: map.getBearing(),
      duration: 700,
      offset: [0, -90]
    });

    renderShopCard(shop);
  }

  function renderShopCard(shop) {
    const card = $("#shopCard");
    const logo = $("#cardLogo");
    const name = $("#cardName");
    const city = $("#cardCity");
    const status = $("#cardStatus");
    const openBtn = $("#cardOpenBtn");

    name.textContent = shopName(shop);
    city.textContent = shopCityState(shop) || "Cigar shop";

    logo.src = logoUrl(shop);
    logo.onerror = () => {
      logo.onerror = null;
      logo.src = "/uxui/darkmode/darkmodeshops.png";
    };

    const s = computeStatus(shop);
    if (s) {
      status.textContent = s.label;
      status.className = `map-card-status ${s.open ? "open" : "closed"}`;
    } else {
      status.textContent = "";
      status.className = "map-card-status";
    }

    openBtn.onclick = () => {
      window.location.href = shopUrl(shop);
    };

    card.hidden = false;
  }

  function fitToShops() {
    if (!shops.length) return;

    const bounds = new mapboxgl.LngLatBounds();

    shops.forEach((shop) => {
      bounds.extend([shop._lng, shop._lat]);
    });

    map.fitBounds(bounds, {
      padding: {
        top: 170,
        left: 60,
        right: 60,
        bottom: 160
      },
      maxZoom: 10.5,
      duration: 900
    });
  }

  function wireUI() {
    $("#mapLocateBtn")?.addEventListener("click", () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition((pos) => {
        map.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14.8,
          pitch: 66,
          duration: 900
        });
      });
    });

    document.querySelectorAll(".map-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".map-filter").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  async function init() {
    await loadShops();
    initMap();
    wireUI();
  }

  init().catch((err) => {
    console.error("[map.js] init failed:", err);
  });
})();
