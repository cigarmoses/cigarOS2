// /pos/img/scripts/build-cigars.js
// Loads Google Sheets CSV (HUB) -> builds brand grid OR filtered cigar rows on /pos/cigars/
//
// ✅ Option A (final):
// - Results mode reuses BRAND PAGE row system (same classes + structure)
// - Row click opens cigar detail popup and populates
// - Green + uses window.addToInvoice() (pos.js), not data-receipt-item
// - Main page background is handled in cigars.css (dark like brand page)

(function () {
  "use strict";

  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";
  const GID = "822697742";
  const HUB_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  window.__CIGAR_HUB_CSV_URL__ = HUB_CSV_URL;

  // -----------------------------
  // DOM helpers
  // -----------------------------
  function getGridEl() {
    return document.getElementById("category-grid") || document.getElementById("brands-grid");
  }

  function getSectionTitleEl() {
    return document.getElementById("cigars-section-title");
  }

  function getAppliedFiltersEl() {
    return document.getElementById("cigars-applied-filters");
  }

  // -----------------------------
  // Utilities
  // -----------------------------
  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();

  const slug = (s) =>
    lower(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  function esc(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && norm(row[k]) !== "") return row[k];
    }
    // case-insensitive fallback
    const ks = Object.keys(row);
    for (const want of keys) {
      const hit = ks.find((h) => lower(h) === lower(want));
      if (hit && norm(row[hit]) !== "") return row[hit];
    }
    return "";
  }

  function formatPriceRaw(v) {
    // Keep your sheet’s display formatting if present; otherwise attempt $X.XX
    const s = norm(v);
    if (!s) return "-";
    if (s.includes("$")) return s;
    const n = Number(s.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return s;
    return "$" + n.toFixed(2);
  }

  function priceNumber(v) {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // -----------------------------
  // CSV parser
  // -----------------------------
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

  async function loadSheet() {
    const res = await fetch(withNoCache(HUB_CSV_URL), { cache: "no-store" });
    if (!res.ok) throw new Error("Google Sheets CSV fetch failed: " + res.status);
    const text = await res.text();
    const parsed = parseCSV(text);
    return parsed.data;
  }

  // -----------------------------
  // Brand tile icons
  // -----------------------------
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
    const canonical = slug(name);
    if (!canonical) return "";
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, canonical)) {
      return BRAND_ICON_OVERRIDES[canonical];
    }
    return canonical;
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

  function setBrandImgWithFallback(imgEl, brandName, csvImgPath) {
    const slugB = brandSlug(brandName);
    const csvSrc = safeSrc(csvImgPath);

    const candidates = [];
    if (csvSrc) candidates.push(csvSrc);
    if (slugB) candidates.push(`/img/icons/brands/${slugB}.svg`);
    if (slugB) candidates.push(`/img/icons/brand/${slugB}.svg`);

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

  // -----------------------------
  // Filter state + matching
  // -----------------------------
  function ensureDefaultState() {
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
  }

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

  function hasActiveState(state) {
    const q = state && state.q ? String(state.q).trim() : "";
    if (q) return true;

    const filters = state && state.filters ? state.filters : {};
    for (const k of Object.keys(filters)) {
      const s = filters[k];
      if (s && typeof s.size === "number" && s.size > 0) return true;
    }
    return false;
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

  // -----------------------------
  // Applied filter chips (unchanged from your build)
  // -----------------------------
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
    if (q) chips.push({ type: "q", key: "q", label: `Search: ${q}`, value: q });

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

    // Clear all
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

  // -----------------------------
  // ✅ BRAND-PAGE IDENTICAL ROW MARKUP (Results mode)
  // -----------------------------
  function buildBrandRowHTML(row) {
    const brand = norm(pick(row, ["Brand"]));
    const line = norm(pick(row, ["Line", "Series", "Collection"]));
    const cigar = norm(pick(row, ["Cigar", "Name", "Cigar Name"]));
    const vitola = norm(pick(row, ["Vitola"]));

    const cigarFull = `${line} ${cigar}`.trim();

    const wrapper = norm(pick(row, ["Wrapper", "Wrapper Type"]));
    const binder = norm(pick(row, ["Binder"]));
    const filler = norm(pick(row, ["Filler"]));
    const origin = norm(pick(row, ["Origin", "Country", "Country of Origin"]));
    const ring = norm(pick(row, ["RG", "Ring", "Ring Gauge"]));
    const length = norm(pick(row, ["Length"]));
    const shape = norm(pick(row, ["Shape"]));
    const strength = norm(pick(row, ["Strength"]));
    const wrapperShade = norm(pick(row, ["Wrapper Shade", "WrapperShade", "Shade"]));
    const msrpRaw = pick(row, ["MSRP", "Price", "MSRP Price", "Cigar MSRP"]);
    const msrp = formatPriceRaw(msrpRaw);

    const image = norm(pick(row, ["Image", "IMG", "Img", "Photo", "Cigar IMG", "Cigar Image"]));

    const brandIconSrc = `/img/icons/brands/${brandSlug(brand)}.svg`;

    return `
      <div class="brand-row"
        data-row
        data-brand="${esc(brand)}"
        data-line="${esc(line)}"
        data-cigar="${esc(cigar)}"
        data-cigar-full="${esc(cigarFull)}"
        data-wrapper="${esc(wrapper)}"
        data-binder="${esc(binder)}"
        data-filler="${esc(filler)}"
        data-origin="${esc(origin)}"
        data-ring="${esc(ring)}"
        data-length="${esc(length)}"
        data-shape="${esc(shape)}"
        data-vitola="${esc(vitola)}"
        data-strength="${esc(strength)}"
        data-wrapper-shade="${esc(wrapperShade)}"
        data-msrp="${esc(msrp)}"
        data-msrp-num="${esc(String(priceNumber(msrpRaw)))}"
        data-image="${esc(image)}">

        <img class="row-ico" alt="" src="${esc(brandIconSrc)}"
             onerror="this.style.visibility='hidden';" />

        <div class="brand-row-left">
          <div class="brand-row-title">
            <div>${esc(cigarFull || cigar)}</div>
          </div>

          <div class="brand-row-sub">
            <div>${esc(vitola)}</div>
          </div>
        </div>

        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(msrp)}</div>
          <button type="button"
            class="pos-add"
            aria-label="Add to invoice">+</button>
        </div>
      </div>
    `;
  }

  // -----------------------------
  // ✅ Cigar Detail Popup (copied from brand system)
  // -----------------------------
  let detailOverlay = null;
  let detailSheet = null;

  function ensureCigarDetailModal() {
    if (detailOverlay) return;

    detailOverlay = document.createElement("div");
    detailOverlay.className = "cigar-detail-overlay";
    detailOverlay.setAttribute("aria-hidden", "true");

    detailOverlay.addEventListener("click", (e) => {
      if (e.target === detailOverlay) closeCigarDetail();
    });

    detailSheet = document.createElement("div");
    detailSheet.className = "cigar-detail-sheet";
    detailSheet.setAttribute("role", "dialog");
    detailSheet.setAttribute("aria-modal", "true");

    detailOverlay.appendChild(detailSheet);
    document.body.appendChild(detailOverlay);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detailOverlay?.classList.contains("open")) {
        closeCigarDetail();
      }
    });
  }

  function closeCigarDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  function pickCigarImageFromDataset(ds) {
    const src = norm(ds.image || "");
    return src || "";
  }

  function renderKV(k, v) {
    const vv = norm(v) || "—";
    return `
      <div class="cd-kv">
        <div class="k">${esc(k)}</div>
        <div class="v">${esc(vv)}</div>
      </div>
    `;
  }

  function openCigarDetailFromDataset(ds) {
    ensureCigarDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = norm(ds.brand || "Brand");
    const cigarName = norm(ds.cigarFull || ds.cigar || "");
    const vitola = norm(ds.vitola || "");
    const ring = norm(ds.ring || "");
    const length = norm(ds.length || "");
    const shape = norm(ds.shape || "");
    const strength = norm(ds.strength || "");
    const wrapperShade = norm(ds.wrapperShade || "");

    const wrapper = norm(ds.wrapper || "");
    const binder = norm(ds.binder || "");
    const filler = norm(ds.filler || "");
    const origin = norm(ds.origin || "");

    const brandIcon = `/img/icons/brands/${brandSlug(brand)}.svg`;

    const picked = pickCigarImageFromDataset(ds);
    const nameForFile = slug(cigarName || "");
    const brandForFolder = slug(brand || "");

    const imgCandidates = [
      picked,
      `/img/cigars/${brandForFolder}/${nameForFile}.png`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpg`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpeg`,
    ].filter(Boolean);

    const cigarImg = imgCandidates[0] || "";

    const msrpNum = Number(ds.msrpNum || "0") || 0;

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>

      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${esc(brand)}</div>
            <div class="cd-name">${esc(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            <img src="${esc(brandIcon)}" alt="" onerror="this.style.display='none';">
          </div>
        </div>

        <div class="cd-main">
          <div class="cd-img">
            ${cigarImg ? `<img class="cigar-detail-stick" src="${esc(cigarImg)}" alt="">` : ``}
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat">
                <div class="k">RING</div>
                <div class="v">${esc(ring || "—")}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${esc(length || "—")}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${esc(shape || "—")}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${esc(vitola || "—")}</div>
              </div>
            </div>

            <div class="cd-block">
              ${renderKV("WRAPPER", wrapper)}
              ${renderKV("BINDER", binder)}
              ${renderKV("FILLER", filler)}
              ${renderKV("ORIGIN", origin)}
            </div>

            <div class="cd-block single">
              ${renderKV("STRENGTH", strength)}
            </div>

            <div class="cd-block single">
              ${renderKV("WRAPPER SHADE", wrapperShade)}
            </div>

            <div class="cd-actions">
              <button type="button" class="cd-btn" disabled>COMPARE</button>
              <button type="button" class="cd-btn" disabled>EDIT</button>
              <button type="button" class="cd-btn is-live" data-cd-action="add">ADD</button>
            </div>
          </div>
        </div>
      </div>
    `;

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeCigarDetail);

    detailSheet.querySelector('[data-cd-action="add"]')?.addEventListener("click", () => {
      if (typeof window.addToInvoice === "function") {
        const id = `${slug(brand)}|${slug(cigarName)}|${slug(vitola)}`;
        window.addToInvoice({
          id,
          name: cigarName,
          vitola: vitola,
          brand: brand,
          price: msrpNum,
          qty: 1,
          icon: brandIcon,
        });
      }
      closeCigarDetail();
    });

    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
  }

  // -----------------------------
  // Main renderer
  // -----------------------------
  async function run() {
    const grid = getGridEl();
    if (!grid) return;

    try {
      const rows = await loadSheet();
      window.__CIGAR_SHEET_ROWS__ = rows;
      ensureDefaultState();

      // expose render function for cigars.js (filters/search)
      window.buildCigarsRender = function () {
        const state = window.__CIGAR_FILTER_STATE__ || { q: "", filters: {} };
        const titleEl = getSectionTitleEl();

        buildAppliedChips(state);

        const active = hasActiveState(state);
        grid.innerHTML = "";

        if (!active) {
          if (titleEl) titleEl.textContent = "Brands";
          grid.classList.remove("cigars-results");
          grid.classList.add("brands-grid");

          const brands = brandsFromRows(rows, state);

          if (!brands.length) {
            const msg = document.createElement("div");
            msg.className = "cigars-empty";
            msg.textContent = "No brands found.";
            grid.appendChild(msg);
            return;
          }

          const frag = document.createDocumentFragment();
          brands.forEach((b) => frag.appendChild(buildTile(b)));
          grid.appendChild(frag);
          return;
        }

        // Results mode (brand-row identical)
        if (titleEl) titleEl.textContent = "Results";
        grid.classList.remove("brands-grid");
        grid.classList.add("cigars-results");

        const matches = rows.filter((r) => rowMatchesState(r, state));
        if (!matches.length) {
          const msg = document.createElement("div");
          msg.className = "cigars-empty";
          msg.textContent = "No cigars match your filters.";
          grid.appendChild(msg);
          return;
        }

        const MAX = 200;
        const slice = matches.slice(0, MAX);

        const html = slice.map(buildBrandRowHTML).join("");
        grid.innerHTML = html;

        if (matches.length > MAX) {
          const more = document.createElement("div");
          more.className = "cigars-more";
          more.textContent = `Showing ${MAX} of ${matches.length} results. Narrow your filters to see more.`;
          grid.appendChild(more);
        }
      };

      // Bind clicks ONCE (event delegation)
      if (!grid.__boundBrandRowClicks) {
        grid.__boundBrandRowClicks = true;

        grid.addEventListener("click", (e) => {
          const addBtn = e.target.closest(".pos-add");
          if (addBtn) {
            const rowEl = addBtn.closest("[data-row]");
            if (!rowEl) return;

            const ds = rowEl.dataset;
            const brand = norm(ds.brand);
            const cigarName = norm(ds.cigarFull || ds.cigar);
            const vitola = norm(ds.vitola);
            const price = Number(ds.msrpNum || "0") || 0;
            const icon = `/img/icons/brands/${brandSlug(brand)}.svg`;
            const id = `${slug(brand)}|${slug(cigarName)}|${slug(vitola)}`;

            if (typeof window.addToInvoice === "function") {
              window.addToInvoice({
                id,
                name: cigarName,
                vitola,
                brand,
                price,
                qty: 1,
                icon,
              });
            }
            return; // IMPORTANT: do not open popup
          }

          const rowEl = e.target.closest("[data-row]");
          if (!rowEl) return;

          const ds = rowEl.dataset;
          openCigarDetailFromDataset({
            brand: ds.brand,
            line: ds.line,
            cigar: ds.cigar,
            cigarFull: ds.cigarFull,
            wrapper: ds.wrapper,
            binder: ds.binder,
            filler: ds.filler,
            origin: ds.origin,
            ring: ds.ring,
            length: ds.length,
            shape: ds.shape,
            vitola: ds.vitola,
            strength: ds.strength,
            wrapperShade: ds.wrapperShade,
            image: ds.image,
            msrpNum: ds.msrpNum,
          });
        });
      }

      // initial paint
      window.buildCigarsRender();
      window.dispatchEvent(new Event("cigars:hub-ready"));
    } catch (err) {
      console.error("[build-cigars] error:", err);
      grid.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "cigars-empty cigars-empty--error";
      msg.textContent = "Brands failed to load from the Hub (Google Sheets). Check sharing + CSV access.";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
