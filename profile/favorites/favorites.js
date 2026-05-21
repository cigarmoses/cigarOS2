/* /profile/favorites/favorites.js
   FAVORITES PAGE MERGED
   - Search bar
   - Filters
   - Remove/Edit mode
   - Manual drag reorder
   - Add button
   - Dark/light toggle
   - Reads profile cigar favorites from cigar detail pages
   - Fallback sample favorites
*/

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const PROFILE_CIGAR_KEY = "cigaros_user_favorite_cigars_v1";
  const PRIMARY_STORAGE_KEY = "cigarSocialFavorites";
  const ORDER_STORAGE_KEY = "cigarSocialFavoritesOrder";
  const THEME_KEY = "cigaros-theme";

  const STORAGE_KEYS = [
    PROFILE_CIGAR_KEY,
    PRIMARY_STORAGE_KEY,
    "cigaros_favorites_v1",
    "cigarosFavorites",
    "favorites",
    "cs_favorites_v1"
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    root: document.documentElement,
    themeToggle: $("#themeToggle"),
    themeIcon: $("#themeIcon"),
    addBtn: $("#favAddBtn"),
    list: $("#favList"),
    status: $("#favStatus"),
    search: $("#favSearch"),
    editBtn: $("#favEditBtn"),
    filterBtn: $("#favFilterBtn"),
    appliedFilters: $("#favAppliedFilters"),
    tabs: $$(".fav-tab"),
    sheet: $("#favFilterSheet"),
    sheetSubtitle: $("#favSheetSubtitle"),
    filterGroups: $("#favFilterGroups"),
    clearFilters: $("#favClearFilters"),
    doneFilters: $("#favDoneFilters")
  };

  const state = {
    allSheetRows: [],
    favorites: [],
    filtered: [],
    activeType: "cigar",
    query: "",
    editing: false,
    filters: {
      brand: new Set(),
      country: new Set(),
      wrapper: new Set(),
      binder: new Set(),
      filler: new Set(),
      strength: new Set(),
      shape: new Set(),
      vitola: new Set(),
      ringMin: "",
      ringMax: "",
      lengthMin: "",
      lengthMax: ""
    },
    draggingId: null
  };

  const fieldAliases = {
    brand: ["Brand", "brand"],
    cigar: ["Cigar", "Name", "Cigar Name", "cigar", "name"],
    line: ["Line", "Series", "line", "series"],
    vitola: ["Vitola", "Style", "Size", "vitola", "style", "size"],
    length: ["Length", "length"],
    ring: ["Ring", "RG", "Ring Gauge", "ring", "rg"],
    country: ["Country", "Origin", "Country of Origin", "country", "origin"],
    wrapper: ["Wrapper", "Wrapper Type", "wrapper"],
    binder: ["Binder", "Binder Type", "binder"],
    filler: ["Filler", "Filler Type", "filler"],
    strength: ["Strength", "Body", "strength", "body"],
    shape: ["Shape", "shape"],
    image: ["Cigar IMG", "Image", "Image URL", "Photo", "image", "img", "photo"],
    url: ["URL", "Link", "Detail URL", "url", "href", "link"]
  };

  const fallbackFavorites = [
    {
      type: "cigar",
      name: "Girl With No Name Lonsdale",
      brand: "Girl With No Name",
      vitola: "Lonsdale",
      image: "/img/cigars/girlwithnoname/girlwithnonamelonsdale.png",
      url: "/pos/cigars/cigar.html?key=Girl%20With%20No%20Name%7CGirl%20With%20No%20Name%7CLonsdale"
    },
    {
      type: "cigar",
      name: "Cohiba Nicaragua N50",
      brand: "Cohiba",
      vitola: "Robusto",
      image: "/img/cigars/cohiba/nicaraguarobusto.png",
      url: "/pos/cigars/cigar.html?key=cohiba%7Cn%204%207%2F8%20x%2050%7Crobusto"
    },
    {
      type: "cigar",
      name: "Camacho Connecticut Robusto",
      brand: "Camacho",
      vitola: "Robusto",
      image: "/img/cigars/camacho/connecticutrobusto.png",
      url: "/pos/cigars/cigar.html?key=camacho%7Cconnecticut%20robusto%7Crobusto"
    },
    {
      type: "cigar",
      name: "Tabak Cafe Con Leche",
      brand: "Tabak",
      vitola: "Belicoso",
      image: "/img/cigars/tabak/cafeconleche.png",
      url: "/pos/cigars/cigar.html?key=Tabak%7CCafe%20Con%20Leche%7CBelicoso"
    },
    {
      type: "brand",
      name: "Opus X",
      brand: "Opus X",
      image: "/img/icons/brands/opusx.svg",
      url: "/pos/cigars/brand.html?brand=Opus%20X"
    },
    {
      type: "brand",
      name: "Padron",
      brand: "Padron",
      image: "/img/icons/brands/padron.svg",
      url: "/pos/cigars/brand.html?brand=Padron"
    },
    {
      type: "shop",
      name: "Fox Cigar Bar",
      image: "/img/icons/shops/foxcigarbar.svg",
      url: "/shops/"
    },
    {
      type: "shop",
      name: "Smoke Cigar Shop",
      country: "Bridgeville, PA",
      image: "/img/icons/shops/foxcigarbar.svg",
      url: "/shops/"
    }
  ];

  function norm(value){
    return String(value ?? "").trim();
  }

  function low(value){
    return norm(value).toLowerCase();
  }

  function compact(value){
    return low(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function titleCase(value){
    const s = norm(value);
    if (!s) return "";
    return s.toLowerCase().split(/\s+/).map((w) => w ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function safeJsonParse(raw, fallback){
    try{
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    }catch{
      return fallback;
    }
  }

  function get(row, key){
    const aliases = fieldAliases[key] || [key];
    for (const name of aliases){
      if (row && Object.prototype.hasOwnProperty.call(row, name)){
        const value = norm(row[name]);
        if (value) return value;
      }
    }
    return "";
  }

  function numberOnly(value){
    const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function splitValues(value){
    return norm(value).split(/[,\|/]+/).map(norm).filter(Boolean);
  }

  function uniqueSorted(values){
    return Array.from(new Set(values.map(norm).filter(Boolean)))
      .sort((a,b) => a.localeCompare(b, undefined, { sensitivity:"base" }));
  }

  function itemId(item){
    if (item.id) return String(item.id);

    const type = item.type || "cigar";
    const brand = item.brand || "";
    const name = item.name || item.cigar || "";
    const vitola = item.vitola || "";
    const url = item.url || item.href || "";

    return `${type}|${compact(brand)}|${compact(name)}|${compact(vitola)}|${compact(url)}`;
  }

  function normalizeFavorite(raw){
    const typeRaw = low(raw.type || raw.kind || raw.category || "cigar");
    const type = ["brand", "shop", "cigar"].includes(typeRaw) ? typeRaw : "cigar";

    const item = {
      id: raw.id || raw.key || "",
      type,
      brand: norm(raw.brand || raw.Brand || ""),
      name: norm(raw.name || raw.cigar || raw.Cigar || raw.title || raw.Title || ""),
      cigar: norm(raw.cigar || raw.Cigar || raw.name || ""),
      line: norm(raw.line || raw.Line || ""),
      vitola: norm(raw.vitola || raw.Vitola || raw.style || raw.Style || ""),
      length: norm(raw.length || raw.Length || ""),
      ring: norm(raw.ring || raw.Ring || raw.rg || raw.RG || ""),
      country: norm(raw.country || raw.Country || raw.origin || raw.Origin || raw.meta || ""),
      wrapper: norm(raw.wrapper || raw.Wrapper || ""),
      binder: norm(raw.binder || raw.Binder || ""),
      filler: norm(raw.filler || raw.Filler || ""),
      strength: norm(raw.strength || raw.Strength || ""),
      shape: norm(raw.shape || raw.Shape || ""),
      image: norm(raw.image || raw.img || raw.Image || raw.photo || raw.Photo || ""),
      url: norm(raw.url || raw.href || raw.URL || raw.link || raw.Link || ""),
      notes: norm(raw.notes || raw.Notes || "")
    };

    if (item.type === "brand" && !item.brand) item.brand = item.name;
    if (item.type === "cigar" && !item.name) item.name = item.cigar;
    if (!item.id) item.id = itemId(item);

    return item;
  }

  function readStorageArray(key){
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = safeJsonParse(raw, null);

    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    if (parsed && typeof parsed === "object") return Object.values(parsed);

    return [];
  }

  function applySavedOrder(items){
    const order = safeJsonParse(localStorage.getItem(ORDER_STORAGE_KEY), []);
    if (!Array.isArray(order) || !order.length) return items;

    const orderMap = new Map(order.map((id, index) => [String(id), index]));

    return [...items].sort((a,b) => {
      const ai = orderMap.has(itemId(a)) ? orderMap.get(itemId(a)) : 999999;
      const bi = orderMap.has(itemId(b)) ? orderMap.get(itemId(b)) : 999999;
      return ai - bi;
    });
  }

  function readFavorites(){
    const collected = [];

    STORAGE_KEYS.forEach((key) => {
      readStorageArray(key).forEach((raw) => collected.push(raw));
    });

    fallbackFavorites.forEach((raw) => collected.push(raw));

    const normalized = collected
      .map(normalizeFavorite)
      .filter((item) => item.name || item.brand);

    const deduped = [];
    const seen = new Set();

    normalized.forEach((item) => {
      const id = itemId(item);
      if (seen.has(id)) return;
      seen.add(id);
      item.id = id;
      deduped.push(item);
    });

    return applySavedOrder(deduped);
  }

  function saveFavorites(){
    localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(state.favorites));
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(state.favorites.map(itemId)));

    const cigarItems = state.favorites
      .filter((item) => item.type === "cigar")
      .map((item) => ({
        key: item.id,
        name: item.name,
        brand: item.brand,
        vitola: item.vitola,
        img: item.image,
        href: item.url
      }));

    localStorage.setItem(PROFILE_CIGAR_KEY, JSON.stringify(cigarItems));
  }

  function parseCSV(text){
    const rows = [];
    let row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++){
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"'){
        current += '"';
        i++;
        continue;
      }

      if (char === '"'){
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes){
        row.push(current);
        current = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes){
        if (char === "\r" && next === "\n") i++;
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
        continue;
      }

      current += char;
    }

    if (current || row.length){
      row.push(current);
      rows.push(row);
    }

    const headers = rows.shift()?.map(norm) || [];

    return rows
      .filter((r) => r.some((cell) => norm(cell)))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = norm(r[i]);
        });
        return obj;
      });
  }

  async function loadSheetRows(){
    try{
      const res = await fetch(CSV_URL, { cache:"no-store" });
      if (!res.ok) throw new Error("Could not load cigar sheet.");
      const text = await res.text();
      state.allSheetRows = parseCSV(text);
    }catch(err){
      console.warn("Favorites sheet load failed:", err);
      state.allSheetRows = [];
    }
  }

  function enrichFavoritesFromSheet(){
    if (!state.allSheetRows.length) return;

    state.favorites = state.favorites.map((fav) => {
      if (fav.type !== "cigar") return fav;

      const favBrand = compact(fav.brand);
      const favName = compact(fav.name || fav.cigar);
      const favVitola = compact(fav.vitola);

      const match = state.allSheetRows.find((row) => {
        const rowBrand = compact(get(row, "brand"));
        const rowName = compact(get(row, "cigar"));
        const rowLine = compact(get(row, "line"));
        const rowVitola = compact(get(row, "vitola"));

        const brandMatch = !favBrand || favBrand === rowBrand;
        const nameMatch =
          favName &&
          (rowName.includes(favName) || favName.includes(rowName) || rowLine.includes(favName) || favName.includes(rowLine));
        const vitolaMatch = !favVitola || !rowVitola || favVitola === rowVitola;

        return brandMatch && nameMatch && vitolaMatch;
      });

      if (!match) return fav;

      return {
        ...fav,
        brand: fav.brand || get(match, "brand"),
        name: fav.name || get(match, "cigar") || get(match, "line"),
        cigar: fav.cigar || get(match, "cigar"),
        line: fav.line || get(match, "line"),
        vitola: fav.vitola || get(match, "vitola"),
        length: fav.length || get(match, "length"),
        ring: fav.ring || get(match, "ring"),
        country: fav.country || get(match, "country"),
        wrapper: fav.wrapper || get(match, "wrapper"),
        binder: fav.binder || get(match, "binder"),
        filler: fav.filler || get(match, "filler"),
        strength: fav.strength || get(match, "strength"),
        shape: fav.shape || get(match, "shape"),
        image: fav.image || get(match, "image"),
        url: fav.url || get(match, "url")
      };
    });

    saveFavorites();
  }

  function activeFavorites(){
    return state.favorites.filter((item) => item.type === state.activeType);
  }

  function hasActiveFilters(){
    const f = state.filters;
    return (
      f.brand.size ||
      f.country.size ||
      f.wrapper.size ||
      f.binder.size ||
      f.filler.size ||
      f.strength.size ||
      f.shape.size ||
      f.vitola.size ||
      f.ringMin ||
      f.ringMax ||
      f.lengthMin ||
      f.lengthMax
    );
  }

  function resetFilters(){
    Object.keys(state.filters).forEach((key) => {
      if (state.filters[key] instanceof Set) state.filters[key].clear();
      else state.filters[key] = "";
    });
  }

  function passesSetFilter(item, field){
    const selected = state.filters[field];
    if (!(selected instanceof Set) || selected.size === 0) return true;

    const values = splitValues(item[field]);
    if (!values.length) return false;

    return values.some((value) => selected.has(value));
  }

  function passesRangeFilter(item, field, minKey, maxKey){
    const value = numberOnly(item[field]);
    const min = numberOnly(state.filters[minKey]);
    const max = numberOnly(state.filters[maxKey]);

    if (!min && !max) return true;
    if (!value) return false;
    if (min && value < min) return false;
    if (max && value > max) return false;

    return true;
  }

  function applyFilters(){
    const q = low(state.query);

    state.filtered = activeFavorites().filter((item) => {
      const haystack = [
        item.brand,
        item.name,
        item.cigar,
        item.line,
        item.vitola,
        item.country,
        item.wrapper,
        item.binder,
        item.filler,
        item.strength,
        item.shape,
        item.notes
      ].join(" ").toLowerCase();

      if (q && !haystack.includes(q)) return false;

      if (state.activeType !== "cigar") return true;

      if (!passesSetFilter(item, "brand")) return false;
      if (!passesSetFilter(item, "country")) return false;
      if (!passesSetFilter(item, "wrapper")) return false;
      if (!passesSetFilter(item, "binder")) return false;
      if (!passesSetFilter(item, "filler")) return false;
      if (!passesSetFilter(item, "strength")) return false;
      if (!passesSetFilter(item, "shape")) return false;
      if (!passesSetFilter(item, "vitola")) return false;
      if (!passesRangeFilter(item, "ring", "ringMin", "ringMax")) return false;
      if (!passesRangeFilter(item, "length", "lengthMin", "lengthMax")) return false;

      return true;
    });
  }

  function itemImage(item){
    if (item.image) return item.image;
    if (item.type === "brand") return brandIconPath(item.brand || item.name);
    if (item.type === "cigar") return cigarImagePath(item);
    return "";
  }

  function brandIconPath(brand){
    const slug = compact(String(brand || "").replace(/&/g, "and"));
    return slug ? `/img/icons/brands/${slug}.svg` : "";
  }

  function cigarImagePath(item){
    const brand = compact(item.brand);
    const cigar = compact(item.name || item.cigar);
    if (!brand || !cigar) return "";
    return `/img/cigars/${brand}/${cigar}.png`;
  }

  function fallbackLetter(item){
    const source = item.type === "brand" ? (item.brand || item.name) : (item.name || item.brand);
    return norm(source).slice(0,1).toUpperCase() || "★";
  }

  function detailUrl(item){
    if (item.url) return item.url;

    if (item.type === "brand"){
      return `/pos/cigars/brand.html?brand=${encodeURIComponent(item.brand || item.name || "")}`;
    }

    if (item.type === "shop"){
      return "/shops/";
    }

    const brand = item.brand || "";
    const cigar = item.name || item.cigar || "";
    const vitola = item.vitola || "";
    const key = `${brand}|${cigar}|${vitola}`;

    return `/pos/cigars/cigar.html?key=${encodeURIComponent(key)}`;
  }

  function metaLine(item){
    if (item.type === "brand") return "Brand favorite";
    if (item.type === "shop") return item.country || "Shop favorite";

    return [item.vitola, item.length ? `${item.length}"` : "", item.ring ? `${item.ring} RG` : ""]
      .filter(Boolean)
      .join(" · ");
  }

  function subMetaLine(item){
    if (item.type !== "cigar") return item.notes || "";
    return [item.wrapper, item.country, item.strength].filter(Boolean).join(" · ");
  }

  function renderStatus(){
    if (!els.status) return;

    const total = activeFavorites().length;

    if (!total){
      els.status.hidden = true;
      return;
    }

    if (!state.filtered.length){
      els.status.hidden = false;
      els.status.textContent = "No favorites match your search or filters.";
      return;
    }

    els.status.hidden = true;
  }

  function renderList(){
    if (!els.list) return;

    applyFilters();
    renderStatus();

    if (!activeFavorites().length){
      els.list.innerHTML = `
        <article class="fav-empty">
          <h3>No ${escapeHtml(state.activeType)} favorites yet</h3>
          <p>Tap the favorite button on a cigar, brand, or shop to save it here.</p>
        </article>
      `;
      return;
    }

    if (!state.filtered.length){
      els.list.innerHTML = "";
      return;
    }

    els.list.innerHTML = state.filtered.map((item) => {
      const id = itemId(item);
      const title = item.type === "brand" ? (item.brand || item.name) : (item.name || item.cigar || item.brand);
      const kicker = item.type === "cigar" ? item.brand : titleCase(item.type);
      const img = itemImage(item);
      const url = detailUrl(item);

      return `
        <article class="fav-card type-${escapeHtml(item.type)}" draggable="${state.editing ? "true" : "false"}" data-id="${escapeHtml(id)}">
          <button class="fav-remove" type="button" aria-label="Remove favorite" data-remove="${escapeHtml(id)}">−</button>

          <div class="fav-art">
            ${
              img
                ? `<img src="${escapeHtml(img)}" alt="" onerror="this.remove();this.parentElement.innerHTML='<span class=&quot;fav-art-letter&quot;>${escapeHtml(fallbackLetter(item))}</span>';">`
                : `<span class="fav-art-letter">${escapeHtml(fallbackLetter(item))}</span>`
            }
          </div>

          <div class="fav-main">
            <p class="fav-kicker">${escapeHtml(kicker)}</p>
            <h3 class="fav-title">${escapeHtml(title)}</h3>
            <p class="fav-meta">${escapeHtml(metaLine(item))}</p>
            ${subMetaLine(item) ? `<p class="fav-submeta">${escapeHtml(subMetaLine(item))}</p>` : ""}
          </div>

          <div class="fav-card-action">
            <a class="fav-open" href="${escapeHtml(url)}" aria-label="Open favorite">›</a>
            <button class="fav-drag" type="button" aria-label="Drag to reorder">☰</button>
          </div>
        </article>
      `;
    }).join("");

    bindCardEvents();
  }

  function bindCardEvents(){
    $$(".fav-remove", els.list).forEach((btn) => {
      btn.addEventListener("click", () => {
        removeFavorite(btn.dataset.remove);
      });
    });

    $$(".fav-card", els.list).forEach((card) => {
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragover", onDragOver);
      card.addEventListener("dragend", onDragEnd);
      card.addEventListener("drop", onDrop);
      card.addEventListener("touchstart", onTouchStart, { passive:true });
      card.addEventListener("touchmove", onTouchMove, { passive:false });
      card.addEventListener("touchend", onTouchEnd);
    });
  }

  function removeFavorite(id){
    state.favorites = state.favorites.filter((item) => itemId(item) !== id);
    saveFavorites();
    renderFilters();
    renderAppliedFilters();
    renderList();
  }

  function onDragStart(e){
    if (!state.editing) return e.preventDefault();

    const card = e.currentTarget;
    state.draggingId = card.dataset.id;
    card.classList.add("dragging");

    if (e.dataTransfer){
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", state.draggingId);
    }
  }

  function onDragOver(e){
    if (!state.editing || !state.draggingId) return;
    e.preventDefault();

    const dragging = $(`.fav-card[data-id="${cssEscape(state.draggingId)}"]`, els.list);
    const target = e.currentTarget;

    if (!dragging || dragging === target) return;

    const rect = target.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;

    els.list.insertBefore(dragging, before ? target : target.nextSibling);
  }

  function onDrop(e){
    if (!state.editing) return;
    e.preventDefault();
    commitDomOrder();
  }

  function onDragEnd(e){
    e.currentTarget.classList.remove("dragging");
    state.draggingId = null;
    commitDomOrder();
  }

  let touchDrag = null;

  function onTouchStart(e){
    if (!state.editing) return;

    const dragHandle = e.target.closest(".fav-drag");
    if (!dragHandle) return;

    const card = e.currentTarget;

    touchDrag = {
      id: card.dataset.id,
      card,
      startY: e.touches[0].clientY
    };

    state.draggingId = touchDrag.id;
    card.classList.add("dragging");
  }

  function onTouchMove(e){
    if (!state.editing || !touchDrag) return;
    e.preventDefault();

    const y = e.touches[0].clientY;
    const target = document.elementFromPoint(window.innerWidth / 2, y)?.closest(".fav-card");

    if (!target || target === touchDrag.card || !els.list.contains(target)) return;

    const rect = target.getBoundingClientRect();
    const before = y < rect.top + rect.height / 2;

    els.list.insertBefore(touchDrag.card, before ? target : target.nextSibling);
  }

  function onTouchEnd(){
    if (!touchDrag) return;

    touchDrag.card.classList.remove("dragging");
    touchDrag = null;
    state.draggingId = null;

    commitDomOrder();
  }

  function commitDomOrder(){
    const visibleIds = $$(".fav-card", els.list).map((card) => card.dataset.id);
    if (!visibleIds.length) return;

    const visibleSet = new Set(visibleIds);
    const visibleItems = visibleIds
      .map((id) => state.favorites.find((item) => itemId(item) === id))
      .filter(Boolean);

    const rebuilt = [];
    let inserted = false;

    state.favorites.forEach((item) => {
      if (visibleSet.has(itemId(item))){
        if (!inserted){
          rebuilt.push(...visibleItems);
          inserted = true;
        }
      }else{
        rebuilt.push(item);
      }
    });

    state.favorites = rebuilt;
    saveFavorites();
  }

  function cssEscape(value){
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function renderFilters(){
    if (!els.filterGroups) return;

    if (state.activeType !== "cigar"){
      els.filterGroups.innerHTML = `
        <div class="fav-filter-group">
          <h3>No filters for ${escapeHtml(titleCase(state.activeType))} yet</h3>
          <p style="margin:0;color:var(--muted);font-size:14px;font-weight:560;line-height:1.35;">
            Search is available for this section. Cigar filters are available under Cigars.
          </p>
        </div>
      `;
      return;
    }

    const cigars = activeFavorites();

    const groups = [
      { key:"brand", label:"Brand", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.brand))) },
      { key:"country", label:"Country", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.country))) },
      { key:"wrapper", label:"Wrapper", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.wrapper))) },
      { key:"binder", label:"Binder", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.binder))) },
      { key:"filler", label:"Filler", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.filler))) },
      { key:"strength", label:"Strength", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.strength))) },
      { key:"shape", label:"Shape", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.shape))) },
      { key:"vitola", label:"Vitola", values: uniqueSorted(cigars.flatMap((i) => splitValues(i.vitola))) }
    ];

    els.filterGroups.innerHTML = `
      ${groups.map(renderFilterGroup).join("")}

      <div class="fav-filter-group">
        <h3>Ring Gauge</h3>
        ${renderRangeGroup("ringMin", "ringMax", "Min RG", "Max RG")}
      </div>

      <div class="fav-filter-group">
        <h3>Length</h3>
        ${renderRangeGroup("lengthMin", "lengthMax", "Min Length", "Max Length")}
      </div>
    `;

    bindFilterEvents();
  }

  function renderFilterGroup(group){
    if (!group.values.length) return "";

    return `
      <div class="fav-filter-group" data-filter-group="${escapeHtml(group.key)}">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="fav-filter-options">
          ${group.values.map((value) => {
            const active = state.filters[group.key].has(value);
            return `
              <button
                class="fav-filter-option ${active ? "active" : ""}"
                type="button"
                data-filter-key="${escapeHtml(group.key)}"
                data-filter-value="${escapeHtml(value)}"
              >
                ${escapeHtml(value)}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderRangeGroup(minKey, maxKey, minLabel, maxLabel){
    return `
      <div class="fav-range-wrap">
        <div class="fav-range-values">
          <span>${escapeHtml(minLabel)}</span>
          <span>${escapeHtml(maxLabel)}</span>
        </div>

        <div class="fav-range-inputs">
          <label>
            Min
            <input type="number" inputmode="decimal" data-range-key="${escapeHtml(minKey)}" value="${escapeHtml(state.filters[minKey])}" placeholder="Any" />
          </label>

          <label>
            Max
            <input type="number" inputmode="decimal" data-range-key="${escapeHtml(maxKey)}" value="${escapeHtml(state.filters[maxKey])}" placeholder="Any" />
          </label>
        </div>
      </div>
    `;
  }

  function bindFilterEvents(){
    $$(".fav-filter-option", els.filterGroups).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.filterKey;
        const value = btn.dataset.filterValue;

        if (!(state.filters[key] instanceof Set)) return;

        if (state.filters[key].has(value)) state.filters[key].delete(value);
        else state.filters[key].add(value);

        btn.classList.toggle("active");
        renderAppliedFilters();
        renderList();
        updateFilterButton();
      });
    });

    $$("[data-range-key]", els.filterGroups).forEach((input) => {
      input.addEventListener("input", () => {
        state.filters[input.dataset.rangeKey] = input.value;
        renderAppliedFilters();
        renderList();
        updateFilterButton();
      });
    });
  }

  function renderAppliedFilters(){
    if (!els.appliedFilters) return;

    const chips = [];

    Object.entries(state.filters).forEach(([key, value]) => {
      if (value instanceof Set){
        value.forEach((v) => chips.push({ key, value:v, label:v }));
      }
    });

    if (state.filters.ringMin) chips.push({ key:"ringMin", value:state.filters.ringMin, label:`RG ≥ ${state.filters.ringMin}` });
    if (state.filters.ringMax) chips.push({ key:"ringMax", value:state.filters.ringMax, label:`RG ≤ ${state.filters.ringMax}` });
    if (state.filters.lengthMin) chips.push({ key:"lengthMin", value:state.filters.lengthMin, label:`Length ≥ ${state.filters.lengthMin}` });
    if (state.filters.lengthMax) chips.push({ key:"lengthMax", value:state.filters.lengthMax, label:`Length ≤ ${state.filters.lengthMax}` });

    if (!chips.length){
      els.appliedFilters.hidden = true;
      els.appliedFilters.innerHTML = "";
      return;
    }

    els.appliedFilters.hidden = false;
    els.appliedFilters.innerHTML = chips.map((chip) => `
      <span class="fav-chip">
        ${escapeHtml(chip.label)}
        <button type="button" data-remove-filter-key="${escapeHtml(chip.key)}" data-remove-filter-value="${escapeHtml(chip.value)}">×</button>
      </span>
    `).join("");

    $$("[data-remove-filter-key]", els.appliedFilters).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.removeFilterKey;
        const value = btn.dataset.removeFilterValue;

        if (state.filters[key] instanceof Set) state.filters[key].delete(value);
        else state.filters[key] = "";

        renderFilters();
        renderAppliedFilters();
        renderList();
        updateFilterButton();
      });
    });
  }

  function updateFilterButton(){
    if (!els.filterBtn) return;
    els.filterBtn.classList.toggle("has-filters", Boolean(hasActiveFilters()));
  }

  function openSheet(){
    if (!els.sheet) return;
    renderFilters();
    els.sheet.classList.add("open");
    els.sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeSheet(){
    if (!els.sheet) return;
    els.sheet.classList.remove("open");
    els.sheet.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function setActiveType(type){
    state.activeType = type;
    resetFilters();

    els.tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.type === type);
    });

    if (els.sheetSubtitle){
      els.sheetSubtitle.textContent =
        type === "cigar" ? "Filter your saved cigars." : `Search your saved ${type}s.`;
    }

    renderFilters();
    renderAppliedFilters();
    updateFilterButton();
    renderList();
  }

  function applyTheme(theme){
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);

    if (els.themeIcon){
      els.themeIcon.src = next === "dark" ? "/img/icons/moon.svg" : "/img/icons/sun.svg";
    }
  }

  function bindGlobalEvents(){
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveType(tab.dataset.type || "cigar");
      });
    });

    if (els.search){
      els.search.addEventListener("input", () => {
        state.query = els.search.value;
        renderList();
      });
    }

    if (els.editBtn){
      els.editBtn.addEventListener("click", () => {
        state.editing = !state.editing;
        document.body.classList.toggle("fav-editing", state.editing);
        els.editBtn.textContent = state.editing ? "Done" : "Edit";
        renderList();
      });
    }

    if (els.addBtn){
      els.addBtn.addEventListener("click", () => {
        if (state.activeType === "shop"){
          window.location.href = "/shops/";
          return;
        }

        window.location.href = "/pos/cigars/";
      });
    }

    if (els.themeToggle){
      els.themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    }

    if (els.filterBtn){
      els.filterBtn.addEventListener("click", openSheet);
    }

    if (els.doneFilters){
      els.doneFilters.addEventListener("click", closeSheet);
    }

    if (els.clearFilters){
      els.clearFilters.addEventListener("click", () => {
        resetFilters();
        renderFilters();
        renderAppliedFilters();
        renderList();
        updateFilterButton();
      });
    }

    $$("[data-close-sheet]").forEach((el) => {
      el.addEventListener("click", closeSheet);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheet();
    });
  }

  async function init(){
    bindGlobalEvents();

    applyTheme(localStorage.getItem(THEME_KEY) || document.documentElement.getAttribute("data-theme") || "dark");

    state.favorites = readFavorites();

    renderList();
    renderFilters();
    renderAppliedFilters();
    updateFilterButton();

    await loadSheetRows();
    enrichFavoritesFromSheet();

    renderList();
    renderFilters();
    renderAppliedFilters();
    updateFilterButton();
  }

  init();
})();
