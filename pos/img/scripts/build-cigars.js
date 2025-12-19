// /pos/img/scripts/build-cigars.js
// Loads Google Sheets CSV -> builds brand grid on /pos/cigars/

(function () {
  // IMPORTANT:
  // If you ever change the sheet tab, update &gid=...
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";
  const GID = "822697742"; // <-- keep if this is your data tab
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

  // Minimal CSV parser (supports quotes)
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

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return row[k];
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

  // apply filters/search (state stored in window.__CIGAR_FILTER_STATE__)
  function rowMatchesState(row, state) {
    const q = (state.q || "").trim().toLowerCase();

    if (q) {
      const hay = [
        row["Brand"],
        row["Cigar"],
        row["Vitola"],
        row["Line"],
        row["Manufacturer"],
        row["Wrapper Shade"],
        row["Strength"],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!hay.includes(q)) return false;
    }

    // feature toggles use columns like "Tubo", "Tin", etc.
    const featureCols = {
      tubo: ["Tubo", "TUBO"],
      flavored: ["Flavored", "FLAVORED"],
      tin: ["Tin", "TIN"],
      pack: ["Pack", "PACK"],
      barberpole: ["Barber", "Barberpole", "BARBER", "BARBERPOLE"],
      boxpressed: ["Box-Pressed", "Box Pressed", "BOX-PRESSED", "BOX PRESSED"],
    };

    for (const key of Object.keys(featureCols)) {
      if (!state.toggles[key]) continue;
      const colKeys = featureCols[key];
      const val = pick(row, colKeys).toString().trim();
      if (!val) return false;
    }

    // multi-select filters
    const map = {
      manufacturer: ["Manufacturer"],
      brand: ["Brand"],
      shade: ["Wrapper Shade", "Shade"],
      vitola: ["Vitola"],
      length: ["Length"],
      ring: ["RG", "Ring"],
      shape: ["Shape"],
      strength: ["Strength"],
    };

    for (const filterKey of Object.keys(map)) {
      const set = state.filters[filterKey];
      if (!set || set.size === 0) continue;

      const colVal = pick(row, map[filterKey]).toString().trim();
      if (!colVal || !set.has(colVal)) return false;
    }

    return true;
  }

  function brandsFromRows(rows, state) {
    const brandMap = new Map();

    for (const row of rows) {
      const brand = (row["Brand"] || "").trim();
      if (!brand) continue;

      if (state && !rowMatchesState(row, state)) continue;

      const brandImg = (row["Brand IMG"] || row["Brand Img"] || "").trim();

      if (!brandMap.has(brand)) {
        brandMap.set(brand, { brand, brandImg });
      } else {
        const existing = brandMap.get(brand);
        if (!existing.brandImg && brandImg) existing.brandImg = brandImg;
      }
    }

    return Array.from(brandMap.values()).sort((a, b) =>
      a.brand.toLowerCase().localeCompare(b.brand.toLowerCase())
    );
  }

  async function loadSheet() {
    const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
    if (!res.ok) throw new Error("Google Sheets CSV fetch failed: " + res.status);
    const text = await res.text();
    const parsed = parseCSV(text);
    return parsed.data;
  }

  async function run() {
    const grid = getGridEl();
    if (!grid) return;

    try {
      const rows = await loadSheet();

      // store globally so cigars.js can build filter option lists
      window.__CIGAR_SHEET_ROWS__ = rows;

      // create default state if missing
      if (!window.__CIGAR_FILTER_STATE__) {
        window.__CIGAR_FILTER_STATE__ = {
          q: "",
          filters: {
            manufacturer: new Set(),
            brand: new Set(),
            shade: new Set(),
            vitola: new Set(),
            length: new Set(),
            ring: new Set(),
            shape: new Set(),
            strength: new Set(),
          },
          toggles: {
            tubo: false,
            flavored: false,
            tin: false,
            pack: false,
            barberpole: false,
            boxpressed: false,
          },
        };
      }

      // expose render function for cigars.js
      window.buildCigarsRender = function () {
        const state = window.__CIGAR_FILTER_STATE__;
        const brands = brandsFromRows(rows, state);

        grid.innerHTML = "";
        if (!brands.length) {
          const msg = document.createElement("div");
          msg.style.color = "#6a7586";
          msg.style.fontWeight = "600";
          msg.style.padding = "10px 0";
          msg.textContent = "No brands match your filters.";
          grid.appendChild(msg);
          return;
        }

        const frag = document.createDocumentFragment();
        brands.forEach((b) => frag.appendChild(buildTile(b)));
        grid.appendChild(frag);
      };

      // initial paint
      window.buildCigarsRender();
    } catch (err) {
      console.error("[build-cigars] error:", err);
      grid.innerHTML = "";
      const msg = document.createElement("div");
      msg.style.color = "#b00020";
      msg.style.fontWeight = "700";
      msg.style.padding = "10px 0";
      msg.textContent =
        "Brands failed to load from Google Sheets. Check the sheet sharing + CSV access.";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
