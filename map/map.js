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

  function clean(v){ return String(v ?? "").trim(); }

  function keyify(s){
    return clean(s).toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"");
  }

  function num(v){
    const n = Number(String(v ?? "").replace(/[^0-9.-]/g,""));
    return Number.isFinite(n) ? n : null;
  }

  function getLat(s){ return num(s.lat) ?? num(s.latitude); }
  function getLng(s){ return num(s.lng) ?? num(s.longitude); }

  function stateAbbr(state){
    const map = { Pennsylvania:"PA", Florida:"FL", NewYork:"NY", California:"CA" };
    return map[clean(state)] || clean(state);
  }

  function shopName(s){ return clean(s.name || "Shop"); }
  function shopCityState(s){
    return [clean(s.city), stateAbbr(s.state)].filter(Boolean).join(", ");
  }
  function shopAddress(s){ return clean(s.address1 || s.address); }
  function shopPhone(s){ return clean(s.phone); }
  function shopWebsite(s){ return clean(s.website); }

  function shopKey(s){ return keyify(s.slug || s.name); }
  function shopUrl(s){ return `/shops/shop-page.html?shop=${shopKey(s)}`; }

  function getFavorites(){
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]"); }
    catch { return []; }
  }

  function isFavorite(s){ return getFavorites().includes(shopKey(s)); }

  function toggleFavorite(s){
    const favs = getFavorites();
    const k = shopKey(s);
    const next = favs.includes(k) ? favs.filter(x=>x!==k) : [...favs,k];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    renderShopCard(s);
  }

  function setLogo(img, shop){
    const key = keyify(shop.slug || shop.name);
    img.onerror = () => img.src = DEFAULT_SHOP_ICON;
    img.src = `/img/icons/shops/${key}.svg`;
  }

  async function loadShops(){
    for(const url of SHOPS_URLS){
      try{
        const res = await fetch(url);
        const data = await res.json();
        shops = data.map(s => ({...s,_lat:getLat(s),_lng:getLng(s)}))
                     .filter(s=>s._lat && s._lng);
        return;
      }catch(e){}
    }
  }

  function initMap(){
    map = new mapboxgl.Map({
      container:"map",
      style:"mapbox://styles/mapbox/light-v11",
      center:DEFAULT_CENTER,
      zoom:DEFAULT_ZOOM,
      pitch:60,
      bearing:-18
    });

    map.on("load", ()=>{
      addClusterLayers();
      addShopMarkers();
      fitToShops();

      map.on("zoom", updateMarkerVisibility);
      map.on("moveend", updateMarkerVisibility);
    });
  }

  function addClusterLayers(){
    map.addSource("shops",{
      type:"geojson",
      data:{
        type:"FeatureCollection",
        features:shops.map((s,i)=>({
          type:"Feature",
          properties:{index:i},
          geometry:{type:"Point",coordinates:[s._lng,s._lat]}
        }))
      },
      cluster:true,
      clusterRadius:50
    });

    map.addLayer({
      id:"clusters",
      type:"circle",
      source:"shops",
      filter:["has","point_count"],
      paint:{
        "circle-color":"#ff3b30",
        "circle-radius":20
      }
    });
  }

  function addShopMarkers(){
    markers.forEach(m=>m.remove());
    markers=[];

    shops.forEach((shop,i)=>{
      const el=document.createElement("button");
      el.className="shop-pin";

      el.onclick=()=>setActiveShop(shop,el);

      const marker=new mapboxgl.Marker({element:el,anchor:"bottom"})
        .setLngLat([shop._lng,shop._lat])
        .addTo(map);

      markers.push(marker);
    });

    updateMarkerVisibility();
  }

  function updateMarkerVisibility(){
    const zoom = map.getZoom();

    // FIX: markers now show properly
    const showPins = zoom >= 5.5 || currentFilter === "favorites";

    markers.forEach((marker,index)=>{
      const el = marker.getElement();
      const shop = shops[index];

      const shouldShow =
        currentFilter !== "favorites" || isFavorite(shop);

      el.classList.toggle("hide-marker", !showPins || !shouldShow);
    });

    if(map.getLayer("clusters")){
      map.setLayoutProperty(
        "clusters",
        "visibility",
        currentFilter==="favorites"?"none":"visible"
      );
    }
  }

  function setActiveShop(shop,el){
    if(activeMarkerEl) activeMarkerEl.classList.remove("is-active");
    activeMarkerEl=el;
    el.classList.add("is-active");

    map.easeTo({
      center:[shop._lng,shop._lat],
      zoom:15,
      pitch:65
    });

    renderShopCard(shop);
  }

  function renderShopCard(shop){
    const card=$("#shopCard");
    if(!card) return;

    $("#cardName").textContent = shopName(shop);
    $("#cardCity").textContent = shopCityState(shop);

    setLogo($("#cardLogo"),shop);

    $("#cardFavBtn").textContent = isFavorite(shop)?"★":"☆";
    $("#cardFavBtn").onclick=(e)=>{
      e.stopPropagation();
      toggleFavorite(shop);
    };

    $("#cardDetails").innerHTML = `
      <div class="map-detail-row">
        <div>Address</div>
        <div>${shopAddress(shop)}</div>
      </div>
      <div class="map-detail-row">
        <div>Phone</div>
        <div>${shopPhone(shop)}</div>
      </div>
    `;

    card.hidden=false;
  }

  function fitToShops(){
    if(!shops.length) return;

    const b=new mapboxgl.LngLatBounds();
    shops.forEach(s=>b.extend([s._lng,s._lat]));

    map.fitBounds(b,{padding:120});
  }

  async function init(){
    await loadShops();
    initMap();
  }

  init();

})();
