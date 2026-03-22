/* /pos/cigars/cigar.js
   Canonical cigar detail page
   - Reads Google Sheets CSV
   - Opens by ?id= or ?slug=
   - Uses universal /pos/cart.js cart
*/

(() => {
  "use strict";

  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const card = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");
  const topbarTitle = $("#cdTopbarTitle");

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHTML(s);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }

      cur += ch;
    }

    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    const normHeaders = headers.map(normalizeHeader);

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !String(c || "").trim())) continue;

      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = r[j] ?? "";
        obj[normHeaders[j]] = r[j] ?? "";
      }
      data.push(obj);
    }
    return data;
  }

  function getField(rec, keys) {
    for (const key of keys) {
      const value = rec?.[key];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  }

  function getCigarId(rec) {
    return getField(rec, ["Cigar ID", "cigarId", "cigarid", "cigar_id", "key", "Key"]);
  }

  function getBrand(rec) {
    return getField(rec, ["Brand", "brand", "brandname"]);
  }

  function getLine(rec) {
    return getField(rec, ["Line", "line", "Series", "series"]);
  }

  function getName(rec) {
    return getField(rec, ["Name", "name", "Cigar", "cigar"]);
  }

  function getVitola(rec) {
    return getField(rec, ["Vitola", "vitola", "Style", "style", "Size", "size", "Shape", "shape"]);
  }

  function getWrapper(rec) {
    return getField(rec, ["Wrapper", "wrapper", "Wrapper Type", "wrappertypet"]);
  }

  function getBinder(rec) {
    return getField(rec, ["Binder", "binder"]);
  }

  function getFiller(rec) {
    return getField(rec, ["Filler", "filler"]);
  }

  function getStrength(rec) {
    return getField(rec, ["Strength", "strength"]);
  }

  function getRing(rec) {
    return getField(rec, ["Ring", "ring", "RG", "rg"]);
  }

  function getLength(rec) {
    return getField(rec, ["Length", "length"]);
  }

  function getOrigin(rec) {
    return getField(rec, ["Origin", "origin", "Country", "country"]);
  }

  function getImage(rec) {
    return getField(rec, ["Cigar IMG", "cigarimg", "Image", "image", "Photo", "photo"]);
  }

  function getPrice(rec) {
    const raw = getField(rec, ["MSRP", "msrp", "Price", "price"]);
    const num = Number(String(raw).replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function bestTitle(rec) {
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    return [brand, line, name].filter(Boolean).join(" • ") || "Cigar";
  }

  function makeSlugFromRecord(rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);
    return slugify([brand, line, name, vitola, id].filter(Boolean).join(" "));
  }

  function findById(records, id) {
    const target = String(id || "").trim();
    if (!target) return null;
    return records.find((r) => getCigarId(r) === target) || null;
  }

  function findBySlug(records, slug) {
    const target = String(slug || "").trim();
    if (!target) return null;

    let found = records.find((r) => makeSlugFromRecord(r) === target);
    if (found) return found;

    found = records.find((r) => slugify(getCigarId(r)) === target);
    return found || null;
  }

  function addCurrentCigarToCart(rec) {
    const cartApi = window.cigarOSCart;
    if (!cartApi || typeof cartApi.add !== "function") return;

    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    cartApi.add({
      type: "cigar",
      id: getCigarId(rec),
      brand,
      line,
      name: [line, name].filter(Boolean).join(" ").trim() || name || line || brand,
      vitola,
      price: getPrice(rec),
      image: getImage(rec),
      url: window.location.href
    });
  }

  function render(rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);
    const img = getImage(rec);
    const wrapper = getWrapper(rec);
    const binder = getBinder(rec);
    const filler = getFiller(rec);
    const strength = getStrength(rec);
    const ring = getRing(rec);
    const length = getLength(rec);
    const origin = getOrigin(rec);

    document.title = bestTitle(rec);
    if (topbarTitle) topbarTitle.textContent = brand || "Cigar";

    const displayName = [line, name].filter(Boolean).join(" ").trim() || name || line || "—";
    const sub = [vitola, ring && `RG ${ring}`, length && `${length}"`].filter(Boolean).join(" • ");

    card.innerHTML = `
      <div class="cd-head">
        <div class="cd-brand">${escapeHTML(brand || "—")}</div>
        <div class="cd-name">${escapeHTML(displayName)}</div>
        <div class="cd-sub">${escapeHTML(sub || "")}</div>
      </div>

      ${img ? `
        <div class="cd-hero">
          <img src="${escapeAttr(img)}" alt="${escapeAttr(displayName)}" loading="lazy">
        </div>
      ` : ""}

      <div class="cd-actions">
        <button class="cd-btn" type="button" id="cdCompare">COMPARE</button>
        <button class="cd-btn" type="button" id="cdEdit">EDIT</button>
        <button class="cd-btn primary" type="button" id="cdAdd">ADD</button>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">Details</div>
        <div class="cd-grid">
          <div class="cd-kv"><div class="cd-k">Cigar ID</div><div class="cd-v" title="${escapeAttr(id)}">${escapeHTML(id || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Vitola</div><div class="cd-v" title="${escapeAttr(vitola)}">${escapeHTML(vitola || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Ring</div><div class="cd-v" title="${escapeAttr(ring)}">${escapeHTML(ring || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Length</div><div class="cd-v" title="${escapeAttr(length)}">${escapeHTML(length || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Wrapper</div><div class="cd-v" title="${escapeAttr(wrapper)}">${escapeHTML(wrapper || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Binder</div><div class="cd-v" title="${escapeAttr(binder)}">${escapeHTML(binder || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Filler</div><div class="cd-v" title="${escapeAttr(filler)}">${escapeHTML(filler || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Strength</div><div class="cd-v" title="${escapeAttr(strength)}">${escapeHTML(strength || "—")}</div></div>
          <div class="cd-kv"><div class="cd-k">Origin</div><div class="cd-v" title="${escapeAttr(origin)}">${escapeHTML(origin || "—")}</div></div>
        </div>
      </div>
    `;

    $("#cdCompare")?.addEventListener("click", () => alert("Compare (hook coming next)"));
    $("#cdEdit")?.addEventListener("click", () => alert("Edit (hook coming next)"));
    $("#cdAdd")?.addEventListener("click", () => addCurrentCigarToCart(rec));
  }

  async function load() {
    backBtn?.addEventListener("click", () => history.back());

    const idParam = getParam("id") || getParam("key");
    const slugParam = getParam("slug");

    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
      const csvText = await res.text();

      const rows = parseCSV(csvText);
      const records = rowsToObjects(rows);

      let rec = null;
      if (idParam) rec = findById(records, idParam);
      if (!rec && slugParam) rec = findBySlug(records, slugParam);
      if (!rec && slugParam && slugParam.includes("/")) {
        const last = slugParam.split("/").filter(Boolean).slice(-1)[0];
        rec = findBySlug(records, last);
      }

      if (!rec) {
        card.innerHTML = `
          <div class="cd-loading" style="color:#111;">
            Cigar not found.<br><br>
            Try opening from a Brand page, or use:<br>
            <span style="color:#8e8e93;">/pos/cigars/cigar.html?id=&lt;Cigar ID&gt;</span>
          </div>
        `;
        return;
      }

      render(rec);
    } catch (e) {
      card.innerHTML = `<div class="cd-loading" style="color:#b00020;">Error loading cigar data.</div>`;
      console.warn("[cigar detail] load error:", e);
    } finally {
      if (loading) loading.style.display = "none";
      if (window.cigarOSCart?.updateBadges) window.cigarOSCart.updateBadges();
    }
  }

  load();
})();
