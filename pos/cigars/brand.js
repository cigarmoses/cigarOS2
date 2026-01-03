/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Updates in this version (adds your “cigar detail img” popup):
   - Clicking the LEFT “info zone” of a row (icon → divider before MSRP) opens the big detail popup
   - Popup size matches your yellow mock: large sheet with gaps top/bottom + rounded corners
   - Does NOT interfere with MSRP area or green + button
   - Uses existing sheet/backdrop system if present, but safely injects its own detail sheet + styles
   - No follow-up required: drop-in replacement for this file
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

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  // wrapper toggle
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-switch");

  // applied filters row under controls
  const brandAppliedWrap = $("#brand-applied");
  const brandAppliedRow = $("#brand-applied-row");

  // Sheets
  const backdrop = $("#sheet-backdrop");

  const sheetFilters = $("#sheet-filters");
  const filtersConfirm = $("#filters-confirm");
  const filtersBack = $("#filters-back");
  const filtersTitle = $("#filters-title");

  const filtersHome = $("#filters-home");
  const filtersDetail = $("#filters-detail");
  const filtersSearch = $("#filters-search");
  const filtersList = $("#filters-list");

  const filtersAppliedWrap = $("#filters-applied");
  const filtersAppliedRow = $("#filters-applied-row");

  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // ---------- State ----------
  let ALL = [];
  let VIEW = [];

  // lookup for the currently rendered list (for fast open-detail)
  let VIEW_BY_ID = Object.create(null);

  // Multi-select field filters (Sets)
  let activeFilters = {}; // { "Vitola": Set(["robusto"]) ... }
  let pendingFilters = {};

  // Boolean toggles (single on/off)
  let activeToggles = {
    Flavored: false,
    Tubo: false,
    Tin: false,
    "Box-Pressed": false,
    Pack: false,
    Barber: false,
  };
  let pendingToggles = { ...activeToggles };

  // Band filters
  let pendingBands = new Set();
  let activeBands = new Set();

  let wrapperState = "all"; // maduro | natural | all

  // Filters popup view state
  let filtersMode = "home"; // home | detail
  let currentField = ""; // which pill opened (e.g., "Vitola")
  let currentFieldValues = [];

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const normKeepCase = (s) => (s || "").toString().trim();

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

    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/^\/img\/icons\/brands\/[a-z0-9]\/+/i, "/img/icons/brands/");
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function bestIconForRow(row) {
    const raw = row["Cigar IMG"] || row["Brand IMG"] || row["Manufacturer IMG"] || "";
    return normalizeIconPath(raw);
  }

  function bestBrandHeaderIcon(firstRow) {
    const raw = firstRow?.["Brand IMG"] || firstRow?.["Manufacturer IMG"] || "";
    const primary = normalizeIconPath(raw);
    if (primary) return primary;
    return bestIconForRow(firstRow || {});
  }

  function applyBrandHeader(brandName, firstRow) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    if (brandIconWrap) {
      const src = bestBrandHeaderIcon(firstRow);
      if (!src) {
        brandIconWrap.innerHTML = "";
        return;
      }
      brandIconWrap.innerHTML = `<img src="${escapeAttr(src)}" alt="" />`;
    }
  }

  // ---------- CSV parsing ----------
  function parseCSV(text) {
    const rows = [];
    let i = 0,
      field = "",
      row = [],
      inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        if (c === '"') {
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (c === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
          continue;
        }
        if (c === "\r") {
          i++;
          continue;
        }
        field += c;
        i++;
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

  // ---------- DETAIL POPUP (inject sheet + styles, open/close, render) ----------
  const DETAIL_SHEET_ID = "sheet-detail";
  const DETAIL_STYLE_ID = "brand-detail-sheet-styles";
  let detailSheetEl = null;

  function injectDetailStylesOnce() {
    if (document.getElementById(DETAIL_STYLE_ID)) return;

    const css = `
      /* ===== Cigar Detail Sheet (injected) ===== */
      #${DETAIL_SHEET_ID}.sheet {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px 16px; /* gap like your yellow mock */
        background: rgba(0,0,0,0.22);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
      }
      #${DETAIL_SHEET_ID}[hidden] { display: none !important; }

      #${DETAIL_SHEET_ID} .detail-shell {
        width: min(560px, 94vw);
        height: min(840px, 86vh);
        border-radius: 28px;
        overflow: hidden;
        position: relative;
        background: rgba(188,167,113,0.35); /* warm tinted sheet */
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 24px 80px rgba(0,0,0,0.35);
      }
      #${DETAIL_SHEET_ID} .detail-close {
        position: absolute;
        top: 14px;
        left: 12px;
        width: 42px;
        height: 42px;
        border: none;
        border-radius: 14px;
        background: rgba(255,255,255,0.14);
        color: rgba(255,255,255,0.92);
        display: grid;
        place-items: center;
        cursor: pointer;
        z-index: 2;
      }
      #${DETAIL_SHEET_ID} .detail-close:active { transform: scale(0.98); }

      #${DETAIL_SHEET_ID} .detail-body {
        height: 100%;
        overflow: auto;
        padding: 62px 18px 18px;
      }

      /* White card inside */
      #${DETAIL_SHEET_ID} .detail-card {
        background: rgba(255,255,255,0.92);
        border-radius: 24px;
        padding: 18px;
      }

      /* Header */
      #${DETAIL_SHEET_ID} .detail-header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }
      #${DETAIL_SHEET_ID} .detail-brand {
        font-size: 36px;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      #${DETAIL_SHEET_ID} .detail-name {
        margin-top: 4px;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 500;
        color: rgba(15,26,44,0.6);
      }
      #${DETAIL_SHEET_ID} .detail-brandicon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: rgba(0,0,0,0.06);
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      #${DETAIL_SHEET_ID} .detail-brandicon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* Grid */
      #${DETAIL_SHEET_ID} .detail-grid {
        display: grid;
        grid-template-columns: 0.9fr 1.1fr;
        gap: 14px;
        align-items: start;
      }
      #${DETAIL_SHEET_ID} .detail-imgwrap {
        background: rgba(0,0,0,0.04);
        border-radius: 20px;
        padding: 12px;
        display: grid;
        place-items: center;
      }
      #${DETAIL_SHEET_ID} .detail-imgwrap img {
        width: 100%;
        height: auto;
        max-height: 560px;
        object-fit: contain;
        border-radius: 14px;
      }

      /* Pills */
      #${DETAIL_SHEET_ID} .detail-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      #${DETAIL_SHEET_ID} .pill {
        background: rgba(0,0,0,0.04);
        border-radius: 18px;
        padding: 12px;
        text-align: center;
      }
      #${DETAIL_SHEET_ID} .pill .k {
        font-size: 11px;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: rgba(15,26,44,0.45);
      }
      #${DETAIL_SHEET_ID} .pill .v {
        margin-top: 4px;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: rgba(15,26,44,0.92);
      }
      #${DETAIL_SHEET_ID} .pill.small .v {
        font-size: 20px;
        font-weight: 700;
      }

      /* Blocks */
      #${DETAIL_SHEET_ID} .block {
        grid-column: 1 / -1;
        background: rgba(0,0,0,0.04);
        border-radius: 18px;
        padding: 12px;
      }
      #${DETAIL_SHEET_ID} .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 2px;
        border-top: 1px solid rgba(0,0,0,0.06);
      }
      #${DETAIL_SHEET_ID} .row:first-child { border-top: none; }
      #${DETAIL_SHEET_ID} .row .k {
        font-size: 12px;
        letter-spacing: 0.08em;
        font-weight: 800;
        color: rgba(15,26,44,0.45);
      }
      #${DETAIL_SHEET_ID} .row .v {
        font-size: 18px;
        font-weight: 700;
        color: rgba(15,26,44,0.92);
        text-align: right;
      }

      @media (max-width: 420px) {
        #${DETAIL_SHEET_ID} .detail-grid { grid-template-columns: 1fr; }
        #${DETAIL_SHEET_ID} .detail-brand { font-size: 34px; }
      }
    `;

    const style = document.createElement("style");
    style.id = DETAIL_STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureDetailSheet() {
    if (detailSheetEl && document.body.contains(detailSheetEl)) return detailSheetEl;

    injectDetailStylesOnce();

    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.id = DETAIL_SHEET_ID;
    sheet.setAttribute("hidden", "");

    sheet.innerHTML = `
      <div class="detail-shell" role="dialog" aria-modal="true" aria-label="Cigar details">
        <button type="button" class="detail-close" data-detail-close aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="detail-body" id="detail-body"></div>
      </div>
    `;

    document.body.appendChild(sheet);
    detailSheetEl = sheet;

    // close handlers
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet) closeDetailSheet();
    });
    sheet.querySelector("[data-detail-close]")?.addEventListener("click", closeDetailSheet);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDetailSheet();
    });

    return sheet;
  }

  function openDetailSheet() {
    const sheet = ensureDetailSheet();
    // use your existing backdrop if present, else sheet already has its own dim background
    if (backdrop) backdrop.removeAttribute("hidden");
    sheet.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
    document.body.style.overflow = "hidden";
  }

  function closeDetailSheet() {
    const sheet = ensureDetailSheet();
    sheet.setAttribute("hidden", "");

    // keep backdrop logic compatible with your other sheets
    const anyOpen =
      !$("#sheet-filters")?.hasAttribute("hidden") ||
      !$("#sheet-bands")?.hasAttribute("hidden") ||
      !$("#sheet-receipt")?.hasAttribute("hidden");

    if (backdrop && !anyOpen) backdrop.setAttribute("hidden", "");
    document.body.classList.remove("pos-modal-open");
    document.body.style.overflow = "";
  }

  function guessDetailCigarImage(row) {
    // If you add a dedicated column later, it will automatically use it.
    const direct =
      row["Cigar Detail IMG"] ||
      row["Detail IMG"] ||
      row["Cigar Stick IMG"] ||
      row["Cigar Image"] ||
      "";

    const normalized = normalizeIconPath(direct);
    if (normalized) return normalized;

    // fallback: reuse cigar icon (better than blank)
    return bestIconForRow(row);
  }

  function renderDetailForRow(row) {
    const sheet = ensureDetailSheet();
    const body = sheet.querySelector("#detail-body");
    if (!body) return;

    const brand = (qp("brand") || row.Brand || "").trim();
    const brandIcon = bestBrandHeaderIcon(ALL[0] || row);

    const cigarName = (row.Cigar || "").trim();
    const lineName = (row.Line || "").trim();
    const displayName = lineName ? `${lineName} ${cigarName}`.trim() : cigarName;

    const cigarImg = guessDetailCigarImage(row);

    const ring = (row.RG || "").trim();
    const length = (row.Length || "").trim();
    const strength = (row.Strength || "").trim();
    const vitola = (row.Vitola || "").trim();

    const wrapper = (row.Wrapper || row["Wrapper Type"] || "").trim();
    const binder = (row.Binder || row["Binder Type"] || "").trim();
    const filler = (row.Filler || row["Filler Type"] || "").trim();
    const origin = (row.Origin || row["Country of Origin"] || row.Country || "").trim();
    const shade = (row["Wrapper Shade"] || row.Shade || "").trim();

    body.innerHTML = `
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <div class="detail-brand">${escapeHTML(brand || "Brand")}</div>
            <div class="detail-name">${escapeHTML(displayName || "")}</div>
          </div>
          <div class="detail-brandicon">
            ${brandIcon ? `<img src="${escapeAttr(brandIcon)}" alt="">` : ""}
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-imgwrap">
            ${cigarImg ? `<img src="${escapeAttr(cigarImg)}" alt="">` : ""}
          </div>

          <div class="detail-stats">
            <div class="pill">
              <div class="k">RING</div>
              <div class="v">${escapeHTML(ring || "—")}</div>
            </div>
            <div class="pill">
              <div class="k">LENGTH</div>
              <div class="v">${escapeHTML(length || "—")}</div>
            </div>

            <div class="pill small">
              <div class="k">STRENGTH</div>
              <div class="v">${escapeHTML(strength || "—")}</div>
            </div>
            <div class="pill small">
              <div class="k">VITOLA</div>
              <div class="v">${escapeHTML(vitola || "—")}</div>
            </div>

            <div class="block">
              <div class="row">
                <div class="k">WRAPPER</div>
                <div class="v">${escapeHTML(wrapper || "—")}</div>
              </div>
              <div class="row">
                <div class="k">BINDER</div>
                <div class="v">${escapeHTML(binder || "—")}</div>
              </div>
              <div class="row">
                <div class="k">FILLER</div>
                <div class="v">${escapeHTML(filler || "—")}</div>
              </div>
            </div>

            <div class="block">
              <div class="row">
                <div class="k">ORIGIN</div>
                <div class="v">${escapeHTML(origin || "—")}</div>
              </div>
              <div class="row">
                <div class="k">WRAPPER SHADE</div>
                <div class="v">${escapeHTML(shade || "—")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- list render ----------
  function renderList(rows) {
    if (!listEl) return;

    // rebuild lookup map each render
    VIEW_BY_ID = Object.create(null);

    if (!rows.length) {
      listEl.innerHTML = "";
      setStatus("No results.");
      return;
    }

    setStatus("");

    listEl.innerHTML = rows
      .map((row) => {
        const name = row.Cigar || "";
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));
        const icon = bestIconForRow(row);
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`;

        // store for open-detail
        VIEW_BY_ID[id] = row;

        // IMPORTANT:
        // - The clickable zone is ONLY icon + main text + divider (before MSRP).
        // - MSRP + green + remain separate (so no conflict).
        return `
          <div class="brand-row" data-id="${escapeAttr(id)}">
            <button class="row-openzone" type="button" data-open-detail aria-label="Open details">
              <img class="row-ico" src="${escapeAttr(icon)}" alt=""
                   onerror="this.style.opacity='0';this.style.pointerEvents='none';" />
              <div class="row-main">
                <div class="row-title">${escapeHTML(name)}</div>
                <div class="row-sub">${escapeHTML(sub)}</div>
              </div>
              <div class="row-divider" aria-hidden="true"></div>
            </button>

            <div class="row-price">${price}</div>
            <button class="row-add" type="button" aria-label="Add" data-add>+</button>
          </div>
        `;
      })
      .join("");

    // If your CSS doesn’t yet style row-openzone/divider, these are safe defaults:
    // (keeps it click-friendly without changing your existing look)
    injectRowOpenZoneFallbackStyles();
  }

  function injectRowOpenZoneFallbackStyles() {
    const id = "brand-row-openzone-fallback";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .brand-row { position: relative; }
      .brand-row .row-openzone{
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 14px;
        border-radius: 18px;
        width: calc(100% - 120px); /* leaves space for price/+ area */
        box-sizing: border-box;
      }
      .brand-row .row-openzone:active { transform: scale(0.99); }
      .brand-row .row-divider{
        margin-left: auto;
        width: 1px;
        height: 44px;
        background: rgba(255,255,255,0.20);
        opacity: 0.9;
      }
      .brand-row .row-price{ position: absolute; right: 56px; top: 50%; transform: translateY(-50%); }
      .brand-row .row-add{ position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }
    `;
    document.head.appendChild(style);
  }

  // ---------- SINGLE event delegation for list (prevents re-binding on every render) ----------
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
          name: row.Cigar,
          brand: row.Brand,
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: bestIconForRow(row) || "",
        });
        return;
      }

      const openBtn = e.target.closest("[data-open-detail]");
      if (openBtn) {
        const rowEl = openBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;

        renderDetailForRow(row);
        openDetailSheet();
      }
    });
  }

  // ---------- filtering ----------
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  function isTruthyToggleCell(v) {
    const s = norm(v);
    if (!s) return false;
    if (s === "0" || s === "false" || s === "no" || s === "n") return false;
    return true;
  }

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    VIEW = ALL.filter((row) => {
      // search
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      // wrapper toggle (by cigar name only)
      const cigarName = norm(row.Cigar || "");
      if (wrapperState === "maduro") {
        if (!cigarName.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        if (!cigarName.includes("natural")) return false;
      }

      // field filters (multi-select)
      for (const [field, set] of Object.entries(activeFilters)) {
        if (!set || !set.size) continue;
        const v = norm(row[field] || "");
        if (!set.has(v)) return false;
      }

      // toggles (boolean)
      for (const [tKey, on] of Object.entries(activeToggles)) {
        if (!on) continue;
        if (!isTruthyToggleCell(row[tKey])) return false;
      }

      // bands
      if (activeBands.size) {
        const src = matchBandSource(row);
        let ok = false;
        activeBands.forEach((token) => {
          if (src.includes(token)) ok = true;
        });
        if (!ok) return false;
      }

      return true;
    });

    renderList(VIEW);
    renderAppliedChipsEverywhere(); // keep chips synced
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

  // ---------- Sheets open/close ----------
  function openSheet(sheetEl) {
    if (!sheetEl) return;
    backdrop?.removeAttribute("hidden");
    sheetEl.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
  }

  function closeSheet(sheetEl) {
    if (!sheetEl) return;
    sheetEl.setAttribute("hidden", "");
    const anyOpen =
      !$("#sheet-filters")?.hasAttribute("hidden") ||
      !$("#sheet-bands")?.hasAttribute("hidden") ||
      !$("#sheet-receipt")?.hasAttribute("hidden") ||
      !(ensureDetailSheet()?.hasAttribute("hidden"));
    if (!anyOpen) backdrop?.setAttribute("hidden", "");
    document.body.classList.remove("pos-modal-open");
  }

  function closeAllSheets() {
    closeSheet(sheetFilters);
    closeSheet(sheetBands);
    const receipt = $("#sheet-receipt");
    if (receipt) closeSheet(receipt);
    closeDetailSheet();
  }

  function initSheetCloseHandlers() {
    $$("[data-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sheet = btn.closest(".sheet");
        if (sheet) closeSheet(sheet);
      });
    });

    // IMPORTANT: backdrop click should close only “native sheets”.
    // The detail sheet closes itself by clicking outside OR ESC; but we also close it here for safety.
    backdrop?.addEventListener("click", closeAllSheets);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // ---------- Filters popup data ----------
  function cloneFilterSets(obj) {
    const out = {};
    for (const [k, set] of Object.entries(obj || {})) out[k] = new Set(set ? [...set] : []);
    return out;
  }

  function uniqSorted(values) {
    const set = new Set();
    values.forEach((v) => {
      const s = normKeepCase(v);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // Wrapper shade custom order (same as cigars.js)
  const WRAPPER_SHADE_ORDER = [
    "Natural",
    "Connecticut",
    "Maduro",
    "Oscuro",
    "Connecticut Shade",
    "EMS",
    "Claro",
    "Colorado",
    "Colorado Claro",
    "Colorado Maduro",
    "Mixed",
    "Candela",
  ];

  function orderWrapperShades(values) {
    const list = uniqSorted(values);
    const seen = new Set();
    const ordered = [];

    for (const item of WRAPPER_SHADE_ORDER) {
      const match = list.find((v) => v.toLowerCase() === item.toLowerCase());
      if (match) {
        ordered.push(match);
        seen.add(match.toLowerCase());
      } else {
        ordered.push(item);
        seen.add(item.toLowerCase());
      }
    }

    for (const v of list) {
      const k = v.toLowerCase();
      if (!seen.has(k)) ordered.push(v);
    }

    return ordered;
  }

  function getValuesForField(field) {
    const vals = [];
    for (const r of ALL) {
      if (!r) continue;
      const v = r[field];
      if (v != null && v !== "") vals.push(v);
    }
    let out = uniqSorted(vals);

    if (field === "Wrapper Shade") out = orderWrapperShades(out);
    if (field === "RG") {
      out = out.sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
    }
    return out;
  }

  // ---------- Filters popup view switching ----------
  function setFiltersMode(mode) {
    filtersMode = mode;

    const isDetail = mode === "detail";
    filtersHome?.toggleAttribute("hidden", isDetail);
    filtersDetail?.toggleAttribute("hidden", !isDetail);

    filtersBack?.toggleAttribute("hidden", !isDetail);

    if (filtersTitle) filtersTitle.textContent = isDetail ? currentField || "Filters" : "Filters";
    if (!isDetail && filtersSearch) filtersSearch.value = "";
  }

  function openFiltersSheet() {
    pendingFilters = cloneFilterSets(activeFilters);
    pendingToggles = { ...activeToggles };

    syncToggleButtons();
    renderFiltersPopupAppliedChips();

    currentField = "";
    currentFieldValues = [];
    setFiltersMode("home");

    openSheet(sheetFilters);
  }

  function openDetailForField(field) {
    currentField = field;
    currentFieldValues = getValuesForField(field);

    setFiltersMode("detail");
    renderDetailList(currentFieldValues);

    setTimeout(() => filtersSearch?.focus(), 50);
  }

  function closeDetailToHome() {
    currentField = "";
    currentFieldValues = [];
    setFiltersMode("home");
    renderFiltersPopupAppliedChips();
    syncToggleButtons();
  }

  // ---------- Toggles (text + circle) ----------
  function syncToggleButtons() {
    $$("#sheet-filters .tog").forEach((btn) => {
      const key = btn.getAttribute("data-toggle-key");
      if (!key) return;
      const on = !!pendingToggles[key];
      btn.classList.toggle("is-on", on);
    });
  }

  function initToggleButtons() {
    $$("#sheet-filters .tog").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-toggle-key");
        if (!key) return;
        pendingToggles[key] = !pendingToggles[key];
        syncToggleButtons();
        activeToggles = { ...pendingToggles };
        renderAppliedChipsEverywhere();
        applyAllFilters();
      });
    });
  }

  // ---------- Detail list rendering (checkbox style) ----------
  function renderDetailList(values) {
    if (!filtersList) return;
    const field = currentField;
    if (!field) return;

    const set = pendingFilters[field] || new Set();

    filtersList.innerHTML = values
      .map((v) => {
        const label = normKeepCase(v);
        const on = set.has(norm(label));
        return `
          <div class="filters-item ${on ? "is-on" : ""}" data-val="${escapeAttr(label)}">
            <div class="label">${escapeHTML(label)}</div>
            <div class="check" aria-hidden="true"></div>
          </div>
        `;
      })
      .join("");

    $$("#sheet-filters .filters-item").forEach((row) => {
      row.addEventListener("click", () => {
        const raw = row.getAttribute("data-val") || "";
        const key = norm(raw);
        if (!key) return;

        pendingFilters[field] ||= new Set();

        if (pendingFilters[field].has(key)) {
          pendingFilters[field].delete(key);
          row.classList.remove("is-on");
        } else {
          pendingFilters[field].add(key);
          row.classList.add("is-on");
        }

        activeFilters = cloneFilterSets(pendingFilters);
        renderAppliedChipsEverywhere();
        applyAllFilters();
      });
    });
  }

  function filterDetailListBySearch() {
    const q = norm(filtersSearch?.value || "");
    const all = currentFieldValues || [];
    const filtered = !q ? all : all.filter((v) => norm(v).includes(q));
    renderDetailList(filtered);
  }

  // ---------- Applied chips (popup + main page) ----------
  function buildAppliedChipData() {
    const chips = [];

    for (const [field, set] of Object.entries(activeFilters)) {
      if (!set || !set.size) continue;
      for (const v of set.values()) {
        chips.push({
          type: "field",
          field,
          value: v,
          label: `${field}: ${v}`,
        });
      }
    }

    for (const [tKey, on] of Object.entries(activeToggles)) {
      if (!on) continue;
      const pretty =
        tKey === "Box-Pressed"
          ? "Box-pressed"
          : tKey === "Pack"
          ? "Packs"
          : tKey === "Barber"
          ? "Barberpole"
          : tKey;
      chips.push({
        type: "toggle",
        field: tKey,
        value: "true",
        label: pretty,
      });
    }

    return chips;
  }

  function removeAppliedChip(chip) {
    if (!chip) return;

    if (chip.type === "toggle") {
      activeToggles[chip.field] = false;
      pendingToggles[chip.field] = false;
      syncToggleButtons();
    } else {
      const field = chip.field;
      const v = chip.value;
      if (activeFilters[field]) {
        activeFilters[field].delete(v);
        if (activeFilters[field].size === 0) delete activeFilters[field];
      }
      if (pendingFilters[field]) {
        pendingFilters[field].delete(v);
        if (pendingFilters[field].size === 0) delete pendingFilters[field];
      }
    }

    renderAppliedChipsEverywhere();
    applyAllFilters();
  }

  function renderChipsInto(el) {
    if (!el) return;
    const chips = buildAppliedChipData();

    if (!chips.length) {
      el.innerHTML = "";
      return;
    }

    el.innerHTML = chips
      .map((c, idx) => {
        return `
          <button type="button" class="applied-chip" data-chip-idx="${idx}">
            <span class="t">${escapeHTML(c.label)}</span>
            <span class="x" aria-hidden="true">×</span>
          </button>
        `;
      })
      .join("");

    el.querySelectorAll(".applied-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-chip-idx"));
        const chipsNow = buildAppliedChipData();
        const chip = chipsNow[idx];
        removeAppliedChip(chip);
      });
    });
  }

  function renderFiltersPopupAppliedChips() {
    const chips = buildAppliedChipData();
    if (!filtersAppliedWrap || !filtersAppliedRow) return;

    if (!chips.length) {
      filtersAppliedWrap.setAttribute("hidden", "");
      filtersAppliedRow.innerHTML = "";
      return;
    }

    filtersAppliedWrap.removeAttribute("hidden");
    renderChipsInto(filtersAppliedRow);
  }

  function renderMainPageAppliedChips() {
    const chips = buildAppliedChipData();
    if (!brandAppliedWrap || !brandAppliedRow) return;

    if (!chips.length) {
      brandAppliedWrap.setAttribute("hidden", "");
      brandAppliedRow.innerHTML = "";
      return;
    }

    brandAppliedWrap.removeAttribute("hidden");
    renderChipsInto(brandAppliedRow);
  }

  function renderAppliedChipsEverywhere() {
    renderFiltersPopupAppliedChips();
    renderMainPageAppliedChips();
  }

  // ---------- Bands sheet (Padron only) ----------
  function getBandLibraryForBrand(brandKey) {
    const LIB = {
      padron: [
        { token: "1926", label: "1926", src: "/img/icons/padron1926seriebank.svg" },
        { token: "1964", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
        { token: "damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
        { token: "black series", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
        { token: "series", label: "Series", src: "/img/icons/padronseriesband.svg" },
        { token: "family reserve", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
      ],
    };

    const list = LIB[brandKey] || [];
    return list.map((x) => ({
      ...x,
      src: (x.src || "").replace("seriebank", "serieband"),
    }));
  }

  function updateBandsConfirmState() {
    if (!bandsConfirm) return;
    bandsConfirm.disabled = pendingBands.size === 0;
  }

  function renderBandsSheet() {
    if (!bandsOptions) return;

    const brand = (qp("brand") || "").trim();
    const b = norm(brand);
    const bands = getBandLibraryForBrand(b);

    pendingBands = new Set(activeBands);
    updateBandsConfirmState();

    if (!bands.length) {
      bandsOptions.innerHTML = `
        <div style="padding:10px 2px; font-size:16px; opacity:.75;">
          No bands configured for <b>${escapeHTML(brand || "this brand")}</b> yet.
        </div>
      `;
      updateBandsConfirmState();
      return;
    }

    bandsOptions.innerHTML = bands
      .map((x) => {
        const checked = pendingBands.has(x.token);
        return `
          <label class="band-row">
            <div class="band-art">
              <img src="${escapeAttr(x.src)}" alt="${escapeAttr(x.label)}"
                   onerror="this.style.opacity='0.15';" />
            </div>
            <div class="band-meta">
              <span class="band-spacer" aria-hidden="true"></span>
              <span class="band-name">${escapeHTML(x.label)}</span>
              <input type="checkbox" class="band-check" data-token="${escapeAttr(x.token)}" ${
                checked ? "checked" : ""
              } />
            </div>
          </label>
        `;
      })
      .join("");

    bandsOptions.querySelectorAll(".band-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const token = cb.getAttribute("data-token");
        if (!token) return;

        if (cb.checked) pendingBands.add(token);
        else pendingBands.delete(token);

        updateBandsConfirmState();
      });
    });

    updateBandsConfirmState();
  }

  function openBandsSheet() {
    renderBandsSheet();
    openSheet(sheetBands);
  }

  // ---------- load ----------
  async function load() {
    const brand = (qp("brand") || "").trim();
    if (!brand) {
      setStatus("Missing brand.");
      return;
    }

    setStatus("Loading…");

    const url = `${CSV_URL}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    const brandNorm = norm(brand);
    ALL = table.filter((r) => norm(r.Brand) === brandNorm);
    if (!ALL.length) ALL = table.filter((r) => norm(r["Brand aka"]) === brandNorm);

    applyBrandHeader(brand, ALL[0]);
    applyAllFilters();
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

  function initFilterPillButtons() {
    $$("#sheet-filters [data-open-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const field = btn.getAttribute("data-open-filter");
        if (!field) return;
        openDetailForField(field);
      });
    });
  }

  function initButtons() {
    btnFilters?.addEventListener("click", (e) => {
      e.preventDefault();
      openFiltersSheet();
    });

    btnBands?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
    });

    filtersBack?.addEventListener("click", () => {
      closeDetailToHome();
    });

    filtersSearch?.addEventListener("input", filterDetailListBySearch);

    filtersConfirm?.addEventListener("click", () => {
      closeSheet(sheetFilters);
    });

    bandsConfirm?.addEventListener("click", () => {
      if (bandsConfirm.disabled) return;
      activeBands = new Set(pendingBands);
      closeSheet(sheetBands);
      applyAllFilters();
    });
  }

  function init() {
    initBackButton();
    initButtons();
    initSheetCloseHandlers();
    initWrapperSeg();

    initFilterPillButtons();
    initToggleButtons();

    // list click delegation (detail popup + add)
    initListDelegation();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();u
