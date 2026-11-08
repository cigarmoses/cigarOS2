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

  // Media Lists components reused here; no publication rankings or catalog fetches added.
  const content=listEl, LOCAL_FAVORITES_KEY="cigaros_pos_favorites_local_v1", FAVORITES_ORDER_KEY="cigaros_pos_favorites_order_v1";
  const IMPORT_SOURCE_KEYS=["cigaros_pos_favorites_cigars","cigaros_user_favorite_cigars_v1"];
  const safeDetailHref=Favorites.localHref;
  const localSaveNotice=message=>{if(message)showToast(message);};
  const buildBrandIconCandidates=r=>[...new Set([normalizeAssetPath(resolveBrandImage(r)),...brandIconCandidates()].filter(Boolean))];
  const publicationIsCuban=resolveIsCuban;
  const publicationCardLabel=r=>[resolveBrandVal(r),shareCaption(["",resolveLine(r),resolveName(r),resolveVitola(r)])];
  const syncLists=()=>{};
  const brandListStore={read(){
    const raw=localStorage.getItem("cigaros_favorite_lists_v1"), lists=raw===null?{}:JSON.parse(raw);
    if(!lists || typeof lists!=="object" || Array.isArray(lists) || Object.values(lists).some(v=>!Array.isArray(v)||v.some(id=>typeof id!=="string")))throw Error("Saved Lists could not be read. They have not been overwritten.");
    return lists;
  }};
      function detailKeyFromURL(value){
        try{
          const href = safeDetailHref(value);
          if(!href) return "";
          const url = new URL(href, location.origin);
          return url.searchParams.get("key") || url.searchParams.get("id") || "";
        }catch{ return ""; }
      }

      function normalizeLocalFavorite(raw){
        if(typeof raw === "string" || typeof raw === "number") raw = {key:String(raw)};
        if(!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const kind = String(raw.type || "cigar").toLowerCase();
        if(!["cigar", "cigars"].includes(kind)) return null;
        const item = {};
        // Keep metadata, but never store temporary blob URLs or image binaries.
        for(const [key,value] of Object.entries(raw)){
          if(["__proto__", "constructor", "prototype"].includes(key)) continue;
          if(typeof value === "string") item[key] = /^blob:/i.test(value) ? "" : value;
          else if(typeof value === "number" || typeof value === "boolean") item[key] = value;
        }
        for(const key of ["imageCandidates", "_localAliases"]){
          if(Array.isArray(raw[key])) item[key] = [...new Set(raw[key].filter(v =>
            typeof v === "string" && v && !/^blob:/i.test(v)
          ))];
        }
        if(raw._localRecord && typeof raw._localRecord === "object" && !Array.isArray(raw._localRecord)){
          item._localRecord = Object.fromEntries(Object.entries(raw._localRecord).filter(([key,value]) =>
            !["__proto__", "constructor", "prototype"].includes(key) &&
            ["string", "number", "boolean"].includes(typeof value) &&
            !(typeof value === "string" && /^blob:/i.test(value))
          ));
        }
        const explicit = norm(raw.key || raw.id);
        item.key = detailKeyFromURL(explicit) || explicit ||
          detailKeyFromURL(raw.href || raw.url) ||
          (raw.brand && (raw.cigar || raw.name || raw.displayName)
            ? [raw.brand, raw.line, raw.cigar || raw.name || raw.displayName, raw.vitola].filter(Boolean).join("|") : "");
        if(!item.key) return null;
        item.type = "cigar";
        return item;
      }

      function localAliases(item){
        if(!item) return [];
        const key = norm(item.key || item.id);
        const hrefKey = detailKeyFromURL(item.href || item.url);
        const catalogKey = item._localRecord ? resolveDetailKey(item._localRecord) : "";
        return [...new Set([
          ...[key, hrefKey, catalogKey].filter(Boolean).map(value => "key:" + value),
          ...(Array.isArray(item._localAliases) ? item._localAliases : [])
        ])];
      }

      function localItemIndex(items, item){
        const aliases = new Set(localAliases(item));
        return items.findIndex(saved => localAliases(saved).some(alias => aliases.has(alias)));
      }

      function mergeLocalMetadata(saved, incoming){
        const result = {...saved};
        for(const [key,value] of Object.entries(incoming)){
          if(["key", "_localAliases", "_localRecord"].includes(key)) continue;
          // Existing resolved data wins over a stale import; fill missing fields.
          if((result[key] === undefined || result[key] === "") && value !== "") result[key] = value;
        }
        result._localAliases = [...new Set([...localAliases(saved), ...localAliases(incoming)])];
        if(!result._localRecord && incoming._localRecord) result._localRecord = incoming._localRecord;
        return result;
      }

      function readLocalDocument(){
        const value = localStorage.getItem(LOCAL_FAVORITES_KEY);
        if(value === null){
          let oldOrder = [];
          try{
            const parsed = JSON.parse(localStorage.getItem(FAVORITES_ORDER_KEY) || "[]");
            if(Array.isArray(parsed)) oldOrder = parsed.filter(id => typeof id === "string");
          }catch{ /* The separate old order may be missing; leave it untouched. */ }
          return {version:1, items:[], order:oldOrder, sources:{}};
        }
        let doc;
        try{ doc = JSON.parse(value); }
        catch{ throw new Error("The local Favorites copy could not be read. It has not been overwritten."); }
        if(!doc || doc.version !== 1 || !Array.isArray(doc.items) || !Array.isArray(doc.order) ||
           !doc.sources || typeof doc.sources !== "object" || Array.isArray(doc.sources)){
          throw new Error("The local Favorites copy has an unrecognized format. It has not been overwritten.");
        }
        if(doc.items.some(item => !item || typeof item !== "object" || typeof item.key !== "string" || !item.key)){
          throw new Error("A saved favorite could not be read. The local copy has not been overwritten.");
        }
        return doc;
      }

      function writeLocalDocument(doc){
        const text = JSON.stringify(doc);
        try{
          if(localStorage.getItem(LOCAL_FAVORITES_KEY) !== text){
            localStorage.setItem(LOCAL_FAVORITES_KEY, text);
            if(localStorage.getItem(LOCAL_FAVORITES_KEY) !== text) throw new Error("Save verification failed.");
          }
        }catch(error){
          localSaveNotice("Favorites could not be saved in this browser. Check that website storage is allowed and not full. Keep this page open; your original saved lists have not been changed.");
          throw error;
        }
      }

      function importFingerprint(item){
        // A newly saved POS entry has a new savedAt value. Do not use image or
        // price changes as a signal to resurrect an explicitly cleared item.
        return JSON.stringify([item.key, item.savedAt ?? item.addedAt ?? item.createdAt ?? ""]);
      }

      function importCurrentFavorites(){
        const doc = readLocalDocument();
        const warnings = [];
        for(const source of IMPORT_SOURCE_KEYS){
          const value = localStorage.getItem(source);
          let entries;
          try{
            const parsed = value === null ? [] : JSON.parse(value);
            entries = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : null);
            if(!entries) throw new Error("Unrecognized saved-list format.");
          }catch(error){
            warnings.push("One source list could not be read. The local Favorites copy is still retained.");
            continue; // Malformed sources never wipe the last observed import.
          }
          const items = entries.map(normalizeLocalFavorite).filter(Boolean);
          const previous = new Set(Array.isArray(doc.sources[source]) ? doc.sources[source] : []);
          const current = [];
          for(const item of items){
            const fingerprint = importFingerprint(item);
            current.push(fingerprint);
            const index = localItemIndex(doc.items, item);
            if(index >= 0) doc.items[index] = mergeLocalMetadata(doc.items[index], item);
            else if(!previous.has(fingerprint)){
              item._localAliases = localAliases(item);
              doc.items.push(item);
            }
          }
          doc.sources[source] = [...new Set(current)];
        }
        const ids = doc.items.map(item => item.key);
        const present = new Set(ids);
        doc.order = [...new Set([...doc.order.filter(id => present.has(id)), ...ids])];
        writeLocalDocument(doc);
        localSaveNotice(warnings[0] || "");
        return doc;
      }

      let publicationPanelSerial=0;
      let publicationSaveQueue=Promise.resolve();
      function publicationActionIcon(kind){
        const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
        for(const [key,value] of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.8","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false"}))svg.setAttribute(key,value);
        const paths=kind==="favorites" ? ["m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.19l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9L12 3Z"]
          : kind==="wishlist" ? ["M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z","M9 10h6m-3-3v6"]
          : kind==="card" ? ["M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z","M8 8h8M8 12h8M8 16h5"] : ["m6 9 6 6 6-6"];
        paths.forEach((d,index)=>{const path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d",d);if(kind==="wishlist" && index)path.classList.add("publication-icon-plus");svg.append(path);});
        return svg;
      }
      function publicationFavoritePayload(record,favorite){
        const key=resolveFavoriteKey(record),api=window.CigarFavorites;
        return {type:"cigar",key,catalogKey:key,posImageKey:resolveDetailKey(record),
          brand:resolveBrandVal(record),line:resolveLine(record),cigar:resolveName(record),name:resolveDisplayName(record),
          vitola:resolveVitola(record),ring:resolveRing(record),length:resolveLength(record),
          wrapper:resolveWrapper(record),binder:resolveBinder(record),filler:resolveFiller(record),
          origin:resolveOrigin(record),strength:resolveStrength(record),shape:resolveShape(record),
          shade:getField(record,["wrapper_shade","wrapper_shade_type","wrappershade","shade"]),
          href:makeDetailHref(record),img:record.__publicationPhotoOverride || getField(record,["cigar_img","cigar_image","image"]) || "",
          aliases:localAliases({...favorite,_localRecord:record}).filter(alias=>alias.startsWith("key:")).map(alias=>"key:"+api.norm(alias.slice(4)))};
      }
      function publicationWishListName(lists){
        return Object.hasOwn(lists,"Wish List") ? "Wish List" : Object.keys(lists).find(name=>name.replace(/\s+/g,"").toLowerCase()==="wishlist") || null;
      }
      function publicationSavedState(ctx){
        const api=window.CigarFavorites,payload=api.normalize(publicationFavoritePayload(ctx.record,ctx.favorite));
        // Do not call has()/all() here: first-use migration belongs to an explicit save.
        const raw=localStorage.getItem(api.KEY);
        let items=[];
        if(raw!==null){
          const doc=JSON.parse(raw);
          if(!doc || doc.version!==2 || !Array.isArray(doc.items))throw Error("Saved Favorites could not be read. Your saved data has not been changed.");
          items=doc.items;
        }else{
          for(const key of IMPORT_SOURCE_KEYS){
            try{const value=JSON.parse(localStorage.getItem(key)||"[]");items.push(...(Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[]));}catch{/* The save helper handles recovery without replacing malformed data. */}
          }
        }
        const favorited=!!payload && items.map(item=>api.normalize(item)).filter(Boolean).some(item=>item.type===payload.type && (item.uid===payload.uid || item.aliases.some(alias=>payload.aliases.includes(alias))));
        const local=readLocalDocument(),incoming=normalizeLocalFavorite({...ctx.favorite,key:ctx.id,_localRecord:ctx.record});
        const index=localItemIndex(local.items,incoming),saved=index<0?null:local.items[index];
        const aliases=new Set([...localAliases(incoming),...localAliases(saved)].map(alias=>alias.replace(/^key:/,"")));
        const lists=brandListStore.read(),wishName=publicationWishListName(lists);
        return {favorited,wished:!!wishName && lists[wishName].some(id=>aliases.has(id.replace(/^key:/,""))),wishName,saved};
      }
      function refreshPublicationActionState(row){
        const ctx=row.publicationContext;
        if(!ctx?.actions || ctx.record.__publicationOnly)return;
        try{
          const saved=publicationSavedState(ctx);
          for(const [kind,yes] of [["favorites",saved.favorited],["wishlist",saved.wished]]){
            const button=ctx.actions[kind];
            if(button.dataset.busy==="true")continue;
            button.classList.toggle("is-saved",yes);
            button.setAttribute("aria-disabled",String(yes));
            button.setAttribute("aria-label",`${yes?"Already in":"Add to"} ${kind==="favorites"?"Favorites":"Wish List"}: ${ctx.label}`);
            button.querySelector(".publication-action-label").textContent=yes ? kind==="favorites"?"Favorited":"On Wish List" : kind==="favorites"?"Favorites":"Wish List";
          }
        }catch(error){ctx.status.textContent=error.message;}
      }
      function refreshPublicationActionStates(){
        content.querySelectorAll(".brand-row").forEach(row=>{refreshPublicationActionState(row); refreshBrandStar(row);});
      }
      function publicationBoxPressed(record){
        const value=getField(record,["box_pressed","boxpressed","box-pressed","box_press","is_box_pressed","boxPressed","Box- Pressed","Box-Pressed","Box Pressed"]).toLowerCase();
        if(/^(?:x|yes|y|true|1|✓|✔)$/.test(value))return "Yes";
        if(/^(?:no|n|false|0)$/.test(value))return "No";
        return "—";
      }
      function saveFromPublicationCard(row,kind){
        const ctx=row.publicationContext,button=ctx.actions[kind];
        if(button.disabled || button.dataset.busy==="true" || button.getAttribute("aria-disabled")==="true")return;
        button.dataset.busy="true";button.setAttribute("aria-busy","true");
        ctx.status.textContent="Saving…";
        const work=async()=>{
          let rollback;
          try{
            if(ctx.record.__publicationOnly)throw Error("This entry is not yet available to save.");
            // A named list stores local cigar IDs. Check it before changing its backing record.
            const lists=kind==="wishlist" ? brandListStore.read() : null;
            const beforeLocal=localStorage.getItem(LOCAL_FAVORITES_KEY);
            let ownedLocal=beforeLocal;
            rollback=()=>{
              // Preserve changes made by another writer while the canonical save was pending.
              if(localStorage.getItem(LOCAL_FAVORITES_KEY)!==ownedLocal)return;
              if(beforeLocal===null)localStorage.removeItem(LOCAL_FAVORITES_KEY);
              else localStorage.setItem(LOCAL_FAVORITES_KEY,beforeLocal);
            };
            try{
              importCurrentFavorites();
              savePublicationFavorite(ctx.record,ctx.favorite,ctx.id);
            }finally{ownedLocal=localStorage.getItem(LOCAL_FAVORITES_KEY);}
            if(kind==="favorites"){
              await window.CigarFavorites.set(publicationFavoritePayload(ctx.record,ctx.favorite),true);
            }else{
              const doc=readLocalDocument(),incoming=normalizeLocalFavorite({...ctx.favorite,key:ctx.id,_localRecord:ctx.record});
              const at=localItemIndex(doc.items,incoming);
              if(at<0)throw Error("This cigar could not be added to Wish List.");
              const saved=doc.items[at],name=publicationWishListName(lists)||"Wish List";
              const aliases=new Set([...localAliases(saved),...localAliases(incoming)].map(alias=>alias.replace(/^key:/,"")));
              if(!Object.hasOwn(lists,name))Object.defineProperty(lists,name,{value:[],enumerable:true,writable:true,configurable:true});
              if(!lists[name].some(id=>aliases.has(id.replace(/^key:/,""))))lists[name].push(saved.key);
              const text=JSON.stringify(lists);
              localStorage.setItem("cigaros_favorite_lists_v1",text);
            }
            rollback=null;
            // Update in place: an inline save must not collapse the card or move focus.
            try{
              syncLists();
              window.CigarosPublicationSwitcher?.refresh?.({personalLists:brandListStore.read()});
            }catch{/* A saved action remains successful if a separate list cannot be read. */}
            ctx.status.textContent=kind==="favorites"?"Added to Favorites.":"Added to Wish List.";
            if(!row.isConnected)showToast(ctx.status.textContent);
          }catch(error){
            if(rollback){try{rollback();}catch{/* Keep the original save error visible. */}}
            ctx.status.textContent="Could not save. "+error.message;
          }finally{
            delete button.dataset.busy;button.removeAttribute("aria-busy");
            refreshPublicationActionStates();
          }
        };
        publicationSaveQueue=publicationSaveQueue.then(work,work);
      }
      function buildPublicationDetails(row){
        const ctx=row.publicationContext,{record,award,panel}=ctx;
        if(panel.childElementCount)return;
        const note=document.createElement("p");note.className="publication-detail-note";
        if(record.__publicationOnly)note.textContent="Details and saved-list actions are not available for this entry yet.";
        else if(award.scope==="blend" && !record.__publicationHubRow)note.textContent="Example size: "+(record.__publicationPhotoCaption?.replace(/^Shown:\s*/i,"") || shareCaption([resolveBrandVal(record),resolveLine(record),resolveName(record),resolveVitola(record)]))+".";
        if(note.textContent)panel.append(note);
        const specs=document.createElement("div");specs.className="publication-specs";
        const groups=[
          ["measurements",[
            ["Ring",getField(record,["ring","ring_gauge","rg","ring_size"])],
            ["Length",getField(record,["length","len"])],["Vitola",resolveVitola(record)]
          ]],
          ["profile",[
            ["Wrapper shade",getField(record,["wrapper_shade","wrapper_shade_type","wrappershade","shade"])],
            ["Strength",resolveStrength(record)]
          ]],
          ["tobaccos",[["Wrapper",resolveWrapper(record)],["Binder",resolveBinder(record)],["Filler",resolveFiller(record)]]],
          ["origin",[["Rolled in (origin)",resolveOrigin(record)]]],
          ["construction",[["Shape",resolveShape(record)],["Box-pressed",publicationBoxPressed(record)]]]
        ];
        for(const [name,fields] of groups){
          const group=document.createElement("dl");group.className="publication-spec-group";group.dataset.specRow=name;
          if(name==="tobaccos")group.classList.add("publication-tobacco-block");
          for(const [label,value] of fields){
            if(name==="construction" && label==="Box-pressed" && value!=="Yes")continue;
            const item=document.createElement("div"),term=document.createElement("dt"),definition=document.createElement("dd");
            item.className="publication-spec-item"+(name==="tobaccos"?"":" publication-spec-tile");item.dataset.spec=label;
            const text=String(value??"").trim();
            term.textContent=label;definition.textContent=!text || /^(?:n\/?a|none|null|undefined|unknown|[—–-])$/i.test(text)?"—":text;
            item.append(term,definition);group.append(item);
          }
          specs.append(group);
        }
        panel.append(specs);
        const actions=document.createElement("div");actions.className="publication-actions";ctx.actions={};
        for(const kind of ["favorites","wishlist"]){
          const button=document.createElement("button"),mark=document.createElement("span"),label=document.createElement("span");
          button.type="button";button.className="publication-action";button.dataset.save=kind;button.disabled=!!record.__publicationOnly;
          button.setAttribute("aria-disabled",String(button.disabled));button.setAttribute("aria-label",`Add to ${kind==="favorites"?"Favorites":"Wish List"}: ${ctx.label}`);
          mark.className="publication-action-mark";mark.append(publicationActionIcon(kind));
          label.className="publication-action-label";label.textContent=kind==="favorites"?"Favorites":"Wish List";
          button.append(mark,label);button.addEventListener("click",()=>saveFromPublicationCard(row,kind));actions.append(button);ctx.actions[kind]=button;
        }
        const cardButton=document.createElement("button"),cardMark=document.createElement("span"),cardLabel=document.createElement("span");
        cardButton.type="button";cardButton.className="publication-action publication-card-action";
        cardButton.setAttribute("aria-label",`Create Cigar Card: ${ctx.label}`);cardButton.setAttribute("aria-haspopup","dialog");
        cardMark.className="publication-action-mark";cardMark.append(publicationActionIcon("card"));
        cardLabel.className="publication-action-label";cardLabel.textContent="Card";
        cardButton.append(cardMark,cardLabel);cardButton.addEventListener("click",()=>openPublicationCardPreview(row,cardButton));actions.append(cardButton);
        const brand=resolveBrandVal(record),canVisit=!!brand && !record.__publicationOnly;
        const brandLink=document.createElement(canVisit?"a":"button"),mark=document.createElement("span");
        brandLink.className="publication-action publication-brand-link";
        brandLink.setAttribute("aria-label",canVisit?`Visit ${brand} brand page`:"Brand page unavailable");
        if(canVisit)brandLink.href=`/pos/cigars/brand?brand=${encodeURIComponent(brand.trim())}`;
        else {brandLink.type="button";brandLink.disabled=true;}
        mark.className="publication-action-mark";
        const fallback=document.createElement("span");fallback.className="publication-brand-fallback";fallback.textContent=brand?brand.split(/\s+/).map(word=>word[0]).slice(0,2).join(""):"—";
        if(canVisit){
          const img=document.createElement("img"),candidates=buildBrandIconCandidates(record);let index=0;
          img.className="publication-brand-icon";img.alt="";img.decoding="async";fallback.hidden=true;
          img.onerror=()=>{if(++index<candidates.length)img.src=candidates[index];else{img.hidden=true;fallback.hidden=false;}};
          if(candidates.length)img.src=candidates[0];else fallback.hidden=false;
          mark.append(img);
        }
        mark.append(fallback);brandLink.append(mark);actions.append(brandLink);panel.append(actions);
        const status=document.createElement("p");status.className="publication-action-status";status.setAttribute("role","status");panel.append(status);ctx.status=status;
        refreshPublicationActionState(row);
      }
      function savePublicationFavorite(record,favorite,id){
        if(record.__publicationOnly)throw Error("This published cigar has not been linked to a POS entry yet.");
        const doc=readLocalDocument(),before=JSON.stringify(doc);
        const incoming=normalizeLocalFavorite({...favorite,key:id,type:"cigar",
          brand:resolveBrandVal(record),line:resolveLine(record),cigar:resolveName(record),
          vitola:resolveVitola(record),href:makeDetailHref(record),_localRecord:record});
        if(!incoming)throw Error("This cigar could not be saved. Please open its details and try again.");
        const index=localItemIndex(doc.items,incoming);
        if(index<0){doc.items.push(incoming);if(!doc.order.includes(id))doc.order.push(id);}
        else doc.items[index]=mergeLocalMetadata(doc.items[index],incoming);
        writeLocalDocument(doc);
        return ()=>writeLocalDocument(JSON.parse(before));
      }
      function visiblePhotoBounds(img){
        const width = img.naturalWidth, height = img.naturalHeight;
        const full = {x:0,y:0,width,height};
        try{
          // Remove transparent padding only, never leaf pixels or white backgrounds.
          // Downsample solely for bounds detection; the displayed image stays original.
          const scale = Math.min(1, 1400 / Math.max(width,height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(width*scale));
          canvas.height = Math.max(1, Math.ceil(height*scale));
          const ctx = canvas.getContext("2d", {willReadFrequently:true});
          if(!ctx) return full;
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let left=canvas.width, right=-1, top=canvas.height, bottom=-1;
          for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++){
            if(pixels[(y*canvas.width+x)*4+3] > 0){
              left=Math.min(left,x); right=Math.max(right,x);
              top=Math.min(top,y); bottom=Math.max(bottom,y);
            }
          }
          if(right < left || bottom < top) return full;
          const sx=width/canvas.width, sy=height/canvas.height;
          const x=Math.max(0,Math.floor((left-1)*sx));
          const y=Math.max(0,Math.floor((top-1)*sy));
          const x2=Math.min(width,Math.ceil((right+2)*sx));
          const y2=Math.min(height,Math.ceil((bottom+2)*sy));
          return {x,y,width:x2-x,height:y2-y};
        }catch{
          // Cross-origin images without CORS remain usable, without alpha trimming.
          return full;
        }
      }

      function makePhotoArt(img, record, favorite, keepLandscape=false){
        const bounds=visiblePhotoBounds(img);
        const hinted=normalizeLoose(getField(record,["cigar_image_orientation","image_orientation"]) || favorite?.imageOrientation || "");
        const portrait=bounds.height > bounds.width;
        const validHint=["head top","head bottom","head left","head right"].includes(hinted);
        const hintIsPortrait=hinted === "head top" || hinted === "head bottom";
        // A replaced photo may have a different axis from its older orientation hint.
        const orientation=validHint && (!keepLandscape || hintIsPortrait===portrait)
          ? hinted : portrait ? "head top" : "head right";
        const vertical=orientation === "head top" || orientation === "head bottom";
        const w=vertical ? bounds.height : bounds.width;
        const h=vertical ? bounds.width : bounds.height;
        const ns="http://www.w3.org/2000/svg";
        const art=document.createElementNS(ns,"svg");
        art.classList.add("favorite-photo-art");
        art.setAttribute("viewBox",`0 0 ${w} ${h}`);
        art.setAttribute("width",String(w));
        art.setAttribute("height",String(h));
        art.setAttribute("preserveAspectRatio","xMidYMid meet");
        art.setAttribute("aria-hidden","true");
        art.setAttribute("focusable","false");
        art.dataset.orientation=orientation;
        art.style.aspectRatio=`${w} / ${h}`;
        const image=document.createElementNS(ns,"image");
        image.setAttribute("width",String(img.naturalWidth));
        image.setAttribute("height",String(img.naturalHeight));
        image.setAttribute("href",img.src);
        image.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",img.src);
        const {x,y,width,height}=bounds;
        const transform=orientation === "head top" ? `matrix(0 1 -1 0 ${y+height} ${-x})`
          : orientation === "head bottom" ? `matrix(0 -1 1 0 ${-y} ${x+width})`
          : orientation === "head left" ? `matrix(-1 0 0 -1 ${x+width} ${y+height})`
          : `translate(${-x} ${-y})`;
        image.setAttribute("transform",transform);
        art.appendChild(image);
        return art;
      }

      function shareCaption(details){
        const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
        const usable=value=>value && !/^[—–-]+$/.test(value);
        const key=word=>word.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
        const words=[];
        details.slice(0,4).map(clean).forEach((part,index)=>{
          if(!usable(part))return;
          let next=part.split(' ');
          // Vitola words already provided by the line/name need not appear again.
          if(index===3){const seen=new Set(words.map(key));next=next.filter(word=>!seen.has(key(word)));}
          let overlap=0;
          for(let n=1;n<=Math.min(words.length,next.length);n++){
            if(words.slice(-n).map(key).join(' ')===next.slice(0,n).map(key).join(' '))overlap=n;
          }
          words.push(...next.slice(overlap));
        });
        const ring=clean(details[4]),length=clean(details[5]);
        const size=[ring,length].filter(usable).join(' x ');
        return [words.join(' '),size].filter(Boolean).join(' ');
      }
      function wrapShareText(ctx,text,maxWidth){
        const lines=[];let line='';
        for(const word of text.split(/\s+/)){
          if(ctx.measureText(line+(line?' ':'')+word).width>maxWidth && line){lines.push(line);line='';}
          for(const char of word){
            if(ctx.measureText(line+char).width>maxWidth && line){lines.push(line);line='';}
            line+=char;
          }
          line+=' ';
        }
        if(line.trim())lines.push(line.trim());return lines;
      }
      async function buildPublicationCardImage(row){
        const context=row.publicationContext;
        if(!context)throw Error("This cigar card is not available.");
        const {record,award,panel}=context;
        const clean=value=>String(value??"").trim().replace(/\s+/g," ");
        const title="Cigar Card", publisher="CigarOS", rank="";
        const [brandName,productName]=publicationCardLabel(record);
        const flag=publicationIsCuban(record)?"🇨🇺 ":"";
        const brand=brandName?flag+brandName:"",product=(brandName?"":flag)+productName;
        const note=award.scope==="blend" && !record.__publicationOnly?clean(panel.querySelector(".publication-detail-note")?.textContent):"";
        const groups=[...panel.querySelectorAll(".publication-spec-group")].map(group=>({
          name:group.dataset.specRow,
          items:[...group.querySelectorAll(".publication-spec-item")].map(item=>({
            label:clean(item.querySelector("dt")?.textContent),value:clean(item.querySelector("dd")?.textContent)||"—"
          }))
        }));
        if(groups.length!==5)throw Error("Open the cigar’s details before creating its card.");
        // Capture the selected card before asynchronous work; switching lists cannot change this image.
        const style=getComputedStyle(row),dark=document.documentElement.dataset.theme==="dark";
        const palette={
          text:style.getPropertyValue("--text").trim() || (dark?"#f8fbff":"#102d4b"),
          muted:style.getPropertyValue("--muted").trim() || (dark?"#b3c7e0":"#45627e"),
          tone:style.getPropertyValue("--publication-card-tone").trim() || (dark?"#28517b":"#edf5ff"),
          edge:style.getPropertyValue("--publication-card-edge").trim() || (dark?"#163653":"#d3e5f9")
        };
        // The panel can inherit a browser default; use the app's explicit SF font roles instead.
        const displayFamily=style.getPropertyValue("--font-display").trim() || '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", Arial, sans-serif';
        const textFamily=style.getPropertyValue("--font-text").trim() || '"SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", Arial, sans-serif';
        const weightOf=(selector,fallback)=>{const node=row.querySelector(selector);return node?Number(getComputedStyle(node).fontWeight) || fallback:fallback;};
        const brandWeight=weightOf(".publication-cigar-brand",780),productWeight=weightOf(".publication-cigar-name",450),valueWeight=weightOf(".publication-spec-item dd",650),labelWeight=weightOf(".publication-spec-item dt",450);
        const art=row.querySelector(".favorite-photo-art"),source=art?.querySelector("image");
        let photo=null;
        if(art && source){
          const box=art.viewBox.baseVal,matrix=source.transform.baseVal.consolidate()?.matrix;
          if(box.width>0 && box.height>0 && matrix)photo={
            url:source.getAttribute("href") || source.getAttributeNS("http://www.w3.org/1999/xlink","href"),
            box:{x:box.x,y:box.y,width:box.width,height:box.height},
            matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],
            width:Number(source.getAttribute("width")),height:Number(source.getAttribute("height"))
          };
        }
        const filename=[publisher,brandName,productName].join("-").normalize("NFD").replace(/\p{M}/gu,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,180)+".png";
        await document.fonts?.ready;
        if(document.fonts?.load)await Promise.allSettled([
          `italic 400 38px ${displayFamily}`,`${brandWeight} 48px ${displayFamily}`,`${productWeight} 42px ${displayFamily}`,
          `${valueWeight} 72px ${displayFamily}`,`${labelWeight} 30px ${textFamily}`
        ].map(font=>document.fonts.load(font,"Cigar 0123456789")));
        let image=null;
        if(photo?.url){
          const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
          let objectURL="";
          try{
            const response=await fetch(photo.url,{signal:controller.signal});
            if(!response.ok)throw Error("Photo request failed.");
            objectURL=URL.createObjectURL(await response.blob());
            image=new Image();image.src=objectURL;await image.decode();
          }catch{
            throw Error("The cigar photo could not be included. Please try creating the card again.");
          }finally{clearTimeout(timeout);if(objectURL)URL.revokeObjectURL(objectURL);}
        }
        const width=1080,pad=80,inner=width-pad*2,gap=22,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
        if(!ctx)throw Error("Image downloads are unavailable in this browser.");
        const font=(size,weight=500,italic=false,role="display")=>`${italic?"italic ":""}${weight} ${size}px ${role==="text"?textFamily:displayFamily}`;
        const wrap=(text,maxWidth)=>{
          const lines=[];let line="";
          for(const word of clean(text).split(" ")){
            if(!word)continue;
            if(ctx.measureText(line+(line?" ":"")+word).width<=maxWidth){line+=(line?" ":"")+word;continue;}
            if(line){lines.push(line);line="";}
            for(const char of Array.from(word)){
              if(line && ctx.measureText(line+char).width>maxWidth){lines.push(line);line="";}
              line+=char;
            }
          }
          if(line)lines.push(line);
          return lines.length?lines:["—"];
        };
        const textBlock=(text,size,weight,maxWidth,italic=false,role="display")=>{
          const type=font(size,weight,italic,role);ctx.font=type;
          const lines=wrap(text,maxWidth),lineHeight=Math.ceil(size*1.25);
          return {lines,type,lineHeight,height:lines.length*lineHeight};
        };
        const heading=textBlock(title,38,400,inner,true);
        const brandBlock=brand?textBlock(brand,48,brandWeight,inner):null;
        const productBlock=textBlock(product || context.label,brand?42:48,brand?productWeight:brandWeight,inner);
        const noteBlock=note?textBlock(note,29,400,inner,false,"text"):null;
        const photoSpace=178;
        let y=88;
        const headingY=y;y+=heading.height+38;
        const photoY=y;y+=photoSpace+38;
        const nameDivider=y;y+=34;
        const brandY=y;if(brandBlock)y+=brandBlock.height+8;
        const productY=y;y+=productBlock.height+38;
        const specsDivider=y;y+=34;
        const noteY=y;if(noteBlock)y+=noteBlock.height+26;
        const layouts=groups.map(group=>{
          const tobacco=group.name==="tobaccos",columns=tobacco?1:group.items.length,tileWidth=(inner-gap*(columns-1))/columns;
          const items=group.items.map(item=>{
            const number=group.name==="measurements" && /^(Ring|Length)$/.test(item.label);
            const value=textBlock(item.value,number?72:tobacco?42:44,valueWeight,tileWidth-44);
            const label=textBlock(item.label,30,labelWeight,tileWidth-36,false,"text");
            return {...item,value,label,height:Math.max(tobacco?138:group.name==="measurements"?216:180,value.height+label.height+58)};
          });
          const height=tobacco?items.reduce((sum,item)=>sum+item.height,0):Math.max(...items.map(item=>item.height));
          const result={name:group.name,tobacco,items,tileWidth,y,height};y+=height+gap;return result;
        });
        const height=Math.ceil(Math.max(width*1.7,y-gap+56));
        if(height>12000)throw Error("These cigar details are too long to fit in one image.");
        // Fixed portrait dimensions match the approved crop. Fit long content without trimming it.
        const outputWidth=1290,outputHeight=2280,scale=Math.min(outputWidth/width,outputHeight/height);
        canvas.width=outputWidth;canvas.height=outputHeight;
        const roundRect=(x,y,w,h,r)=>{
          const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
        };
        const background=ctx.createLinearGradient(0,0,outputWidth,outputHeight);
        background.addColorStop(0,dark?"#1c4475":"#dceafb");background.addColorStop(1,dark?"#091f36":"#bbd3ec");ctx.fillStyle=background;ctx.fillRect(0,0,outputWidth,outputHeight);
        ctx.translate((outputWidth-width*scale)/2,(outputHeight-height*scale)/2);ctx.scale(scale,scale);
        const card=ctx.createLinearGradient(32,16,width-32,height-16);card.addColorStop(0,palette.tone);card.addColorStop(.48,palette.tone);card.addColorStop(1,palette.edge);
        roundRect(32,16,width-64,height-32,64);ctx.fillStyle=card;ctx.fill();
        const drawText=(block,x,y,color,align="left")=>{
          ctx.font=block.type;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="top";
          block.lines.forEach((line,index)=>ctx.fillText(line,x,y+index*block.lineHeight));
        };
        const divider=(x,y,w)=>{
          const line=ctx.createLinearGradient(x,0,x+w,0);line.addColorStop(0,"transparent");line.addColorStop(.12,dark?"#c6ddff2b":"#49688930");line.addColorStop(.88,dark?"#c6ddff2b":"#49688930");line.addColorStop(1,"transparent");ctx.fillStyle=line;ctx.fillRect(x,y,w,2);
        };
        const tile=(x,y,w,h)=>{
          const fill=ctx.createLinearGradient(x,y,x+w,y+h);fill.addColorStop(0,dark?"#a1d3ff26":"#ffffff82");fill.addColorStop(.65,dark?"#c3e7ff0b":"#ffffff30");fill.addColorStop(1,dark?"#a1d3ff14":"#e2f1ff45");
          roundRect(x,y,w,h,42);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=dark?"#d5ebff33":"#ffffffb0";ctx.lineWidth=2;ctx.stroke();
        };
        const drawItem=(item,x,y,w,h)=>{
          const contents=item.value.height+10+item.label.height,top=y+(h-contents)/2;
          drawText(item.value,x+w/2,top,palette.text,"center");drawText(item.label,x+w/2,top+item.value.height+10,palette.muted,"center");
        };
        drawText(heading,width/2,headingY,palette.text,"center");
        if(image && photo){
          const scale=Math.min(inner/photo.box.width,photoSpace/photo.box.height),w=photo.box.width*scale,h=photo.box.height*scale;
          const x=pad+(inner-w)/2,top=photoY+(photoSpace-h)/2;
          ctx.save();ctx.beginPath();ctx.rect(x,top,w,h);ctx.clip();ctx.translate(x,top);ctx.scale(scale,scale);ctx.translate(-photo.box.x,-photo.box.y);ctx.transform(...photo.matrix);ctx.drawImage(image,0,0,photo.width || image.naturalWidth,photo.height || image.naturalHeight);ctx.restore();
        }else{
          const placeholder=textBlock("Cigar photo unavailable",30,400,inner,false,"text");
          drawText(placeholder,width/2,photoY+(photoSpace-placeholder.height)/2,palette.muted,"center");
        }
        divider(pad,nameDivider,inner);
        if(brandBlock)drawText(brandBlock,pad,brandY,palette.text);
        drawText(productBlock,pad,productY,palette.text);
        divider(pad,specsDivider,inner);
        if(noteBlock)drawText(noteBlock,pad,noteY,palette.muted);
        for(const group of layouts){
          if(group.tobacco){
            tile(pad,group.y,inner,group.height);let top=group.y;
            group.items.forEach((item,index)=>{if(index)divider(pad+28,top,inner-56);drawItem(item,pad,top,inner,item.height);top+=item.height;});
          }else group.items.forEach((item,index)=>{const x=pad+index*(group.tileWidth+gap);tile(x,group.y,group.tileWidth,group.height);drawItem(item,x,group.y,group.tileWidth,group.height);});
        }
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error("The portrait image could not be created. Please try again.")),"image/png"));
        return {blob,filename,title,width:outputWidth,height:outputHeight};
      }

      let activePublicationCardPreview=null,publicationCardPreviewSerial=0;
      function openPublicationCardPreview(row,button){
        if(activePublicationCardPreview?.open){activePublicationCardPreview.querySelector(".cigar-card-preview-close")?.focus();return;}
        const preview=document.createElement("dialog"),header=document.createElement("div"),heading=document.createElement("h2");
        const close=document.createElement("button"),status=document.createElement("p"),stage=document.createElement("div"),img=document.createElement("img"),actions=document.createElement("div");
        const send=document.createElement("button"),download=document.createElement("a"),retry=document.createElement("button");
        const label=row.publicationContext.label;
        let closed=false,creating=false,url="",file=null,title="";
        preview.className="favorite-lists-dialog cigar-card-preview";
        heading.id="cigar-card-preview-title-"+(++publicationCardPreviewSerial);heading.textContent="Cigar Card";
        preview.setAttribute("aria-labelledby",heading.id);
        header.className="cigar-card-preview-header";
        close.type="button";close.className="cigar-card-preview-close";close.textContent="×";close.setAttribute("aria-label","Close Cigar Card preview");
        close.addEventListener("click",()=>preview.close());header.append(heading,close);
        status.className="cigar-card-preview-status";status.setAttribute("role","status");status.setAttribute("aria-atomic","true");
        img.className="cigar-card-preview-image";img.hidden=true;
        stage.className="cigar-card-preview-stage";stage.append(img);
        actions.className="cigar-card-preview-actions";actions.hidden=true;
        send.type="button";send.className="cigar-card-preview-share";send.textContent="Share Image";send.hidden=true;
        download.className="cigar-card-preview-download";download.textContent="Download PNG";download.hidden=true;
        retry.type="button";retry.className="cigar-card-preview-retry";retry.textContent="Try Again";retry.hidden=true;
        actions.append(send,download,retry);preview.append(header,stage,status,actions);
        const fitViewport=()=>preview.style.setProperty("--cigar-card-viewport",(window.visualViewport?.height || window.innerHeight)+"px");
        function cleanup(){
          if(closed)return;closed=true;
          if(activePublicationCardPreview===preview)activePublicationCardPreview=null;
          window.removeEventListener("resize",fitViewport);window.visualViewport?.removeEventListener("resize",fitViewport);
          if(url){URL.revokeObjectURL(url);url="";}
          file=null;preview.remove();button.disabled=false;button.removeAttribute("aria-busy");
          if(button.isConnected)button.focus();
        }
        async function prepare(){
          if(closed || creating)return;
          creating=true;button.disabled=true;button.setAttribute("aria-busy","true");preview.setAttribute("aria-busy","true");
          status.textContent="Preparing your portrait image…";actions.hidden=true;retry.hidden=true;img.hidden=true;
          try{
            // Finish this row's own photo load before taking a snapshot of its details.
            if(row.classList.contains("is-photo-loading") && row.publicationPhotoReady)await row.publicationPhotoReady;
            if(closed)return;
            const result=await buildPublicationCardImage(row);
            if(closed)return;
            title=result.title;
            if(url)URL.revokeObjectURL(url);
            url=URL.createObjectURL(result.blob);
            file=typeof File==="function"?new File([result.blob],result.filename,{type:"image/png"}):null;
            img.src=url;img.alt=title+". "+label+". Cigar details.";
            await img.decode();if(closed)return;
            download.href=url;download.download=result.filename;download.hidden=false;
            let shareable=false;
            try{shareable=!!(file && typeof navigator.share==="function" && navigator.canShare?.({files:[file]}));}catch{/* Download remains available. */}
            send.hidden=!shareable;img.hidden=false;status.textContent="";actions.hidden=false;
          }catch(error){
            if(closed)return;
            if(url){URL.revokeObjectURL(url);url="";}file=null;send.hidden=true;download.hidden=true;
            console.warn("[Cigar Card]",error);
            status.textContent=error.message || "Could not create this Cigar Card. Please try again.";
            retry.hidden=false;actions.hidden=false;
          }finally{
            creating=false;preview.removeAttribute("aria-busy");
            if(!closed){button.disabled=false;button.removeAttribute("aria-busy");}
          }
        }
        send.addEventListener("click",async()=>{
          if(!file || send.disabled)return;send.disabled=true;
          try{
            // This fresh tap retains the user activation needed by native image sharing.
            await navigator.share({files:[file],title});
            if(!closed)status.textContent="";
          }catch(error){
            if(!closed && error.name!=="AbortError")status.textContent="Sharing is unavailable here. Use Download PNG to save your Cigar Card.";
          }finally{send.disabled=false;}
        });
        retry.addEventListener("click",prepare);
        preview.addEventListener("close",cleanup,{once:true});
        document.body.append(preview);activePublicationCardPreview=preview;
        fitViewport();window.addEventListener("resize",fitViewport);window.visualViewport?.addEventListener("resize",fitViewport);
        try{preview.showModal();close.focus();void prepare();}
        catch(error){cleanup();showToast("Could not open the Cigar Card preview. Please try again.");}
      }


  function brandNavigationStar(){
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 183.6 176.05");svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
    const outline=document.createElementNS(svg.namespaceURI,"path");outline.setAttribute("d","M183.6,67.14h-70.23L91.81,0l-21.59,67.14H0l56.81,41.66-21.63,67.25,56.57-40.35h.02l56.65,40.35-21.63-67.25,56.82-41.66ZM123.41,141.53l-31.64-23.15-31.59,23.15,12.08-38.6-31.72-23.91h39.21l12.06-38.53,12.05,38.53h39.21l-31.73,23.91,12.08,38.6h0Z");outline.setAttribute("class","brand-star-outline");
    const solid=document.createElementNS(svg.namespaceURI,"path");solid.setAttribute("d","M183.6,67.14h-70.23L91.81,0l-21.59,67.14H0l56.81,41.66-21.63,67.25,56.57-40.35h.02l56.65,40.35-21.63-67.25,56.82-41.66Z");solid.setAttribute("class","brand-star-solid");svg.append(outline,solid);return svg;
  }
  const expandedBrands=new Set(), brandPhotoURLs=new Set();let brandPanelSerial=0;
  function refreshBrandStar(row){
    const r=row.brandRecord,button=row.querySelector('.brand-favorite');if(!r||!button)return;
    try{const saved=isCigarFavorite(r);button.classList.toggle('is-saved',saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',`${saved?'Remove from':'Save to'} Favorites: ${resolveDisplayName(r)}`);}catch(error){button.setAttribute('aria-label','Favorites unavailable');}
  }
  async function toggleBrandFavorite(row){
    const button=row.querySelector('.brand-favorite');if(button.disabled)return;button.disabled=true;
    try{const r=row.brandRecord;await Favorites.set(favoritePayload(r),!isCigarFavorite(r));refreshPublicationActionStates();}
    catch(error){showToast(error.message);}finally{button.disabled=false;}
  }
  async function loadBrandPhoto(row){
    const holder=row.querySelector('.brand-cigar-photo'),r=row.brandRecord;
    row.classList.add('is-photo-loading');
    try{
      const candidates=Favorites.imageCandidates(favoritePayload(r));
      const local=await Favorites.localImage(resolveDetailKey(r)||resolveFavoriteKey(r));
      if(!row.isConnected)return;
      if(local){const url=URL.createObjectURL(local);brandPhotoURLs.add(url);candidates.unshift(url);}
      for(const url of candidates){
        if(!row.isConnected)return;
        const img=await new Promise(resolve=>{const image=new Image();let timer;const done=value=>{clearTimeout(timer);image.onload=image.onerror=null;resolve(value);};image.onload=()=>done(image);image.onerror=()=>done(null);timer=setTimeout(()=>done(null),6000);image.src=url;});
        if(!row.isConnected)return;
        if(img){holder.replaceChildren(makePhotoArt(img,r,null,true));return;}
      }
      holder.textContent='Photo unavailable';
    }catch{if(row.isConnected)holder.textContent='Photo unavailable';}
    finally{row.classList.remove('is-photo-loading');}
  }
  function renderList(rows){
    if(!listEl)return;
    brandPhotoURLs.forEach(url=>URL.revokeObjectURL(url));brandPhotoURLs.clear();listEl.replaceChildren();
    if(!rows.length){listEl.innerHTML=`<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;return;}
    rows.forEach(r=>{
      const row=document.createElement('article'),id=++brandPanelSerial,key=resolveFavoriteKey(r),name=resolveDisplayName(r)||'Unnamed cigar';
      row.className='brand-row';row.brandRecord=r;
      if(resolveIsCuban(r))row.dataset.cuban='true';
      const inventory=getField(r,['inventory']);
      row.innerHTML=`<div class="brand-card-summary"><button class="brand-icon-toggle" type="button" aria-expanded="false" aria-controls="brand-details-${id}" aria-label="Expand details: ${esc(name)}"><img class="row-ico" alt="" loading="lazy" decoding="async"></button><div class="brand-row-left"><div class="brand-row-title-wrap"><div class="brand-row-title" id="brand-name-${id}">${esc(name)}</div>${resolveIsCuban(r)?'<span class="brand-row-flag" aria-label="Cuban">🇨🇺</span>':''}</div><div class="brand-row-meta"><span class="brand-row-sub">${esc(resolveVitola(r)||'—')}</span><span class="brand-meta-dot" aria-hidden="true">·</span><span class="brand-row-size">${esc(resolveLength(r)||'—')} x ${esc(resolveRing(r)||'—')}</span></div><div class="brand-row-msrp">${esc(resolvePrice(r))}</div></div><div class="brand-row-right"><span class="brand-stock" aria-label="Inventory stock: ${esc(inventory||'unavailable')}">${esc(inventory||'—')}</span><button class="brand-favorite" type="button" aria-pressed="false"></button><button class="qty-btn qty-btn--plus" type="button" aria-label="Open add menu for ${esc(name)}">+</button></div></div><div class="publication-details" id="brand-details-${id}" role="region" aria-labelledby="brand-name-${id}" hidden></div>`;
      bindImageFallback($('.row-ico',row),rowIconCandidatesForRow(r),'hide');
      const panel=$('.publication-details',row),toggle=$('.brand-icon-toggle',row);
      $('.brand-favorite',row).append(brandNavigationStar());
      $('.brand-favorite',row).addEventListener('click',()=>toggleBrandFavorite(row));
      $('.qty-btn--plus',row).addEventListener('click',()=>openActionSheet(r));
      row.publicationContext={record:r,favorite:favoritePayload(r),id:key,award:{},panel,label:name,actions:null};
      const display=open=>{
        if(open && !panel.childElementCount){
          buildPublicationDetails(row);
          const photo=document.createElement('div');photo.className='brand-cigar-photo';photo.setAttribute('role','img');photo.setAttribute('aria-label',name+' cigar photo');photo.textContent='Loading photo…';panel.prepend(photo);
          row.publicationPhotoReady=loadBrandPhoto(row);
        }
        panel.hidden=!open;row.classList.toggle('is-expanded',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',`${open?'Collapse':'Expand'} details: ${name}`);
        if(open)expandedBrands.add(key);else expandedBrands.delete(key);
      };
      toggle.addEventListener('click',()=>display(toggle.getAttribute('aria-expanded')!=='true'));
      listEl.append(row);refreshBrandStar(row);if(expandedBrands.has(key))display(true);
    });
  }
  window.addEventListener('storage',refreshPublicationActionStates);
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

  // The old brand page had filter state but no button binding or dialog.
  const brandFilterFields=[['vitola','Vitola',resolveVitola],['ring','Ring',resolveRing],['length','Length',resolveLength],['strength','Strength',resolveStrength],['shape','Shape',resolveShape],['shade','Wrapper shade',resolveShade]];
  let brandFiltersDialog=null;
  function updateFilterLabel(){const count=Object.values(state.filters).reduce((sum,set)=>sum+set.size,0);if(btnFilters)btnFilters.textContent=count?`Filters (${count})`:'Filters';}
  function openBrandFilters(){
    if(brandFiltersDialog?.open)return;
    const dialog=document.createElement('dialog');dialog.className='brand-filter-dialog';dialog.setAttribute('aria-labelledby','brand-filter-title');
    dialog.innerHTML='<form method="dialog"><header><h2 id="brand-filter-title">Filters</h2><button type="button" data-filter-cancel aria-label="Close filters">×</button></header><label class="brand-filter-search-label">Find a filter<input type="search" class="brand-filter-search" placeholder="Search filter options" autocomplete="off"></label><div class="brand-filter-options"></div><p class="brand-filter-empty" hidden>No matching options.</p><footer><button type="button" data-filter-clear>Clear all</button><button type="button" data-filter-cancel>Cancel</button><button type="submit" class="brand-filter-apply">Apply</button></footer></form>';
    const draft=Object.fromEntries(brandFilterFields.map(([key])=>[key,new Set(state.filters[key])]));
    const options=dialog.querySelector('.brand-filter-options');
    for(const [key,label,resolver] of brandFilterFields){
      const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=label;fieldset.append(legend);fieldset.dataset.filterGroup=key;
      const values=[...new Set([...state.rowsAll.map(resolver).filter(Boolean),...draft[key]])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      for(const value of values){const item=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='checkbox';input.value=value;input.dataset.filterKey=key;input.checked=draft[key].has(value);text.textContent=value;item.className='brand-filter-option';item.dataset.search=(label+' '+value).toLowerCase();input.addEventListener('change',()=>{if(input.checked)draft[key].add(value);else draft[key].delete(value);});item.append(input,text);fieldset.append(item);}
      if(values.length)options.append(fieldset);
    }
    const close=()=>dialog.close();dialog.querySelectorAll('[data-filter-cancel]').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.querySelector('[data-filter-clear]').addEventListener('click',()=>{Object.values(draft).forEach(set=>set.clear());dialog.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=false;});});
    const filterSearch=dialog.querySelector('.brand-filter-search');
    filterSearch.addEventListener('input',()=>{const q=filterSearch.value.trim().toLowerCase();let visible=0;options.querySelectorAll('fieldset').forEach(group=>{let groupVisible=0;group.querySelectorAll('.brand-filter-option').forEach(item=>{item.hidden=!item.dataset.search.includes(q);if(!item.hidden)groupVisible++;});group.hidden=!groupVisible;visible+=groupVisible;});dialog.querySelector('.brand-filter-empty').hidden=visible>0;});
    dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();for(const [key] of brandFilterFields)state.filters[key]=new Set(draft[key]);applyAll();updateFilterLabel();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
    const oldOverflow=document.body.style.overflow;
    dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;dialog.remove();brandFiltersDialog=null;btnFilters?.setAttribute('aria-expanded','false');btnFilters?.focus();},{once:true});
    document.body.append(dialog);brandFiltersDialog=dialog;
    try{dialog.showModal();document.body.style.overflow='hidden';btnFilters?.setAttribute('aria-expanded','true');filterSearch.focus();}
    catch(error){dialog.remove();brandFiltersDialog=null;showToast('Filters could not open. Please reload this page.');}
  }
  btnFilters?.setAttribute('aria-haspopup','dialog');btnFilters?.setAttribute('aria-expanded','false');btnFilters?.addEventListener('click',openBrandFilters);

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
  Favorites.subscribe(()=>{if(state.actionRow)updateActionSheet();refreshPublicationActionStates();});
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
