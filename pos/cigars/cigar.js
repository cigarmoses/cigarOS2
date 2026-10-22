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


/* /pos/cigars/cigar.js — Portfolio swipe / inline glass navigation 2026-10-14-r1.
   Based on the supplied Favorites repair. Same editor fields, barcode renderer,
   local storage keys, HUB write endpoint and explicit-save behavior. */
(() => {
  "use strict";
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const CIGAROS_HUB_WRITE_URL = "https://script.google.com/macros/s/AKfycbzJqlXzX9VpZUA2ZwrReXswto2K-fSdW_vm__xP1ir-xECCifZrpeyzaLQavUmRUYzpbA/exec";
  const COMPARE_KEY = "cigaros_compare_keys";
  // Existing fallback column indices retained; named headers remain preferred.
  const LENGTH_COL_INDEX = 10;
  const RING_COL_INDEX = 11;
  const $ = (sel, root = document) => root.querySelector(sel);
  const card = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");
  const themeToggle = $("#theme-toggle");
  const rootEl = document.documentElement;
  const Favorites = window.CigarFavorites;
  function getParam(name) { try { return new URL(location.href).searchParams.get(name) || ""; } catch { return ""; } }
  function getSavedTheme() { return localStorage.getItem("theme") || rootEl.getAttribute("data-theme") || "dark"; }
  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    rootEl.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle?.setAttribute("aria-pressed", String(next === "dark"));
  }
  function normalizeLoose(s) {
    return String(s || "").trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ")
      .replace(/["'’]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function slugify(s) { return normalizeLoose(s).replace(/\s+/g, "-"); }
  function compactKey(s) {
    return String(s || "").trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/["'’]/g, "").replace(/[^a-z0-9]+/g, "");
  }
  function normalizeBrand(v) { return compactKey(v); }
  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }
  function escapeHTML(s) {
    return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function escapeAttr(s) { return escapeHTML(s); }
  function parseCSV(text) {
    const rows = []; let row = [], cur = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i+1];
      if (ch === '"' && inQuotes && next === '"') {cur += '"'; i++; continue;}
      if (ch === '"') {inQuotes = !inQuotes; continue;}
      if (ch === ',' && !inQuotes) {row.push(cur); cur = ""; continue;}
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = ""; continue;
      }
      cur += ch;
    }
    if (cur.length || row.length) {row.push(cur); rows.push(row);}
    return rows;
  }
  function normalizeHeader(h) { return String(h || "").trim().toLowerCase().replace(/\s+/g, ""); }
  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map(h => String(h || "").trim());
    const normHeaders = headers.map(normalizeHeader), data = [];
    for (let i=1; i<rows.length; i++) {
      const r=rows[i]; if (!r || r.every(c => !String(c || "").trim())) continue;
      const obj={};
      for(let j=0;j<headers.length;j++) {obj[headers[j]]=r[j]??""; obj[normHeaders[j]]=r[j]??"";}
      obj.__row=r; obj.__length_col=r[LENGTH_COL_INDEX]??""; obj.__ring_col=r[RING_COL_INDEX]??""; data.push(obj);
    }
    return data;
  }
  function getField(rec, keys) {
    for (const key of keys) {const value = rec?.[key]; if (value != null && String(value).trim() !== "") return String(value).trim();}
    return "";
  }
  function getCigarId(rec) {return getField(rec,["Key","key","Cigar ID","cigarId","cigarid","cigar_id","id","row_id"]);}
  function getBrand(rec) {return getField(rec,["Brand","brand","brandname","Brand aka","brandaka"]);}
  function getLine(rec) {return getField(rec,["Line","line","Series","series"]);}
  function getName(rec) {return getField(rec,["Cigar","cigar","Name","name"]);}
  function getVitola(rec) {return getField(rec,["Vitola","vitola","Style","style","Size","size"]);}
  function getShape(rec) {return getField(rec,["Shape","shape"]);}
  function getWrapper(rec) {return getField(rec,["Wrapper","wrapper"]);}
  function getBinder(rec) {return getField(rec,["Binder","binder"]);}
  function getFiller(rec) {return getField(rec,["Filler","filler"]);}
  function getStrength(rec) {return getField(rec,["Strength","strength"]);}
  function getRing(rec) {return getField(rec,["Ring","ring","RG","rg","Ring Gauge","ringgauge","Ring Size","ringsize"]);}
  function getLength(rec) {return getField(rec,["Length","length","Len","len"]);}
  function getOrigin(rec) {return getField(rec,["Origin","origin","Country","country"]);}
  function getShade(rec) {return getField(rec,["Wrapper Shade","wrappershade","wrapper_shade","shade"]);}
  function getImage(rec) {return getField(rec,["Cigar IMG","cigarimg","Image","image","Photo","photo"]);}
  function getBrandImage(rec) {return getField(rec,["Brand IMG","brandimg","brand_image"]);}
  function getLineImage(rec) {return getField(rec,["Line IMG","lineimg","line_image","Line Image","lineimage","brand_line_img"]);}
  function makeSlugFromRecord(rec) {
    return slugify([getBrand(rec),getLine(rec),getName(rec),getVitola(rec),getCigarId(rec)].filter(Boolean).join(" "));
  }
  function scoreRecord(rec) {
    let score=0;
    if(getRing(rec))score+=50;if(getLength(rec))score+=50;if(getImage(rec))score+=5;
    if(getVitola(rec))score+=3;if(getShape(rec))score+=3;if(getShade(rec))score+=3;if(getStrength(rec))score+=3;
    if(getWrapper(rec))score+=2;if(getBinder(rec))score+=2;if(getFiller(rec))score+=2;if(getOrigin(rec))score+=1;
    return score;
  }
  function bestRecord(matches) {
    if(!matches.length)return null;
    matches.sort((a,b)=>scoreRecord(b)-scoreRecord(a));
    return matches.find(r=>getRing(r)&&getLength(r))||matches[0];
  }
  function findById(records,id) {
    const raw=String(id||"").trim();if(!raw)return null;
    const loose=normalizeLoose(raw),slug=slugify(raw);
    return bestRecord(records.filter(r=>[
      getCigarId(r),getName(r),[getLine(r),getName(r)].filter(Boolean).join(" "),
      [getBrand(r),getLine(r),getName(r)].filter(Boolean).join(" "),
      [getBrand(r),getName(r)].filter(Boolean).join(" "),[getName(r),getVitola(r)].filter(Boolean).join(" ")
    ].filter(Boolean).some(v=>v.trim()===raw||normalizeLoose(v)===loose||slugify(v)===slug)));
  }
  function findBySlug(records,slug) {
    const raw=String(slug||"").trim();if(!raw)return null;
    const target=slugify(raw);
    return bestRecord(records.filter(r=>makeSlugFromRecord(r)===target||slugify(getCigarId(r))===target));
  }
  function findByPipeKey(records,idParam) {
    const raw=String(idParam||"").trim();if(!raw||!raw.includes("|"))return null;
    const parts=raw.split("|").map(s=>s.trim());
    // Both old three-part URLs and brand-page four-part keys remain valid.
    const rawBrand=parts[0]||"", rawName=parts.length===4?[parts[1],parts[2]].filter(Boolean).join(" "):(parts[1]||""), rawVitola=parts.length===4?parts[3]:(parts[2]||"");
    const brandLoose=normalizeLoose(rawBrand),brandCompact=compactKey(rawBrand),name=normalizeLoose(rawName),vitola=normalizeLoose(rawVitola);
    const matches=records.filter(r=>{
      const b=getBrand(r), n=normalizeLoose(getName(r)), full=normalizeLoose([getLine(r),getName(r)].filter(Boolean).join(" "));
      return (!brandLoose||normalizeLoose(b)===brandLoose||compactKey(b)===brandCompact)
        && (!name||full===name||n===name||(full&&name&&(full.includes(name)||name.includes(full))))
        && (!vitola||normalizeLoose(getVitola(r))===vitola);
    });
    matches.sort((a,b)=>scoreRecord(b)-scoreRecord(a));return matches[0]||null;
  }
  function readSet(key) {try {const raw=JSON.parse(localStorage.getItem(key)||"[]");return new Set(Array.isArray(raw)?raw:[]);}catch{return new Set();}}
  function writeSet(key,set) {try{localStorage.setItem(key,JSON.stringify(Array.from(set)));}catch{}}
  function flagForCountry(country) {return {cuba:"🇨🇺",nicaragua:"🇳🇮","dominican republic":"🇩🇴",honduras:"🇭🇳",mexico:"🇲🇽",ecuador:"🇪🇨",usa:"🇺🇸","united states":"🇺🇸"}[String(country||"").trim().toLowerCase()]||"";}
  function collectAccolades(records,rec) {
    const key=getCigarId(rec),brand=getBrand(rec),name=getName(rec),vitola=getVitola(rec),out=[],seen=new Set();
    records.filter(row=>{const rowKey=getCigarId(row);if(key&&rowKey&&key===rowKey)return true;return getBrand(row)===brand&&getName(row)===name&&getVitola(row)===vitola;}).forEach(row=>{
      const media=getField(row,["Media","media","Source","source"]),year=getField(row,["Year","year"]),rank=getField(row,["Rank","rank"]);
      if(!media&&!year&&!rank)return;const sig=`${media}|${year}|${rank}`;if(seen.has(sig))return;seen.add(sig);out.push({media,year,rank});
    });
    out.sort((a,b)=>{const ra=parseInt(a.rank,10),rb=parseInt(b.rank,10),ya=parseInt(a.year,10),yb=parseInt(b.year,10);if(Number.isFinite(ra)&&Number.isFinite(rb)&&ra!==rb)return ra-rb;if(Number.isFinite(ya)&&Number.isFinite(yb)&&ya!==yb)return yb-ya;return String(a.media).localeCompare(String(b.media));});
    return out.slice(0,2);
  }
  function renderAccolades(accolades) {
    return accolades.map(item=>{const p=[];if(item.rank)p.push(`#${escapeHTML(item.rank)}`);if(item.year)p.push(`of ${escapeHTML(item.year)}`);if(item.media)p.push(escapeHTML(item.media));return `<div class="cd-accolade-line">${p.join(" - ").replace(" - of "," of ")}</div>`;}).join("");
  }
  function resolveIsCuban(rec) {
    const explicit=getField(rec,["Cuban","cuban","is_cuban"]);
    if(explicit){const v=explicit.toLowerCase().trim();if(["x","yes","true","1","cuban"].includes(v))return true;if(["no","false","0","non-cuban","non cuban"].includes(v))return false;}
    return getOrigin(rec).toLowerCase()==="cuba";
  }
  function buildBrandIconCandidates(rec) {
    const lineImg=normalizeAssetPath(getLineImage(rec)),brandImg=normalizeAssetPath(getBrandImage(rec)),brandKey=normalizeBrand(getBrand(rec)),out=[];
    if(lineImg)out.push(lineImg);if(brandImg)out.push(brandImg);if(brandKey)out.push(`/img/icons/brands/${brandKey}.svg`,`/img/icons/brands/${brandKey}.png`);
    return [...new Set(out.filter(Boolean))];
  }
  function buildCigarImageCandidates(rec) {
    const fromSheet=normalizeAssetPath(getImage(rec)),brand=getBrand(rec),line=getLine(rec),cigar=getName(rec),vitola=getVitola(rec);
    const folder=normalizeBrand(brand),b=compactKey(brand),l=compactKey(line),c=compactKey(cigar),v=compactKey(vitola),out=[];
    if(resolveIsCuban(rec)&&folder){if(l&&c)out.push(`/img/cigars/cuban/${folder}/${l}${c}.png`);if(l&&c&&v)out.push(`/img/cigars/cuban/${folder}/${l}${c}${v}.png`);if(c)out.push(`/img/cigars/cuban/${folder}/${c}.png`);}
    if(fromSheet)out.push(fromSheet);
    if(folder){const names=[];if(b&&l&&c)names.push(`${b}${l}${c}`);if(b&&l&&c&&v)names.push(`${b}${l}${c}${v}`);if(l&&c)names.push(`${l}${c}`);if(l&&c&&v)names.push(`${l}${c}${v}`);if(l&&v)names.push(`${l}${v}`);if(b&&c)names.push(`${b}${c}`);if(b&&c&&v)names.push(`${b}${c}${v}`);if(c)names.push(c);if(c&&v)names.push(`${c}${v}`);[...new Set(names)].forEach(n=>out.push(`/img/cigars/${folder}/${n}.png`));}
    return [...new Set(out.filter(Boolean))];
  }
  function wireImageFallback(img,fallbackClass,fallbackText) {
    if(!img)return;
    function tryNext(){if(!img.isConnected)return;let fallbacks=[];try{fallbacks=JSON.parse(img.dataset.fallbacks||"[]");}catch{}const next=fallbacks.shift();img.dataset.fallbacks=JSON.stringify(fallbacks);if(next){img.src=next;return;}const fallback=document.createElement("div");fallback.className=fallbackClass;fallback.textContent=fallbackText;img.replaceWith(fallback);}
    img.addEventListener("error",tryNext);
    if(img.complete&&!img.naturalWidth)tryNext();
  }
  function buildBrandHref(brand){const v=String(brand||"").trim();return v?`/pos/cigars/brand?brand=${encodeURIComponent(v)}`:"/pos/cigars/";}
  function wireBrandNavigation(brand) {
    const href=buildBrandHref(brand);
    [$(".cd-brand"),$("#cdBrandBadge")].forEach(el=>{if(!el)return;el.style.cursor="pointer";el.setAttribute("role","link");el.setAttribute("tabindex","0");const go=()=>{location.href=href;};el.addEventListener("click",go);el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});});
  }
  /* Demo POS storage adapter from the supplied file. Shared HUB writes below are
     unchanged; this Favorites repair does not call them automatically. */
  const POS_STORAGE_PREFIX = "cigaros_demo_pos_v1:";
  const localCigarImages = new Map();
  function openPosDatabase() {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open("cigaros_demo_pos",1);
      request.onupgradeneeded=()=>{request.result.createObjectStore("records",{keyPath:"key"});};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error("Browser storage is busy."));
    });
  }
  async function loadPosRecord(key) {
    if(!key)throw new Error("A cigar key is required.");
    const db=await openPosDatabase();
    const saved=await new Promise((resolve,reject)=>{const tx=db.transaction("records","readonly"),request=tx.objectStore("records").get(key);tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onabort=()=>{db.close();reject(tx.error);};});
    if(saved)return saved;
    const raw=localStorage.getItem(POS_STORAGE_PREFIX+key);if(raw===null)return null;
    let record;try{record=JSON.parse(raw);}catch{return null;}
    return record&&typeof record==="object"&&!Array.isArray(record)&&record.key===key?record:null;
  }
  async function savePosRecord(record) {
    if(!record.key)throw new Error("A cigar key is required.");
    const db=await openPosDatabase();
    await new Promise((resolve,reject)=>{const tx=db.transaction("records","readwrite");tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};tx.objectStore("records").put(record);});
  }
  async function saveManufacturerBoxUPCToHub(key,manufacturerBoxUPC) {
    const cigarKey=String(key??"").trim(),boxUPC=String(manufacturerBoxUPC??"").trim();
    if(!cigarKey)throw new Error("A cigar key is required for the HUB save.");
    if(boxUPC&&!isValidManufacturerUPC(boxUPC))throw new Error("Manufacturer Box UPC must be a valid 12-digit UPC-A, including its check digit.");
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(CIGAROS_HUB_WRITE_URL,{method:"POST",mode:"cors",credentials:"omit",redirect:"follow",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({key:cigarKey,manufacturerBoxUPC:boxUPC}),signal:controller.signal});
      if(!response.ok)throw new Error(`HUB returned HTTP ${response.status}. Check the web-app deployment and try Save again.`);
      let result;try{result=await response.json();}catch(error){if(error?.name==="AbortError")throw error;throw new Error("HUB did not return a readable confirmation. Check that the web app is deployed with access set to Anyone, then try Save again.");}
      if(!result||result.ok!==true)throw new Error(typeof result?.error==="string"&&result.error.trim()?`HUB: ${result.error}`:"HUB did not confirm the save. Please try Save again.");
      if(result.key!==cigarKey||result.manufacturerBoxUPC!==boxUPC)throw new Error("HUB returned a confirmation for a different key or UPC. Check the HUB writer deployment before trying again.");
    }catch(error){
      if(error?.name==="AbortError")throw new Error("HUB confirmation timed out. The UPC may already have been written; check your connection and try Save again to confirm it.");
      if(error instanceof TypeError)throw new Error("Could not confirm the HUB save. Check your connection and that the web app allows Anyone access. If this continues, check the deployment's cross-origin access. The UPC may already have been written; you can retry Save.");
      throw error;
    }finally{clearTimeout(timeout);}
  }
  function cachePosImage(key,image){++localImageRequest;const previous=localCigarImages.get(key);if(previous)URL.revokeObjectURL(previous);localCigarImages.delete(key);if(image?.blob instanceof Blob)localCigarImages.set(key,URL.createObjectURL(image.blob));}
  function showPosImage(rec) {
    if (activeRecord && activeRecord !== rec) return;
    const url=localCigarImages.get(getCigarId(rec)),container=$(".cd-left",card);if(!url||!container)return;
    const img=document.createElement("img");img.id="cdStickImage";img.className="cd-stick";img.alt=[getBrand(rec),getName(rec)].filter(Boolean).join(" ");img.src=url;
    const existing=$("#cdStickImage",container)||$(".cd-stick-placeholder",container);if(existing)existing.replaceWith(img);else container.prepend(img);
  }
  function getPosFieldValue(rec,saved,field) {
    if(saved&&Object.prototype.hasOwnProperty.call(saved,field.id)){const v=saved[field.id];if(typeof v==="string"||typeof v==="number")return v;}
    const keys=[field.label,normalizeHeader(field.label),field.id];if(field.id==="inventorySingles")keys.push("Inventory singles","Inventory","inventory");
    const value=getField(rec,keys);if(value==="")return field.id==="inventorySingles"?89:"";
    if(field.type==="number"){const v=value.replace(/[$,\s]/g,"");return v!==""&&Number.isFinite(Number(v))?Number(v):"";}return value;
  }
  function isValidManufacturerUPC(value){if(!/^[0-9]{12}$/.test(value))return false;let sum=0;for(let i=0;i<11;i++)sum+=Number(value[i])*(i%2===0?3:1);return (10-sum%10)%10===Number(value[11]);}
  function wireManufacturerBarcodes(sheet) {
    const entries=[{input:$("#manufacturerSingleUPC",sheet),prefix:"cdSingle",label:"SINGLE STICK"},{input:$("#manufacturerBoxUPC",sheet),prefix:"cdBox",label:"BOX"}];
    const placeholder=$("#cdBarcodePlaceholder",sheet);
    function update(){let hasValue=false;entries.forEach(({input,prefix,label})=>{
      const value=input.value,barcodeCard=$("#"+prefix+"BarcodeCard",sheet),svg=$("#"+prefix+"Barcode",sheet),message=$("#"+prefix+"BarcodeMessage",sheet),present=value.trim()!=="";
      hasValue=hasValue||present;barcodeCard.style.display=present?"block":"none";svg.replaceChildren();svg.style.display="none";svg.removeAttribute("aria-label");message.textContent="";message.hidden=true;if(!present)return;
      const showMessage=text=>{message.textContent=text;message.hidden=false;};
      if(!isValidManufacturerUPC(value)){showMessage(/^[0-9]{12}$/.test(value)?"Invalid UPC-A check digit.":"Enter exactly 12 digits for a UPC-A barcode.");return;}
      if(typeof window.JsBarcode!=="function"){showMessage("Barcode preview unavailable. Please reload the page.");return;}
      try{
        window.JsBarcode(svg,value,{format:"UPC",width:2,height:72,displayValue:true,fontSize:18,margin:12,background:"#ffffff",lineColor:"#000000"});
        const width=parseFloat(svg.getAttribute("width")),height=parseFloat(svg.getAttribute("height"));if(!(width>0&&height>0))throw new Error("Empty barcode");
        svg.setAttribute("viewBox","0 0 "+width+" "+height);svg.setAttribute("preserveAspectRatio","xMidYMid meet");svg.setAttribute("role","img");svg.setAttribute("aria-label",label+" UPC-A "+value);svg.style.cssText="display: block; width: 100%; height: auto; margin: 0 auto;";
      }catch{svg.replaceChildren();svg.style.display="none";showMessage("Barcode preview unavailable.");}
    });placeholder.style.display=hasValue?"none":"flex";}
    entries.forEach(({input})=>{input.addEventListener("input",update);input.addEventListener("change",update);});update();return update;
  }
  async function openPosEditor(rec) {
    const existingEditor=document.getElementById("cdPosEditor");if(existingEditor)existingEditor.remove();
    const brand=getBrand(rec)||"—",line=getLine(rec),name=getName(rec),displayName=[line,name].filter(Boolean).join(" ").trim()||name||line||"—";
    const fields=[
      {id:"manufacturerSingleUPC",label:"Manufacturer Single UPC",type:"text",inputmode:"numeric"},
      {id:"manufacturerBoxUPC",label:"Manufacturer Box UPC",type:"text",inputmode:"numeric"},
      {id:"customSingleSKU",label:"Custom Single SKU",type:"text",inputmode:"text"},
      {id:"inventorySingles",label:"Inventory Singles",type:"number",inputmode:"numeric"},
      {id:"inventoryBoxes",label:"Inventory Boxes",type:"number",inputmode:"numeric"},
      {id:"msrp",label:"MSRP",type:"number",inputmode:"decimal",step:"0.01"},
      {id:"boxCount",label:"Box Count",type:"number",inputmode:"numeric"},
      {id:"boxMSRP",label:"Box MSRP",type:"number",inputmode:"decimal",step:"0.01"},
      {id:"cigarCost",label:"Cigar Cost",type:"number",inputmode:"decimal",step:"0.01"},
      {id:"customBoxSKU",label:"Custom Box SKU",type:"text",inputmode:"text"},
      {id:"boxCost",label:"Box Cost",type:"number",inputmode:"decimal",step:"0.01"}
    ];
    const overlay=document.createElement("div");overlay.id="cdPosEditor";
    overlay.style.cssText=`position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;margin:0;padding:0;box-sizing:border-box;background:rgba(5,15,35,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);`;
    const sheet=document.createElement("div");
    sheet.style.cssText=`position:relative;width:100%;max-width:430px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding:12px 18px calc(24px + env(safe-area-inset-bottom,0px));border-radius:24px 24px 0 0;background:#f5f7fa;box-shadow:0 -12px 40px rgba(0,0,0,.22);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;`;
    sheet.innerHTML=`
      <div style="width:38px;height:5px;margin:0 auto 14px;border-radius:999px;background:#c7cbd1;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <button id="cdEditCancel" type="button" style="border:0;background:transparent;color:#64748b;padding:10px 0;font:inherit;font-size:15px;">Cancel</button>
        <div style="color:#16263d;font-size:17px;font-weight:700;text-align:center;">Edit POS Entry</div>
        <button id="cdEditSave" type="button" style="border:0;background:transparent;color:#007aff;padding:10px 0;font:inherit;font-size:15px;font-weight:700;">Save</button>
      </div>
      <div style="margin:0 0 16px;color:#64748b;font-size:13px;">${escapeHTML(brand)} · ${escapeHTML(displayName)}</div>
      <div id="cdBarcodeArea" style="display:flex;flex-direction:column;gap:10px;width:100%;margin:0 0 18px;box-sizing:border-box;">
        <div id="cdSingleBarcodeCard" style="display:none;width:100%;box-sizing:border-box;padding:12px;border:1px solid rgba(22,38,61,.12);border-radius:14px;background:#ffffff;text-align:center;">
          <div style="margin-bottom:7px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.08em;">SINGLE STICK</div>
          <svg id="cdSingleBarcode" style="display:none;width:100%;height:auto;margin:0 auto;"></svg>
          <div id="cdSingleBarcodeMessage" role="status" aria-live="polite" style="padding:16px 0;color:#64748b;font-size:12px;" hidden></div>
        </div>
        <div id="cdBoxBarcodeCard" style="display:none;width:100%;box-sizing:border-box;padding:12px;border:1px solid rgba(22,38,61,.12);border-radius:14px;background:#ffffff;text-align:center;">
          <div style="margin-bottom:7px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.08em;">BOX</div>
          <svg id="cdBoxBarcode" style="display:none;width:100%;height:auto;margin:0 auto;"></svg>
          <div id="cdBoxBarcodeMessage" role="status" aria-live="polite" style="padding:16px 0;color:#64748b;font-size:12px;" hidden></div>
        </div>
        <div id="cdBarcodePlaceholder" style="display:flex;width:100%;min-height:92px;box-sizing:border-box;align-items:center;justify-content:center;padding:16px;border:1px dashed rgba(22,38,61,.20);border-radius:14px;background:rgba(255,255,255,.45);color:#64748b;font-size:11px;font-weight:700;letter-spacing:.05em;text-align:center;">NO MANUFACTURER BARCODE ADDED</div>
      </div>
      <div id="cdEditStatus" role="status" aria-live="polite" style="margin-bottom:12px;color:#b00020;" hidden></div>
      <div style="margin:0 0 18px;">
        <button id="cdUploadImage" type="button" disabled style="width:100%;padding:13px;border:1px solid #007aff;border-radius:12px;background:white;color:#007aff;font:inherit;font-weight:700;">UPLOAD IMAGE</button>
        <input id="cdImageFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <p style="color:#64748b;font-size:12px;">Demo: saved for this cigar in this browser only. PNG, JPG or WebP, up to 10 MB.</p>
        <img id="cdImagePreview" alt="Selected cigar image" hidden style="display:none;max-width:100%;max-height:220px;margin:12px auto;object-fit:contain;">
        <div id="cdImageName" style="color:#64748b;font-size:12px;overflow-wrap:anywhere;"></div>
      </div>
      <div id="cdEditFields" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px;align-items:end;"></div>`;
    overlay.appendChild(sheet);document.body.appendChild(overlay);
    const fieldsContainer=$("#cdEditFields",sheet);
    fields.forEach(field=>{
      const wrap=document.createElement("label");wrap.style.cssText=`display:block;margin:0;min-width:0;${field.id==="customSingleSKU"?"grid-column:1 / -1;":""}`;
      const step=field.step?`step="${escapeAttr(field.step)}"`:"";
      wrap.innerHTML=`<div style="margin:0 0 6px 4px;color:#64748b;font-size:12px;font-weight:600;">${escapeHTML(field.label)}</div>
        <input id="${escapeAttr(field.id)}" type="${escapeAttr(field.type)}" inputmode="${escapeAttr(field.inputmode)}" ${step} autocomplete="off"
        style="display:block;width:100%;height:48px;min-width:0;box-sizing:border-box;border:1px solid rgba(22,38,61,.12);border-radius:14px;background:#ffffff;color:#16263d;padding:0 14px;font:inherit;font-size:16px;outline:none;-webkit-appearance:none;appearance:none;">`;
      fieldsContainer.appendChild(wrap);
    });
    const updateManufacturerBarcodes=wireManufacturerBarcodes(sheet);
    let previewUrl="";
    const closeEditor=()=>{if(saving)return;if(previewUrl)URL.revokeObjectURL(previewUrl);overlay.remove();};
    $("#cdEditCancel",sheet)?.addEventListener("click",closeEditor);
    const key=getCigarId(rec),saveButton=$("#cdEditSave",sheet),status=$("#cdEditStatus",sheet);
    let ready=false,saving=false,selectingImage=false,selectedImage=null;
    const uploadButton=$("#cdUploadImage",sheet),imageInput=$("#cdImageFile",sheet),preview=$("#cdImagePreview",sheet),imageName=$("#cdImageName",sheet);
    const displayPreview=image=>{
      if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=image?.blob instanceof Blob?URL.createObjectURL(image.blob):"";
      preview.hidden=!previewUrl;preview.style.display=previewUrl?"block":"none";if(previewUrl)preview.src=previewUrl;else preview.removeAttribute("src");imageName.textContent=image?.name||"";
    };
    const showError=message=>{status.textContent=message;status.hidden=false;};
    saveButton.disabled=true;uploadButton.addEventListener("click",()=>imageInput.click());
    imageInput.addEventListener("change",async()=>{
      const file=imageInput.files[0];imageInput.value="";if(!file||!ready||saving||selectingImage)return;
      status.hidden=true;
      if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){showError("Choose a PNG, JPG or WebP image no larger than 10 MB.");return;}
      selectingImage=true;saveButton.disabled=true;uploadButton.disabled=true;const candidateUrl=URL.createObjectURL(file);
      try{const check=new Image();check.src=candidateUrl;await check.decode();if(!overlay.isConnected)return;selectedImage={blob:file,name:file.name};displayPreview(selectedImage);}
      catch{showError("This image could not be opened. Please choose another file.");}
      finally{URL.revokeObjectURL(candidateUrl);selectingImage=false;saveButton.disabled=false;uploadButton.disabled=false;}
    });
    saveButton.addEventListener("click",async()=>{
      if(!ready||saving||selectingImage)return;
      const record={key,image:selectedImage};
      for(const field of fields){const input=$("#"+field.id,sheet);if(!input.reportValidity())return;record[field.id]=field.type==="number"&&input.value!==""?Number(input.value):input.value;}
      record.manufacturerBoxUPC=String(record.manufacturerBoxUPC??"").trim();
      if(record.manufacturerBoxUPC&&!isValidManufacturerUPC(record.manufacturerBoxUPC)){showError("Manufacturer Box UPC must contain exactly 12 digits with a valid UPC-A check digit, or be left blank.");$("#manufacturerBoxUPC",sheet).focus();return;}
      saving=true;uploadButton.disabled=true;saveButton.disabled=true;saveButton.textContent="Saving…";fields.forEach(field=>{$("#"+field.id,sheet).disabled=true;});status.hidden=true;
      let savedLocally=false,savedToHub=false;
      try{
        await savePosRecord(record);savedLocally=true;
        await saveManufacturerBoxUPCToHub(record.key,record.manufacturerBoxUPC);savedToHub=true;
        cachePosImage(key,record.image);showPosImage(rec);saving=false;closeEditor();
      }catch(error){
        const detail=error?.message||"Please try again.";
        showError(savedToHub?`Your record and UPC were saved, but the image could not be refreshed. ${detail}`:savedLocally?`Your full record and image are saved in this browser, but the HUB UPC save was not confirmed. ${detail} Your entries are still here.`:`Could not save in this browser, so the HUB write was not attempted. ${detail} Your entries are still here.`);
        console.warn("[POS editor] Save failed:",error);
      }finally{saving=false;uploadButton.disabled=false;saveButton.disabled=false;saveButton.textContent="Save";fields.forEach(field=>{$("#"+field.id,sheet).disabled=false;});}
    });
    overlay.addEventListener("click",event=>{if(event.target===overlay)closeEditor();});
    sheet.addEventListener("click",event=>event.stopPropagation());
    fields.forEach(field=>{$("#"+field.id,sheet).disabled=true;});
    try{
      const saved=await loadPosRecord(key);if(!overlay.isConnected)return;
      selectedImage=saved?.image||null;displayPreview(selectedImage);
      fields.forEach(field=>{const input=$("#"+field.id,sheet);input.value=getPosFieldValue(rec,saved,field);input.disabled=false;});
      updateManufacturerBarcodes();ready=true;uploadButton.disabled=false;saveButton.disabled=false;
    }catch(error){showError(key?"Could not load saved values. Please allow browser storage and reopen Edit.":"This cigar has no record key, so changes cannot be saved.");console.warn("[POS editor] Load failed:",error);}
  }

  /* Brand portfolio navigation — 2026-10-13-r1.
     Arrows and touch/pen swipes share one controller. HUB order is preserved;
     no server writes are made by browsing. Existing sheet keys are not changed. */
  let portfolioRecords = [];
  let portfolio = [];
  let portfolioIndex = -1;
  let activeRecord = null;
  let portfolioBusy = false;
  let portfolioControls = null;
  let portfolioStatus = null;
  let localImageRequest = 0;
  let portfolioView = 0;
  const portfolioRouteKeys = new WeakMap();
  const portfolioRouteHubKeys = new WeakMap();

  function portfolioKey(rec) {
    return getCigarId(rec) || [
      getBrand(rec), [getLine(rec), getName(rec)].filter(Boolean).join(" "), getVitola(rec)
    ].join("|");
  }

  function portfolioMarket(rec) {
    const explicit = getField(rec, ["Cuban", "cuban", "is_cuban"]).toLowerCase();
    if (["x", "yes", "true", "1", "cuban"].includes(explicit)) return "cuban";
    if (["no", "false", "0", "non-cuban", "non cuban"].includes(explicit)) return "non-cuban";
    const manufacturer = getField(rec, ["Manufacturer", "manufacturer"]);
    return resolveIsCuban(rec) || /\(cuban\)/i.test(getBrand(rec) + " " + manufacturer)
      ? "cuban" : "non-cuban";
  }

  function portfolioLabel(rec) {
    return [getLine(rec), getName(rec), getVitola(rec)].filter(Boolean).join(" · ");
  }

  function explicitPortfolioRoute(records, seed) {
    const parts = (getParam("id") || getParam("key")).split("|").map(normalizeLoose);
    const fields = rec => [getBrand(rec), getLine(rec), getName(rec), getVitola(rec)];
    const wanted = fields(seed).map(normalizeLoose), key = getCigarId(seed);
    if (!key || parts.length !== 4 || parts.some((part, index) => part !== wanted[index])) return "";
    const sameVariant = rec => fields(rec).every((value, index) => normalizeLoose(value) === wanted[index]);
    const candidates = records.filter(rec => portfolioMarket(rec) === portfolioMarket(seed));
    // Keep a precise route only when a shared HUB key covers different variants.
    if (!candidates.some(rec => getCigarId(rec) === key && !sameVariant(rec))) return "";
    if (candidates.some(rec => sameVariant(rec) && getCigarId(rec) !== key) && getParam("hubKey") !== key) return "";
    return fields(seed).join("|");
  }

  function makePortfolio(records, seed) {
    const brand = normalizeBrand(getBrand(seed)), market = portfolioMarket(seed);
    const grouped = new Map();
    for (const rec of records) {
      if (!brand || normalizeBrand(getBrand(rec)) !== brand || portfolioMarket(rec) !== market) continue;
      if (!getName(rec) && !getLine(rec)) continue;
      // Repeated ratings/accolades for the same key are one portfolio entry.
      const key = portfolioKey(rec);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(rec);
    }
    // Map insertion order is the first appearance in the HUB. Never sort by rating.
    const items = Array.from(grouped.values(), rows => bestRecord(rows));
    if (!items.some(rec => portfolioKey(rec) === portfolioKey(seed))) items.push(seed);
    return items;
  }

  function recordForLocation(records) {
    const id = getParam("id") || getParam("key"), slug = getParam("slug");
    const market = getParam("cdMarket");
    const candidates = ["cuban", "non-cuban"].includes(market)
      ? records.filter(rec => portfolioMarket(rec) === market) : records;
    // A publication can qualify an exact four-part variant with its original HUB identity.
    // An invalid qualification must not fall through to another cigar or shared-key row.
    const hubKey = getParam("hubKey");
    if (hubKey) {
      const parts = id.split("|").map(normalizeLoose);
      if (parts.length !== 4) return null;
      return bestRecord(candidates.filter(row => getCigarId(row) === hubKey &&
        [getBrand(row), getLine(row), getName(row), getVitola(row)]
          .every((value, index) => normalizeLoose(value) === parts[index])));
    }
    let rec = id ? bestRecord(candidates.filter(row => getCigarId(row) === id)) : null;
    // Exact generated keys before legacy fuzzy matching (e.g. No. 1 vs No. 10).
    if (!rec && id) {
      const normalized = value => String(value).trim().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
      rec = bestRecord(candidates.filter(row => normalized(portfolioKey(row)) === normalized(id)));
    }
    if (!rec && id && id.includes("|")) {
      const parts = id.split("|").map(value => value.trim());
      if (parts.length === 3 || parts.length === 4) {
        const brand = normalizeBrand(parts[0]);
        const name = normalizeLoose(parts.length === 4 ? [parts[1], parts[2]].filter(Boolean).join(" ") : parts[1]);
        const vitola = normalizeLoose(parts[parts.length - 1]);
        rec = bestRecord(candidates.filter(row => {
          const names = [getName(row), [getLine(row), getName(row)].filter(Boolean).join(" "),
            [getBrand(row), getLine(row), getName(row)].filter(Boolean).join(" "),
            [getBrand(row), getName(row)].filter(Boolean).join(" ")].map(normalizeLoose);
          return brand === normalizeBrand(getBrand(row)) && names.includes(name)
            && (!vitola || vitola === normalizeLoose(getVitola(row)));
        }));
      }
    }
    if (!rec && id) rec = findByPipeKey(candidates, id);
    if (!rec && id) rec = findById(candidates, id);
    if (!rec && id) rec = findBySlug(candidates, id);
    if (!rec && slug) rec = findBySlug(candidates, slug);
    return rec;
  }

  function portfolioURL(rec) {
    const url = new URL(location.href);
    url.searchParams.delete("id");
    url.searchParams.delete("slug");
    url.searchParams.set("key", portfolioRouteKeys.get(rec) || portfolioKey(rec));
    const hubKey = portfolioRouteHubKeys.get(rec);
    if (hubKey) url.searchParams.set("hubKey", hubKey);
    else url.searchParams.delete("hubKey");
    // Separate Cuban and non-Cuban portfolios, including brands with the same name.
    url.searchParams.set("cdMarket", portfolioMarket(rec));
    return url;
  }

  function portfolioBlocked() {
    if (portfolioBusy || document.getElementById("cdPosEditor")) return true;
    return Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]'))
      .some(dialog => !dialog.hidden && dialog.getClientRects().length > 0);
  }

  function addPortfolioStyles() {
    if (document.getElementById("cdPortfolioStyle")) return;
    const style = document.createElement("style");
    style.id = "cdPortfolioStyle";
    style.textContent = `
      /* Only the detail surface handles horizontal swipes. Scrolling and zoom stay enabled. */
      #cdCard.cd-portfolio-surface { touch-action: pan-y pinch-zoom; }
      #cdCard.cd-portfolio-switching { pointer-events: none; will-change: transform, opacity; }
      .cd-wrap.cd-portfolio-viewport { overflow-x: clip; }
      #cdCard .cd-stick, #cdCard .cd-badge { -webkit-user-drag: none; }
      #cdPortfolioControls {
        display: flex; flex-direction: row; align-items: center; justify-content: space-between;
        gap: 16px; width: 100%; box-sizing: border-box; margin: 12px 0 0; padding: 4px;
      }
      #cdPortfolioControls[hidden] { display: none !important; }
      #cdPortfolioControls .cd-portfolio-arrow {
        position: relative; display: grid; place-items: center; flex: 0 0 48px;
        width: 48px; height: 48px; min-width: 48px; min-height: 48px;
        padding: 0; margin: 0; box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, .24); border-radius: 50%;
        appearance: none; -webkit-appearance: none;
        background: linear-gradient(145deg, rgba(255,255,255,.19), rgba(255,255,255,.03)), rgba(28,38,55,.58);
        color: #f6f8ff; cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(255,255,255,.06), 0 4px 14px rgba(0,0,0,.22);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        backdrop-filter: blur(20px) saturate(180%);
        touch-action: manipulation; -webkit-tap-highlight-color: transparent;
        transition: opacity .15s ease, transform .15s ease;
      }
      #cdPortfolioControls .cd-portfolio-arrow svg { display: block; width: 20px; height: 20px; }
      #cdPortfolioControls .cd-portfolio-arrow:disabled { opacity: .35; cursor: default; }
      #cdPortfolioControls .cd-portfolio-arrow:not(:disabled):active { transform: scale(.94); }
      #cdPortfolioControls .cd-portfolio-arrow:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      html[data-theme="light"] #cdPortfolioControls .cd-portfolio-arrow {
        color: #16263d; border-color: rgba(255,255,255,.85);
        background: linear-gradient(145deg, rgba(255,255,255,.72), rgba(255,255,255,.18)), rgba(225,233,244,.48);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(129,150,177,.16), 0 4px 14px rgba(22,38,61,.14);
      }
      #cdPortfolioStatus {
        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%);
        white-space: nowrap; border: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        #cdPortfolioControls .cd-portfolio-arrow { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function positionPortfolioControls() {
    if (!portfolioControls || !card) return;
    const tobacco = $(".cd-tobaccos", card);
    // Reuse the same buttons after every render, preserving their click listeners.
    if (tobacco && tobacco.nextElementSibling !== portfolioControls) {
      tobacco.insertAdjacentElement("afterend", portfolioControls);
    }
  }

  function updatePortfolioControls(announce = false) {
    if (!portfolioControls) return;
    portfolioControls.hidden = portfolio.length < 2;
    portfolioControls.dataset.index = String(portfolioIndex);
    portfolioControls.dataset.count = String(portfolio.length);
    portfolioControls.setAttribute("aria-label", (getBrand(activeRecord) || "Brand") + " portfolio");
    const previous = $("#cdPortfolioPrev", portfolioControls), next = $("#cdPortfolioNext", portfolioControls);
    const first = portfolioIndex <= 0, last = portfolioIndex >= portfolio.length - 1;
    previous.disabled = portfolioBusy || first;
    next.disabled = portfolioBusy || last;
    previous.title = first ? "First cigar in this portfolio" : "Previous: " + portfolioLabel(portfolio[portfolioIndex - 1]);
    next.title = last ? "Last cigar in this portfolio" : "Next: " + portfolioLabel(portfolio[portfolioIndex + 1]);
    previous.setAttribute("aria-label", previous.title);
    next.setAttribute("aria-label", next.title);
    card.classList.toggle("cd-portfolio-surface", portfolio.length > 1);
    card.dataset.cigarKey = portfolioKey(activeRecord);
    if (announce && portfolioStatus) {
      portfolioStatus.textContent = `${getBrand(activeRecord)}. ${portfolioLabel(activeRecord)}. Cigar ${portfolioIndex + 1} of ${portfolio.length}.`;
    }
    positionPortfolioControls();
  }

  async function refreshPortfolioImage(rec, view) {
    const key = getCigarId(rec);
    if (!key) return; // Do not invent a storage/HUB key for a keyless row.
    const request = ++localImageRequest;
    try {
      const saved = await loadPosRecord(key);
      if (view !== portfolioView || activeRecord !== rec || request !== localImageRequest) return;
      cachePosImage(key, saved?.image);
      showPosImage(rec);
      // Keep only the current uploaded photo; browsing a large brand must not retain every blob.
      for (const [otherKey, url] of localCigarImages) {
        if (otherKey !== key) { URL.revokeObjectURL(url); localCigarImages.delete(otherKey); }
      }
      positionPortfolioControls();
    } catch (error) { console.warn("[POS image] Local image could not be loaded:", error); }
  }

  function animatePortfolio(frames, duration) {
    if (typeof card.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    try { return card.animate(frames, {duration, easing:"cubic-bezier(.22,.61,.36,1)", fill:"forwards"}); }
    catch { return null; }
  }

  async function movePortfolio(direction) {
    if (portfolioBlocked() || ![-1, 1].includes(direction)) return;
    const target = portfolioIndex + direction;
    if (target < 0 || target >= portfolio.length) return;
    const previousRecord = activeRecord, previousIndex = portfolioIndex, previousURL = location.href;
    const nextRecord = portfolio[target], url = portfolioURL(nextRecord), scrollY = window.scrollY;
    let outgoing = null, incoming = null, committed = false;
    portfolioBusy = true;
    card.classList.add("cd-portfolio-switching");
    card.setAttribute("aria-busy", "true");
    card.inert = true;
    updatePortfolioControls();
    try {
      outgoing = animatePortfolio([
        {transform:"translate3d(0,0,0)", opacity:1},
        {transform:`translate3d(${-direction * 28}px,0,0)`, opacity:0}
      ], 105);
      if (outgoing) await outgoing.finished.catch(() => {});
      try {
        // One history entry for the detail browser: Back is not a replay of every swipe.
        history.replaceState(history.state, "", url.href);
      } catch (error) {
        console.warn("[Portfolio] In-place URL update unavailable; opening the matching detail URL.", error);
        location.replace(url.href);
        return;
      }
      activeRecord = nextRecord;
      portfolioIndex = target;
      const view = ++portfolioView;
      render(portfolioRecords, nextRecord);
      showPosImage(nextRecord);
      committed = true;
      if (outgoing) { outgoing.cancel(); outgoing = null; }
      // Preserve the user's vertical reading position (the browser clamps shorter pages).
      window.scrollTo(0, scrollY);
      updatePortfolioControls(true);
      void refreshPortfolioImage(nextRecord, view);
      incoming = animatePortfolio([
        {transform:`translate3d(${direction * 28}px,0,0)`, opacity:0},
        {transform:"translate3d(0,0,0)", opacity:1}
      ], 165);
      if (incoming) await incoming.finished.catch(() => {});
    } catch (error) {
      console.warn("[Portfolio] Cigar could not be switched:", error);
      if (!committed) {
        activeRecord = previousRecord;
        portfolioIndex = previousIndex;
        ++portfolioView;
        try { history.replaceState(history.state, "", previousURL); render(portfolioRecords, previousRecord); showPosImage(previousRecord); }
        catch { location.replace(previousURL); }
      }
      if (portfolioStatus) portfolioStatus.textContent = "Could not switch cigars. Please try again.";
    } finally {
      outgoing?.cancel(); incoming?.cancel();
      card.inert = false;
      card.classList.remove("cd-portfolio-switching");
      card.removeAttribute("aria-busy");
      portfolioBusy = false;
      updatePortfolioControls();
    }
  }

  function wirePortfolioGestures() {
    let gesture = null, ignoreClickUntil = 0;
    const interactive = 'button, a, input, select, textarea, label, [role="button"], [role="link"], [role="slider"], [contenteditable]:not([contenteditable="false"])';
    // A second finger cancels the swipe so a pinch cannot switch cigars.
    document.addEventListener("pointerdown", event => {
      if (gesture && event.pointerId !== gesture.id) gesture = null;
    }, {capture:true, passive:true});
    card.addEventListener("pointerdown", event => {
      ignoreClickUntil = 0;
      if (!event.isPrimary || event.pointerType === "mouse" || portfolio.length < 2 || portfolioBlocked()) return;
      if (event.target.closest?.(interactive)) return;
      const width = document.documentElement.clientWidth;
      // Leave the very edge to the browser's own back/forward gesture.
      if (event.clientX < 24 || event.clientX > width - 24 || (window.visualViewport?.scale || 1) > 1.05) return;
      gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, time:performance.now(), axis:""};
    }, {passive:true});
    card.addEventListener("pointermove", event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
      if (!gesture.axis && Math.max(dx, dy) > 10) {
        if (dy >= dx) { gesture = null; return; }
        if (dx > dy * 1.35) gesture.axis = "x";
      }
    }, {passive:true});
    document.addEventListener("pointerup", event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const start = gesture; gesture = null;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      const threshold = Math.max(44, Math.min(80, card.clientWidth * .12));
      if (performance.now() - start.time > 1200 || Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      ignoreClickUntil = performance.now() + 400;
      void movePortfolio(dx < 0 ? 1 : -1);
    }, {passive:true});
    document.addEventListener("pointercancel", () => { gesture = null; }, {passive:true});
    window.addEventListener("blur", () => { gesture = null; });
    card.addEventListener("click", event => {
      if (portfolioBusy || (event.detail !== 0 && performance.now() < ignoreClickUntil)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    card.addEventListener("dragstart", event => {
      if (event.target.closest?.(".cd-stick, .cd-badge")) event.preventDefault();
    });
    document.addEventListener("keydown", event => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || portfolioBlocked()) return;
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (event.target.closest?.(interactive) && !event.target.closest?.("#cdPortfolioControls")) return;
      if (window.getSelection()?.toString()) return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      if (portfolioIndex + direction < 0 || portfolioIndex + direction >= portfolio.length) return;
      event.preventDefault(); void movePortfolio(direction);
    });
  }

  function startPortfolio(records, seed) {
    portfolioRecords = records;
    portfolio = makePortfolio(records, seed);
    portfolioIndex = portfolio.findIndex(rec => portfolioKey(rec) === portfolioKey(seed));
    const explicitRoute = explicitPortfolioRoute(records, seed);
    if (explicitRoute) {
      portfolioRouteKeys.set(seed, explicitRoute);
      if (getParam("hubKey") === getCigarId(seed)) portfolioRouteHubKeys.set(seed, getCigarId(seed));
      portfolio[portfolioIndex] = seed;
    }
    activeRecord = portfolio[portfolioIndex];
    const view = ++portfolioView;
    addPortfolioStyles();
    card.closest(".cd-wrap")?.classList.add("cd-portfolio-viewport");
    portfolioControls = document.createElement("nav");
    portfolioControls.id = "cdPortfolioControls";
    portfolioControls.hidden = true;
    portfolioControls.innerHTML = `
      <button id="cdPortfolioPrev" class="cd-portfolio-arrow" type="button" aria-label="Previous cigar" aria-controls="cdCard">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button id="cdPortfolioNext" class="cd-portfolio-arrow" type="button" aria-label="Next cigar" aria-controls="cdCard">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    portfolioStatus = document.createElement("div");
    portfolioStatus.id = "cdPortfolioStatus";
    portfolioStatus.setAttribute("role", "status");
    portfolioStatus.setAttribute("aria-live", "polite");
    portfolioStatus.setAttribute("aria-atomic", "true");
    document.body.appendChild(portfolioStatus);
    $("#cdPortfolioPrev", portfolioControls).addEventListener("click", () => { void movePortfolio(-1); });
    $("#cdPortfolioNext", portfolioControls).addEventListener("click", () => { void movePortfolio(1); });
    wirePortfolioGestures();
    render(records, activeRecord);
    showPosImage(activeRecord);
    updatePortfolioControls();
    void refreshPortfolioImage(activeRecord, view);
  }

  let favoriteUnsubscribe = () => {};
  let pageShowUnsubscribe = () => {};
  function render(records,rec) {
    favoriteUnsubscribe(); pageShowUnsubscribe();
    $("#cdFavoriteStatus")?.remove();
    const id=getCigarId(rec),brand=getBrand(rec)||"—",line=getLine(rec),name=getName(rec);
    const displayName=[line,name].filter(Boolean).join(" ").trim()||name||line||"—";
    const vitola=getVitola(rec)||"—",wrapper=getWrapper(rec)||"—",binder=getBinder(rec)||"—",filler=getFiller(rec)||"—",origin=getOrigin(rec)||"—",strength=getStrength(rec)||"—",shade=getShade(rec)||"—",shape=getShape(rec)||"—",ring=getRing(rec)||"—",length=getLength(rec)||"—";
    const cigarImgCandidates=buildCigarImageCandidates(rec),brandImgCandidates=buildBrandIconCandidates(rec),flag=flagForCountry(origin),accolades=collectAccolades(records,rec);
    document.title=`${brand} ${displayName}`.trim();
    card.innerHTML=`
      <div class="cd-head">
        <div class="cd-head-copy"><div class="cd-brand">${escapeHTML(brand)}</div><div class="cd-name">${escapeHTML(displayName)}</div></div>
        ${brandImgCandidates.length?`<img class="cd-badge" id="cdBrandBadge" src="${escapeAttr(brandImgCandidates[0])}" data-fallbacks='${escapeAttr(JSON.stringify(brandImgCandidates.slice(1)))}' alt="${escapeAttr(brand)}" loading="lazy" decoding="async">`:`<div class="cd-badge-placeholder">Brand</div>`}
      </div>
      <div class="cd-grid">
        <div class="cd-left">
          ${cigarImgCandidates.length?`<img class="cd-stick" id="cdStickImage" src="${escapeAttr(cigarImgCandidates[0])}" data-fallbacks='${escapeAttr(JSON.stringify(cigarImgCandidates.slice(1)))}' alt="${escapeAttr(displayName)}" loading="lazy" decoding="async">`:`<div class="cd-stick-placeholder">No image</div>`}
        </div>
        <div class="cd-right">
          <div class="cd-top-stats">
            <div class="cd-card cd-pair-card"><div class="cd-pair-grid">
              <div class="cd-pair-item"><div class="cd-card-label">Ring</div><div class="cd-pair-value">${escapeHTML(ring)}</div></div>
              <div class="cd-pair-item"><div class="cd-card-label">Length</div><div class="cd-pair-value">${escapeHTML(length)}</div></div>
            </div></div>
            <div class="cd-card cd-mini cd-mini--single"><div class="cd-card-label">Vitola</div><div class="cd-mini-value">${escapeHTML(vitola)}</div></div>
          </div>
          <div class="cd-card cd-shade-card"><div class="cd-card-label">Wrapper Shade</div><div class="cd-shade-value">${escapeHTML(shade)}</div></div>
          <div class="cd-mini-grid">
            <div class="cd-card cd-mini"><div class="cd-card-label">Strength</div><div class="cd-mini-value">${escapeHTML(strength)}</div></div>
            <div class="cd-card cd-mini"><div class="cd-card-label">Shape</div><div class="cd-mini-value">${escapeHTML(shape)}</div></div>
          </div>
          <div class="cd-card cd-tobaccos">
            <div class="cd-tobacco-row"><div class="cd-card-label">Wrapper</div><div class="cd-tobacco-value wrap-text">${escapeHTML(wrapper)}</div></div>
            <div class="cd-tobacco-row"><div class="cd-card-label">Binder</div><div class="cd-tobacco-value wrap-text">${escapeHTML(binder)}</div></div>
            <div class="cd-tobacco-row"><div class="cd-card-label">Filler</div><div class="cd-tobacco-value wrap-text">${escapeHTML(filler)}</div></div>
            <div class="cd-origin-inline"><span class="cd-origin-inline-text">Rolled in ${escapeHTML(origin)}</span>${flag?`<span class="cd-flag" aria-hidden="true">${flag}</span>`:""}</div>
          </div>
          ${accolades.length?`<div class="cd-accolades-inline">${renderAccolades(accolades)}</div>`:""}
          <div class="cd-actions">
            <button class="cd-action" type="button" id="cdCompare">Compare</button>
            <button class="cd-action" type="button" id="cdFavorite">Favorite</button>
            <button class="cd-action" type="button" id="cdWishlist">Wishlist</button>
            <button class="cd-action cd-action--primary" type="button" id="cdEdit">Edit</button>
          </div>
        </div>
      </div>`;
    const compareSet=readSet(COMPARE_KEY),favoriteBtn=$("#cdFavorite"),compareBtn=$("#cdCompare"),wishlistBtn=$("#cdWishlist"),editBtn=$("#cdEdit");
    let savingFavorite=false;
    function makeFavoritePayload() {
      const key=id||getParam("key")||getParam("id")||[brand,displayName,getVitola(rec)].join("|");
      const visible=$("#cdStickImage");
      const loaded=visible?.complete&&visible.naturalWidth>0?Favorites.imagePath(visible.getAttribute("src")):"";
      return {key,type:"cigar",name:displayName,cigar:name,brand,line,vitola:getVitola(rec),ring:getRing(rec),length:getLength(rec),wrapper:getWrapper(rec),binder:getBinder(rec),filler:getFiller(rec),origin:getOrigin(rec),country:getOrigin(rec),strength:getStrength(rec),shape:getShape(rec),shade:getShade(rec),
        img:loaded||cigarImgCandidates[0]||"",imageCandidates:[loaded,...cigarImgCandidates].filter(Boolean),posImageKey:id,
        href:"/pos/cigars/cigar.html?key="+encodeURIComponent(key)};
    }
    function favoriteMessage(message) {
      if (!favoriteBtn?.isConnected) return;
      let notice=$("#cdFavoriteStatus");
      if(!notice){notice=document.createElement("div");notice.id="cdFavoriteStatus";notice.setAttribute("role","alert");notice.style.cssText="position:fixed;bottom:100px;left:16px;right:16px;z-index:99999;padding:14px;border-radius:14px;background:#fff;color:#9f1239;font:14px -apple-system,system-ui,sans-serif;";document.body.appendChild(notice);}
      notice.textContent=message;
    }
    function syncUI() {
      if (!favoriteBtn?.isConnected) return;
      try {
        const isFavorite=Favorites.has(makeFavoritePayload());
        favoriteBtn?.classList.toggle("is-on",isFavorite);
        favoriteBtn?.setAttribute("aria-pressed",String(isFavorite));
        if(favoriteBtn)favoriteBtn.textContent=isFavorite?"Favorited":"Favorite";
      }catch(error){favoriteMessage(error.message);}
      compareBtn?.classList.toggle("is-on",compareSet.has(id));
    }
    favoriteBtn?.addEventListener("click",async()=>{
      if(savingFavorite)return;
      savingFavorite=true;favoriteBtn.disabled=true;
      $("#cdFavoriteStatus")?.remove();
      try{const payload=makeFavoritePayload();await Favorites.set(payload,!Favorites.has(payload));syncUI();}
      catch(error){favoriteMessage(error.message);}
      finally{savingFavorite=false;favoriteBtn.disabled=false;}
    });
    favoriteUnsubscribe=Favorites.subscribe(syncUI);
    window.addEventListener("pageshow",syncUI);
    pageShowUnsubscribe=()=>window.removeEventListener("pageshow",syncUI);
    compareBtn?.addEventListener("click",()=>{
      if(!id)return;
      if(compareSet.has(id))compareSet.delete(id);else compareSet.add(id);
      const capped=Array.from(compareSet).slice(0,4);writeSet(COMPARE_KEY,new Set(capped));syncUI();
    });
    wishlistBtn?.addEventListener("click",()=>{
      const cartApi=window.cigarOSCart;if(!cartApi||typeof cartApi.add!=="function")return;
      const cigarKey=id||`${brand}|${name}|${vitola}`;
      cartApi.add({type:"cigar",key:cigarKey,id:cigarKey,brand,line,name,vitola,ring,length,shape,wrapper,binder,filler,origin,shade,strength,image:cigarImgCandidates[0]||"",url:`/pos/cigars/cigar.html?key=${encodeURIComponent(cigarKey)}`});
    });
    editBtn?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();openPosEditor(rec);});
    syncUI();
    wireImageFallback($("#cdBrandBadge"),"cd-badge-placeholder","Brand");
    wireImageFallback($("#cdStickImage"),"cd-stick-placeholder","No image");
    wireBrandNavigation(brand);
    positionPortfolioControls();
  }
  async function load() {
    if(!card)return;
    applyTheme(getSavedTheme());
    themeToggle?.addEventListener("click",()=>applyTheme(getSavedTheme()==="dark"?"light":"dark"));
    backBtn?.addEventListener("click",()=>{if(history.length>1)history.back();else location.href=buildBrandHref(getBrand(activeRecord));});
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let input;
      try {
        const res = await fetch(SHEET_CSV_URL, {cache:"no-store", signal:controller.signal});
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
        input = await res.text();
        if (/^\s*</.test(input)) throw new Error("Catalog returned a page instead of CSV.");
      } finally { clearTimeout(timeout); }
      const records = rowsToObjects(parseCSV(input));
      const rec = recordForLocation(records);
      if (!rec) { card.innerHTML=`<div class="cd-loading">Cigar not found.</div>`; return; }
      try { await Favorites.hydrateRecords(records); }
      catch(error) { console.warn("[Favorites] Migration/enrichment failed:",error); }
      startPortfolio(records,rec);
    } catch(error) {
      card.innerHTML=`<div class="cd-loading">Error loading cigar data. Please reload to try again.</div>`;
      console.warn("[cigar detail] load error:",error);
    } finally { if(loading)loading.style.display="none"; }
  }
  load();
})();
