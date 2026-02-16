/* /cigars/cigar.js
   Canonical cigar pages (PWA-safe)
   - Routes:
       /cigars/<slug>  (via _redirects -> cigar.html?slug=:splat)
       /cigars/cigar.html?id=<CIGAR_ID>
   - Data source: Google Sheets CSV export (canonical)
*/

(() => {
  "use strict";

  // ✅ Canonical data source (your saved memory URL)
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const card = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // CSV parser that handles quoted commas
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

    // last cell
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
        obj[normHeaders[j]] = r[j] ?? ""; // normalized alias
      }
      data.push(obj);
    }
    return data;
  }

  function getCigarId(rec) {
    // Accept: "Cigar ID" or "cigarId" etc
    return (
      rec["Cigar ID"] ??
      rec["cigarId"] ??
      rec["cigarid"] ??
      rec["cigar_id"] ??
      rec["key"] ??
      rec["Key"] ??
      ""
    ).toString().trim();
  }

  function getBrand(rec) {
    return (rec["Brand"] ?? rec["brand"] ?? rec["brandname"] ?? "").toString().trim();
  }

  function getLine(rec) {
    return (rec["Line"] ?? rec["line"] ?? rec["Series"] ?? rec["series"] ?? "").toString().trim();
  }

  function getName(rec) {
    return (rec["Name"] ?? rec["name"] ?? rec["Cigar"] ?? rec["cigar"] ?? "").toString().trim();
  }

  function getVitola(rec) {
    return (rec["Vitola"] ?? rec["vitola"] ?? rec["Style"] ?? rec["style"] ?? rec["Size"] ?? rec["size"] ?? "").toString().trim();
  }

  function getWrapper(rec) {
    return (rec["Wrapper"] ?? rec["wrapper"] ?? rec["Wrapper Type"] ?? rec["wrappertypet"] ?? "").toString().trim();
  }

  function getBinder(rec) {
    return (rec["Binder"] ?? rec["binder"] ?? "").toString().trim();
  }

  function getFiller(rec) {
    return (rec["Filler"] ?? rec["filler"] ?? "").toString().trim();
  }

  function getStrength(rec) {
    return (rec["Strength"] ?? rec["strength"] ?? "").toString().trim();
  }

  function getRing(rec) {
    return (rec["Ring"] ?? rec["ring"] ?? rec["RG"] ?? rec["rg"] ?? "").toString().trim();
  }

  function getLength(rec) {
    return (rec["Length"] ?? rec["length"] ?? "").toString().trim();
  }

  function getOrigin(rec) {
    return (rec["Origin"] ?? rec["origin"] ?? rec["Country"] ?? rec["country"] ?? "").toString().trim();
  }

  function bestTitle(rec) {
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);

    const parts = [brand, line, name].filter(Boolean);
    return parts.join(" • ") || "Cigar";
  }

  function makeSlugFromRecord(rec) {
    // Uses cigarId to guarantee uniqueness (since it’s your canonical key)
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    const base = [brand, line, name, vitola, id].filter(Boolean).join(" ");
    return slugify(base);
  }

  function findById(records, id) {
    const target = String(id || "").trim();
    if (!target) return null;
    return records.find((r) => getCigarId(r) === target) || null;
  }

  function findBySlug(records, slug) {
    const target = String(slug || "").trim();
    if (!target) return null;

    // exact match on computed slug
    let found = records.find((r) => makeSlugFromRecord(r) === target);
    if (found) return found;

    // fallback: try slugify(cigarId) match (if someone uses that shorter link)
    found = records.find((r) => slugify(getCigarId(r)) === target);
    return found || null;
  }

  function render(rec) {
    const id = getCigarId(rec);
    const brand = getBrand(rec);
    const line = getLine(rec);
    const name = getName(rec);
    const vitola = getVitola(rec);

    document.title = bestTitle(rec);

    // Optional: if you later add an image column in sheet, map it here
    const img =
      (rec["Image"] ?? rec["image"] ?? rec["Photo"] ?? rec["photo"] ?? "").toString().trim();

    const wrapper = getWrapper(rec);
    const binder = getBinder(rec);
    const filler = getFiller(rec);
    const strength = getStrength(rec);
    const ring = getRing(rec);
    const length = getLength(rec);
    const origin = getOrigin(rec);

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

    // Wire buttons (non-destructive placeholders until we hook into your POS logic)
    $("#cdCompare")?.addEventListener("click", () => alert("Compare (hook coming next)"));
    $("#cdEdit")?.addEventListener("click", () => alert("Edit (hook coming next)"));
    $("#cdAdd")?.addEventListener("click", () => alert("Add to cart (hook coming next)"));
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
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function load() {
    backBtn?.addEventListener("click", () => history.back());

    const idParam = getParam("id");
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

      // If Netlify redirect passed full path pieces, slug might include slashes
      // Already slugified, but ensure we try last segment too.
      if (!rec && slugParam && slugParam.includes("/")) {
        const last = slugParam.split("/").filter(Boolean).slice(-1)[0];
        rec = findBySlug(records, last);
      }

      if (!rec) {
        card.innerHTML = `
          <div class="cd-loading" style="color:#111;">
            Cigar not found.<br><br>
            Try opening from a Brand page, or use:<br>
            <span style="color:#8e8e93;">/cigars/cigar?id=&lt;Cigar ID&gt;</span>
          </div>
        `;
        return;
      }

      // Update URL to canonical pretty route if we were opened with ?id=
      // (Non-breaking; keeps query compatibility.)
      const canonicalSlug = makeSlugFromRecord(rec);
      const wantedPath = `/pos/cigars/${canonicalSlug}`;
      if (!window.location.pathname.startsWith("/pos/cigars/") || window.location.search.includes("id=")) {
        // Keep it nice, but don’t break back button.
        history.replaceState(null, "", `${wantedPath}`);
      }

      render(rec);
    } catch (e) {
      card.innerHTML = `<div class="cd-loading" style="color:#b00020;">Error loading cigar data.</div>`;
      // eslint-disable-next-line no-console
      console.warn("[cigar detail] load error:", e);
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  load();
})();
