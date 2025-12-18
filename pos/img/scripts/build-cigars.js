// /pos/img/scripts/build-cigars.js
// Loads Google Sheets CSV and exposes rows/brands for cigars.js.
// Builds NO debug UI text.

(function () {
  // ✅ Your spreadsheet id
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";

  // ✅ IMPORTANT: set this to the sheet/tab gid that contains your hub data
  // If you’re already getting “Loaded 2,952 rows” then your gid is correct.
  const GID = "822697742";

  // gviz CSV export (works when sheet is shared “Anyone with link: Viewer”)
  const GOOGLE_SHEETS_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  function getGridEl() {
    return (
      document.getElementById("category-grid") ||
      document.getElementById("brands-grid")
    );
  }

  // Robust CSV parser (handles quotes)
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

      if (!inQuotes && ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    if (!rows.length) return { headers: [], data: [] };

    const headers = rows[0].map((h) => (h || "").trim());
    const data = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").toString().trim();
      });
      return obj;
    });

    return { headers, data };
  }

  // Header matching helper
  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function safeSrc(src) {
    if (!src) return "";
    let s = String(src).trim();
    if (!s) return "";
    if (!s.startsWith("/") && !s.startsWith("http")) {
      s = "/" + s.replace(/^\/+/, "");
    }
    return s;
  }

  const BRAND_ICON_OVERRIDES = {
    aturrent: "aturrent",
    aflores: "aflores",
    carlostorano: "torano",
    brundelre: "brundelre",
    diamondcrown: "diamondcrown",
    elreydelmundo: "elreydelmundo",
    fonseca: "fonseca",
  };

  function brandSlug(name) {
    if (!name) return "";
    const canonical = String(name)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

    if (!canonical) return "";
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, canonical)) {
      return BRAND_ICON_OVERRIDES[canonical];
    }
    return canonical;
  }

  function setBrandImgWithFallback(imgEl, brandName, csvImgPath) {
    const slug = brandSlug(brandName);
    const csvSrc = safeSrc(csvImgPath);

    const candidates = [];
    if (csvSrc) candidates.push(csvSrc);
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        imgEl.style.display = "none";
        return;
      }
      imgEl.src = candidates[idx++];
    }

    imgEl.onerror = tryNext;
    tryNext();
  }

  function buildTile({ brand, brandImg }) {
    const a = document.createElement("a");
    a.className = "category-card";
    a.href = `/pos/cigars/brand.html?brand=${encodeURIComponent(brand)}`;
    a.setAttribute("aria-label", brand);

    const img = document.createElement("img");
    img.alt = brand;
    img.loading = "lazy";
    img.decoding = "async";
    setBrandImgWithFallback(img, brand, brandImg);

    const name = document.createElement("div");
    name.className = "category-name";
    name.textContent = brand;

    a.appendChild(img);
    a.appendChild(name);
    return a;
  }

  async function run() {
    const grid = getGridEl();
    if (!grid) return;

    try {
      const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
      if (!res.ok) throw new Error(`Google CSV fetch failed (${res.status})`);
      const text = await res.text();

      const { data } = parseCSV(text);

      // expose rows globally for cigars.js
      window.__CIGAR_SHEET_ROWS__ = data;

      // Build unique brand list (+ keep Brand IMG when available)
      const map = new Map();
      for (const row of data) {
        const brand = pick(row, ["Brand", "brand"]);
        if (!brand) continue;

        const brandImg = pick(row, ["Brand IMG", "Brand Img", "brand img", "Brand Image", "BrandImage"]);
        if (!map.has(brand)) map.set(brand, { brand, brandImg });
        else {
          const existing = map.get(brand);
          if (!existing.brandImg && brandImg) existing.brandImg = brandImg;
        }
      }

      const brands = Array.from(map.values()).sort((a, b) =>
        a.brand.toLowerCase().localeCompare(b.brand.toLowerCase())
      );

      window.__CIGAR_BRANDS__ = brands;

      // initial render (cigars.js may re-render when filters/search apply)
      grid.innerHTML = "";
      const frag = document.createDocumentFragment();
      brands.forEach((b) => frag.appendChild(buildTile(b)));
      grid.appendChild(frag);

      // notify cigars.js that data is ready
      window.dispatchEvent(new CustomEvent("cigars:data-ready"));
    } catch (err) {
      console.error("[build-cigars] error:", err);
      grid.innerHTML = "";
      const msg = document.createElement("div");
      msg.style.color = "#b00020";
      msg.style.fontWeight = "700";
      msg.style.padding = "10px 0";
      msg.textContent =
        "Brands failed to load from Google Sheets. Check sharing + the gid.";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
