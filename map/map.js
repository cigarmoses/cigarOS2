(() => {
  "use strict";

  mapboxgl.accessToken = "pk.eyJ1IjoiY2lnYXJzb2NpYWwiLCJhIjoiY21ianl5bHd1MGxicTJqcHdhb3dpZ3ZwNCJ9.ijIrVkm0sLmv9xApK1zxBw";

  const SHOPS_URL = "/shops/shops.json";
  const DEFAULT_CENTER = [-80.1918, 25.7617];
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
      num(shop.LAT)
    );
  }

  function getLng(shop) {
    return (
      num(shop.lng) ??
      num(shop.lon) ??
      num(shop.longitude) ??
      num(shop.Longitude) ??
      num(shop.LNG)
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
    const key = ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];
    const today = clean(hours[key]);

    if (!today || today === "—") return null;

    const parts = today.split("-").map(s => s.trim());
    if (parts.length !== 2) return null;

    let open = parseTime(parts[0]);
    let close = parseTime(parts[1]);

    if (open == null || close == null) return null;

    const now = new Date();
    let nowMin = now.getHours()*60 + now.getMinutes();

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
      .map(shop => {
        const lat = getLat(shop);
        const lng = getLng(shop);
        return { ...shop, _lat: lat, _lng: lng };
      })
      .filter(shop => Number.isFinite(shop._lat) && Number.isFinite(shop._lng));
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

    layers.forEach(layer => {
      const id = layer.id;

      if (id.includes("water")) {
        map.setPaintProperty(id, "fill-color", "#9ed7ee");
        return;
      }

      if (id.includes("land") || id.includes("background")) {
        if (layer.type === "fill") {
          map.setPaintProperty(id, "fill-color", "#ededee");
        }
      }

      if (id.includes("road") && layer.type === "line") {
        map.setPaintProperty(id, "line-color", "#b9b9bd");
      }

      if (id.includes("label") || id.includes("poi")) {
        map.setLayoutProperty(id, "visibility", "none");
      }
    });
  }

  function add3DBuildings() {
    const layers = map.getStyle().layers;
    const labelLayerId = layers.find(
      l => l.type === "symbol" && l.layout && l.layout["text-field"]
    )?.id;

    map.addLayer({
      id: "3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==","extrude","true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#aaa",
        "fill-extrusion-height": ["get","height"],
        "fill-extrusion-base": ["get","min_height"],
        "fill-extrusion-opacity": 0.9
      }
    }, labelLayerId);
  }

  function addShopMarkers() {
    shops.forEach(shop => {
      const el = document.createElement("div");
      el.className = "shop-pin";

      el.onclick = () => setActiveShop(shop, el);

      new mapboxgl.Marker(el)
        .setLngLat([shop._lng, shop._lat])
        .addTo(map);
    });
  }

  function setActiveShop(shop, el) {
    if (activeMarkerEl) activeMarkerEl.classList.remove("is-active");

    activeMarkerEl = el;
    el.classList.add("is-active");

    map.easeTo({
      center: [shop._lng, shop._lat],
      zoom: 15.4,
      duration: 700
    });

    renderShopCard(shop);
  }

  function renderShopCard(shop) {
    $("#shopCard").hidden = false;
    $("#cardName").textContent = shopName(shop);
    $("#cardCity").textContent = shopCityState(shop);

    const status = computeStatus(shop);
    const statusEl = $("#cardStatus");

    if (status) {
      statusEl.textContent = status.label;
      statusEl.className = `map-card-status ${status.open ? "open" : "closed"}`;
    }
  }

  function fitToShops() {
    if (!shops.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    shops.forEach(s => bounds.extend([s._lng, s._lat]));

    map.fitBounds(bounds, { padding: 80 });
  }

  async function init() {
    await loadShops();
    initMap();
  }

  init();
})();
