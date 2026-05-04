(() => {
  "use strict";

  mapboxgl.accessToken = "pk.eyJ1IjoiY2lnYXJzb2NpYWwiLCJhIjoiY21ianl5bHd1MGxicTJqcHdhb3dpZ3ZwNCJ9.ijIrVkm0sLmv9xApK1zxBw";

  const SHOPS_URLS = ["/shops/shops.json", "/data/shops/shops.json"];
  const DEFAULT_CENTER = [-80.1918, 25.7617];
  const DEFAULT_ZOOM = 6.4;

  const $ = (sel) => document.querySelector(sel);

  let map;
  let shops = [];
  let activeMarkerEl = null;

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
    return num(shop.lat) ?? num(shop.latitude) ?? num(shop.Latitude) ?? num(shop.LAT);
  }

  function getLng(shop) {
    return num(shop.lng) ?? num(shop.lon) ?? num(shop.longitude) ?? num(shop.Longitude) ?? num(shop.LNG);
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

  async function fetchShopsJson() {
    for (const url of SHOPS_URLS) {
      try {
        const res = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) continue;
        return await res.json();
      } catch (e) {}
    }
    return [];
  }

  async function loadShops() {
    const data = await fetchShopsJson();

    shops = (Array.isArray(data) ? data : [])
      .map((shop) => {
        const lat = getLat(shop);
        const lng = getLng(shop);
        return { ...shop, _lat: lat, _lng: lng };
      })
      .filter((shop) => Number.isFinite(shop._lat) && Number.isFinite(shop._lng));

    console.log("[map] shops loaded:", shops.length, shops);
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
      try { applyPremiumStyle(); } catch (e) { console.warn("[map] style skipped:", e); }
      try { add3DBuildings(); } catch (e) { console.warn("[map] 3D skipped:", e); }

      addShopMarkers();
      fitToShops();
    });
  }

  function applyPremiumStyle() {
    const layers = map.getStyle().layers || [];

    layers.forEach((layer) => {
      const id = layer.id || "";

      if (id.includes("label") || id.includes("poi") || id.includes("transit")) {
        try { map.setLayoutProperty(id, "visibility", "none"); } catch (e) {}
      }

      if (id.includes("water") && layer.type === "fill") {
        try {
          map.setPaintProperty(id, "fill-color", "#9ed7ee");
          map.setPaintProperty(id, "fill-opacity", 1);
        } catch (e) {}
      }

      if ((id.includes("land") || id.includes("background")) && layer.type === "background") {
        try { map.setPaintProperty(id, "background-color", "#f4f4f5"); } catch (e) {}
      }

      if ((id.includes("land") || id.includes("park")) && layer.type === "fill") {
        try { map.setPaintProperty(id, "fill-color", "#eeeeef"); } catch (e) {}
      }

      if (id.includes("road") && layer.type === "line") {
        try {
          map.setPaintProperty(id, "line-color", "#b9b9bd");
          map.setPaintProperty(id, "line-opacity", 0.72);
        } catch (e) {}
      }
    });

    map.setFog({
      color: "#ffffff",
      "high-color": "#d7d7da",
      "horizon-blend": 0.18
    });
  }

  function add3DBuildings() {
    if (map.getLayer("cigaros-3d-buildings")) return;

    const layers = map.getStyle().layers || [];
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
    )?.id;

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
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
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

      new mapboxgl.Marker({
        element: el,
        anchor: "bottom"
      })
        .setLngLat([shop._lng, shop._lat])
        .addTo(map);
    });
  }

  function setActiveShop(shop, markerEl) {
    if (activeMarkerEl) activeMarkerEl.classList.remove("is-active");

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
    const openBtn = $("#cardOpenBtn");

    if (!card) return;

    name.textContent = shopName(shop);
    city.textContent = shopCityState(shop) || "Cigar shop";

    logo.src = logoUrl(shop);
    logo.onerror = () => {
      logo.onerror = null;
      logo.src = "/uxui/darkmode/darkmodeshops.png";
    };

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
      maxZoom: shops.length === 1 ? 12 : 8.5,
      duration: 900
    });
  }

  async function init() {
    await loadShops();
    initMap();
  }

  init().catch((err) => {
    console.error("[map.js] init failed:", err);
  });
})();
