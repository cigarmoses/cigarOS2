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


/* /profile/favorites/favorites.js — Favorites repair 2026-10-12-r1.
   Tap opens the saved detail URL. Hold on touch; click-drag with a mouse.
   No demo favorites, HTML changes, drag library, or image-size overrides. */
(() => {
  "use strict";
  const F = window.CigarFavorites;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const els = {
    list: $("#favList"), status: $("#favStatus"), search: $("#favSearch"),
    tabs: $$(".fav-tab"), theme: $("#themeToggle"), themeIcon: $("#themeIcon"),
    add: $("#favAddBtn"), edit: $("#favEditBtn"), filter: $("#favFilterBtn"),
    chips: $("#favAppliedFilters"), sheet: $("#favFilterSheet"),
    subtitle: $("#favSheetSubtitle"), groups: $("#favFilterGroups"),
    clear: $("#favClearFilters"), done: $("#favDoneFilters")
  };
  if (!els.list || !F) return;
  // These are the same cigar fields used by the supplied POS brand filters.
  const filterDefs = [
    ["vitola", "Vitola"], ["ring", "Ring Gauge"], ["length", "Length"],
    ["strength", "Strength"], ["shape", "Shape"], ["shade", "Wrapper Shade"]
  ];
  const state = {
    type: tabType(new URL(location.href).searchParams.get("tab")),
    query: "", filters: Object.fromEntries(filterDefs.map(([k]) => [k, new Set()])),
    items: [], visible: [], rendered: false, editing: false, drag: null, settling: false,
    suppressClickUntil: 0, ignoreMouseUntil: 0, imageGeneration: 0,
    urls: [], sheetOpen: false, savedOverflow: "", lastFocus: null
  };
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function tabType(value) { return ({cigar:"cigar",cigars:"cigar",brand:"brand",brands:"brand",shop:"shop",shops:"shop"})[value] || "cigar"; }
  function title(item) { return item.name || item.cigar || item.brand || item.key || "Favorite cigar"; }
  function listRows() { return Array.from(els.list.children).filter(el => el.hasAttribute("data-id")); }
  function announce(message, error = false) {
    let el = $(error ? "#favRepairError" : "#favAnnouncement");
    if (!el) {
      el = document.createElement("div"); el.id = error ? "favRepairError" : "favAnnouncement";
      el.className = error ? "fav-repair-error" : "fav-visually-hidden";
      el.setAttribute("role", error ? "alert" : "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    if (error) { clearTimeout(el.hideTimer); el.hideTimer = setTimeout(() => el.remove(), 9000); }
  }
  function refresh() {
    if (state.drag || state.settling) return;
    try {
      const next = F.all();
      const changed = !state.rendered || JSON.stringify(next) !== JSON.stringify(state.items);
      state.items = next;
      // Do not replace a tapped link on a focus/pageshow event when data is unchanged.
      if (changed) { render(); if (state.sheetOpen) renderFilters(); }
    }
    catch (error) { announce(error.message, true); }
  }
  function selectedItems() { return state.items.filter(i => i.type === state.type); }
  function applyFilters(items) {
    const words = F.norm(state.query).split(/\s+/).filter(Boolean);
    return items.filter(item => {
      const hay = F.norm([item.name,item.brand,item.cigar,item.line,item.manufacturer,item.vitola,item.ring,item.length,item.wrapper,item.binder,item.filler,item.strength,item.shape,item.shade,item.origin,item.country,item.notes].join(" "));
      if (!words.every(word => hay.includes(word))) return false;
      return state.type !== "cigar" || filterDefs.every(([k]) => !state.filters[k].size || state.filters[k].has(F.norm(item[k])));
    });
  }
  function render() {
    if (state.drag || state.settling) return;
    state.rendered = true;
    state.imageGeneration++;
    for (const url of state.urls) URL.revokeObjectURL(url);
    state.urls = [];
    state.visible = applyFilters(selectedItems());
    els.list.classList.toggle("is-cigars", state.type === "cigar");
    els.list.classList.toggle("is-icons", state.type !== "cigar");
    els.tabs.forEach(tab => {
      const active = tab.dataset.type === state.type;
      tab.classList.toggle("active", active); tab.setAttribute("aria-pressed", String(active));
    });
    if (els.filter) els.filter.hidden = state.type !== "cigar";
    if (els.search) els.search.placeholder = state.type === "cigar" ? "Search favorites" : `Search ${state.type}s`;
    if (els.status) {
      els.status.hidden = !selectedItems().length || !!state.visible.length;
      els.status.textContent = "No favorites match your search or filters.";
    }
    if (!selectedItems().length) {
      els.list.innerHTML = `<article class="fav-empty"><h3>No ${state.type}s saved yet</h3><p>Tap Favorite on a cigar detail page to save it here.</p></article>`;
      renderChips(); return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of state.visible) {
      const row = document.createElement("article");
      row.className = item.type === "cigar" ? "fav-cigar" : "fav-icon-item";
      row.dataset.id = item.uid;
      const link = document.createElement("a");
      link.className = item.type === "cigar" ? "fav-cigar-link" : "fav-icon-link";
      link.href = item.href; link.draggable = false;
      link.setAttribute("aria-label", title(item));
      link.title = `${title(item)} — hold to reorder`;
      if (item.type === "cigar") {
        const img = document.createElement("img");
        img.alt = title(item); img.draggable = false; img.decoding = "async";
        link.appendChild(img); wireCigarImage(img, item, state.imageGeneration);
      } else {
        const art = document.createElement("div"); art.className = "fav-icon-art";
        const path = item.img || (item.type === "brand" ? `/img/icons/brands/${F.compact(item.brand || item.name)}.svg` : "");
        if (path) {
          const img = document.createElement("img"); img.alt = ""; img.draggable = false;
          img.onerror = () => { art.textContent = title(item).slice(0, 1); };
          img.src = path; art.appendChild(img);
        } else art.textContent = title(item).slice(0,1);
        const name = document.createElement("div"); name.className = "fav-icon-name"; name.textContent = title(item);
        link.append(art,name);
        if (item.type === "shop" && item.country) {
          const meta = document.createElement("div"); meta.className = "fav-icon-meta"; meta.textContent = item.country; link.appendChild(meta);
        }
      }
      row.appendChild(link);
      // A sibling button, not a button nested inside a link.
      const remove = document.createElement("button");
      remove.type = "button"; remove.dataset.remove = item.uid;
      remove.className = item.type === "cigar" ? "fav-cigar-remove" : "fav-icon-remove";
      remove.textContent = "×"; remove.setAttribute("aria-label", "Remove " + title(item));
      row.appendChild(remove); fragment.appendChild(row);
    }
    els.list.replaceChildren(fragment); renderChips();
  }
  async function wireCigarImage(img, item, generation) {
    const paths = F.imageCandidates(item);
    let index = 0;
    const next = () => {
      if (generation !== state.imageGeneration) return;
      if (index < paths.length) { img.src = paths[index++]; return; }
      img.hidden = true;
      if (!img.parentElement) return;
      const note = document.createElement("span"); note.className = "fav-image-unavailable";
      note.textContent = "Image unavailable"; img.parentElement.appendChild(note);
    };
    img.onerror = next;
    try {
      const blob = await F.localImage(item.posImageKey || item.key);
      if (generation !== state.imageGeneration) return;
      if (blob) { const url = URL.createObjectURL(blob); state.urls.push(url); paths.unshift(url); }
    } catch (error) { console.warn("[Favorites image]", error); }
    next();
  }
  function renderFilters() {
    if (!els.groups) return;
    const cigars = state.items.filter(i => i.type === "cigar");
    els.groups.innerHTML = filterDefs.map(([key,label]) => {
      const options = new Map();
      for (const item of cigars) {
        const value = String(item[key] || "").trim();
        if (value && !["n/a","—","unknown"].includes(value.toLowerCase())) options.set(F.norm(value), value);
      }
      const values = [...options].sort((a,b) => a[1].localeCompare(b[1],undefined,{numeric:true,sensitivity:"base"}));
      return `<section class="fav-filter-group"><h3>${label}</h3><div class="fav-filter-options">${values.length ? values.map(([value,display]) => `<button type="button" class="fav-filter-option ${state.filters[key].has(value) ? "active" : ""}" data-filter-key="${key}" data-filter-value="${escape(value)}" aria-pressed="${state.filters[key].has(value)}">${escape(display)}</button>`).join("") : `<span class="fav-filter-note">No saved values yet.</span>`}</div></section>`;
    }).join("");
  }
  function renderChips() {
    const chips = state.type === "cigar" ? filterDefs.flatMap(([key,label]) => [...state.filters[key]].map(value => ({key,label,value}))) : [];
    if (els.filter) els.filter.classList.toggle("has-filters", !!chips.length);
    if (!els.chips) return;
    els.chips.hidden = !chips.length;
    els.chips.innerHTML = chips.map(({key,label,value}) => `<span class="fav-chip">${escape(label)}: ${escape(value)}<button type="button" data-clear-key="${key}" data-clear-value="${escape(value)}" aria-label="Remove ${escape(label)} filter">×</button></span>`).join("");
  }
  function clearFilters() { Object.values(state.filters).forEach(set => set.clear()); renderFilters(); render(); }
  function setType(type) {
    cancelDrag();
    state.type = tabType(type); state.query = ""; state.rendered = false;
    if (els.search) els.search.value = "";
    Object.values(state.filters).forEach(set => set.clear());
    try { const u = new URL(location.href); u.searchParams.set("tab",state.type+"s"); history.replaceState(null,"",u); } catch {}
    closeSheet(); refresh();
  }
  function openSheet() {
    if (!els.sheet || state.type !== "cigar") return;
    cancelDrag(); state.sheetOpen = true; state.lastFocus = document.activeElement;
    state.savedOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    els.sheet.inert = false; els.sheet.classList.add("open"); els.sheet.setAttribute("aria-hidden","false");
    if (els.subtitle) els.subtitle.textContent = "Filter your saved cigars.";
    renderFilters(); els.done?.focus({preventScroll:true});
  }
  function closeSheet() {
    if (!state.sheetOpen || !els.sheet) return;
    state.sheetOpen = false;
    document.body.style.overflow = state.savedOverflow;
    els.sheet.classList.remove("open"); els.sheet.setAttribute("aria-hidden","true"); els.sheet.inert = true;
    state.lastFocus?.focus?.({preventScroll:true});
  }
  function applyTheme(theme, write = true) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme",next);
    if (write) { try { localStorage.setItem("cigaros-theme",next); localStorage.setItem("theme",next); } catch {} }
    if (els.themeIcon) els.themeIcon.src = `/img/icons/${next === "dark" ? "moon" : "sun"}.svg`;
    els.theme?.setAttribute("aria-label", `Switch to ${next === "dark" ? "light" : "dark"} mode`);
  }
  function setEditing(value) {
    state.editing = value; document.body.classList.toggle("fav-editing",value);
    if (els.edit) { els.edit.textContent = value ? "Done" : "Edit"; els.edit.setAttribute("aria-pressed",String(value)); }
  }

  /* Drag lifecycle: the original row stays as a placeholder; a visual clone
     follows the pointer. Pending touches do NOT prevent ordinary scrolling. */
  function rowAt(target) {
    const row = target instanceof Element ? target.closest("[data-id]") : null;
    return row?.parentElement === els.list ? row : null;
  }
  function pending(row,x,y,kind,id) {
    if (state.settling || state.sheetOpen) return;
    cancelDrag();
    const drag = {row,x,y,startX:x,startY:y,kind,id,active:false,timer:0,raf:0,
      original:listRows().map(el => el.dataset.id), clone:null, animations:[], lastFrame:0};
    state.drag = drag;
    drag.timer = setTimeout(() => activate(drag), kind === "touch" ? 300 : 220);
  }
  function activate(drag) {
    if (state.drag !== drag || !drag.row.isConnected) return;
    clearTimeout(drag.timer); drag.active = true;
    const rect = drag.row.getBoundingClientRect();
    drag.rect = {top:rect.top,left:rect.left,width:rect.width,height:rect.height};
    drag.offsetX = drag.startX - rect.left; drag.offsetY = drag.startY - rect.top;
    const clone = drag.row.cloneNode(true);
    clone.removeAttribute("data-id"); clone.removeAttribute("id");
    $$('[id]',clone).forEach(el => el.removeAttribute("id"));
    $$('a,button',clone).forEach(el => {el.tabIndex = -1; el.removeAttribute("href");});
    clone.classList.add("fav-drag-preview"); clone.setAttribute("aria-hidden","true");
    clone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;z-index:10001;pointer-events:none;transition:none;`;
    document.body.appendChild(clone); drag.clone = clone;
    drag.row.classList.add("fav-drag-placeholder"); document.body.classList.add("fav-sorting-v2");
    announce("Picked up " + (drag.row.querySelector("a")?.getAttribute("aria-label") || "favorite"));
    drag.raf = requestAnimationFrame(dragFrame);
  }
  function move(x,y,kind,id,event) {
    const d = state.drag;
    if (!d || d.kind !== kind || d.id !== id) return;
    d.x = x; d.y = y;
    if (!d.active && Math.hypot(x-d.startX,y-d.startY) > 8) {
      if (kind === "touch") { cancelDrag(); return; }
      activate(d);
    }
    if (d.active && event?.cancelable) event.preventDefault();
  }
  function layoutRect(el) {
    const list = els.list.getBoundingClientRect();
    return {top:list.top+el.offsetTop,left:list.left+el.offsetLeft,width:el.offsetWidth,height:el.offsetHeight};
  }
  function movePlaceholder(d) {
    const others = listRows().filter(el => el !== d.row);
    const cy = d.y - d.offsetY + d.rect.height/2;
    const cx = d.x - d.offsetX + d.rect.width/2;
    let next = null;
    for (const el of others) {
      const r = layoutRect(el);
      if (state.type === "cigar" ? cy < r.top+r.height/2 : cy < r.top || (cy < r.top+r.height && cx < r.left+r.width/2)) { next = el; break; }
    }
    if (d.row.nextElementSibling === next) return;
    const positions = new Map(others.map(el => [el,el.getBoundingClientRect()]));
    for (const animation of d.animations) animation.cancel(); d.animations = [];
    els.list.insertBefore(d.row,next);
    if (!reducedMotion()) for (const el of others) {
      const before = positions.get(el), after = el.getBoundingClientRect();
      const dx = before.left-after.left,dy = before.top-after.top;
      if ((dx || dy) && el.animate) d.animations.push(el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:150,easing:"ease-out"}));
    }
  }
  function dragFrame(time) {
    const d = state.drag; if (!d?.active) return;
    const view = window.visualViewport;
    const top = view?.offsetTop || 0, height = view?.height || innerHeight;
    const dt = Math.min((time-(d.lastFrame || time))/16.67,2); d.lastFrame = time;
    const edge = 64;
    let scroll = d.y < top+edge ? -Math.min(12,(top+edge-d.y)/4) : d.y > top+height-edge ? Math.min(12,(d.y-(top+height-edge))/4) : 0;
    if (scroll) window.scrollBy(0,scroll*dt);
    const dx = state.type === "cigar" ? 0 : d.x-d.startX;
    d.clone.style.transform = `translate3d(${dx}px,${d.y-d.startY}px,0)`;
    movePlaceholder(d);
    d.raf = requestAnimationFrame(dragFrame);
  }
  function cleanup(d) {
    clearTimeout(d.timer); cancelAnimationFrame(d.raf);
    for (const animation of d.animations) animation.cancel();
    d.clone?.remove(); d.row.classList.remove("fav-drag-placeholder");
    document.body.classList.remove("fav-sorting-v2");
  }
  function cancelDrag() {
    const d = state.drag; if (!d) return;
    if (d.active) {
      const rows = new Map(listRows().map(row => [row.dataset.id,row]));
      for (const id of d.original) if (rows.has(id)) els.list.appendChild(rows.get(id));
      state.suppressClickUntil = Date.now()+600;
    }
    cleanup(d); state.drag = null;
  }
  async function finishDrag(event) {
    const d = state.drag; if (!d) return;
    clearTimeout(d.timer);
    if (!d.active) { cleanup(d); state.drag = null; return; }
    if (event?.cancelable) event.preventDefault();
    state.suppressClickUntil = Date.now()+800;
    cancelAnimationFrame(d.raf); state.settling = true;
    const ids = listRows().map(el => el.dataset.id), type = state.type;
    const target = d.row.getBoundingClientRect();
    try {
      if (d.clone?.animate && !reducedMotion()) {
        const animation = d.clone.animate([
          {transform:d.clone.style.transform},
          {transform:`translate3d(${target.left-d.rect.left}px,${target.top-d.rect.top}px,0)`}
        ],{duration:130,easing:"ease-out",fill:"forwards"});
        await animation.finished.catch(() => {});
      }
      await F.reorder(type,ids);
      announce("New favorites order saved.");
    } catch (error) { announce(error.message,true); }
    finally { cleanup(d); if (state.drag === d) state.drag=null; state.settling=false; state.rendered=false; refresh(); }
  }
  function touchById(list,id) { return Array.from(list).find(t => t.identifier === id); }
  els.list.addEventListener("touchstart",event => {
    state.ignoreMouseUntil = Date.now()+1200;
    if (event.touches.length !== 1) { cancelDrag(); return; }
    if (event.target instanceof Element && event.target.closest("button")) return;
    const row = rowAt(event.target); if (!row) return;
    const t = event.changedTouches[0]; pending(row,t.clientX,t.clientY,"touch",t.identifier);
  },{passive:true});
  document.addEventListener("touchstart",event => { if(event.touches.length > 1) cancelDrag(); },{passive:true});
  document.addEventListener("touchmove",event => {
    const d = state.drag; if (!d || d.kind !== "touch") return;
    const t = touchById(event.touches,d.id); if (t) move(t.clientX,t.clientY,"touch",d.id,event);
  },{passive:false});
  document.addEventListener("touchend",event => {
    const d = state.drag; if (d?.kind === "touch" && touchById(event.changedTouches,d.id)) { state.ignoreMouseUntil=Date.now()+1200; void finishDrag(event); }
  },{passive:false});
  document.addEventListener("touchcancel",() => cancelDrag(),{passive:true});
  els.list.addEventListener("mousedown",event => {
    if (event.button !== 0 || Date.now() < state.ignoreMouseUntil || event.target.closest("button")) return;
    const row = rowAt(event.target); if (row) pending(row,event.clientX,event.clientY,"mouse",0);
  });
  document.addEventListener("mousemove",event => move(event.clientX,event.clientY,"mouse",0,event));
  document.addEventListener("mouseup",event => { if (state.drag?.kind === "mouse") void finishDrag(event); });
  els.list.addEventListener("dragstart",event => event.preventDefault());
  els.list.addEventListener("contextmenu",event => { if (rowAt(event.target)) event.preventDefault(); });
  els.list.addEventListener("click",event => {
    if (Date.now() < state.suppressClickUntil || state.drag?.active || state.settling) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      event.preventDefault(); event.stopPropagation();
      const item = state.items.find(i => i.uid === remove.dataset.remove);
      if (item && confirm("Remove " + title(item) + " from Favorites?")) F.remove(item.uid).catch(e => announce(e.message,true));
    }
  },true);
  els.list.addEventListener("keydown",event => {
    const row = rowAt(event.target); if (!row || !event.altKey || !["ArrowUp","ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const rows = listRows(), at = rows.indexOf(row), dest = at+(event.key === "ArrowUp" ? -1 : 1);
    if (dest < 0 || dest >= rows.length) return;
    [rows[at],rows[dest]] = [rows[dest],rows[at]];
    F.reorder(state.type,rows.map(el => el.dataset.id)).then(() => {
      listRows().find(el => el.dataset.id === row.dataset.id)?.querySelector("a")?.focus(); announce("New favorites order saved.");
    }).catch(e => announce(e.message,true));
  });
  els.tabs.forEach(tab => tab.addEventListener("click",() => setType(tab.dataset.type)));
  els.search?.addEventListener("input",() => { cancelDrag(); state.query=els.search.value; render(); });
  els.add?.addEventListener("click",() => { location.href = state.type === "shop" ? "/shops/" : "/pos/cigars/"; });
  els.theme?.addEventListener("click",() => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  els.edit?.addEventListener("click",() => setEditing(!state.editing));
  els.filter?.addEventListener("click",openSheet); els.done?.addEventListener("click",closeSheet); els.clear?.addEventListener("click",clearFilters);
  $$('[data-close-sheet]').forEach(el => el.addEventListener("click",closeSheet));
  els.groups?.addEventListener("click",event => {
    const button=event.target.closest("[data-filter-key]"); if (!button) return;
    const set=state.filters[button.dataset.filterKey],v=button.dataset.filterValue;
    if(set.has(v))set.delete(v);else set.add(v);
    button.classList.toggle("active",set.has(v));button.setAttribute("aria-pressed",String(set.has(v)));render();
  });
  els.chips?.addEventListener("click",event => {
    const b=event.target.closest("[data-clear-key]");if(!b)return;
    state.filters[b.dataset.clearKey].delete(b.dataset.clearValue);render();renderFilters();
  });
  document.addEventListener("keydown",event => {
    if(event.key === "Escape"){cancelDrag();closeSheet();setEditing(false);}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="e"&&!/INPUT|TEXTAREA/.test(event.target.tagName)){event.preventDefault();setEditing(!state.editing);}
    if(state.sheetOpen&&event.key==="Tab"){
      const f=$$('button:not([disabled]),input:not([disabled])',els.sheet).filter(el=>el.getClientRects().length);
      if(!f.length)return;
      if(event.shiftKey&&document.activeElement===f[0]){event.preventDefault();f.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===f.at(-1)){event.preventDefault();f[0].focus();}
    }
  });
  window.addEventListener("blur",cancelDrag);
  window.addEventListener("pagehide",cancelDrag);
  document.addEventListener("visibilitychange",() => {if(document.hidden)cancelDrag();else refresh();});
  window.addEventListener("pageshow",refresh);
  window.addEventListener("focus",refresh);
  window.addEventListener("popstate",() => {state.type=tabType(new URL(location.href).searchParams.get("tab"));state.rendered=false;refresh();});
  F.subscribe(refresh);
  if (els.sheet) {els.sheet.inert=true;els.sheet.setAttribute("aria-hidden","true");}
  let theme="dark";try{theme=localStorage.getItem("cigaros-theme")||localStorage.getItem("theme")||document.documentElement.dataset.theme;}catch{}
  applyTheme(theme,false);
  refresh();
  F.hydrate().then(refresh).catch(error => {
    console.warn("[Favorites] Saved records remain available; catalog enrichment failed:",error);
    if(state.items.some(i=>i.type==="cigar"&&!i.name)) announce("Some older favorites need the cigar catalog to load. Your saved records are still here.",true);
  });
})();
