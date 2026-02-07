// /pos/img/scripts/build-cigars.js
// Loads Google Sheets CSV (HUB) -> builds brand grid OR filtered cigar rows on /pos/cigars/
// Exposes:
//   - window.__CIGAR_SHEET_ROWS__
//   - window.__CIGAR_HUB_CSV_URL__
//   - window.buildCigarsRender()
// Dispatches:
//   - window event "cigars:hub-ready" when data + renderer are ready

(function () {
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";
  const GID = "822697742";
  const HUB_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  window.__CIGAR_HUB_CSV_URL__ = HUB_CSV_URL;

  function getGridEl() {
    return (
      document.getElementById("category-grid") ||
      document.getElementById("brands-grid")
    );
  }

  function getSectionTitleEl() {
    return document.getElementById("cigars-section-title");
  }

  function getAppliedFiltersEl() {
    return document.getElementById("cigars-applied-filters");
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
      const set = state.filters && state.filters[filterKey];
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

  function formatPrice(v) {
    const n = Number(String(v || "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return "-";
    return "$" + n.toFixed(2);
  }

  function makeReceiptItem(row) {
    // Best-effort payload for cart.js (matches your “data-receipt-item” pattern)
    const payload = {
      kind: "cigar",
      brand: (row["Brand"] || "").trim(),
      line: (row["Line"] || "").trim(),
      cigar: (row["Cigar"] || "").trim(),
      vitola: (row["Vitola"] || "").trim(),
      msrp:
        (row["MSRP"] || row["Price"] || row["MSRP Price"] || row["Cigar MSRP"] || "").trim(),
      ring: (row["RG"] || row["Ring"] || "").trim(),
      length: (row["Length"] || "").trim(),
      wrapperShade: (row["Wrapper Shade"] || "").trim(),
      strength: (row["Strength"] || "").trim(),
      // optional
      image: (row["Image"] || row["IMG"] || row["Cigar IMG"] || "").trim(),
    };
    return JSON.stringify(payload);
  }

  function buildCigarRow(row) {
    const wrap = document.createElement("div");
    wrap.className = "cigar-row";

    const brand = (row["Brand"] || "").trim();
    const line = (row["Line"] || "").trim();
    const cigar = (row["Cigar"] || "").trim();
    const vitola = (row["Vitola"] || "").trim();

    const brandImg = (row["Brand IMG"] || row["Brand Img"] || "").trim();

    const icon = document.createElement("div");
    icon.className = "cigar-row__icon";

    const img = document.createElement("img");
    img.alt = brand || "";
    img.loading = "lazy";
    img.decoding = "async";
    setBrandImgWithFallback(img, brand, brandImg);
    icon.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "cigar-row__meta";

    const title = document.createElement("div");
    title.className = "cigar-row__title";
    // Match Brand POS row convention: "Line + Cigar"
    title.textContent = [line, cigar].filter(Boolean).join(" ");

    const sub = document.createElement("div");
    sub.className = "cigar-row__sub";
    sub.textContent = vitola || brand || "";

    meta.appendChild(title);
    meta.appendChild(sub);

    const right = document.createElement("div");
    right.className = "cigar-row__right";

    const priceVal = pick(row, ["MSRP", "Price", "MSRP Price", "Cigar MSRP"]);
    const price = document.createElement("div");
    price.className = "cigar-row__price";
    price.textContent = formatPrice(priceVal);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "cigar-row__add";
    add.setAttribute("aria-label", "Add");
    add.textContent = "+";

    // IMPORTANT: cart.js listens for this dataset pattern
    add.setAttribute("data-receipt-item", makeReceiptItem(row));

    right.appendChild(price);
    right.appendChild(add);

    wrap.appendChild(icon);
    wrap.appendChild(meta);
    wrap.appendChild(right);

    return wrap;
  }

  function hasActiveState(state) {
    const q = (state && state.q ? String(state.q).trim() : "");
    if (q) return true;

    const filters = state && state.filters ? state.filters : {};
    for (const k of Object.keys(filters)) {
      const s = filters[k];
      if (s && typeof s.size === "number" && s.size > 0) return true;
    }
    return false;
  }

  function clearAllState() {
    const st = window.__CIGAR_FILTER_STATE__;
    if (!st) return;
    st.q = "";
    if (st.filters) {
      Object.keys(st.filters).forEach((k) => {
        const s = st.filters[k];
        if (s && typeof s.clear === "function") s.clear();
        else st.filters[k] = new Set();
      });
    }
  }

  function removeFilterValue(key, value) {
    const st = window.__CIGAR_FILTER_STATE__;
    if (!st || !st.filters || !st.filters[key]) return;
    const set = st.filters[key];
    if (set && typeof set.delete === "function") set.delete(value);
  }

  function clearSearch() {
    const st = window.__CIGAR_FILTER_STATE__;
    if (!st) return;
    st.q = "";
    const inp = document.getElementById("cigars-search-input");
    if (inp) inp.value = "";
  }

  function buildAppliedChips(state) {
    const root = getAppliedFiltersEl();
    if (!root) return;

    root.innerHTML = "";

    const chips = [];

    const q = (state.q || "").trim();
    if (q) {
      chips.push({ type: "q", key: "q", label: `Search: ${q}`, value: q });
    }

    const labelMap = {
      manufacturer: "Manufacturer",
      brand: "Brand",
      vitola: "Vitola",
      ring: "Ring",
      length: "Length",
      strength: "Strength",
      shape: "Shape",
      shade: "Wrap. Shade",
    };

    if (state.filters) {
      for (const k of Object.keys(labelMap)) {
        const set = state.filters[k];
        if (!set || set.size === 0) continue;
        for (const v of Array.from(set)) {
          chips.push({ type: "filter", key: k, label: `${labelMap[k]}: ${v}`, value: v });
        }
      }
    }

    if (chips.length === 0) return;

    // Clear all chip
    const clearChip = document.createElement("div");
    clearChip.className = "af-chip af-clear";
    clearChip.innerHTML = `
      <div class="af-chip__text">Clear All</div>
      <button class="af-chip__x" type="button" aria-label="Clear all">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    clearChip.querySelector(".af-chip__x").addEventListener("click", () => {
      clearAllState();
      clearSearch();
      window.buildCigarsRender && window.buildCigarsRender();
    });
    root.appendChild(clearChip);

    chips.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "af-chip";
      chip.innerHTML = `
        <div class="af-chip__text"></div>
        <button class="af-chip__x" type="button" aria-label="Remove">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
          </svg>
        </button>
      `;
      chip.querySelector(".af-chip__text").textContent = c.label;

      chip.querySelector(".af-chip__x").addEventListener("click", () => {
        if (c.type === "q") clearSearch();
        else removeFilterValue(c.key, c.value);

        window.buildCigarsRender && window.buildCigarsRender();
      });

      root.appendChild(chip);
    });
  }

  async function loadSheet() {
    const res = await fetch(withNoCache(HUB_CSV_URL), { cache: "no-store" });
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
      window.__CIGAR_SHEET_ROWS__ = rows;

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
          toggles: {},
        };
      }

      window.buildCigarsRender = function () {
        const state = window.__CIGAR_FILTER_STATE__ || { q: "", filters: {} };
        const titleEl = getSectionTitleEl();

        // Chips always reflect current state
        buildAppliedChips(state);

        // MODE SWITCH:
        // - No active filters/search => brand browse
        // - Any active => cigar rows
        const active = hasActiveState(state);

        grid.innerHTML = "";

        if (!active) {
          if (titleEl) titleEl.textContent = "Brands";
          grid.classList.remove("cigars-results");
          grid.classList.add("brands-grid");

          const brands = brandsFromRows(rows, state);

          if (!brands.length) {
            const msg = document.createElement("div");
            msg.style.color = "rgba(255,255,255,.65)";
            msg.style.fontWeight = "700";
            msg.style.padding = "10px 0";
            msg.textContent = "No brands found.";
            grid.appendChild(msg);
            return;
          }

          const frag = document.createDocumentFragment();
          brands.forEach((b) => frag.appendChild(buildTile(b)));
          grid.appendChild(frag);
          return;
        }

        // Filtered cigar results
        if (titleEl) titleEl.textContent = "Results";
        grid.classList.remove("brands-grid");
        grid.classList.add("cigars-results");

        const matches = rows.filter((r) => rowMatchesState(r, state));

        if (!matches.length) {
          const msg = document.createElement("div");
          msg.style.color = "rgba(255,255,255,.70)";
          msg.style.fontWeight = "800";
          msg.style.padding = "10px 0";
          msg.textContent = "No cigars match your filters.";
          grid.appendChild(msg);
          return;
        }

        // Keep it stable and fast: cap long lists (tweak if you want)
        const MAX = 200;
        const slice = matches.slice(0, MAX);

        const frag = document.createDocumentFragment();
        slice.forEach((r) => frag.appendChild(buildCigarRow(r)));
        grid.appendChild(frag);

        if (matches.length > MAX) {
          const more = document.createElement("div");
          more.style.color = "rgba(255,255,255,.55)";
          more.style.fontWeight = "700";
          more.style.padding = "8px 2px 0";
          more.textContent = `Showing ${MAX} of ${matches.length} results. Narrow your filters to see more.`;
          grid.appendChild(more);
        }
      };

      window.buildCigarsRender();

      window.dispatchEvent(new Event("cigars:hub-ready"));
    } catch (err) {
      console.error("[build-cigars] error:", err);
      grid.innerHTML = "";
      const msg = document.createElement("div");
      msg.style.color = "#ff6b6b";
      msg.style.fontWeight = "800";
      msg.style.padding = "10px 0";
      msg.textContent =
        "Brands failed to load from the Hub (Google Sheets). Check sharing + CSV access.";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
