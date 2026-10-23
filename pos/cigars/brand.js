/* CigarOS Favorites repair 2026-10-12-r1.
   Shared helper bundled into each page script. No extra script tag required.
   Browser-local storage, not an account/cloud database. */
(() => {
  "use strict";
  if (window.CigarFavorites?.version === 2) return;
  const KEY = "cigaros_favorites_v2";
  const BACKUP = "cigaros_favorites_backup_before_v2";
  const EVENT = "cigaros:favorites-changed";
  const SOURCES = [
    "cigaros_user_favorite_cigars_v1", "cigaros_pos_favorites_cigars",
    "cigarSocialFavorites", "cigaros_favorites_v1", "cigarosFavorites",
    "favorites", "cs_favorites_v1", "cigaros_favorite_keys"
  ];
  const OLD_ORDER = "cigarSocialFavoritesOrder";
  const CSV = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const text = v => String(v ?? "").trim();
  const norm = v => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/["'’]/g, "").replace(/\s+/g, " ").trim();
  const compact = v => norm(v).replace(/[^a-z0-9]/g, "");
  const unique = a => [...new Set(a.filter(Boolean))];
  const fields = ["brand", "line", "cigar", "vitola", "ring", "length", "origin", "country", "manufacturer", "wrapper", "binder", "filler", "strength", "shape", "shade", "notes"];
  let catalogPromise = null;
  let queue = Promise.resolve();

  function json(raw, fallback) { try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } }
  function field(row, names) {
    if (!row || typeof row !== "object") return "";
    for (const name of names) {
      if (row[name] != null && text(row[name])) return text(row[name]);
    }
    const wanted = new Set(names.map(compact));
    for (const [name, value] of Object.entries(row)) {
      if (wanted.has(compact(name)) && value != null && text(value)) return text(value);
    }
    return "";
  }
  function imagePath(value) {
    const v = text(value);
    if (!v || /^(blob:|data:|javascript:)/i.test(v)) return "";
    try {
      const url = new URL(v.startsWith("http") || v.startsWith("/") ? v : "/" + v, location.origin);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      return url.origin === location.origin ? url.pathname + url.search : url.href;
    } catch { return ""; }
  }
  function localHref(value) {
    if (!value) return "";
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin ? url.pathname + url.search : "";
    } catch { return ""; }
  }
  function hrefKey(href) {
    try {
      const u = new URL(href, location.origin);
      return u.searchParams.get("key") || u.searchParams.get("id") || "";
    } catch { return ""; }
  }
  function hrefAlias(href) {
    if (!href) return "";
    const u = new URL(href, location.origin);
    const identity = u.searchParams.get("key") || u.searchParams.get("id") || u.searchParams.get("slug");
    if (identity && /\/pos\/cigars\/cigar(?:\.html)?\/?$/.test(u.pathname)) return "key:" + norm(identity);
    u.searchParams.sort();
    return "url:" + norm(u.pathname.replace(/\.html$/, "").replace(/\/$/, "") + u.search);
  }
  function normalize(raw, forcedType) {
    if (typeof raw === "string" || typeof raw === "number") raw = { key: String(raw), type: forcedType || "cigar" };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const candidateType = text(forcedType || raw.type || raw.kind || raw.category || "cigar").toLowerCase().replace(/s$/, "");
    const type = ["cigar", "brand", "shop"].includes(candidateType) ? candidateType : "cigar";
    const item = { type };
    for (const key of fields) item[key] = field(raw, [key]);
    item.name = field(raw, ["displayName", "name", "title", "Cigar"]);
    item.cigar = field(raw, ["cigar", "Cigar"]);
    item.vitola ||= field(raw, ["style", "size"]);
    item.ring ||= field(raw, ["Ring Gauge", "RG"]);
    item.shade ||= field(raw, ["Wrapper Shade", "wrapper_shade"]);
    item.origin ||= field(raw, ["country", "Country of Origin"]);
    item.country ||= item.origin || text(raw.meta);
    item.img = imagePath(field(raw, ["img", "image", "Cigar IMG", "photo"]));
    item.imageCandidates = unique([item.img, ...(Array.isArray(raw.imageCandidates) ? raw.imageCandidates.map(imagePath) : [])]);
    item.href = localHref(field(raw, ["href", "url", "Detail URL"]));
    item.key = field(raw, ["key", "cigarId", "Cigar ID", "cigar_id"]);
    if (!item.key && !text(raw.id).startsWith(type + "|")) item.key = text(raw.id);
    if (/^https?:|^\//.test(item.key)) item.key = hrefKey(item.key) || item.key;
    if (!item.key) item.key = hrefKey(item.href);
    if (type === "brand") { item.brand ||= item.name; item.name ||= item.brand; }
    if (!item.name && item.cigar) item.name = [item.line, item.cigar].filter(Boolean).join(" ");
    if (!item.key && item.name) item.key = type === "cigar" ? [item.brand, item.name, item.vitola].join("|") : item.name;
    if (!item.key && !item.href) return null;
    if (!item.href) {
      if (type === "cigar") item.href = "/pos/cigars/cigar.html?key=" + encodeURIComponent(item.key);
      if (type === "brand") item.href = "/pos/cigars/brand?brand=" + encodeURIComponent(item.brand || item.name);
      // Never guess a specific shop slug: retain its existing URL or directory fallback.
      if (type === "shop") item.href = "/shops/";
    }
    const aliases = [item.key ? "key:" + norm(item.key) : "", text(raw.id) ? "key:" + norm(raw.id) : ""];
    if (!(type === "shop" && /^\/shops\/?$/.test(item.href))) aliases.push(hrefAlias(item.href));
    item.aliases = unique([...(Array.isArray(raw.aliases) ? raw.aliases : []), ...aliases]);
    item.uid = text(raw.uid) || `${type}:${encodeURIComponent(norm(item.key || item.href))}`;
    item.posImageKey = text(raw.posImageKey) || (type === "cigar" ? item.key : "");
    item.savedAt = Number(raw.savedAt) || 0;
    item.catalogKey = text(raw.catalogKey);
    return item;
  }
  function same(a, b) {
    if (a.type !== b.type) return false;
    return a.uid === b.uid || a.aliases.some(alias => b.aliases.includes(alias));
  }
  function merge(a, b, preferNew = false) {
    const result = { ...a };
    for (const [key, value] of Object.entries(b)) {
      if (["uid", "aliases", "imageCandidates", "savedAt"].includes(key)) continue;
      if (value !== "" && value != null && (preferNew || !result[key])) result[key] = value;
    }
    result.uid = a.uid;
    result.aliases = unique([...a.aliases, ...b.aliases]);
    result.imageCandidates = unique([result.img, ...a.imageCandidates, ...b.imageCandidates]);
    result.savedAt = a.savedAt || b.savedAt;
    return result;
  }
  function dedupe(items) {
    const result = [];
    for (const item of items.filter(Boolean)) {
      const index = result.findIndex(other => same(other, item));
      if (index < 0) result.push(item);
      else result[index] = merge(result[index], item);
    }
    return result;
  }
  function unpack(parsed, type) {
    if (Array.isArray(parsed)) return parsed.map(v => normalize(v, type)).filter(Boolean);
    if (!parsed || typeof parsed !== "object") return [];
    if (Array.isArray(parsed.items)) return unpack(parsed.items, type);
    const grouped = ["cigars", "brands", "shops"].filter(k => Array.isArray(parsed[k]));
    if (grouped.length) return grouped.flatMap(k => unpack(parsed[k], k.slice(0, -1)));
    if (parsed.key || parsed.name || parsed.href || parsed.brand) return [normalize(parsed, type)].filter(Boolean);
    return Object.entries(parsed).flatMap(([k, v]) => {
      if (v === true) return [normalize({key:k}, type)].filter(Boolean);
      return typeof v === "object" && v ? [normalize({key:k, ...v}, type)].filter(Boolean) : [];
    });
  }
  function storageError(error) {
    return new Error("Favorites could not be saved in this browser. Check available storage and site permissions; your existing data has not been cleared. " + (error?.message || ""));
  }
  function writeDocument(doc) {
    try { localStorage.setItem(KEY, JSON.stringify(doc)); } catch (error) { throw storageError(error); }
  }
  function readDocument() {
    let raw;
    try { raw = localStorage.getItem(KEY); } catch (error) { throw storageError(error); }
    if (raw === null) return migrate();
    const doc = json(raw, null);
    if (!doc || doc.version !== 2 || !Array.isArray(doc.items)) {
      throw new Error("Saved Favorites data needs recovery. It has not been overwritten. Keep your browser data and contact support.");
    }
    return doc;
  }
  function migrate() {
    const snapshot = {};
    for (const key of [...SOURCES, OLD_ORDER]) snapshot[key] = localStorage.getItem(key);
    if (localStorage.getItem(BACKUP) === null) {
      try { localStorage.setItem(BACKUP, JSON.stringify({savedAt:Date.now(), values:snapshot})); }
      catch (error) { throw storageError(error); }
    }
    const imported = SOURCES.flatMap(key => unpack(json(snapshot[key], [])));
    const items = dedupe(imported);
    const order = json(snapshot[OLD_ORDER], []);
    if (Array.isArray(order)) {
      const ranks = new Map(order.map((key, index) => ["key:" + norm(key), index]));
      const rank = item => Math.min(...item.aliases.map(a => ranks.get(a) ?? Infinity));
      items.sort((a,b) => rank(a) - rank(b));
    }
    const doc = {version:2, revision:0, migratedAt:Date.now(), updatedAt:Date.now(), items};
    writeDocument(doc);
    // Old stores are left untouched here. They are never re-imported after v2 exists.
    return doc;
  }
  function mirror(doc) {
    // Compatibility outputs for other existing profile widgets. Never primary inputs after migration.
    const cigars = doc.items.filter(i => i.type === "cigar");
    const mirrorValues = {
      cigaros_user_favorite_cigars_v1: cigars.map(i => ({...i, image:i.img, url:i.href})),
      cigaros_pos_favorites_cigars: cigars.map(i => ({...i, displayName:i.name, image:i.img, url:i.href})),
      cigaros_favorite_keys: cigars.map(i => i.key),
      cigarSocialFavorites: doc.items.map(i => ({...i, id:i.key, image:i.img, url:i.href})),
      cigarSocialFavoritesOrder: doc.items.map(i => i.key)
    };
    for (const [key, value] of Object.entries(mirrorValues)) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (error) { console.warn("[Favorites] Canonical save succeeded; compatibility mirror failed:", key, error); }
    }
  }
  function mutate(fn) {
    const run = () => {
      const doc = readDocument();
      const before = JSON.stringify(doc.items);
      const value = fn(doc);
      if (before !== JSON.stringify(doc.items)) {
        doc.revision = (doc.revision || 0) + 1; doc.updatedAt = Date.now();
        writeDocument(doc); mirror(doc);
        window.dispatchEvent(new CustomEvent(EVENT, {detail:{revision:doc.revision}}));
      }
      return value;
    };
    const locked = () => navigator.locks?.request ? navigator.locks.request(KEY, run) : run();
    const job = queue.then(locked, locked);
    queue = job.catch(() => {});
    return job;
  }
  function all() { return readDocument().items.map(item => normalize(item)).filter(Boolean); }
  function has(payload) {
    const item = normalize(payload);
    return !!item && all().some(existing => same(existing, item));
  }
  function set(payload, wanted) {
    const item = normalize(payload);
    if (!item) return Promise.reject(new Error("This cigar does not have a usable identity or detail link."));
    return mutate(doc => {
      const matches = doc.items.filter(old => same(old, item));
      if (!wanted) { doc.items = doc.items.filter(old => !same(old, item)); return false; }
      if (matches.length) {
        const first = matches[0];
        doc.items = doc.items.filter(old => !same(old, item) || old.uid === first.uid);
        const index = doc.items.findIndex(old => old.uid === first.uid);
        doc.items[index] = merge(first, item, true);
      } else doc.items.push({...item, savedAt:Date.now()});
      return true;
    });
  }
  function remove(uid) {
    return mutate(doc => { doc.items = doc.items.filter(item => item.uid !== uid); });
  }
  function reorder(type, ids) {
    return mutate(doc => {
      const wanted = unique(ids);
      const byId = new Map(doc.items.filter(i => i.type === type).map(i => [i.uid, i]));
      const ordered = wanted.map(id => byId.get(id)).filter(Boolean);
      const set = new Set(ordered.map(i => i.uid)); let cursor = 0;
      doc.items = doc.items.map(item => set.has(item.uid) ? ordered[cursor++] : item);
    });
  }
  function subscribe(callback) {
    const changed = () => callback();
    const storage = event => { if (event.key === KEY || event.key === null) callback(); };
    window.addEventListener(EVENT, changed);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(EVENT, changed); window.removeEventListener("storage", storage); };
  }
  function parseCSV(input) {
    const rows = []; let row = [], value = "", quoted = false;
    const text = input.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i+1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && ch === ',') { row.push(value); value = ""; }
      else if (!quoted && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(value); rows.push(row); row = []; value = "";
      } else value += ch;
    }
    if (value || row.length) {row.push(value); rows.push(row);}
    const headers = rows.shift() || [];
    return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(headers.map((h,i) => [h.trim(), r[i] || ""])));
  }
  function rowPayload(row) {
    const brand = field(row, ["Brand", "Brand Name"]);
    const line = field(row, ["Line", "Series"]);
    const cigar = field(row, ["Cigar", "Name"]);
    const vitola = field(row, ["Vitola", "Style", "Size"]);
    const name = [line, cigar].filter(Boolean).join(" ");
    const key = field(row, ["Key", "Cigar ID", "id", "row_id"]) || [brand, name, vitola].join("|");
    return normalize({...row, type:"cigar", key, catalogKey:key, name, cigar, brand, line, vitola,
      href:"/pos/cigars/cigar.html?key=" + encodeURIComponent(key),
      img:field(row, ["Cigar IMG", "image", "photo"]), posImageKey:key});
  }
  function recordAliases(item) {
    const key3 = [item.brand, item.name, item.vitola].join("|");
    const key4 = [item.brand, item.line, item.cigar, item.vitola].filter(Boolean).join("|");
    return unique([...item.aliases, "key:"+norm(key3), "key:"+norm(key4)]);
  }
  function resolve(item, rows) {
    if (item.type !== "cigar") return null;
    let matches = rows.filter(row => item.aliases.some(a => recordAliases(row).includes(a)));
    if (!matches.length) {
      const names = unique([item.name, item.cigar].map(norm));
      if (!item.brand || !names.length) return null;
      matches = rows.filter(row => {
        if (compact(item.brand) !== compact(row.brand)) return false;
        if (item.vitola && norm(item.vitola) !== norm(row.vitola)) return false;
        for (const k of ["ring", "length", "origin"]) if (item[k] && row[k] && norm(item[k]) !== norm(row[k])) return false;
        const candidates = [row.cigar, row.name, [row.brand, row.name].join(" "), [row.brand, row.cigar].join(" ")].map(norm);
        return names.some(name => candidates.includes(name));
      });
    }
    const identities = unique(matches.map(row => norm(row.catalogKey)));
    // Duplicate accolade rows for one cigar are safe; ambiguous different cigars are not.
    if (identities.length !== 1) return null;
    return matches.sort((a,b) => Object.values(b).filter(Boolean).length - Object.values(a).filter(Boolean).length)[0];
  }
  async function catalog() {
    if (!catalogPromise) catalogPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      try {
        const response = await fetch(CSV, {cache:"no-store", signal:controller.signal});
        if (!response.ok) throw new Error("Cigar catalog returned HTTP " + response.status);
        const input = await response.text();
        if (/^\s*</.test(input)) throw new Error("Cigar catalog returned a page instead of CSV.");
        return parseCSV(input).map(rowPayload).filter(Boolean);
      } finally { clearTimeout(timer); }
    })().catch(error => {catalogPromise = null; throw error;});
    return catalogPromise;
  }
  function reconcile(rows) {
    return mutate(doc => {
      doc.items = dedupe(doc.items.map(old => {
        const match = resolve(old, rows);
        if (!match) return old;
        const merged = merge(old, match);
        // Use an actual matched key, but keep old aliases and the original UID/order.
        merged.key = match.key; merged.catalogKey = match.key;
        merged.posImageKey = match.posImageKey;
        merged.href = match.href;
        merged.aliases = unique([...merged.aliases, ...recordAliases(match)]);
        return merged;
      }));
    });
  }
  async function hydrate() { return reconcile(await catalog()); }
  function hydrateRecords(records) { return reconcile(records.map(rowPayload).filter(Boolean)); }
  function imageCandidates(item) {
    const brand = compact(item.brand), line = compact(item.line), cigar = compact(item.cigar || item.name), vitola = compact(item.vitola);
    const names = unique([brand+line+cigar, brand+line+cigar+vitola, line+cigar, line+cigar+vitola, line+vitola, brand+cigar, brand+cigar+vitola, cigar, cigar+vitola, compact(item.name)]);
    const paths = [item.img, ...(item.imageCandidates || [])];
    if (brand && cigar) {
      if (norm(item.origin) === "cuba") names.forEach(n => paths.push(`/img/cigars/cuban/${brand}/${n}.png`));
      names.forEach(n => paths.push(`/img/cigars/${brand}/${n}.png`));
    }
    return unique(paths.map(imagePath));
  }
  async function localImage(key) {
    if (!key || !window.indexedDB) return null;
    return new Promise(resolve => {
      let settled = false;
      const done = value => {if (!settled) {settled=true; clearTimeout(timer); resolve(value);}};
      const timer = setTimeout(() => done(null), 3000);
      const request = indexedDB.open("cigaros_demo_pos");
      request.onupgradeneeded = () => { request.transaction.abort(); };
      request.onerror = () => done(null);
      request.onblocked = () => done(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("records")) {db.close(); done(null); return;}
        const tx = db.transaction("records", "readonly");
        const get = tx.objectStore("records").get(key);
        tx.oncomplete = () => {db.close(); done(get.result?.image?.blob instanceof Blob ? get.result.image.blob : null);};
        tx.onabort = () => {db.close(); done(null);};
      };
    });
  }
  window.CigarFavorites = Object.freeze({version:2, KEY, BACKUP, EVENT,
    all, has, set, remove, reorder, subscribe, hydrate, hydrateRecords, catalog, normalize,
    imageCandidates, imagePath, localHref, localImage, field, norm, compact,
    exportBackup: () => ({current:readDocument(), beforeRepair:json(localStorage.getItem(BACKUP),null)})});
})();


/* /pos/cigars/brand.js — Favorites repair 2026-10-12-r1.
   Existing brand selection, list/cart and action-sheet classes retained.
   Favorite writes now use the same store as detail and Favorites pages. */
(() => {
  "use strict";
  const CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const BRANDS_URL = "/data/brands.json";
  const Favorites = window.CigarFavorites;
  const $ = (sel,root=document) => root.querySelector(sel);
  const $$ = (sel,root=document) => Array.from(root.querySelectorAll(sel));
  const brandTitle=$("#brand-title"),brandIconImg=$("#brand-icon-img"),searchInput=$("#brand-search"),btnFilters=$("#btn-filters"),btnBands=$("#btn-bands"),seg=$("#wrapper-seg"),segBtns=$$(".seg-btn",seg||document),listEl=$("#brand-list"),backBtn=$("#back-btn"),brandSearchBtn=$("#brandSearchBtn");
  const state={brand:"",brandQuery:"",brandMeta:null,brandsAll:[],rowsAll:[],search:"",wrapperMode:"all",filters:{vitola:new Set(),ring:new Set(),length:new Set(),strength:new Set(),shape:new Set(),shade:new Set()},actionRow:null,singleQty:1,boxQty:0};
  let favoriteBusy=false;
  function norm(v){return String(v??"").trim().replace(/\s+/g," ");}
  function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function normalizeBrand(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g,"and").replace(/[^a-z0-9]+/g,"");}
  function normalizeLoose(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/["'’]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function normalizeAssetPath(path){const v=String(path||"").trim();if(!v)return "";if(/^https?:\/\//i.test(v))return v;return v.startsWith("/")?v:`/${v}`;}
  function getParam(name){try{return new URL(location.href).searchParams.get(name)||"";}catch{return "";}}
  function parseCSV(text){const rows=[];let cur=[],field="",inQuotes=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(inQuotes){if(ch==='"'&&next==='"'){field+='"';i++;}else if(ch==='"')inQuotes=false;else field+=ch;}else{if(ch==='"')inQuotes=true;else if(ch===","){cur.push(field);field="";}else if(ch==="\n"){cur.push(field);rows.push(cur);cur=[];field="";}else if(ch!=="\r")field+=ch;}}cur.push(field);rows.push(cur);return rows;}
  function normalizeHeader(h){return String(h||"").trim().toLowerCase().replace(/\s+/g," ").replace(/[^a-z0-9 ]/g,"").replace(/ /g,"_");}
  function mapRows(csv){const keys=(csv[0]||[]).map(normalizeHeader);return csv.slice(1).filter(r=>r&&!r.every(c=>!String(c||"").trim())).map(r=>{const obj={};keys.forEach((k,i)=>{obj[k]=(r[i]??"").trim();});return obj;});}
  function getField(r,keys){for(const k of keys){if(r&&r[k]!=null&&String(r[k]).trim()!=="")return String(r[k]).trim();}return "";}
  function resolveBrandVal(r){return getField(r,["brand","brand_name","manufacturer_brand","cigar_brand"]);}
  function resolveManufacturerVal(r){return getField(r,["manufacturer","maker"]);}
  function resolveLine(r){return getField(r,["line","series"]);}
  function resolveName(r){return getField(r,["cigar","name"]);}
  function resolveVitola(r){return getField(r,["vitola","style","vitola_name","size"]);}
  function resolveOrigin(r){return getField(r,["origin","country_of_origin","country"]);}
  function resolveRing(r){return getField(r,["ring","ring_gauge","rg"]);}
  function resolveLength(r){return getField(r,["length"]);}
  function resolveShape(r){return getField(r,["shape"]);}
  function resolveWrapper(r){return getField(r,["wrapper"]);}
  function resolveBinder(r){return getField(r,["binder"]);}
  function resolveFiller(r){return getField(r,["filler"]);}
  function resolveStrength(r){return getField(r,["strength"]);}
  function resolveShade(r){return getField(r,["wrapper_shade","wrapper_shade_type","shade","wrapper"]);}
  function resolveBrandImage(r){return getField(r,["brand_img","brand_image","brandicon","brand_icon"]);}
  function resolveLineImage(r){return getField(r,["line_img","line_image","lineicon","line_icon","brand_line_img"]);}
  function resolveDetailKey(r){return getField(r,["key","cigar_id","id","row_id"]);}
  function resolvePriceNumber(r){const raw=getField(r,["msrp","cigar_msrp","cigar_retail"]),n=Number(String(raw||"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)&&n>0?n:0;}
  function resolvePrice(r){const n=resolvePriceNumber(r);return n>0?money(n):"—";}
  function resolveBoxCount(r){const raw=getField(r,["box_count","box_qty","box_quantity","count_per_box"]),n=Number(String(raw||"").replace(/[^0-9.]/g,""));return Number.isFinite(n)&&n>0?n:20;}
  function resolveBoxMsrpNumber(r){const raw=getField(r,["box_msrp","box_price","box_retail"]),n=Number(String(raw||"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)&&n>0?n:resolvePriceNumber(r)*resolveBoxCount(r);}
  function resolveDisplayName(r){const line=resolveLine(r),cigar=resolveName(r);return [line,cigar].filter(Boolean).join(" ").trim()||cigar||line||"";}
  function resolveFavoriteKey(r){return resolveDetailKey(r)||[resolveBrandVal(r)||state.brand,resolveDisplayName(r),resolveVitola(r)].join("|");}
  function favoritePayload(r){
    const key=resolveFavoriteKey(r);
    return {type:"cigar",key,name:resolveDisplayName(r),cigar:resolveName(r),brand:resolveBrandVal(r)||state.brand,line:resolveLine(r),vitola:resolveVitola(r),ring:resolveRing(r),length:resolveLength(r),manufacturer:resolveManufacturerVal(r),wrapper:resolveWrapper(r),binder:resolveBinder(r),filler:resolveFiller(r),origin:resolveOrigin(r),country:resolveOrigin(r),strength:resolveStrength(r),shape:resolveShape(r),shade:resolveShade(r),
      img:normalizeAssetPath(getField(r,["cigar_img","cigar_image","image","photo"])),href:makeDetailHref(r),posImageKey:resolveDetailKey(r)||key};
  }
  function isCigarFavorite(r){return Favorites.has(favoritePayload(r));}
  function showToast(message){let toast=$(".pos-toast");if(!toast){toast=document.createElement("div");toast.className="pos-toast";toast.setAttribute("role","status");document.body.appendChild(toast);}toast.textContent=message;toast.classList.add("is-showing");clearTimeout(toast.__timer);toast.__timer=setTimeout(()=>toast.classList.remove("is-showing"),2600);}
  function resolveIsCuban(r){const explicit=getField(r,["cuban","is_cuban"]);if(explicit){const v=explicit.toLowerCase().trim();if(["x","yes","true","1","cuban"].includes(v))return true;if(["no","false","0","non-cuban","non cuban"].includes(v))return false;}return resolveManufacturerVal(r).toLowerCase().includes("habanos")||resolveOrigin(r).toLowerCase()==="cuba"||/🇨🇺|\(cuban\)/iu.test(resolveBrandVal(r)+" "+resolveManufacturerVal(r));}
  function brandDisplayName(){return state.brandMeta?.name||state.brand||state.brandQuery||"Brand";}
  function brandSlug(){return normalizeBrand(state.brandMeta?.slug||state.brandMeta?.name||state.brand||state.brandQuery);}
  function brandIconCandidates(){const sheetRow=state.rowsAll.find(r=>normalizeAssetPath(resolveBrandImage(r))),fromSheet=normalizeAssetPath(sheetRow?resolveBrandImage(sheetRow):""),metaImage=normalizeAssetPath(state.brandMeta?.image||state.brandMeta?.icon||state.brandMeta?.svg||state.brandMeta?.img),slug=brandSlug(),out=[];if(fromSheet)out.push(fromSheet);if(metaImage)out.push(metaImage);if(slug)out.push(`/img/icons/brands/${slug}.svg`,`/img/icons/brands/${slug}.png`);return [...new Set(out.filter(Boolean))];}
  function brandIconPath(){return brandIconCandidates()[0]||"";}
  function rowIconCandidatesForRow(r){return [...new Set([normalizeAssetPath(resolveLineImage(r)),normalizeAssetPath(resolveBrandImage(r)),...brandIconCandidates()].filter(Boolean))];}
  function rowIconPathForRow(r){return rowIconCandidatesForRow(r)[0]||"";}
  function bindImageFallback(img,candidates=[],finalBehavior="hide"){if(!img)return;const list=[...new Set(candidates.filter(Boolean))];if(!list.length){if(finalBehavior==="hide")img.style.visibility="hidden";return;}let idx=0;img.style.visibility="";img.onerror=()=>{idx++;if(idx<list.length)img.src=list[idx];else{img.onerror=null;if(finalBehavior==="hide")img.style.visibility="hidden";}};img.src=list[0];}
  function makeDetailHref(r){const detailKey=resolveDetailKey(r);if(detailKey)return `/pos/cigars/cigar.html?key=${encodeURIComponent(detailKey)}`;const key=[state.brand,resolveDisplayName(r),resolveVitola(r)].filter(Boolean).join("|");return `/pos/cigars/cigar.html?key=${encodeURIComponent(key)}`;}
  function buildCartItem(r,type="stick"){
    const isBox=type==="box",unitPrice=isBox?resolveBoxMsrpNumber(r):resolvePriceNumber(r),detailKey=resolveDetailKey(r);
    return {key:`${detailKey||`${normalizeBrand(state.brand)}|${resolveDisplayName(r)}|${resolveVitola(r)}`}|${type}`,type:"cigar",purchaseType:type,category:"Cigars",id:detailKey||resolveName(r),brand:state.brand,manufacturer:resolveManufacturerVal(r),line:resolveLine(r),cigar:resolveName(r),name:`${resolveDisplayName(r)}${isBox?" (Box)":""}`,displayName:resolveDisplayName(r),vitola:resolveVitola(r),ring:resolveRing(r),length:resolveLength(r),shape:resolveShape(r),wrapper:resolveWrapper(r),binder:resolveBinder(r),filler:resolveFiller(r),origin:resolveOrigin(r),shade:resolveShade(r),strength:resolveStrength(r),image:brandIconPath(),msrp:unitPrice,boxCount:resolveBoxCount(r),url:makeDetailHref(r)};
  }
  function money(n){const num=Number(n||0);return Number.isFinite(num)?num.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00";}
  function ensureActionSheet(){
    if($("#pos-action-sheet"))return;
    const sheet=document.createElement("div");sheet.id="pos-action-sheet";sheet.className="pos-action-sheet";sheet.hidden=true;
    sheet.innerHTML=`<div class="pos-action-backdrop" data-action-close></div>
      <div class="pos-action-card" role="dialog" aria-modal="true" aria-label="Add cigar">
        <div class="pos-action-title" id="pos-action-title">Cigar</div>
        <div class="pos-action-lines">
          <div class="pos-action-line"><div class="pos-action-line-top"><div class="pos-action-label">Single</div><div class="pos-action-stepper"><button type="button" data-qty-minus="single" aria-label="Fewer singles">−</button><span id="singleQty">1</span><button type="button" data-qty-plus="single" aria-label="More singles">+</button></div></div><div class="pos-action-line-bottom"><span id="singleUnit">0.00</span><span id="singleTotal">0.00</span></div></div>
          <div class="pos-action-line"><div class="pos-action-line-top"><div class="pos-action-label">Box</div><div class="pos-action-stepper"><button type="button" data-qty-minus="box" aria-label="Fewer boxes">−</button><span id="boxQty">0</span><button type="button" data-qty-plus="box" aria-label="More boxes">+</button></div></div><div class="pos-action-line-bottom"><span id="boxUnit">0.00</span><span id="boxTotal">0.00</span></div></div>
        </div>
        <div class="pos-action-total"><span>Total:</span><strong id="actionTotal">$0.00</strong></div>
        <div class="pos-action-buttons"><button type="button" class="pos-action-cancel" data-action-close>Cancel</button><button type="button" class="pos-action-add" id="actionAddBtn">Add</button></div>
        <button type="button" class="pos-action-favorite" id="actionFavoriteBtn">Save as Favorite</button>
      </div>`;
    document.body.appendChild(sheet);
  }
  function updateActionSheet(){
    const r=state.actionRow;if(!r)return;
    const singlePrice=resolvePriceNumber(r),boxPrice=resolveBoxMsrpNumber(r);
    $("#singleQty").textContent=String(state.singleQty);$("#boxQty").textContent=String(state.boxQty);
    $("#singleUnit").textContent=money(singlePrice);$("#singleTotal").textContent=money(singlePrice*state.singleQty);
    $("#boxUnit").textContent=money(boxPrice);$("#boxTotal").textContent=money(boxPrice*state.boxQty);
    $("#actionTotal").textContent=`$${money(singlePrice*state.singleQty+boxPrice*state.boxQty)}`;
    const btn=$("#actionFavoriteBtn");
    if(btn){try{const saved=isCigarFavorite(r);btn.textContent=saved?"Saved as Favorite":"Save as Favorite";btn.classList.toggle("is-saved",saved);btn.setAttribute("aria-pressed",String(saved));}catch(error){btn.textContent="Save as Favorite";showToast(error.message);}}
  }
  function openActionSheet(r){ensureActionSheet();state.actionRow=r;state.singleQty=1;state.boxQty=0;$("#pos-action-title").textContent=resolveDisplayName(r)||"Cigar";updateActionSheet();const sheet=$("#pos-action-sheet");sheet.hidden=false;requestAnimationFrame(()=>sheet.classList.add("is-open"));if(navigator.vibrate)navigator.vibrate(8);}
  function closeActionSheet(){const sheet=$("#pos-action-sheet");if(!sheet)return;sheet.classList.remove("is-open");setTimeout(()=>{if(!sheet.classList.contains("is-open"))sheet.hidden=true;},180);}
  function addActionItemsToCart(){
    const r=state.actionRow;if(!r)return;
    if(state.singleQty>0){const item=buildCartItem(r,"stick"),qty=window.cigarOSCart?.getItemQty?.(item)||0;window.cigarOSCart?.setQty?.(item,qty+state.singleQty);}
    if(state.boxQty>0){const item=buildCartItem(r,"box"),qty=window.cigarOSCart?.getItemQty?.(item)||0;window.cigarOSCart?.setQty?.(item,qty+state.boxQty);}
    if(navigator.vibrate)navigator.vibrate(12);showToast("Added to invoice");closeActionSheet();
  }
  function openDetail(r){location.href=makeDetailHref(r);}
  function applySearch(rows){const q=state.search.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>[resolveDisplayName(r),resolveVitola(r),resolveRing(r),resolveLength(r),resolveManufacturerVal(r),resolveLine(r),resolveOrigin(r)].join(" ").toLowerCase().includes(q));}
  function applyFilterSets(rows){return rows.filter(r=>{if(state.filters.vitola.size&&!state.filters.vitola.has(resolveVitola(r)))return false;if(state.filters.ring.size&&!state.filters.ring.has(resolveRing(r)))return false;if(state.filters.length.size&&!state.filters.length.has(resolveLength(r)))return false;if(state.filters.strength.size&&!state.filters.strength.has(resolveStrength(r)))return false;if(state.filters.shape.size&&!state.filters.shape.has(resolveShape(r)))return false;if(state.filters.shade.size&&!state.filters.shade.has(resolveShade(r)))return false;return true;});}
  function renderList(rows){
    if(!listEl)return;listEl.innerHTML="";
    if(!rows.length){listEl.innerHTML=`<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;return;}
    rows.forEach(r=>{
      const candidates=rowIconCandidatesForRow(r),iconPath=rowIconPathForRow(r),price=resolvePrice(r),cuban=resolveIsCuban(r),row=document.createElement("article");row.className="brand-row";if(cuban)row.setAttribute("data-cuban","true");
      row.innerHTML=`<img class="row-ico" src="${esc(iconPath)}" alt="" loading="lazy" decoding="async"><div class="brand-row-left"><div class="brand-row-title-wrap"><div class="brand-row-title">${esc(resolveDisplayName(r)||"Unnamed cigar")}</div>${cuban?'<div class="brand-row-flag" aria-hidden="true">🇨🇺</div>':""}</div><div class="brand-row-sub">${esc(resolveVitola(r)||"—")}</div></div><div class="brand-row-right"><div class="brand-row-msrp">${esc(price)}</div><button class="qty-btn qty-btn--plus" type="button" aria-label="Open add menu">+</button></div>`;
      const icon=$(".row-ico",row),left=$(".brand-row-left",row),plus=$(".qty-btn--plus",row);
      bindImageFallback(icon,candidates,"hide");left?.addEventListener("click",()=>openDetail(r));icon?.addEventListener("click",()=>openDetail(r));
      plus?.addEventListener("click",e=>{e.stopPropagation();openActionSheet(r);});listEl.appendChild(row);
    });
  }
  function applyAll(){let rows=[...state.rowsAll];rows=applyFilterSets(rows);rows=applySearch(rows);renderList(rows);setBrandHeader();}
  function ensureBrandManufacturerMeta(){const block=$(".brand-title-block");if(!block)return null;let meta=$(".brand-manufacturer",block);if(!meta){meta=document.createElement("div");meta.className="brand-manufacturer";block.appendChild(meta);}return meta;}
  function setBrandHeader(){const display=brandDisplayName();if(brandTitle)brandTitle.textContent=display||"Brand";const meta=ensureBrandManufacturerMeta(),first=state.rowsAll[0],maker=first?resolveManufacturerVal(first):"";if(meta){const show=maker&&normalizeBrand(maker)!==normalizeBrand(display),cuban=first&&resolveIsCuban(first);meta.textContent=show?`${cuban?"🇨🇺 ":""}${maker}`:"";meta.style.display=show?"":"none";}if(!brandIconImg)return;brandIconImg.alt=display||"Brand";bindImageFallback(brandIconImg,brandIconCandidates(),"hide");}
  function findBrandMeta(query,brands){const q=normalizeBrand(query);if(!q||!Array.isArray(brands))return null;return brands.find(b=>normalizeBrand(b.slug)===q)||brands.find(b=>normalizeBrand(b.name)===q)||brands.find(b=>{const slug=normalizeBrand(b.slug),name=normalizeBrand(b.name);return !!slug&&(slug.includes(q)||q.includes(slug)||name.includes(q)||q.includes(name));})||null;}
  async function loadBrandsMeta(){try{const res=await fetch(`${BRANDS_URL}?v=${Date.now()}`,{cache:"no-store"});if(!res.ok)throw new Error(`brands.json fetch failed: ${res.status}`);const data=await res.json();return Array.isArray(data)?data:[];}catch{return [];}}
  function brandIdentity(value){
    return normalizeBrand(String(value||"").replace(/\(cuban\)/gi, "").replace(/🇨🇺/gu, ""));
  }
  function requestedBrandMarket(){
    const value=getParam("cuban").trim().toLowerCase();
    if(["1","true","yes","cuban"].includes(value))return true;
    if(["0","false","no","domestic","non-cuban"].includes(value))return false;
    if(/🇨🇺|\(cuban\)/iu.test(state.brandQuery))return true;
    const meta=state.brandMeta,q=normalizeBrand(state.brandQuery);
    if(meta&&[meta.slug,meta.name].some(value=>normalizeBrand(value)===q)&&/🇨🇺|\(cuban\)/iu.test(meta.name||""))return true;
    return null;
  }
  function chooseRowsForBrand(rows){
    const needles=[...new Set([state.brandQuery,state.brandMeta?.slug,state.brandMeta?.name,state.brand].map(brandIdentity).filter(Boolean))];
    const market=requestedBrandMarket();
    function selectMarket(matches){
      if(market!==null)return matches.filter(r=>resolveIsCuban(r)===market);
      // Legacy bare links mean domestic when both portfolios share a name.
      // Keep legacy links for Cuban-only brands working, without mixing portfolios.
      const domestic=matches.filter(r=>!resolveIsCuban(r));
      return domestic.length?domestic:matches.filter(resolveIsCuban);
    }
    const exact=rows.filter(r=>needles.includes(brandIdentity(resolveBrandVal(r))));
    if(exact.length)return selectMarket(exact);
    const fuzzy=rows.filter(r=>{const rb=brandIdentity(resolveBrandVal(r));return rb&&needles.some(n=>rb.includes(n)||n.includes(rb));});
    if(fuzzy.length)return selectMarket(fuzzy);
    const makers=rows.filter(r=>needles.includes(brandIdentity(resolveManufacturerVal(r))));
    if(makers.length)return selectMarket(makers);
    const loose=rows.filter(r=>{const b=normalizeLoose(resolveBrandVal(r)),q=normalizeLoose(state.brandQuery);return b&&q&&(b.includes(q)||q.includes(b));});
    return selectMarket(loose);
  }
  backBtn?.addEventListener("click",()=>{if(history.length>1)history.back();else location.href="/pos/cigars/";});
  searchInput?.addEventListener("input",()=>{state.search=searchInput.value||"";applyAll();});
  brandSearchBtn?.addEventListener("click",()=>window.openGlobalSearch?.());
  document.addEventListener("click",async e=>{
    const target=e.target;if(!(target instanceof Element))return;
    if(target.closest("[data-action-close]")){closeActionSheet();return;}
    if(target.closest("[data-qty-plus='single']")){state.singleQty++;updateActionSheet();return;}
    if(target.closest("[data-qty-minus='single']")){state.singleQty=Math.max(0,state.singleQty-1);updateActionSheet();return;}
    if(target.closest("[data-qty-plus='box']")){state.boxQty++;updateActionSheet();return;}
    if(target.closest("[data-qty-minus='box']")){state.boxQty=Math.max(0,state.boxQty-1);updateActionSheet();return;}
    if(target.closest("#actionAddBtn")){addActionItemsToCart();return;}
    if(target.closest("#actionFavoriteBtn")){
      if(!state.actionRow||favoriteBusy)return;
      const row=state.actionRow,button=$("#actionFavoriteBtn");favoriteBusy=true;button.disabled=true;
      try{const payload=favoritePayload(row),wanted=!Favorites.has(payload);await Favorites.set(payload,wanted);showToast(wanted?"Saved to Favorites":"Removed from Favorites");updateActionSheet();}
      catch(error){showToast(error.message);}
      finally{favoriteBusy=false;button.disabled=false;}
    }
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeActionSheet();});
  Favorites.subscribe(()=>{if(state.actionRow)updateActionSheet();});
  window.addEventListener("pageshow",()=>{if(state.actionRow)updateActionSheet();});
  if(btnBands)btnBands.style.display="none";if(seg)seg.style.display="none";segBtns.forEach(b=>b.classList.remove("is-on"));
  async function boot(){
    if(!listEl)return;ensureActionSheet();state.brandQuery=(getParam("brand")||"Padron").trim();
    state.brandsAll=await loadBrandsMeta();state.brandMeta=findBrandMeta(state.brandQuery,state.brandsAll);state.brand=state.brandMeta?.name||state.brandQuery;
    const res=await fetch(CSV_URL,{cache:"no-store"});if(!res.ok)throw new Error(`CSV fetch failed: ${res.status}`);
    const rows=mapRows(parseCSV(await res.text()));
    try{await Favorites.hydrateRecords(rows);}catch(error){showToast(error.message);}
    state.rowsAll=chooseRowsForBrand(rows).map(r=>({...r,wrapper_shade:resolveShade(r)}));
    if(!state.rowsAll.length){listEl.innerHTML=`<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;setBrandHeader();return;}
    applyAll();
  }
  boot().catch(error=>{console.error("Brand page boot failed:",error);if(listEl)listEl.innerHTML='<div class="empty">Error loading brand.</div>';});
})();
