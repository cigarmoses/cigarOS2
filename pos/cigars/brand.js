/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ List row icon = BRAND LOGO ONLY (never cigar images)
   ✅ Display name = Line + Cigar (dedupe prefix)
   ✅ Detail popup: forgiving cigar image match + "image coming soon" placeholder
   ✅ FIX: Filters + Bands buttons wired + sheets open/close/backdrop/escape
   ✅ FIX: Accept brand query as SLUG or DISPLAY NAME (e.g., arturofuente OR Arturo Fuente)
   ✅ FIX: Add-to-invoice includes brand icon so invoice shows icons
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  // ---------- DOM (core) ----------
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back");

  // wrapper toggle
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-switch");

  // sheets
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");
  const backdrop = $("#sheet-backdrop");
  const sheetFilters = $("#sheet-filters");
  const sheetBands = $("#sheet-bands");

  // filters sheet internals
  const filtersHome = $("#filters-home");
  const filtersDetail = $("#filters-detail");
  const filtersTitle = $("#filters-title");
  const filtersBack = $("#filters-back");
  const filtersList = $("#filters-list");
  const filtersSearch = $("#filters-search");
  const filtersConfirm = $("#filters-confirm");

  const appliedWrap = $("#brand-applied");
  const appliedRow = $("#brand-applied-row");

  // bands sheet internals
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // ---------- State ----------
  let ALL = [];
  let VIEW_BY_ID = Object.create(null);

  // Brand icon candidates (computed once per page)
  let BRAND_ICON_CANDS = [];
  let BRAND_SLUG = "";

  // Wrapper “maduro/natural/all”
  let wrapperState = "all"; // maduro | natural | all

  // Price range derived from data
  let PRICE_MIN = 0;
  let PRICE_MAX = 0;

  // Filters (ACTIVE = applied)
  const active = {
    priceMin: null,
    priceMax: null,
    fields: {
      Vitola: new Set(),
      RG: new Set(),
      Length: new Set(),
      "Wrapper Shade": new Set(),
      Strength: new Set(),
      Shape: new Set(),
    },
    // band filter (from Bands sheet)
    bands: new Set(), // stores normalized band keys
  };

  // Draft selections inside filter/band sheets (apply on confirm)
  const draft = {
    fields: {
      Vitola: new Set(),
      RG: new Set(),
      Length: new Set(),
      "Wrapper Shade": new Set(),
      Strength: new Set(),
      Shape: new Set(),
    },
    bands: new Set(),
  };

  // Which filter field detail page is open
  let FILTER_FIELD_OPEN = "";

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const normD = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const slugTight = (s) =>
    normD(s)
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");

  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  const money = (n) =>
    window.CigarOSCart?.money ? window.CigarOSCart.money(n) : Number(n || 0).toFixed(2);

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
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
    return escapeHTML(s).replaceAll("`", "");
  }

  function normalizeIconPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("img/")) s = "/" + s;
    if (!s.startsWith("/")) s = "/" + s;

    // brand icons live under /img/icons/brands/
    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function getBrandQueryRaw() {
    return (qp("brand") || "").toString().trim();
  }

  function brandMatchesRow(brandQueryRaw, row) {
    const qRaw = (brandQueryRaw || "").toString().trim();
    if (!qRaw) return false;

    const qNorm = normD(qRaw);
    const qSlug = slugTight(qRaw);

    const b = (row.Brand || "").toString().trim();
    const bAka = (row["Brand aka"] || "").toString().trim();

    const bNorm = normD(b);
    const bSlug = slugTight(b);

    const akaNorm = normD(bAka);
    const akaSlug = slugTight(bAka);

    // allow:
    // - display name match (padron)
    // - slug match (arturofuente)
    // - aka match
    if (qNorm && (qNorm === bNorm || qNorm === akaNorm)) return true;
    if (qSlug && (qSlug === bSlug || qSlug === akaSlug)) return true;

    // allow contains in either direction (soft match)
    if (qNorm && bNorm && (bNorm.includes(qNorm) || qNorm.includes(bNorm))) return true;
    if (qSlug && bSlug && (bSlug.includes(qSlug) || qSlug.includes(bSlug))) return true;

    return false;
  }

  // =========================================================
  // ✅ DISPLAY NAME = Line + Cigar (dedupe prefix)
  // =========================================================
  function stripDuplicateLinePrefix(lineRaw, cigarRaw) {
    const line = (lineRaw || "").toString().trim();
    const cigar = (cigarRaw || "").toString().trim();
    if (!line || !cigar) return cigar;

    const ln = normD(line);
    const cn = normD(cigar);

    if (cn.startsWith(ln + " ")) return cigar.slice(line.length).trim();
    return cigar;
  }

  function buildDisplayName(row) {
    const line = (row.Line || "").toString().trim();
    const cigar = (row.Cigar || "").toString().trim();
    const cigarNoDup = stripDuplicateLinePrefix(line, cigar);

    if (line && cigarNoDup) return `${line} ${cigarNoDup}`;
    return cigarNoDup || cigar || line || "";
  }

  // =========================================================
  // ✅ BRAND ICON candidates (NEVER use cigar images)
  // =========================================================
  function brandIconCandidates(row) {
    const out = [];

    const rawBrand = row?.["Brand IMG"] || "";
    const rawMfg = row?.["Manufacturer IMG"] || "";

    const a = normalizeIconPath(rawBrand);
    const b = normalizeIconPath(rawMfg);

    if (a) out.push(a);
    if (b) out.push(b);

    // canonical fallback using slug
    const slug = BRAND_SLUG || slugTight(row?.Brand || "");
    if (slug) {
      out.push(`/img/icons/brands/${slug}.svg`);
      out.push(`/img/icons/brands/${slug}.png`);
      out.push(`/img/icons/brands/${slug}.jpg`);
    }

    return Array.from(new Set(out.filter(Boolean)));
  }

  function cartBrandIcon(row) {
    // prefer sheet-provided brand icon, else canonical slug svg
    const rawBrand = normalizeIconPath(row?.["Brand IMG"] || "");
    const rawMfg = normalizeIconPath(row?.["Manufacturer IMG"] || "");
    const slug = BRAND_SLUG || slugTight(row?.Brand || "");
    return (
      rawBrand ||
      rawMfg ||
      (slug ? `/img/icons/brands/${slug}.svg` : "") ||
      "/img/icons/cigar-outline.svg"
    );
  }

  function loadFirstWorkingImage(imgEl, candidates, fallbackSrc) {
    let i = 0;

    const tryNext = () => {
      if (i >= candidates.length) {
        if (fallbackSrc) imgEl.src = fallbackSrc;
        else imgEl.removeAttribute("src");
        return;
      }
      imgEl.onerror = () => {
        i++;
        tryNext();
      };
      imgEl.src = candidates[i];
    };

    tryNext();
  }

  function applyBrandHeader(firstRow) {
    const displayName = (firstRow?.Brand || getBrandQueryRaw() || "Brand").toString().trim();
    BRAND_SLUG = slugTight(firstRow?.Brand || getBrandQueryRaw() || "");
    if (brandTitleEl) brandTitleEl.textContent = displayName || "Brand";

    // compute once for the entire page (used for header + EVERY row)
    BRAND_ICON_CANDS = brandIconCandidates(firstRow || {});

    if (!brandIconWrap) return;

    if (!BRAND_ICON_CANDS.length) {
      brandIconWrap.innerHTML = "";
      return;
    }

    brandIconWrap.innerHTML = `<img data-brand-icon alt="" />`;
    const img = brandIconWrap.querySelector("img[data-brand-icon]");
    if (!img) return;

    loadFirstWorkingImage(img, BRAND_ICON_CANDS, "");
  }

  // =========================================================
  // ✅ DETAIL cigar image resolution (forgiving)
  // =========================================================
  function resolveCigarImageCandidates(row) {
    const brandSlug = BRAND_SLUG || slugTight(row.Brand || "");
    const baseDir = brandSlug ? `/img/cigars/${brandSlug}/` : "/img/cigars/";

    const candidates = [];

    // 1) explicit sheet image (if it points into /img/cigars/ or is a filename)
    const raw = row["Cigar IMG"] || row["Cigar Image"] || row["Image"] || "";
    const rawNorm = normalizeIconPath(raw);

    if (rawNorm.includes("/img/cigars/")) {
      candidates.push(rawNorm);
    } else if (raw && /\.(png|jpg|jpeg|webp)$/i.test(raw)) {
      candidates.push(`${baseDir}${raw.replace(/^\/+/, "")}`);
    }

    // 2) generate from line/cigar patterns
    const lineRaw = (row.Line || "").toString().trim();
    const cigarRaw = (row.Cigar || "").toString().trim();

    const lineNorm = normD(lineRaw);
    const cigarSlug = slugTight(cigarRaw);
    const lineSlug = slugTight(lineRaw);

    const exts = [".png", ".jpg", ".jpeg", ".webp"];
    const pushBase = (baseNoExt) => exts.forEach((ext) => candidates.push(`${baseNoExt}${ext}`));

    // Padron specifics
    if (brandSlug === "padron" || normD(row.Brand) === "padron") {
      if (lineNorm === "1964") pushBase(`${baseDir}padron1964${cigarSlug}`);

      if (lineNorm === "1926") {
        pushBase(`${baseDir}1926serie${cigarSlug}`);
        pushBase(`${baseDir}1926series${cigarSlug}`);
        pushBase(`${baseDir}1926${cigarSlug}`);
        pushBase(`${baseDir}padron1926serie${cigarSlug}`);
      }

      if (lineNorm === "damaso" || normD(cigarRaw) === "damaso") {
        pushBase(`${baseDir}Damaso`);
        pushBase(`${baseDir}damaso`);
        pushBase(`${baseDir}padrondamaso`);
      }

      if (lineSlug && cigarSlug) pushBase(`${baseDir}padron${lineSlug}${cigarSlug}`);
      if (cigarSlug) pushBase(`${baseDir}padron${cigarSlug}`);
    } else {
      // other brands (safe generic)
      if (brandSlug && lineSlug && cigarSlug) pushBase(`${baseDir}${brandSlug}${lineSlug}${cigarSlug}`);
      if (brandSlug && cigarSlug) pushBase(`${baseDir}${brandSlug}${cigarSlug}`);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  // =========================================================
  // ✅ DETAIL PLACEHOLDER SVG ("image coming soon")
  // =========================================================
  function cigarPlaceholderSVG() {
    return `
      <svg viewBox="0 0 240 520" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="ph_g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="rgba(15,26,44,0.10)"/>
            <stop offset="1" stop-color="rgba(15,26,44,0.04)"/>
          </linearGradient>
        </defs>

        <rect x="78" y="32" width="84" height="456" rx="42"
              fill="url(#ph_g)" stroke="rgba(15,26,44,0.22)" stroke-width="3"/>

        <rect x="78" y="32" width="84" height="44" rx="22"
              fill="rgba(15,26,44,0.06)" stroke="rgba(15,26,44,0.18)" stroke-width="2"/>

        <rect x="86" y="160" width="68" height="22" rx="11"
              fill="rgba(15,26,44,0.06)"/>
        <rect x="86" y="192" width="68" height="10" rx="5"
              fill="rgba(15,26,44,0.05)"/>

        <text x="120" y="275"
              text-anchor="middle"
              font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
              font-size="14"
              fill="rgba(15,26,44,0.55)"
              letter-spacing="-0.02em">
          image coming soon
        </text>
      </svg>
    `;
  }

  // ---------- CSV parsing ----------
  function parseCSV(text) {
    const rows = [];
    let i = 0, field = "", row = [], inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQuotes = false; i++; continue; }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ",") { row.push(field); field = ""; i++; continue; }
        if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        if (c === "\r") { i++; continue; }
        field += c; i++;
      }
    }

    row.push(field);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].every((x) => !x || !x.trim())) rows.pop();
    return rows;
  }

  function tableFromCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => (h || "").trim());

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = (rows[r][c] ?? "").trim();
      out.push(obj);
    }
    return out;
  }

  // ---------- LIST render ----------
  function injectRowOpenHitStylesOnce() {
    const id = "brand-row-openhit-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .brand-row{ position: relative; }
      .brand-row .row-openhit{
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 132px;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        z-index: 2;
        border-radius: 18px;
      }
      .brand-row .row-price,
      .brand-row .row-add{
        position: relative;
        z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  function renderList(rows) {
    if (!listEl) return;

    VIEW_BY_ID = Object.create(null);

    if (!rows.length) {
      listEl.innerHTML = "";
      setStatus("No results.");
      return;
    }

    setStatus("");

    listEl.innerHTML = rows
      .map((row) => {
        const name = buildDisplayName(row);
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`;

        VIEW_BY_ID[id] = row;

        // IMPORTANT: row icon is ALWAYS brand icon
        return `
          <div class="brand-row" data-id="${escapeAttr(id)}">
            <img class="row-ico" data-row-brand-icon alt="" />

            <div class="row-main" data-open>
              <div class="row-title">${escapeHTML(name)}</div>
              <div class="row-sub">${escapeHTML(sub)}</div>
            </div>

            <div class="row-price">${price}</div>
            <button class="row-add" type="button" aria-label="Add" data-add>+</button>

            <button class="row-openhit" type="button" aria-label="Open details" data-open-detail></button>
          </div>
        `;
      })
      .join("");

    // Apply brand icon to every row (same source chain)
    const rowIcons = listEl.querySelectorAll("img[data-row-brand-icon]");
    rowIcons.forEach((img) => {
      if (BRAND_ICON_CANDS?.length) loadFirstWorkingImage(img, BRAND_ICON_CANDS, "");
      else {
        img.style.opacity = "0";
        img.style.pointerEvents = "none";
      }
    });

    injectRowOpenHitStylesOnce();
  }

  function initListDelegation() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const rowEl = addBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: buildDisplayName(row),
          brand: row.Brand,
          category: "Cigars",
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: cartBrandIcon(row), // ✅ critical: invoice icon
        });
        return;
      }

      const openBtn = e.target.closest("[data-open-detail], [data-open]");
      if (openBtn) {
        const rowEl = openBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;
        openCigarDetail(row);
      }
    });
  }

  // =========================================================
  // ✅ Band key extraction (used for Bands filter)
  // =========================================================
  function bandKeyFromRow(row) {
    const raw =
      row["Band"] ||
      row["Band Name"] ||
      row["Band Key"] ||
      row["Band Art"] ||
      row["Band IMG"] ||
      row["Band Image"] ||
      "";
    return normD(raw);
  }

  function cigarMatchesBands(row) {
    if (!active.bands.size) return true;
    const k = bandKeyFromRow(row);
    if (!k) return false;
    return active.bands.has(k);
  }

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    const out = ALL.filter((row) => {
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      const cigarName = norm(row.Cigar || "");
      if (wrapperState === "maduro") {
        if (!cigarName.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        if (!cigarName.includes("natural")) return false;
      }

      const msrp = toNum(row.MSRP);
      if (active.priceMin != null && msrp < active.priceMin) return false;
      if (active.priceMax != null && msrp > active.priceMax) return false;

      for (const [field, set] of Object.entries(active.fields)) {
        if (!set || !set.size) continue;
        const cell = row[field] ?? "";
        const k = norm(cell);
        if (!set.has(k)) return false;
      }

      if (!cigarMatchesBands(row)) return false;

      return true;
    });

    renderList(out);
    renderAppliedChips();
  }

  // ---------- wrapper toggle ----------
  function setWrapperState(state) {
    wrapperState = state;
    if (wrapperSeg) wrapperSeg.dataset.state = state;

    btnMaduro?.setAttribute("aria-pressed", String(state === "maduro"));
    btnNatural?.setAttribute("aria-pressed", String(state === "natural"));

    applyAllFilters();
  }

  function initWrapperSeg() {
    if (!wrapperSeg) return;

    setWrapperState("all");

    btnMaduro?.addEventListener("click", () => setWrapperState("maduro"));
    btnNatural?.addEventListener("click", () => setWrapperState("natural"));

    segDot?.addEventListener("click", () => {
      if (wrapperState === "maduro") setWrapperState("all");
      else if (wrapperState === "all") setWrapperState("natural");
      else setWrapperState("maduro");
    });
  }

  // =========================================================
  // ✅ SHEET MANAGER (Filters + Bands)
  // =========================================================
  function closeSheets() {
    if (sheetFilters) sheetFilters.hidden = true;
    if (sheetBands) sheetBands.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("pos-modal-open");
  }

  function openSheet(which) {
    if (!backdrop) return;

    // close any open first
    if (sheetFilters) sheetFilters.hidden = true;
    if (sheetBands) sheetBands.hidden = true;

    backdrop.hidden = false;
    document.body.classList.add("pos-modal-open");

    if (which === "filters" && sheetFilters) sheetFilters.hidden = false;
    if (which === "bands" && sheetBands) sheetBands.hidden = false;
  }

  function initSheetCloseHandlers() {
    // close buttons
    $$("[data-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSheets();
      });
    });

    // backdrop click
    backdrop?.addEventListener("click", closeSheets);

    // esc
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheets();
    });

    // open buttons
    btnFilters?.addEventListener("click", () => {
      syncDraftFromActive();
      showFiltersHome();
      renderFiltersHomeCounts();
      openSheet("filters");
    });

    btnBands?.addEventListener("click", () => {
      syncDraftFromActive();
      renderBandsSheet();
      openSheet("bands");
      updateBandsConfirmState();
    });
  }

  // =========================================================
  // ✅ FILTERS SHEET (field selection)
  // =========================================================
  function syncDraftFromActive() {
    for (const k of Object.keys(draft.fields)) draft.fields[k] = new Set();
    for (const [k, set] of Object.entries(active.fields)) {
      draft.fields[k] = new Set(Array.from(set || []));
    }
    draft.bands = new Set(Array.from(active.bands || []));
    updateFiltersConfirmState();
  }

  function hasAnyDraftFilters() {
    const anyField = Object.values(draft.fields).some((s) => s && s.size);
    const anyBands = draft.bands && draft.bands.size;
    return Boolean(anyField || anyBands);
  }

  function updateFiltersConfirmState() {
    if (!filtersConfirm) return;
    // ✅ OFF by default until user changes something away from active
    const changed = didDraftChange();
    filtersConfirm.disabled = !changed;
  }

  function didDraftChange() {
    // compare draft.fields vs active.fields, and draft.bands vs active.bands
    for (const key of Object.keys(active.fields)) {
      const a = active.fields[key] || new Set();
      const d = draft.fields[key] || new Set();
      if (a.size !== d.size) return true;
      for (const v of a) if (!d.has(v)) return true;
    }
    const ab = active.bands || new Set();
    const db = draft.bands || new Set();
    if (ab.size !== db.size) return true;
    for (const v of ab) if (!db.has(v)) return true;

    return false;
  }

  function showFiltersHome() {
    FILTER_FIELD_OPEN = "";
    if (filtersHome) filtersHome.hidden = false;
    if (filtersDetail) filtersDetail.hidden = true;
    if (filtersBack) filtersBack.hidden = true;
    if (filtersTitle) filtersTitle.textContent = "Filters";
    if (filtersSearch) filtersSearch.value = "";
  }

  function showFiltersDetail(field) {
    FILTER_FIELD_OPEN = field;

    if (filtersHome) filtersHome.hidden = true;
    if (filtersDetail) filtersDetail.hidden = false;
    if (filtersBack) filtersBack.hidden = false;

    if (filtersTitle) filtersTitle.textContent = field;
    if (filtersSearch) filtersSearch.value = "";
    renderFilterDetailList(field);
  }

  function uniqueValuesForField(field) {
    const set = new Set();
    ALL.forEach((r) => {
      const v = (r[field] ?? "").toString().trim();
      if (!v) return;
      set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function renderFilterDetailList(field) {
    if (!filtersList) return;

    const q = norm(filtersSearch?.value || "");
    const values = uniqueValuesForField(field)
      .filter((v) => {
        if (!q) return true;
        return norm(v).includes(q);
      })
      .slice(0, 300); // keep list sane

    const selected = draft.fields[field] || new Set();

    filtersList.innerHTML = values
      .map((v) => {
        const key = norm(v);
        const isOn = selected.has(key);
        return `
          <button class="filter-opt" type="button" data-opt="${escapeAttr(key)}" aria-pressed="${isOn ? "true" : "false"}">
            <span class="filter-opt-label">${escapeHTML(v)}</span>
            <span class="filter-opt-check" aria-hidden="true">${isOn ? "✓" : ""}</span>
          </button>
        `;
      })
      .join("");

    // delegation
    filtersList.onclick = (e) => {
      const btn = e.target.closest("[data-opt]");
      if (!btn) return;

      const key = btn.getAttribute("data-opt") || "";
      if (!key) return;

      const set = draft.fields[field] || (draft.fields[field] = new Set());
      if (set.has(key)) set.delete(key);
      else set.add(key);

      updateFiltersConfirmState();
      renderFilterDetailList(field);
      renderFiltersHomeCounts();
    };
  }

  function renderFiltersHomeCounts() {
    // small visual helper: add badge counts to the pills (no extra CSS required)
    $$("[data-open-filter]").forEach((btn) => {
      const field = btn.getAttribute("data-open-filter");
      if (!field) return;

      const n = draft.fields[field]?.size || 0;
      btn.setAttribute("data-count", String(n));
      btn.textContent = btn.textContent.replace(/\s+$begin:math:text$\\d\+$end:math:text$\s*$/, "");
      if (n > 0) btn.textContent = `${btn.textContent} (${n})`;
    });
  }

  function initFiltersUI() {
    // open detail when clicking the “Ring / Length / …” pills
    $$("[data-open-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const field = btn.getAttribute("data-open-filter");
        if (!field) return;
        showFiltersDetail(field);
      });
    });

    filtersBack?.addEventListener("click", () => {
      showFiltersHome();
    });

    filtersSearch?.addEventListener("input", () => {
      if (!FILTER_FIELD_OPEN) return;
      renderFilterDetailList(FILTER_FIELD_OPEN);
    });

    filtersConfirm?.addEventListener("click", () => {
      // apply draft -> active
      for (const k of Object.keys(active.fields)) active.fields[k] = new Set();
      for (const [k, set] of Object.entries(draft.fields)) {
        active.fields[k] = new Set(Array.from(set || []));
      }
      active.bands = new Set(Array.from(draft.bands || []));

      closeSheets();
      applyAllFilters();
      updateFiltersConfirmState(); // will go back to disabled until another change
    });
  }

  // =========================================================
  // ✅ BANDS SHEET
  // =========================================================
  function getBandOptionsFromAll() {
    // we support either:
    // - Band IMG / Band Image (path)
    // - Band / Band Name (string)
    // if you have both, we show the image if it looks like an image path
    const map = new Map(); // key -> {key,label,img}

    ALL.forEach((r) => {
      const key = bandKeyFromRow(r);
      if (!key) return;

      const imgRaw = r["Band IMG"] || r["Band Image"] || r["Band Art"] || "";
      const img = normalizeIconPath(imgRaw);
      const labelRaw = r["Band"] || r["Band Name"] || r["Band Key"] || r["Band Art"] || imgRaw || "";
      const label = (labelRaw || "").toString().trim() || key;

      if (!map.has(key)) map.set(key, { key, label, img });
      else {
        // if existing has no img but this one does, keep it
        const cur = map.get(key);
        if (cur && !cur.img && img) cur.img = img;
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }

  function renderBandsSheet() {
    if (!bandsOptions) return;

    const opts = getBandOptionsFromAll();

    if (!opts.length) {
      bandsOptions.innerHTML = `
        <div style="padding:14px 4px;color:rgba(15,26,44,.60);font:600 14px/1.3 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
          No band art found for this brand in the sheet.
        </div>
      `;
      return;
    }

    bandsOptions.innerHTML = opts
      .map((o) => {
        const checked = draft.bands.has(o.key);
        const hasImg = o.img && /\.(svg|png|jpg|jpeg|webp)$/i.test(o.img);

        return `
          <div class="band-row" data-band="${escapeAttr(o.key)}">
            <div class="band-art">
              ${
                hasImg
                  ? `<img src="${escapeAttr(o.img)}" alt="${escapeAttr(o.label)}"
                       onerror="this.onerror=null; this.style.display='none';" />`
                  : `<div style="width:100%;height:100%;display:grid;place-items:center;color:rgba(15,26,44,.55);font:700 14px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;">
                       ${escapeHTML(o.label)}
                     </div>`
              }
            </div>

            <div class="band-meta">
              <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                          font:700 14px/1.2 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#0f1a2c;">
                ${escapeHTML(o.label)}
              </div>
              <input class="band-check" type="checkbox" ${checked ? "checked" : ""} />
            </div>
          </div>
        `;
      })
      .join("");

    // click toggles checkbox + draft
    bandsOptions.onclick = (e) => {
      const row = e.target.closest("[data-band]");
      if (!row) return;

      const key = row.getAttribute("data-band") || "";
      if (!key) return;

      const cb = row.querySelector("input.band-check");
      const willOn = !(cb && cb.checked);

      if (willOn) draft.bands.add(key);
      else draft.bands.delete(key);

      if (cb) cb.checked = willOn;

      updateBandsConfirmState();
      updateFiltersConfirmState();
    };
  }

  function updateBandsConfirmState() {
    if (!bandsConfirm) return;
    // allow confirm only if it differs from active
    const changed = didDraftChange();
    bandsConfirm.disabled = !changed;
  }

  function initBandsUI() {
    bandsConfirm?.addEventListener("click", () => {
      // apply draft -> active
      active.bands = new Set(Array.from(draft.bands || []));
      closeSheets();
      applyAllFilters();
      updateBandsConfirmState();
    });
  }

  // =========================================================
  // ✅ Applied chips row (under controls)
  // =========================================================
  function renderAppliedChips() {
    if (!appliedWrap || !appliedRow) return;

    const chips = [];

    // wrapper chip
    if (wrapperState !== "all") chips.push({ label: wrapperState.toUpperCase(), kind: "wrapper", key: wrapperState });

    // fields chips
    for (const [field, set] of Object.entries(active.fields)) {
      if (!set || !set.size) continue;
      const n = set.size;
      chips.push({ label: `${field}: ${n}`, kind: "field", key: field });
    }

    // bands chip
    if (active.bands && active.bands.size) chips.push({ label: `Bands: ${active.bands.size}`, kind: "bands", key: "bands" });

    if (!chips.length) {
      appliedWrap.hidden = true;
      appliedRow.innerHTML = "";
      return;
    }

    appliedWrap.hidden = false;
    appliedRow.innerHTML = chips
      .map((c) => {
        return `
          <button type="button"
                  class="applied-chip"
                  data-chip-kind="${escapeAttr(c.kind)}"
                  data-chip-key="${escapeAttr(c.key)}"
                  style="
                    border:none;
                    background:rgba(255,255,255,.10);
                    color:rgba(255,255,255,.92);
                    font:800 12px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
                    padding:10px 12px;
                    border-radius:999px;
                    margin-right:8px;
                    cursor:pointer;
                  ">
            ${escapeHTML(c.label)} <span style="opacity:.75;margin-left:6px;">×</span>
          </button>
        `;
      })
      .join("");

    appliedRow.onclick = (e) => {
      const chip = e.target.closest("[data-chip-kind]");
      if (!chip) return;

      const kind = chip.getAttribute("data-chip-kind") || "";
      const key = chip.getAttribute("data-chip-key") || "";

      if (kind === "wrapper") {
        setWrapperState("all");
        return;
      }
      if (kind === "field" && key && active.fields[key]) {
        active.fields[key].clear();
        applyAllFilters();
        return;
      }
      if (kind === "bands") {
        active.bands.clear();
        applyAllFilters();
        return;
      }
    };
  }

  // =========================================================
  // ✅ CIGAR DETAIL POPUP
  // =========================================================
  let detailOverlay = null;
  let detailSheet = null;

  function ensureCigarDetailModal() {
    if (detailOverlay && detailSheet) return;

    // If brand.html already includes a modal overlay, reuse it (prevents duplicates)
    const existingOverlay = $("#cigarDetailOverlay") || $(".cigar-detail-overlay");
    const existingSheet = existingOverlay ? existingOverlay.querySelector(".cigar-detail-sheet") : null;

    if (existingOverlay && existingSheet) {
      detailOverlay = existingOverlay;
      detailSheet = existingSheet;
      detailOverlay.classList.remove("open");
      detailOverlay.setAttribute("aria-hidden", "true");
      return;
    }

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

  function renderKV(k, v) {
    const vv = (v || "").toString().trim() || "—";
    return `
      <div class="cd-kv">
        <div class="k">${escapeHTML(k)}</div>
        <div class="v">${escapeHTML(vv)}</div>
      </div>
    `;
  }

  function openCigarDetail(row) {
    ensureCigarDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = (row.Brand || getBrandQueryRaw() || "Brand").toString().trim();
    const cigarName = buildDisplayName(row);

    const rg = row.RG || row["Ring"] || "";
    const len = row.Length || "";
    const strength = row.Strength || "";
    const vitola = row.Vitola || "";
    const shape = row.Shape || "";
    const wrapper = row.Wrapper || row["Wrapper Type"] || row["Wrapper Country"] || "";
    const binder = row.Binder || row["Binder Type"] || "";
    const filler = row.Filler || row["Filler Type"] || "";
    const origin = row.Origin || row["Country of Origin"] || row["Country"] || "";
    const shade = row["Wrapper Shade"] || row.Shade || "";

    const cigarCands = resolveCigarImageCandidates(row);

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>

      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${escapeHTML(brand)}</div>
            <div class="cd-name">${escapeHTML(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            <img data-detail-brand-icon alt="">
          </div>
        </div>

        <div class="cd-main">
          <div class="cd-img">
            <div data-cigar-placeholder style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
              ${cigarPlaceholderSVG()}
            </div>
            <img class="cigar-detail-stick" data-detail-cigar-img alt="" style="display:none;">
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat">
                <div class="k">RING</div>
                <div class="v">${escapeHTML(String(rg || ""))}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${escapeHTML(String(len || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${escapeHTML(String(shape || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${escapeHTML(String(vitola || ""))}</div>
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
              <button type="button" class="cd-btn" disabled>COMPARE TO</button>
              <button type="button" class="cd-btn is-live" data-cd-action="add">ADD TO BILL</button>
              <button type="button" class="cd-btn" disabled>EDIT IN HUB</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Brand icon in detail popup (same as page brand icon)
    const brandImg = detailSheet.querySelector("img[data-detail-brand-icon]");
    if (brandImg) {
      if (BRAND_ICON_CANDS?.length) loadFirstWorkingImage(brandImg, BRAND_ICON_CANDS, "");
      else brandImg.src = cartBrandIcon(row);
    }

    // Cigar image load chain + placeholder swap
    const ph = detailSheet.querySelector("[data-cigar-placeholder]");
    const cigarImg = detailSheet.querySelector("img[data-detail-cigar-img]");
    if (cigarImg) {
      const showPlaceholder = () => {
        if (ph) ph.style.display = "flex";
        cigarImg.style.display = "none";
      };
      const showImage = () => {
        if (ph) ph.style.display = "none";
        cigarImg.style.display = "block";
      };

      if (!cigarCands.length) {
        showPlaceholder();
      } else {
        let idx = 0;
        const tryNext = () => {
          if (idx >= cigarCands.length) {
            showPlaceholder();
            return;
          }
          cigarImg.onerror = () => {
            idx++;
            tryNext();
          };
          cigarImg.onload = () => showImage();
          cigarImg.src = cigarCands[idx];
        };
        tryNext();
      }
    }

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeCigarDetail);

    detailSheet.querySelector('[data-cd-action="add"]')?.addEventListener("click", () => {
      window.CigarOSCart?.add({
        id: row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`,
        name: buildDisplayName(row),
        brand: row.Brand,
        category: "Cigars",
        sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
        price: toNum(row.MSRP),
        img: cartBrandIcon(row), // ✅ invoice icon
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

  // ---------- init ----------
  function initBackButton() {
    if (!backBtn) return;
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.history.length > 1) return window.history.back();
      window.location.href = "/pos/cigars/";
    });
  }

  function computePriceRangeFromAll() {
    if (!ALL.length) {
      PRICE_MIN = 0;
      PRICE_MAX = 0;
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    ALL.forEach((r) => {
      const n = toNum(r.MSRP);
      if (!Number.isFinite(n)) return;
      if (n < min) min = n;
      if (n > max) max = n;
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;

    const roundDown = (x) => Math.floor(x * 4) / 4;
    const roundUp = (x) => Math.ceil(x * 4) / 4;

    PRICE_MIN = roundDown(min);
    PRICE_MAX = roundUp(max);

    active.priceMin = PRICE_MIN;
    active.priceMax = PRICE_MAX;
  }

  async function load() {
    const brandQuery = getBrandQueryRaw();
    if (!brandQuery) {
      setStatus("Missing brand.");
      return;
    }

    setStatus("Loading…");

    const url = `${CSV_URL}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    ALL = table.filter((r) => brandMatchesRow(brandQuery, r));
    if (!ALL.length) {
      setStatus("No cigars found for this brand.");
      return;
    }

    applyBrandHeader(ALL[0]);
    computePriceRangeFromAll();

    setStatus("");
    applyAllFilters();
  }

  function init() {
    initBackButton();
    initWrapperSeg();
    initListDelegation();

    initSheetCloseHandlers();
    initFiltersUI();
    initBandsUI();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
