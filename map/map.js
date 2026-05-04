(() => {
  "use strict";

  mapboxgl.accessToken = "pk.eyJ1IjoiY2lnYXJzb2NpYWwiLCJhIjoiY21ianl5bHd1MGxicTJqcHdhb3dpZ3ZwNCJ9.ijIrVkm0sLmv9xApK1zxBw";

  const SHOPS_URLS = ["/shops/shops.json", "/data/shops/shops.json"];
  const DEFAULT_CENTER = [-80.1918, 25.7617];
  const DEFAULT_ZOOM = 6.4;
  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

  const $ = (sel) => document.querySelector(sel);

  let map;
  let shops = [];
  let activeMarkerEl = null;
  let currentZoom = DEFAULT_ZOOM;

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

  function logoKeys(shop) {
    return [
      shop.logoKey,
      shop.slug,
      shop.Slug,
      shop.slug_id,
      shop.name,
      shop.Shop,
      shop.shop
    ]
      .map(clean)
      .filter(Boolean)
      .flatMap((k) => [k, keyify(k)])
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }

  function shopKey(shop) {
    return keyify(shop.logoKey || shop.slug || shop.Slug || shop.slug_id || shopName(shop));
  }

  function shopUrl(shop) {
    return `/shops/shop-page.html?shop=${encodeURIComponent(shopKey(shop))}`;
  }

  function setLogoWithFallback(img, shop) {
    const keys = logoKeys(shop);
    const candidates = [];

    keys.forEach((k) => {
      candidates.push(`/img/icons/shops/${encodeURIComponent(k)}.svg`);
      candidates.push(`/img/icons/shops/${encodeURIComponent(k)}.png`);
    });

    candidates.push(DEFAULT_SHOP_ICON);

    let index = 0;

    img.onerror = () => {
      index += 1;
      if (index < candidates.length) {
        img.src = candidates[index];
      } else {
        img.onerror = null;
        img.src = DEFAULT_SHOP_ICON;
      }
    };

    img.src = candidates[0] || DEFAULT_SHOP_ICON;
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

  function getDayKey(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
  }

  function computeStatus(shop) {
    const hours = normalizeHours(shop);
    const now = new Date();
    const nowMinReal = now.getHours() * 60 + now.getMinutes();

    const checks = [
      { day: getDayKey(0), offset: 0 },
      { day: getDayKey(-1), offset: -1440 }
    ];

    for (const check of checks) {
      const str = clean(hours[check.day]);
      if (!str || str === "—") continue;

      const parts = str.split("-").map((s) => s.trim());
      if (parts.length !== 2) continue;

      let open = parseTime(parts[0]);
      let close = parseTime(parts[1]);

      if (open == null || close == null) continue;

      open += check.offset;
      close += check.offset;

      if (close < open) close += 1440;

      if (nowMinReal >= open && nowMinReal <= close) {
        return {
          open: true,
          label: `Open • Closes ${parts[1]}`
        };
      }
    }

    const today = clean(hours[getDayKey(0)]);
    if (today && today !== "—") {
      const parts = today.split("-").map((s) => s.trim());
      if (parts.length === 2) {
        return {
          open: false,
          label: `Closed • Opens ${parts[0]}`
        };
      }
    }

    return {
      open: false,
      label: "Closed"
    };
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
  }

  function initMap() {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 62,
      bearing: -18,
      antialias: true,
      attributionControl: false
    });

    map.on("load", () => {
      try { applyPremiumStyle(); } catch (e) {}
      try { add3DBuildings(); } catch (e) {}

      addShopMarkers();
      fitToShops();
      wireZoomBehavior();
    });
  }

  function applyPremiumStyle() {
    const layers = map.getStyle().layers || [];

    layers.forEach((layer) => {
      const id = layer.id || "";

      if (id.includes("poi") || id.includes("transit") || id.includes("airport")) {
        try { map.setLayoutProperty(id, "visibility", "none"); } catch (e) {}
      }

      if (layer.type === "symbol") {
        try { map.setLayoutProperty(id, "visibility", "visible"); } catch (e) {}
        try { map.setPaintProperty(id, "text-color", "#8e8e93"); } catch (e) {}
        try { map.setPaintProperty(id, "text-halo-color", "#ffffff"); } catch (e) {}
        try { map.setPaintProperty(id, "text-halo-width", 1.5); } catch (e) {}
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
          map.setPaintProperty(id, "line-opacity", 0.66);
        } catch (e) {}
      }
    });

    map.setFog({
      color: "#ffffff",
      "high-color": "#d7d7da",
      "horizon-blend": 0.16
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
            0, "#d6d6d8",
            80, "#a7a7ab",
            180, "#74747a"
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.9
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

    updatePinDensity();
  }

  function wireZoomBehavior() {
    map.on("zoom", () => {
      currentZoom = map.getZoom();
      updatePinDensity();
    });
  }

  function updatePinDensity() {
    const zoom = map?.getZoom?.() || currentZoom;

    document.querySelectorAll(".shop-pin").forEach((pin) => {
      pin.classList.toggle("is-small", zoom < 8);
      pin.classList.toggle("is-tiny", zoom < 5.5);
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
    const status = $("#cardStatus");
    const openBtn = $("#cardOpenBtn");

    if (!card) return;

    name.textContent = shopName(shop);
    city.textContent = shopCityState(shop) || "Cigar shop";

    if (logo) setLogoWithFallback(logo, shop);

    const s = computeStatus(shop);

    if (status) {
      status.textContent = s?.label || "";
      status.className = `map-card-status ${s?.open ? "open" : "closed"}`;
    }

    if (openBtn) {
      openBtn.textContent = "Open";
      openBtn.classList.toggle("open", !!s?.open);
      openBtn.classList.toggle("closed", !s?.open);
      openBtn.onclick = () => {
        window.location.href = shopUrl(shop);
      };
    }

    card.onclick = (e) => {
      if (e.target.closest("button")) return;
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
