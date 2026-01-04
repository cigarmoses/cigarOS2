/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Filters Sheet v3 (your locked spec)
   - Bottom sheet slides up/down
   - Price Range under title
   - 6 accordion sections with + / −
   - Pills grid (4 per row)
   - Only Show = single-select radio grid (2x3) with circle left
   - Apply Filters button: light grey default, iOS blue when changed/selected
   - 3-color system: blue selected, grey/white text
   - SF Pro Display + tight tracking (-0.02em)
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

  // applied filters row under controls (optional; kept)
  const brandAppliedWrap = $("#brand-applied");
  const brandAppliedRow = $("#brand-applied-row");

  // Backdrop + Sheets
  const backdrop = $("#sheet-backdrop");
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // We will REBUILD the filters sheet UI inside #sheet-filters
  const sheetFilters = $("#sheet-filters");

  // ---------- State ----------
  let ALL = [];
  let VIEW = [];
  let VIEW_BY_ID = Object.create(null);

  // Band filters
  let pendingBands = new Set();
  let activeBands = new Set();

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
    onlyShow: "", // one of: Barberpole, Box-Pressed, Flavored, Tins, Packs, Tubos
  };

  // Filters (PENDING = in open sheet)
  let pending = null;

  // Accordion open section key (pending UI state only)
  let openSection = ""; // "Vitola" | "RG" | "Length" | "Wrapper Shade" | "Strength" | "Shape"

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

  // ---------- LIST render ----------
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
        const name = row.Cigar || "";
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));
        const icon = bestIconForRow(row);
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`;

        VIEW_BY_ID[id] = row;

        return `
          <div class="brand-row" data-id="${escapeAttr(id)}">
            <img class="row-ico" src="${escapeAttr(icon)}" alt=""
                 onerror="this.style.opacity='0';this.style.pointerEvents='none';" />

            <div class="row-main" data-open>
              <div class="row-title">${escapeHTML(name)}</div>
              <div class="row-sub">${escapeHTML(sub)}</div>
            </div>

            <div class="row-price">${price}</div>
            <button class="row-add" type="button" aria-label="Add" data-add>+</button>

            <!-- tap zone: icon -> divider (before MSRP) -->
            <button class="row-openhit" type="button" aria-label="Open details" data-open-detail></button>
          </div>
        `;
      })
      .join("");

    injectRowOpenHitStylesOnce();
  }

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
        right: 132px; /* keeps MSRP/+ clickable */
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

  // ---------- list delegation ----------
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
        // Your detail popup is already working in your current build.
        // Keep existing behavior: if you’re rendering details elsewhere, hook it here.
        // For now: do nothing to avoid breaking your current working detail sheet.
        // (If you want me to wire this to your detail overlay, say so and I’ll connect it.)
      }
    });
  }

  // ---------- filtering helpers ----------
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  function isTruthyCell(v) {
    const s = norm(v);
    if (!s) return false;
    if (s === "0" || s === "false" || s === "no" || s === "n") return false;
    return true;
  }

  function onlyShowPass(row) {
    const key = active.onlyShow;
    if (!key) return true;

    if (key === "Barberpole") return isTruthyCell(row.Barber);
    if (key === "Box-Pressed") return isTruthyCell(row["Box-Pressed"]);
    if (key === "Flavored") return isTruthyCell(row.Flavored);
    if (key === "Tins") return isTruthyCell(row.Tin);
    if (key === "Packs") return isTruthyCell(row.Pack);
    if (key === "Tubos") return isTruthyCell(row.Tubo);

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

      // price range
      const msrp = toNum(row.MSRP);
      if (active.priceMin != null && msrp < active.priceMin) return false;
      if (active.priceMax != null && msrp > active.priceMax) return false;

      // multi-select fields
      for (const [field, set] of Object.entries(active.fields)) {
        if (!set || !set.size) continue;

        const cell = row[field] ?? "";
        const k = norm(cell);
        if (!set.has(k)) return false;
      }

      // only show radio
      if (!onlyShowPass(row)) return false;

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
    renderMainAppliedChips();
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

  // ---------- backdrop + sheet open/close ----------
  function openBackdrop() {
    backdrop?.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
  }
  function closeBackdropIfNoSheets() {
    const anyOpen =
      (sheetFilters && sheetFilters.classList.contains("is-open")) ||
      !(sheetBands?.hasAttribute("hidden")) ||
      !(($("#sheet-receipt") || null)?.hasAttribute?.("hidden"));
    if (!anyOpen) backdrop?.setAttribute("hidden", "");
    document.body.classList.remove("pos-modal-open");
  }

  // ---------- Filters data: values + ordering ----------
  const ORDER_VITOLA = [
    "Robusto",
    "Toro",
    "Gordo",
    "Churchill",
    "Corona",
    "Corona Extra",
    "Corona Gorda",
    "Lancero",
    "Pyramid",
    "Belicoso",
    "Gigante",
  ];

  const ORDER_SHADE = [
    "Natural",
    "Connecticut",
    "Colorado",
    "Colorado Maduro",
    "Maduro",
    "Oscuro",
    "Candela",
    "EMS",
  ];

  const ORDER_STRENGTH = ["Mellow", "Mild", "Medium", "Medium-Full", "Full"];

  const ORDER_SHAPE = ["Parejo", "Perfecto", "Pyramid", "Torpedo", "Figurado", "Belicoso"];

  function uniqSorted(list) {
    const seen = new Map(); // norm -> display
    list.forEach((v) => {
      const d = normKeepCase(v);
      if (!d) return;
      const k = norm(d);
      if (!seen.has(k)) seen.set(k, d);
    });
    return Array.from(seen.entries()).map(([k, d]) => ({ k, d }));
  }

  function orderedWithAppend(values, preferredOrder) {
    const map = new Map(values.map((x) => [x.k, x.d]));

    const out = [];
    const used = new Set();

    preferredOrder.forEach((label) => {
      const k = norm(label);
      if (map.has(k)) {
        out.push({ k, d: map.get(k) });
        used.add(k);
      }
    });

    // append any extras (alpha by display)
    const extras = values
      .filter((x) => !used.has(x.k))
      .sort((a, b) => a.d.localeCompare(b.d));
    out.push(...extras);

    return out;
  }

  function getFieldValues(field) {
    const vals = [];
    ALL.forEach((r) => {
      const v = r[field];
      if (v != null && `${v}`.trim() !== "") vals.push(v);
    });

    let base = uniqSorted(vals);

    if (field === "Vitola") return orderedWithAppend(base, ORDER_VITOLA);
    if (field === "Wrapper Shade") return orderedWithAppend(base, ORDER_SHADE);
    if (field === "Strength") return orderedWithAppend(base, ORDER_STRENGTH);
    if (field === "Shape") return orderedWithAppend(base, ORDER_SHAPE);

    if (field === "Length") {
      // numeric descending, display as-is
      return base.sort((a, b) => (Number(b.d) || 0) - (Number(a.d) || 0));
    }
    if (field === "RG") {
      // numeric ascending
      return base.sort((a, b) => (Number(a.d) || 0) - (Number(b.d) || 0));
    }

    return base.sort((a, b) => a.d.localeCompare(b.d));
  }

  // ---------- Filters sheet: build + render ----------
  const FILTERS_STYLE_ID = "brand-filters-sheet-v3-style";

  function injectFiltersSheetStylesOnce() {
    if (document.getElementById(FILTERS_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = FILTERS_STYLE_ID;
    style.textContent = `
      /* ===== Filters Bottom Sheet v3 ===== */
      #sheet-filters{
        position: fixed;
        left: 0; right: 0; bottom: 0;
        margin: 0 auto;
        width: min(720px, 100vw);
        height: min(86vh, 820px);
        border-radius: 34px 34px 0 0;
        background:
          radial-gradient(900px 520px at 20% 10%, rgba(65,110,200,.22), transparent 55%),
          linear-gradient(180deg, rgba(11,28,58,.98), rgba(7,16,36,.98));
        color: rgba(255,255,255,.92);
        box-shadow: 0 -24px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08);
        z-index: 110;
        transform: translateY(110%);
        transition: transform .28s ease;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
        letter-spacing: -0.02em;
      }
      #sheet-filters.is-open{ transform: translateY(0); }
      #sheet-filters[hidden]{ display:none !important; }

      #sheet-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 100;
      }

      .fsh-head{
        position: relative;
        padding: 10px 18px 8px;
      }
      .fsh-grab{
        width: 42px; height: 5px;
        border-radius: 999px;
        background: rgba(255,255,255,.22);
        margin: 6px auto 10px;
      }
      .fsh-titleRow{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 6px;
      }
      .fsh-title{
        font-size: 22px;
        font-weight: 600;
        color: rgba(255,255,255,.92);
      }
      .fsh-x{
        width: 34px; height: 34px;
        border-radius: 999px;
        border: none;
        background: rgba(255,255,255,.10);
        color: rgba(255,255,255,.92);
        font-size: 20px;
        font-weight: 600;
        line-height: 1;
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .fsh-x:active{ transform: scale(.98); }

      .fsh-body{
        flex: 1 1 auto;
        overflow: auto;
        padding: 10px 18px 14px;
      }

      .fsh-secTitle{
        margin: 6px 0 10px;
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,.72);
      }

      /* Price range */
      .priceBox{
        border-radius: 18px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.12);
        padding: 12px 12px 10px;
      }
      .priceTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .priceLbl{
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,.78);
      }
      .priceVal{
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,.85);
      }
      .rangeWrap{
        display:grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .rangeRow{
        display:flex;
        gap: 10px;
        align-items:center;
      }
      .rangeRow input[type="range"]{
        width: 100%;
        accent-color: var(--accent, #0f7aff);
      }

      /* Accordion rows */
      .accList{
        margin-top: 12px;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.06);
      }
      .accRow{
        padding: 14px 14px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 12px;
        border-top: 1px solid rgba(255,255,255,.10);
        cursor: pointer;
        user-select:none;
      }
      .accRow:first-child{ border-top: none; }
      .accLeft{
        display:flex;
        align-items:center;
        gap: 10px;
        min-width: 0;
      }
      .accPlus{
        width: 22px;
        font-size: 18px;
        font-weight: 600;
        color: rgba(255,255,255,.82);
        line-height: 1;
        text-align:center;
      }
      .accLabel{
        font-size: 16px;
        font-weight: 600;
        color: rgba(255,255,255,.90);
      }
      .accMeta{
        font-size: 13px;
        font-weight: 500;
        color: rgba(255,255,255,.55);
        white-space: nowrap;
      }

      .accPanel{
        display: none;
        padding: 12px 14px 14px;
        border-top: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.10);
      }
      .accPanel.is-open{ display:block; }

      /* Pills grid (4 per row) */
      .pillGrid{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .optPill{
        height: 34px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.07);
        color: rgba(255,255,255,.82);
        font-size: 13px;
        font-weight: 500;
        letter-spacing: -0.02em;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 0 10px;
        cursor:pointer;
        -webkit-tap-highlight-color: transparent;
        user-select:none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .optPill.is-on{
        background: var(--accent, #0f7aff);
        border-color: var(--accent, #0f7aff);
        color: #fff;
      }
      .optPill:active{ transform: scale(.99); }

      /* Only show radio grid */
      .radioGrid{
        border-radius: 18px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.10);
        padding: 10px 12px 12px;
      }
      .radioTitle{
        font-size: 13px;
        font-weight: 600;
        color: rgba(255,255,255,.72);
        margin-bottom: 10px;
      }
      .radioRows{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px 10px;
      }
      .radioOpt{
        display:flex;
        align-items:center;
        gap: 8px;
        height: 34px;
        padding: 0 8px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.82);
        font-size: 12px;
        font-weight: 500;
        letter-spacing: -0.02em;
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      .radioDot{
        width: 14px; height: 14px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,.40);
        position: relative;
        flex: 0 0 auto;
      }
      .radioOpt.is-on .radioDot{
        border-color: var(--accent, #0f7aff);
      }
      .radioOpt.is-on .radioDot::after{
        content:"";
        position:absolute;
        inset: 3px;
        border-radius: 999px;
        background: var(--accent, #0f7aff);
      }

      /* Footer apply button */
      .fsh-foot{
        padding: 12px 18px 18px;
        border-top: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.10);
      }
      .applyBtn{
        width: 100%;
        height: 46px;
        border-radius: 22px;
        border: none;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.02em;
        cursor: pointer;
      }
      .applyBtn.is-off{
        background: rgba(255,255,255,.22);
        color: rgba(255,255,255,.55);
      }
      .applyBtn.is-on{
        background: var(--accent, #0f7aff);
        color: #fff;
      }
      .applyBtn:active{ transform: scale(.99); }

      @media (max-width: 420px){
        .pillGrid{ grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .accLabel{ font-size: 15px; }
      }
    `;
    document.head.appendChild(style);
  }

  function cloneActiveToPending() {
    const p = {
      priceMin: active.priceMin,
      priceMax: active.priceMax,
      fields: {},
      onlyShow: active.onlyShow,
    };
    for (const [k, set] of Object.entries(active.fields)) {
      p.fields[k] = new Set(set ? [...set] : []);
    }
    return p;
  }

  function pendingIsDefaultOrSameAsActive() {
    if (!pending) return true;

    const aMin = active.priceMin ?? null;
    const aMax = active.priceMax ?? null;
    const pMin = pending.priceMin ?? null;
    const pMax = pending.priceMax ?? null;

    if (aMin !== pMin) return false;
    if (aMax !== pMax) return false;
    if ((active.onlyShow || "") !== (pending.onlyShow || "")) return false;

    for (const key of Object.keys(active.fields)) {
      const aSet = active.fields[key] || new Set();
      const pSet = pending.fields[key] || new Set();
      if (aSet.size !== pSet.size) return false;
      for (const v of aSet) if (!pSet.has(v)) return false;
    }
    return true;
  }

  function pendingHasAnySelection() {
    if (!pending) return false;
    if (pending.onlyShow) return true;
    if (pending.priceMin != null || pending.priceMax != null) {
      // If price range differs from full range, count as selection
      if (PRICE_MIN !== PRICE_MAX) {
        const min = pending.priceMin ?? PRICE_MIN;
        const max = pending.priceMax ?? PRICE_MAX;
        if (min !== PRICE_MIN || max !== PRICE_MAX) return true;
      }
    }
    for (const set of Object.values(pending.fields)) {
      if (set && set.size) return true;
    }
    return false;
  }

  function setFiltersSheetOpen(open) {
    if (!sheetFilters) return;
    if (open) {
      sheetFilters.removeAttribute("hidden");
      requestAnimationFrame(() => sheetFilters.classList.add("is-open"));
      openBackdrop();
    } else {
      sheetFilters.classList.remove("is-open");
      // allow transition to finish
      setTimeout(() => {
        sheetFilters.setAttribute("hidden", "");
        closeBackdropIfNoSheets();
      }, 220);
    }
  }

  function buildSectionMeta(fieldKey) {
    const set = pending?.fields?.[fieldKey];
    if (!set || !set.size) return "Any";
    return `${set.size} selected`;
  }

  function renderFiltersSheet() {
    if (!sheetFilters) return;

    injectFiltersSheetStylesOnce();

    // init pending when sheet opens
    if (!pending) pending = cloneActiveToPending();
    if (!openSection) openSection = ""; // closed by default

    const priceMin = pending.priceMin ?? PRICE_MIN;
    const priceMax = pending.priceMax ?? PRICE_MAX;

    const applyEnabled = !pendingIsDefaultOrSameAsActive() || pendingHasAnySelection();
    const applyClass = applyEnabled ? "is-on" : "is-off";

    sheetFilters.innerHTML = `
      <div class="fsh-head">
        <div class="fsh-grab" aria-hidden="true"></div>
        <div class="fsh-titleRow">
          <div class="fsh-title">Filters</div>
          <button class="fsh-x" type="button" aria-label="Close" data-fsh-close>×</button>
        </div>

        <div class="priceBox" style="margin-top:8px;">
          <div class="priceTop">
            <div class="priceLbl">Price Range</div>
            <div class="priceVal">$${money(priceMin)} – $${money(priceMax)}</div>
          </div>
          <div class="rangeWrap">
            <div class="rangeRow">
              <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="0.25"
                     value="${priceMin}" data-price-min />
            </div>
            <div class="rangeRow">
              <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="0.25"
                     value="${priceMax}" data-price-max />
            </div>
          </div>
        </div>
      </div>

      <div class="fsh-body">
        <div class="accList" role="list">
          ${renderAccRow("Vitola", "Vitola")}
          ${renderAccRow("Ring", "RG")}
          ${renderAccRow("Length", "Length")}
          ${renderAccRow("Wrapper Shade", "Wrapper Shade")}
          ${renderAccRow("Strength", "Strength")}
          ${renderAccRow("Shape", "Shape")}
        </div>

        <div style="height:14px;"></div>

        <div class="radioGrid">
          <div class="radioTitle">Only Show</div>
          <div class="radioRows">
            ${renderRadioOpt("Barberpole")}
            ${renderRadioOpt("Box-Pressed")}
            ${renderRadioOpt("Flavored")}
            ${renderRadioOpt("Tins")}
            ${renderRadioOpt("Packs")}
            ${renderRadioOpt("Tubos")}
          </div>
        </div>
      </div>

      <div class="fsh-foot">
        <button type="button" class="applyBtn ${applyClass}" data-apply-filters>
          Apply Filters
        </button>
      </div>
    `;

    // Wire events
    sheetFilters.querySelector("[data-fsh-close]")?.addEventListener("click", () => {
      // discard pending changes if you close
      pending = null;
      openSection = "";
      setFiltersSheetOpen(false);
    });

    // price sliders
    const minEl = sheetFilters.querySelector("[data-price-min]");
    const maxEl = sheetFilters.querySelector("[data-price-max]");

    const clampPrice = () => {
      if (!minEl || !maxEl) return;
      let minV = Number(minEl.value);
      let maxV = Number(maxEl.value);

      if (minV > maxV) {
        // keep handles from crossing
        const t = minV;
        minV = maxV;
        maxV = t;
        minEl.value = String(minV);
        maxEl.value = String(maxV);
      }
      pending.priceMin = minV;
      pending.priceMax = maxV;
      renderFiltersSheet(); // re-render to update values + button state
    };

    minEl?.addEventListener("input", clampPrice);
    maxEl?.addEventListener("input", clampPrice);

    // accordion rows
    sheetFilters.querySelectorAll("[data-acc]").forEach((row) => {
      row.addEventListener("click", () => {
        const key = row.getAttribute("data-acc") || "";
        openSection = openSection === key ? "" : key; // collapse if open
        renderFiltersSheet();
      });
    });

    // pills (multi-select)
    sheetFilters.querySelectorAll("[data-pill-field]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const field = btn.getAttribute("data-pill-field");
        const val = btn.getAttribute("data-pill-val");
        if (!field || !val) return;

        pending.fields[field] ||= new Set();
        if (pending.fields[field].has(val)) pending.fields[field].delete(val);
        else pending.fields[field].add(val);

        renderFiltersSheet();
      });
    });

    // Only Show radios (single)
    sheetFilters.querySelectorAll("[data-onlyshow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-onlyshow") || "";
        pending.onlyShow = pending.onlyShow === k ? "" : k; // allow deselect
        renderFiltersSheet();
      });
    });

    // Apply
    sheetFilters.querySelector("[data-apply-filters]")?.addEventListener("click", () => {
      if (!pending) return;

      // Apply pending -> active
      active.priceMin = pending.priceMin;
      active.priceMax = pending.priceMax;
      active.onlyShow = pending.onlyShow;

      for (const key of Object.keys(active.fields)) {
        active.fields[key] = new Set(pending.fields[key] ? [...pending.fields[key]] : []);
      }

      pending = null;
      openSection = "";
      setFiltersSheetOpen(false);
      applyAllFilters();
    });
  }

  function renderAccRow(label, fieldKey) {
    const isOpen = openSection === fieldKey;
    const plus = isOpen ? "−" : "+";
    const meta = buildSectionMeta(fieldKey);

    const panel = isOpen ? renderPillsPanel(fieldKey) : "";

    return `
      <div class="accRow" data-acc="${escapeAttr(fieldKey)}" role="listitem">
        <div class="accLeft">
          <div class="accPlus">${plus}</div>
          <div class="accLabel">${escapeHTML(label)}</div>
        </div>
        <div class="accMeta">${escapeHTML(meta)}</div>
      </div>
      <div class="accPanel ${isOpen ? "is-open" : ""}">
        ${panel}
      </div>
    `;
  }

  function renderPillsPanel(fieldKey) {
    const values = getFieldValues(fieldKey);
    const set = pending?.fields?.[fieldKey] || new Set();

    // Special case: user wants Ring and Length “full numeric ranges”
    // We still use your dataset’s values so we never show options that don’t exist.
    // (If you want forced 40–90 even when missing in data, say so.)

    return `
      <div class="pillGrid">
        ${values
          .map(({ k, d }) => {
            const on = set.has(k);
            return `
              <button type="button"
                class="optPill ${on ? "is-on" : ""}"
                data-pill-field="${escapeAttr(fieldKey)}"
                data-pill-val="${escapeAttr(k)}">
                ${escapeHTML(d)}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderRadioOpt(label) {
    const on = (pending?.onlyShow || "") === label;
    return `
      <div class="radioOpt ${on ? "is-on" : ""}" data-onlyshow="${escapeAttr(label)}">
        <div class="radioDot" aria-hidden="true"></div>
        <div class="radioTxt">${escapeHTML(label)}</div>
      </div>
    `;
  }

  // ---------- applied chips under controls (optional, simple) ----------
  function renderMainAppliedChips() {
    if (!brandAppliedWrap || !brandAppliedRow) return;

    const chips = [];

    // price chip if not full range
    if (PRICE_MIN !== PRICE_MAX) {
      const min = active.priceMin ?? PRICE_MIN;
      const max = active.priceMax ?? PRICE_MAX;
      if (min !== PRICE_MIN || max !== PRICE_MAX) {
        chips.push({ type: "price", label: `Price: $${money(min)}–$${money(max)}` });
      }
    }

    // fields
    for (const [field, set] of Object.entries(active.fields)) {
      if (!set || !set.size) continue;
      set.forEach((k) => chips.push({ type: "field", field, k, label: `${field}: ${k}` }));
    }

    // only show
    if (active.onlyShow) chips.push({ type: "only", label: `Only: ${active.onlyShow}` });

    if (!chips.length) {
      brandAppliedWrap.setAttribute("hidden", "");
      brandAppliedRow.innerHTML = "";
      return;
    }

    brandAppliedWrap.removeAttribute("hidden");
    brandAppliedRow.innerHTML = chips
      .map(
        (c, idx) => `
        <button type="button" class="applied-chip" data-chip="${idx}">
          <span class="t">${escapeHTML(c.label)}</span>
          <span class="x" aria-hidden="true">×</span>
        </button>
      `
      )
      .join("");

    brandAppliedRow.querySelectorAll(".applied-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-chip"));
        const c = chips[idx];
        if (!c) return;

        if (c.type === "price") {
          active.priceMin = null;
          active.priceMax = null;
        } else if (c.type === "only") {
          active.onlyShow = "";
        } else if (c.type === "field") {
          active.fields[c.field]?.delete(c.k);
        }

        applyAllFilters();
      });
    });
  }

  // ---------- Bands sheet (kept) ----------
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
    return list.map((x) => ({ ...x, src: (x.src || "").replace("seriebank", "serieband") }));
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
              <img src="${escapeAttr(x.src)}" alt="${escapeAttr(x.label)}" onerror="this.style.opacity='0.15';" />
            </div>
            <div class="band-meta">
              <span class="band-name">${escapeHTML(x.label)}</span>
              <input type="checkbox" class="band-check" data-token="${escapeAttr(x.token)}" ${checked ? "checked" : ""} />
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
    // keep your existing bands modal open method:
    backdrop?.removeAttribute("hidden");
    sheetBands?.removeAttribute("hidden");
    document.body.classList.add("pos-modal-open");
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

  function initBackdropHandlers() {
    backdrop?.addEventListener("click", () => {
      // close filters sheet
      if (sheetFilters?.classList.contains("is-open")) {
        pending = null;
        openSection = "";
        setFiltersSheetOpen(false);
      }

      // close bands (if open)
      if (sheetBands && !sheetBands.hasAttribute("hidden")) {
        sheetBands.setAttribute("hidden", "");
        closeBackdropIfNoSheets();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (sheetFilters?.classList.contains("is-open")) {
        pending = null;
        openSection = "";
        setFiltersSheetOpen(false);
      }

      if (sheetBands && !sheetBands.hasAttribute("hidden")) {
        sheetBands.setAttribute("hidden", "");
        closeBackdropIfNoSheets();
      }
    });
  }

  function initButtons() {
    btnFilters?.addEventListener("click", (e) => {
      e.preventDefault();
      pending = cloneActiveToPending();
      openSection = "";
      renderFiltersSheet();
      setFiltersSheetOpen(true);
    });

    btnBands?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
    });

    bandsConfirm?.addEventListener("click", () => {
      if (bandsConfirm.disabled) return;
      activeBands = new Set(pendingBands);
      sheetBands?.setAttribute("hidden", "");
      closeBackdropIfNoSheets();
      applyAllFilters();
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

    // round to quarter dollars for sliders
    const roundDown = (x) => Math.floor(x * 4) / 4;
    const roundUp = (x) => Math.ceil(x * 4) / 4;

    PRICE_MIN = roundDown(min);
    PRICE_MAX = roundUp(max);

    // default active range = full range (nulls = treat as full)
    active.priceMin = PRICE_MIN;
    active.priceMax = PRICE_MAX;
  }

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

    computePriceRangeFromAll();

    setStatus("");
    applyAllFilters();
  }

  function init() {
    initBackButton();
    initBackdropHandlers();
    initButtons();
    initWrapperSeg();
    initListDelegation();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
