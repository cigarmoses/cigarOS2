(() => {
  "use strict";

  mapboxgl.accessToken = "pk.eyJ1IjoiY2lnYXJzb2NpYWwiLCJhIjoiY21ianl5bHd1MGxicTJqcHdhb3dpZ3ZwNCJ9.ijIrVkm0sLmv9xApK1zxBw";

  const SHOPS_URLS = ["/shops/shops.json", "/data/shops/shops.json"];
  const DEFAULT_CENTER = [-80.1918, 25.7617];
  const DEFAULT_ZOOM = 6.4;
  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";
  const FAVORITES_KEY = "cigaros.favoriteShops";

  const $ = (sel) => document.querySelector(sel);

  let map;
  let shops = [];
  let markers = [];
  let activeShop = null;
  let activeMarkerEl = null;
  let userMarker = null;
  let currentFilter = "shops";
  let dragStartY = null;
  let dragStartTime = 0;

  function clean(v) {
    return String(v ?? "").trim();
  }

  function keyify(s) {
    return clean(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
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

  function stateAbbr(state) {
    const s = clean(state);
    const map = {
      "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
      "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
      "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
      "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
      "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO",
      "Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
      "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH",
      "Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
      "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
      "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
    };
    return map[s] || s;
  }

  function shopName(shop) {
    return clean(shop.name || shop.Shop || shop.shop || "Shop");
  }

  function shopCityState(shop) {
    const city = clean(shop.city || shop.City);
    const state = stateAbbr(shop.state || shop.ST || shop.State);
    return [city, state].filter(Boolean).join(", ");
  }

  function shopAddress(shop) {
    return clean(shop.address || shop.Address || shop.address1 || shop.Address1);
  }

  function shopPhone(shop) {
    return clean(shop.phone || shop.Phone || shop.Cell);
  }

  function shopWebsite(shop) {
    return clean(shop.website || shop.Website);
  }

  function logoKeys(shop) {
    return [shop.logoKey, shop.slug, shop.Slug, shop.slug_id, shop.name, shop.Shop, shop.shop]
      .map(clean)
      .filter(Boolean)
      .flatMap((k) => [k, keyify(k), k.toLowerCase()])
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }

  function shopKey(shop) {
    return keyify(shop.logoKey || shop.slug || shop.Slug || shop.slug_id || shopName(shop));
  }

  function shopUrl(shop) {
    return `/shops/shop-page.html?shop=${encodeURIComponent(shopKey(shop))}`;
  }

  function normalizeWebsiteUrl(v) {
    const s = clean(v);
    if (!s) return "";
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function setFavorites(list) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  }

  function isFavorite(shop) {
    return getFavorites().includes(shopKey(shop));
  }

  function toggleFavorite(shop) {
    const key = shopKey(shop);
    const favs = getFavorites();
    const next = favs.includes(key) ? favs.filter((x) => x !== key) : [...favs, key];
    setFavorites(next);
    renderShopCard(shop);
    applyFilter(currentFilter);
  }

  function setLogoWithFallback(img, shop) {
    const candidates = [];

    logoKeys(shop).forEach((k) => {
      candidates.push(`/img/icons/shops/${encodeURIComponent(k)}.svg`);
      candidates.push(`/img/icons/shops/${encodeURIComponent(k)}.png`);
      candidates.push(`/img/icons/shops/${encodeURIComponent(k.toLowerCase())}.svg`);
      candidates.push(`/img/icons/shops/${encodeURIComponent(k.toLowerCase())}.png`);
    });

    candidates.push(DEFAULT_SHOP_ICON);

    let index = 0;

    img.onerror = () => {
      index += 1;
      img.src = candidates[index] || DEFAULT_SHOP_ICON;
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
    const m = clean(str).match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
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
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (const check of [{ day: getDayKey(0), offset: 0 }, { day: getDayKey(-1), offset: -1440 }]) {
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

      if (nowMin >= open && nowMin <= close) {
        return { open: true, label: `Open • Closes ${parts[1]}` };
      }
    }

    const today = clean(hours[getDayKey(0)]);
    if (today && today !== "—") {
      const parts = today.split("-").map((s) => s.trim());
      if (parts.length === 2) return { open: false, label: `Closed • Opens ${parts[0]}` };
    }

    return { open: false, label: "Closed" };
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

  function toGeoJson(list) {
    return {
      type: "FeatureCollection",
      features: list.map((shop, index) => ({
        type: "Feature",
        properties: {
          index,
          name: shopName(shop),
          key: shopKey(shop)
        },
        geometry: {
          type: "Point",
          coordinates: [shop._lng, shop._lat]
        }
      }))
    };
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

      addClusterLayers();
      addShopMarkers();
      fitToShops();

      map.on("zoom", updateMarkerVisibility);
      map.on("moveend", updateMarkerVisibility);
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
        try { map.setPaintProperty(id, "fill-color", "#9ed7ee"); } catch (e) {}
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

  function addClusterLayers() {
    if (map.getSource("shops")) return;

    map.addSource("shops", {
      type: "geojson",
      data: toGeoJson(shops),
      cluster: true,
      clusterMaxZoom: 8,
      clusterRadius: 52
    });

    map.addLayer({
      id: "shop-clusters",
      type: "circle",
      source: "shops",
      filter: ["has", "point_count"],
      maxzoom: 9,
      paint: {
        "circle-color": "#ff3b30",
        "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 40, 32],
        "circle-opacity": 0.88,
        "circle-stroke-width": 4,
        "circle-stroke-color": "rgba(255,255,255,.88)"
      }
    });

    map.addLayer({
      id: "shop-cluster-count",
      type: "symbol",
      source: "shops",
      filter: ["has", "point_count"],
      maxzoom: 9,
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 13
      },
      paint: {
        "text-color": "#ffffff"
      }
    });

    map.on("click", "shop-clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["shop-clusters"] });
      const clusterId = features[0].properties.cluster_id;

      map.getSource("shops").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom,
          pitch: 62,
          duration: 700
        });
      });
    });
  }

  function addShopMarkers() {
    markers.forEach((m) => m.remove());
    markers = [];

    shops.forEach((shop) => {
      const el = document.createElement("button");
      el.className = "shop-pin";
      el.type = "button";
      el.setAttribute("aria-label", shopName(shop));

      el.addEventListener("click", () => setActiveShop(shop, el));

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([shop._lng, shop._lat])
        .addTo(map);

      markers.push(marker);
    });

    updateMarkerVisibility();
  }

  function updateMarkerVisibility() {
    const zoom = map.getZoom();
    const showPins = zoom >= 8.7 || currentFilter === "favorites";

    markers.forEach((marker) => {
      const el = marker.getElement();
      const shop = shops.find((s) => s._lng === marker.getLngLat().lng && s._lat === marker.getLngLat().lat);
      const shouldShowByFilter = currentFilter !== "favorites" || (shop && isFavorite(shop));

      el.classList.toggle("hide-marker", !showPins || !shouldShowByFilter);
    });

    if (map.getLayer("shop-clusters")) {
      map.setLayoutProperty("shop-clusters", "visibility", currentFilter === "favorites" ? "none" : "visible");
      map.setLayoutProperty("shop-cluster-count", "visibility", currentFilter === "favorites" ? "none" : "visible");
    }
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
    const favBtn = $("#cardFavBtn");
    const details = $("#cardDetails");

    if (!card) return;

    card.classList.remove("expanded");

    name.textContent = shopName(shop);
    city.textContent = shopCityState(shop) || "Cigar shop";

    if (logo) setLogoWithFallback(logo, shop);

    const s = computeStatus(shop);

    if (status) {
      status.textContent = s?.label || "";
      status.className = `map-card-status ${s?.open ? "open" : "closed"}`;
    }

    if (openBtn) {
      openBtn.hidden = true;
    }

    if (favBtn) {
      favBtn.textContent = isFavorite(shop) ? "★" : "☆";
      favBtn.classList.toggle("active", isFavorite(shop));
      favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(shop);
      };
    }

    if (details) {
      const features = shop.features || shop.Features || shop.amenities || {};
      const brands = Array.isArray(shop.brands)
        ? shop.brands
        : typeof shop.Brands === "string"
          ? shop.Brands.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      const amenityItems = [
        ["Indoor Seating", features.indoorSeating || features.indoor],
        ["Outdoor Seating", features.outdoorSeating || features.outdoor],
        ["TVs", features.tvs],
        ["Food", features.food],
        ["Alcohol", features.alcohol],
        ["BYOB", features.byob],
        ["Live Music", features.liveMusic || features.livemusic],
        ["Quiet Space", features.quietSpace || features.quiet],
        ["TAA", features.taa]
      ].filter((x) => x[1] === true || x[1] === "true" || x[1] === "yes" || x[1] === "1");

details.innerHTML = `
  <div class="map-detail-grid">

    <div class="map-detail-row">
      <div class="map-detail-k">Address</div>
      <div class="map-detail-v">${escapeHtml(shopAddress(shop))}</div>
    </div>

    <div class="map-detail-row">
      <div class="map-detail-k">Phone</div>
      <div class="map-detail-v">${escapeHtml(shopPhone(shop))}</div>
    </div>

    ${shopWebsite(shop) ? `
      <div class="map-detail-row">
        <div class="map-detail-k">Website</div>
        <div class="map-detail-v">${escapeHtml(shopWebsite(shop))}</div>
      </div>
    ` : ""}

    ${brands.length ? `
      <div class="map-detail-section">
        <div class="map-detail-section-title">Brands</div>
        <div class="map-brand-chips">
          ${brands.slice(0, 24).map((b) => `<span>${escapeHtml(b)}</span>`).join("")}
        </div>
      </div>
    ` : ""}

    ${amenityItems.length ? `
      <div class="map-detail-section">
        <div class="map-detail-section-title">Features</div>
        <div class="map-feature-chips">
          ${amenityItems.map(([label]) => `<span>${escapeHtml(label)}</span>`).join("")}
        </div>
      </div>
    ` : ""}
  </div>
`;
    }

    card.onclick = (e) => {
      if (e.target.closest("button")) return;
      card.classList.toggle("expanded");
    };

    wireCardDrag(card);
    card.hidden = false;
  }

  function wireCardDrag(card) {
    card.onpointerdown = (e) => {
      dragStartY = e.clientY;
      dragStartTime = Date.now();
    };

    card.onpointerup = (e) => {
      if (dragStartY == null) return;

      const diff = e.clientY - dragStartY;
      const quick = Date.now() - dragStartTime < 280;

      if (diff < -35 || (quick && diff < -12)) card.classList.add("expanded");
      if (diff > 35 || (quick && diff > 12)) card.classList.remove("expanded");

      dragStartY = null;
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function fitToShops(list = shops) {
    if (!list.length) return;

    const bounds = new mapboxgl.LngLatBounds();
    list.forEach((shop) => bounds.extend([shop._lng, shop._lat]));

    map.fitBounds(bounds, {
      padding:{ top:170, left:60, right:60, bottom:160 },
      maxZoom:list.length === 1 ? 12 : 8.5,
      duration:900
    });
  }

  function applyFilter(filter) {
    currentFilter = filter;

    const card = $("#shopCard");
    if (card) card.hidden = true;

    if (filter === "favorites") {
      const favs = shops.filter(isFavorite);
      fitToShops(favs.length ? favs : shops);
    } else {
      fitToShops(shops);
    }

    updateMarkerVisibility();
  }

  function findNearestShop(lng, lat) {
    let best = null;
    let bestDist = Infinity;

    shops.forEach((shop) => {
      const dx = shop._lng - lng;
      const dy = shop._lat - lat;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        best = shop;
        bestDist = d;
      }
    });

    return best;
  }

  function wireUI() {
    $("#mapLocateBtn")?.addEventListener("click", () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition((pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;

        if (userMarker) userMarker.remove();

        const el = document.createElement("div");
        el.className = "user-marker";

        userMarker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        const nearest = findNearestShop(lng, lat);

        map.easeTo({
          center:[lng, lat],
          zoom:13.8,
          pitch:66,
          duration:900
        });

        if (nearest) {
          setTimeout(() => {
            const marker = markers.find((m) => {
              const ll = m.getLngLat();
              return ll.lng === nearest._lng && ll.lat === nearest._lat;
            });
            setActiveShop(nearest, marker?.getElement?.() || document.createElement("div"));
          }, 700);
        }
      });
    });

    document.querySelectorAll(".map-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".map-filter").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyFilter(btn.dataset.layer || "shops");
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
