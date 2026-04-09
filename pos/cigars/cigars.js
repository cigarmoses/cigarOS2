/* /pos/cigars/cigars.js
   POS Cigars
   - Loads Google Sheet CSV
   - Shows brand grid by default
   - Search filters brands
   - Filter button reserved for future modal
*/

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);

  const listRoot = $("#cigarsList");
  const searchInput = $("#cigars-search-input");
  const filterBtn = $("#btn-open-filters");
  const themeToggle = $("#theme-toggle");
  const searchBtn = $("#cbSearchBtn");

  let ALL_ROWS = [];
  let BRANDS = [];

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    }
  }

  function initThemeToggle() {
    const saved =
      localStorage.getItem("theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "light";

    applyTheme(saved);

    themeToggle?.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += ch;
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => String(cell || "").trim() !== ""));
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => String(h || "").trim());

    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = String(r[i] ?? "").trim();
      });
      return obj;
    });
  }

  function getField(row, keys) {
    for (const key of keys) {
      const value = row?.[key];
      if (value != null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  function buildBrands(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const brand = normalizeText(
        getField(row, ["Brand", "brand", "Brand aka", "brand_aka"])
      );
      if (!brand) return;

      const manufacturer = normalizeText(
        getField(row, ["Manufacturer", "manufacturer"])
      );

      if (!map.has(brand)) {
        map.set(brand, {
          brand,
          manufacturer,
          count: 0
        });
      }

      const entry = map.get(brand);
      entry.count += 1;

      if (!entry.manufacturer && manufacturer) {
        entry.manufacturer = manufacturer;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand));
  }

  function brandIconPath(brand) {
    return `/img/icons/brands/${slugify(brand)}.svg`;
  }

  function renderBrands(brands) {
    if (!listRoot) return;

    if (!brands.length) {
      listRoot.innerHTML = `<div class="cigars-empty">No cigars found.</div>`;
      return;
    }

    listRoot.innerHTML = `
      <div class="brands-grid">
        ${brands
          .map((item) => {
            const href = `/pos/cigars/brand.html?brand=${encodeURIComponent(item.brand)}`;
            return `
              <a href="${href}" aria-label="${escapeHTML(item.brand)}">
                <img
                  src="${escapeHTML(brandIconPath(item.brand))}"
                  alt="${escapeHTML(item.brand)}"
                  loading="lazy"
                  decoding="async"
                  onerror="this.style.opacity='.25';this.style.filter='grayscale(1)';"
                />
                <div class="category-name">${escapeHTML(item.brand)}</div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function filterBrands(query) {
    const q = normalizeText(query).toLowerCase();
    if (!q) return BRANDS;

    return BRANDS.filter((item) => {
      const hay = `${item.brand} ${item.manufacturer} ${item.count}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderSearchResults(brands) {
    if (!listRoot) return;

    if (!brands.length) {
      listRoot.innerHTML = `<div class="cigars-empty">No cigars found.</div>`;
      return;
    }

    listRoot.innerHTML = `
      <div class="cigars-results">
        ${brands
          .map((item) => {
            const href = `/pos/cigars/brand.html?brand=${encodeURIComponent(item.brand)}`;
            return `
              <a class="brand-row" href="${href}">
                <img
                  class="row-ico"
                  src="${escapeHTML(brandIconPath(item.brand))}"
                  alt="${escapeHTML(item.brand)}"
                  loading="lazy"
                  decoding="async"
                  onerror="this.style.display='none';"
                />

                <div class="brand-row-left">
                  <div class="brand-row-title">${escapeHTML(item.brand)}</div>
                  <div class="brand-row-sub">${escapeHTML(item.manufacturer || "Brand")}</div>
                </div>

                <div class="brand-row-right">
                  <div class="brand-row-msrp">${escapeHTML(String(item.count))}</div>
                </div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderCurrent() {
    const q = searchInput?.value || "";
    const filtered = filterBrands(q);

    if (normalizeText(q)) {
      renderSearchResults(filtered);
    } else {
      renderBrands(filtered);
    }
  }

  async function loadData() {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);

      const text = await res.text();
      ALL_ROWS = rowsToObjects(parseCSV(text));
      BRANDS = buildBrands(ALL_ROWS);

      renderCurrent();
    } catch (err) {
      console.error("Failed to load cigars:", err);
      if (listRoot) {
        listRoot.innerHTML = `<div class="cigars-empty">Failed to load cigars.</div>`;
      }
    }
  }

  function bindUI() {
    searchInput?.addEventListener("input", renderCurrent);

    filterBtn?.addEventListener("click", () => {
      // reserved for future filter modal
    });

    searchBtn?.addEventListener("click", () => {
      if (typeof window.openGlobalSearch === "function") {
        window.openGlobalSearch();
      } else {
        searchInput?.focus();
      }
    });
  }

  function init() {
    initThemeToggle();
    bindUI();
    loadData();
  }

  init();
})();
