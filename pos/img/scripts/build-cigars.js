// /pos/img/scripts/build-cigars.js
// Builds the Brands grid on /pos/cigars/ from Google Sheets (CSV export).

(function () {
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

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

  function normalizeBrandName(name) {
    return (name || "").toString().trim();
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
    const canonical = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

    if (!canonical) return "";
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, canonical)) {
      return BRAND_ICON_OVERRIDES[canonical];
    }
    return canonical;
  }

  // Minimal CSV parser (handles quoted commas)
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

  function safeSrc(src) {
    if (!src) return "";
    let s = src.trim();
    if (!s) return "";
    if (!s.startsWith("/") && !s.startsWith("http")) {
      s = "/" + s.replace(/^\/+/, "");
    }
    return s;
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

    grid.innerHTML = "";

    try {
      const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL), {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Google CSV fetch failed: ${res.status}`);
      const text = await res.text();

      const { headers, data } = parseCSV(text);
      console.log("[build-cigars] headers:", headers);
      console.log("[build-cigars] rows:", data.length);

      const map = new Map();

      for (const row of data) {
        const brand = normalizeBrandName(row["Brand"]);
        if (!brand) continue;

        const brandImg =
          row["Brand IMG"] || row["Brand Img"] || row["BrandIMG"] || "";

        if (!map.has(brand)) {
          map.set(brand, { brand, brandImg });
        } else {
          const existing = map.get(brand);
          if (!existing.brandImg && brandImg) existing.brandImg = brandImg;
        }
      }

      const brands = Array.from(map.values()).sort((a, b) =>
        a.brand.toLowerCase().localeCompare(b.brand.toLowerCase())
      );

      if (!brands.length) {
        const msg = document.createElement("div");
        msg.style.color = "#6a7586";
        msg.style.fontWeight = "600";
        msg.style.padding = "10px 0";
        msg.textContent =
          "No brands found. Your Google Sheet tab must have a 'Brand' column.";
        grid.appendChild(msg);
        return;
      }

      const frag = document.createDocumentFragment();
      brands.forEach((b) => frag.appendChild(buildTile(b)));
      grid.appendChild(frag);
    } catch (err) {
      console.error("[build-cigars] error:", err);

      const msg = document.createElement("div");
      msg.style.color = "#b00020";
      msg.style.fontWeight = "700";
      msg.style.padding = "10px 0";
      msg.textContent =
        "Brands failed to load from Google Sheets. Check sharing/publish + gid.";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
