// /pos/img/scripts/build-cigars.js
// Loads Google Sheets CSV (HUB) -> builds brand grid OR (when filters/search active) renders
// the EXACT SAME row markup + click behavior as /pos/cigars/brand.js (brand-row + cigar detail popup)
//
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

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- DOM helpers ----------
  function getGridEl() {
    return document.getElementById("category-grid") || document.getElementById("brands-grid");
  }
  function getSectionTitleEl() {
    return document.getElementById("cigars-section-title");
  }
  function getAppliedFiltersEl() {
    return document.getElementById("cigars-applied-filters");
  }

  // ---------- utilities ----------
  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();

  const slug = (s) =>
    lower(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  const esc = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    }
    // case-insensitive fallback
    const ks = Object.keys(row || {});
    for (const want of keys) {
      const hit = ks.find((h) => lower(h) === lower(want));
      if (hit && norm(row[hit]) !== "") return row[hit];
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

  // ---------- CSV parsing ----------
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

  // ---------- brand icon overrides ----------
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

  function setBrandImgWithFallback(imgEl, brandName, csvImgPath) {
    const s = brandSlug(brandName);
    const csvSrc = safeSrc(csvImgPath);

    const candidates = [];
    if (csvSrc) candidates.push(csvSrc);
    if (s) candidates.push(`/img/icons/brands/${s}.svg`);
    if (s) candidates.push(`/img/icons/brand/${s}.svg`);

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

  // ---------- brand tiles ----------
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

  function brandsFromRows(rows, state) {
    const brandMap = new Map();

    for (const row of rows) {
      const brand = norm(row["Brand"]);
      if (!brand) continue;

      if (state && !rowMatchesState(row, state)) continue;

      const brandImg = norm(row["Brand IMG"] || row["Brand Img"]);
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

  // ---------- filter matching (same logic as your build) ----------
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

      const colVal = norm(pick(row, map[filterKey]));
      if (!colVal || !set.has(colVal)) return false;
    }

    return true;
  }

  function hasActiveState(state) {
    const q = state?.q ? norm(state.q) : "";
    if (q) return true;

    const filters = state?.filters || {};
    for (const k of Object.keys(filters)) {
      const s = filters[k];
      if (s && typeof s.size === "number" && s.size > 0) return true;
    }
    return false;
  }

  // ---------- Applied chips (unchanged) ----------
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
    const q = norm(state.q);
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

  // =========================================================
  // ✅ CIGAR DETAIL POPUP (copied from brand.js, so row click works on main page)
  // =========================================================
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
      if (e.key === "Escape" && detailOverlay?.classList.contains("open")) closeCigarDetail();
    });
  }

  function bestBrandHeaderIcon(row) {
    const b = norm(row?.brand || row?.Brand || row?.Manufacturer || "");
    return b ? `/img/icons/brands/${slug(b)}.svg` : "";
  }

  function pickCigarImage(row) {
    const raw =
      row?.image ||
      row?.Image ||
      row?.["Cigar IMG"] ||
      row?.["Cigar Image"] ||
      row?.Img ||
      row?.Photo ||
      "";
    return norm(raw);
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

  function openCigarDetail(row) {
    ensureCigarDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = norm(row?.brand || row?.Brand || "Brand");
    const cigarName = norm(
      row?.cigarFull ||
        row?.["Cigar Full"] ||
        row?.cigar ||
        row?.Cigar ||
        ""
    );

    const brandIcon = bestBrandHeaderIcon(row) || "";

    const picked = pickCigarImage(row);
    const nameForFile = slug(
      row?.cigarFull || row?.cigar || row?.Cigar || ""
    );
    const brandForFolder = slug(row?.brand || row?.Brand || "");
    const imgCandidates = [
      picked,
      brandForFolder && nameForFile ? `/img/cigars/${brandForFolder}/${nameForFile}.png` : "",
      brandForFolder && nameForFile ? `/img/cigars/${brandForFolder}/${nameForFile}.jpg` : "",
      brandForFolder && nameForFile ? `/img/cigars/${brandForFolder}/${nameForFile}.jpeg` : "",
    ].filter(Boolean);

    const cigarImg = imgCandidates[0] || "";

    const rg = norm(row?.ring || row?.RG || row?.Ring || "");
    const len = norm(row?.length || row?.Length || "");
    const strength = norm(row?.strength || row?.Strength || "");
    const vitola = norm(row?.vitola || row?.Vitola || "");
    const shape = norm(row?.shape || row?.Shape || "");
    const wrapper = norm(row?.wrapper || row?.Wrapper || "");
    const binder = norm(row?.binder || row?.Binder || "");
    const filler = norm(row?.filler || row?.Filler || "");
    const origin = norm(row?.origin || row?.Origin || "");
    const shade = norm(row?.wrapperShade || row?.["Wrapper Shade"] || row?.Shade || "");

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>

      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${esc(brand)}</div>
            <div class="cd-name">${esc(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            ${brandIcon ? `<img src="${esc(brandIcon)}" alt="">` : ``}
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
                <div class="v">${esc(String(rg || "—"))}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${esc(String(len || "—"))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${esc(String(shape || "—"))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${esc(String(vitola || "—"))}</div>
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
              ${renderKV("WRAPPER SHADE", shade)}
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
      const msrpVal = row?.msrp ?? row?.MSRP ?? row?.Price ?? row?.price ?? 0;

      // If your cart exposes window.CigarOSCart (brand.js expects it), use it.
      window.CigarOSCart?.add?.({
        id: row?.key || `${brand}-${cigarName}-${vitola}`,
        name: cigarName,
        brand: brand,
        category: "Cigars",
        sub: vitola ? `${vitola} • ${len} × ${rg}` : "",
        price: Number(msrpVal || 0),
        img: "",
      });

      closeCigarDetail();
    });

    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
  }

  function closeCigarDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  // =========================================================
  // ✅ EXACT BRAND-PAGE ROW MARKUP FOR RESULTS
  // =========================================================
  function priceNum(x) {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function buildReceiptItem({ brand, line, cigar, vitola, msrp }) {
    const key = `${slug(brand)}|${slug(line)}|${slug(cigar)}`;
    return {
      key,
      type: "cigar",
      category: "Cigars",
      name: `${line ? line + " — " : ""}${cigar}`,
      sub: vitola || "",
      price: priceNum(msrp),
      qty: 1,
      meta: { brand, line, cigar, vitola },
    };
  }

  function buildBrandPageRowFromHubRow(r) {
    const brand = norm(pick(r, ["Brand"]));
    const line = norm(pick(r, ["Line", "Series", "Collection"]));
    const cigar = norm(pick(r, ["Cigar", "Name", "Cigar Name"]));
    const cigarFull = norm([line, cigar].filter(Boolean).join(" "));

    const vitola = norm(pick(r, ["Vitola"]));
    const strength = norm(pick(r, ["Strength"]));
    const shape = norm(pick(r, ["Shape"]));
    const wrapperShade = norm(pick(r, ["Wrapper Shade", "WrapperShade", "Shade"]));

    const wrapper = norm(pick(r, ["Wrapper", "Wrapper Type"]));
    const binder = norm(pick(r, ["Binder"]));
    const filler = norm(pick(r, ["Filler"]));
    const origin = norm(pick(r, ["Origin", "Country", "Country of Origin"]));
    const ring = norm(pick(r, ["RG", "Ring", "Ring Gauge"]));
    const length = norm(pick(r, ["Length"]));
    const msrp = norm(pick(r, ["MSRP", "Price", "MSRP Price", "Cigar MSRP"]));
    const image = norm(pick(r, ["Image", "Img", "Photo", "Cigar Image", "Cigar IMG"]));

    const receiptItem = buildReceiptItem({ brand, line, cigar, vitola, msrp });
    const brandIconSrc = `/img/icons/brands/${slug(brand)}.svg`;

    const row = document.createElement("div");
    row.className = "brand-row";
    row.setAttribute("data-row", "");
    row.dataset.brand = brand;
    row.dataset.line = line;
    row.dataset.cigar = cigar;
    row.dataset.cigarFull = cigarFull;
    row.dataset.wrapper = wrapper;
    row.dataset.binder = binder;
    row.dataset.filler = filler;
    row.dataset.origin = origin;
    row.dataset.ring = ring;
    row.dataset.length = length;
    row.dataset.shape = shape;
    row.dataset.vitola = vitola;
    row.dataset.strength = strength;
    row.dataset.wrapperShade = wrapperShade;
    row.dataset.msrp = msrp;
    row.dataset.image = image;

    row.innerHTML = `
      <img class="row-ico" alt="" src="${esc(brandIconSrc)}" onerror="this.style.visibility='hidden';" />

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
        <button
          type="button"
          class="pos-add"
          aria-label="Add to invoice"
          data-receipt-item='${esc(JSON.stringify(receiptItem))}'
        >+</button>
      </div>
    `;

    return row;
  }

  function bindResultsRowClicks(containerEl) {
    if (!containerEl) return;

    containerEl.addEventListener("click", (e) => {
      const t = e.target;

      // If they hit the green +, cart.js handles via [data-receipt-item]
      const add = t && t.closest ? t.closest("[data-receipt-item]") : null;
      if (add) return;

      const row = t && t.closest ? t.closest("[data-row]") : null;
      if (!row) return;

      const item = {
        brand: norm(row.dataset.brand),
        line: norm(row.dataset.line),
        cigar: norm(row.dataset.cigar),
        cigarFull: norm(row.dataset.cigarFull),

        vitola: norm(row.dataset.vitola),
        shape: norm(row.dataset.shape),
        strength: norm(row.dataset.strength),
        wrapperShade: norm(row.dataset.wrapperShade),

        wrapper: norm(row.dataset.wrapper),
        binder: norm(row.dataset.binder),
        filler: norm(row.dataset.filler),
        origin: norm(row.dataset.origin),
        ring: norm(row.dataset.ring),
        length: norm(row.dataset.length),
        msrp: norm(row.dataset.msrp),
        image: norm(row.dataset.image),

        key: `${slug(row.dataset.brand)}|${slug(row.dataset.line)}|${slug(row.dataset.cigarFull || row.dataset.cigar)}`,
      };

      openCigarDetail(item);
    });
  }

  // ---------- load + render ----------
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

      // (re)bind once (safe; event handler is on container)
      bindResultsRowClicks(grid);

      window.buildCigarsRender = function () {
        const state = window.__CIGAR_FILTER_STATE__ || { q: "", filters: {} };
        const titleEl = getSectionTitleEl();

        // Chips always reflect current state
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

        // Filtered cigar results (render with brand-page row markup)
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

        const MAX = 200;
        const slice = matches.slice(0, MAX);

        const frag = document.createDocumentFragment();
        slice.forEach((r) => frag.appendChild(buildBrandPageRowFromHubRow(r)));
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
