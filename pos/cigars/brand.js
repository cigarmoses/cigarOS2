/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ FIX (THIS PASS):
   - Bands + Filters sheets render FULL-SCREEN bottom sheet (not tiny center)
   - Adds/ensures a real #sheet-backdrop overlay (created if missing in HTML)
   - Proper z-index layering so the sheet is on top and the background is dimmed (not “blurry card in center”)
   - Keeps: Bands logic, Filters logic, Maduro/Natural toggle, row click detail modal, add-to-cart wiring
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();

  // accent-safe slug (Padrón -> padron)
  const slug = (s) =>
    lower(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const esc = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // aliases used by some helpers
  const escapeHTML = esc;
  const escapeAttr = esc;

  // ---- brand context ----
  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---- DOM (page) ----
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  // Back buttons (both can exist)
  const brandBackBtn = $("#brand-back");
  const posBackBtn = $(".pos-back");
  const backBtn = brandBackBtn || posBackBtn;

  // Buttons on this page
  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  // Maduro/Natural segmented control
  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // Sheets (already in brand.html)
  const sheetReceipt = $("#sheet-receipt"); // (not touched here)
  const sheetBands = $("#sheet-bands");
  const sheetFilters = $("#sheet-filters");

  // Bands sheet targets
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // Filters sheet targets
  const filtersHome = $("#filters-home");
  const filtersDetail = $("#filters-detail");
  const filtersList = $("#filters-list");
  const filtersSearch = $("#filters-search");
  const filtersBack = $("#filters-back");
  const filtersTitle = $("#filters-title");
  const filtersConfirm = $("#filters-confirm");

  // =========================================================
  // ✅ BACKDROP (CREATE IF MISSING)
  // =========================================================
  function ensureBackdrop() {
    let bd = $("#sheet-backdrop");
    if (bd) return bd;

    bd = document.createElement("div");
    bd.id = "sheet-backdrop";
    bd.className = "sheet-backdrop";
    bd.hidden = true;
    document.body.appendChild(bd);
    return bd;
  }

  // =========================================================
  // ✅ REMOVE DUPLICATE BACK BUTTON
  // =========================================================
  function fixDuplicateBackButtons() {
    if (brandBackBtn && posBackBtn && posBackBtn !== brandBackBtn) {
      posBackBtn.style.display = "none";
      posBackBtn.setAttribute("aria-hidden", "true");
      posBackBtn.tabIndex = -1;
    }
  }

  // =========================================================
  // ✅ INVOICE PILL SHOULD OPEN INVOICE
  // =========================================================
  function findInvoicePill() {
    return (
      $("#invoice-pill") ||
      $("#posInvoicePill") ||
      $("#invoice-btn") ||
      $(".invoice-pill") ||
      $(".pos-invoice-pill") ||
      $(".pos-invoice") ||
      $$("button, a, div").find(
        (el) => lower(el.textContent).trim() === "invoice" && el.offsetParent !== null
      ) ||
      null
    );
  }

  function openInvoice() {
    const candidates = [
      $("#posInvoiceFab"),
      $("#posReceiptFab"),
      $("#receipt-open"),
      $("#invoice-open"),
      $(".pos-invoice-fab"),
      $(".pos-receipt-fab"),
      $(".receipt-fab"),
      $("[data-open-invoice]"),
      $("[data-open-receipt]"),
    ].filter(Boolean);

    if (candidates.length) {
      candidates[0].click();
      return true;
    }

    try {
      location.href = "/pos/invoice.html";
      return true;
    } catch {
      return false;
    }
  }

  function bindInvoicePill() {
    const pill = findInvoicePill();
    if (!pill) return;
    pill.style.cursor = "pointer";
    pill.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInvoice();
    });
  }

  // ---- CSV parsing ----
  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }
      if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  function csvToObjects(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return [];
    const headers = splitCsvLine(lines[0]).map((h) => norm(h));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c]] = norm(cols[c] ?? "");
      rows.push(obj);
    }
    return rows;
  }

  function pick(r, keys) {
    for (const k of keys) if (r[k] != null && norm(r[k]) !== "") return r[k];
    const ks = Object.keys(r);
    for (const want of keys) {
      const hit = ks.find((h) => lower(h) === lower(want));
      if (hit && norm(r[hit]) !== "") return r[hit];
    }
    return "";
  }

  // Match HUB headers
  const getBrand = (r) => pick(r, ["Brand", "Brand AKA", "Brand aka", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getWrapperShade = (r) =>
    pick(r, ["Wrapper Shade", "WrapperShade", "Wrapper shade", "wrapper shade", "Shade"]);
  const getWrapper = (r) => pick(r, ["Wrapper", "Wrapper Type"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin", "Country", "Country of Origin"]);
  const getRing = (r) => pick(r, ["Ring", "Ring Gauge", "RG"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);
  const getImage = (r) => pick(r, ["Image", "Img", "Photo", "Cigar Image", "Cigar IMG"]);

  const priceNum = (x) => {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

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

  // =========================================================
  // ✅ CIGAR DETAIL POPUP
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
      if (e.key === "Escape" && detailOverlay?.classList.contains("open")) {
        closeCigarDetail();
      }
    });
  }

  function bestBrandHeaderIcon(row) {
    const b = norm(row?.brand || row?.Brand || row?.Manufacturer || BRAND || "");
    return `/img/icons/brands/${slug(b)}.svg`;
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
    return norm(raw) || "";
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

    const brand = norm(row?.brand || row?.Brand || BRAND || "Brand");
    const cigarName = norm(
      row?.cigarFull ||
        row?.["Cigar Full"] ||
        row?.cigar ||
        row?.Cigar ||
        (norm(row?.line || row?.Line) && norm(row?.cigar || row?.Cigar)
          ? `${norm(row?.line || row?.Line)} ${norm(row?.cigar || row?.Cigar)}`.trim()
          : "")
    );

    const brandIcon = bestBrandHeaderIcon(row) || "";

    const picked = pickCigarImage(row);

    const nameForFile = slug(
      row?.cigarFull ||
        row?.["Cigar Full"] ||
        row?.cigar ||
        row?.Cigar ||
        `${norm(row?.line || row?.Line || "")} ${norm(row?.cigar || row?.Cigar || "")}`.trim()
    );

    const brandForFolder = slug(row?.brand || row?.Brand || BRAND || "");

    const imgCandidates = [
      picked,
      `/img/cigars/${brandForFolder}/${nameForFile}.png`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpg`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpeg`,
      `/img/cigars/${brandForFolder}/${brandForFolder}${nameForFile}.png`,
      `/img/cigars/${brandForFolder}/${brandForFolder}${nameForFile}.jpg`,
      `/img/cigars/${brandForFolder}/${brandForFolder}${nameForFile}.jpeg`,
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

    const shade = norm(
      row?.wrapperShade ||
        row?.shade ||
        row?.["Wrapper Shade"] ||
        row?.WrapperShade ||
        row?.["WrapperShade"] ||
        ""
    );

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>

      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${escapeHTML(brand)}</div>
            <div class="cd-name">${escapeHTML(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            ${brandIcon ? `<img src="${escapeAttr(brandIcon)}" alt="">` : ``}
          </div>
        </div>

        <div class="cd-main">
          <div class="cd-img">
            ${cigarImg ? `<img class="cigar-detail-stick" src="${escapeAttr(cigarImg)}" alt="">` : ``}
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat">
                <div class="k">RING</div>
                <div class="v">${escapeHTML(String(rg))}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${escapeHTML(String(len))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${escapeHTML(String(shape))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${escapeHTML(String(vitola))}</div>
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

      window.CigarOSCart?.add({
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
  // ✅ SHEET OPEN/CLOSE (FULLSCREEN BOTTOM SHEET)
  // =========================================================
  function openSheetEl(sheetEl) {
    if (!sheetEl) return;

    const bd = ensureBackdrop();

    document.body.classList.add("pos-modal-open");

    bd.hidden = false;
    bd.classList.add("open");

    sheetEl.hidden = false;
    sheetEl.classList.add("is-open");
  }

  function closeAllSheets() {
    const bd = ensureBackdrop();

    document.body.classList.remove("pos-modal-open");

    [sheetBands, sheetFilters, sheetReceipt].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-open");
      el.hidden = true;
    });

    bd.classList.remove("open");
    bd.hidden = true;
  }

  function bindSheetClosers() {
    // x buttons
    $$("[data-sheet-close]").forEach((btn) => btn.addEventListener("click", closeAllSheets));

    // backdrop
    const bd = ensureBackdrop();
    bd.addEventListener("click", closeAllSheets);

    // escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // =========================================================
  // ✅ STATE
  // =========================================================
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all", // all | maduro | natural
    bandKeys: new Set(),
    filterKey: "",
    filters: {
      values: new Map(),
      toggles: new Map(),
    },
  };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r)) === BRAND_SLUG;
  }

  // =========================================================
  // ✅ WRAPPER TOGGLE
  // =========================================================
  function setWrapperState(next) {
    state.wrapperState = next;

    if (wrapperSeg) wrapperSeg.dataset.state = next;

    if (segMaduro) segMaduro.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    if (segNatural) segNatural.setAttribute("aria-pressed", next === "natural" ? "true" : "false");

    apply();
  }

  function bindWrapperToggle() {
    if (!wrapperSeg) return;

    setWrapperState("all");

    segMaduro?.addEventListener("click", () => setWrapperState("maduro"));
    segNatural?.addEventListener("click", () => setWrapperState("natural"));

    segSwitch?.addEventListener("click", () => {
      const cur = state.wrapperState;
      const next = cur === "all" ? "maduro" : cur === "maduro" ? "natural" : "all";
      setWrapperState(next);
    });
  }

  function matchesWrapper(r) {
    const mode = state.wrapperState;
    if (mode === "all") return true;

    // keep your current behavior: name-string match
    const line = norm(getLine(r));
    const cigar = norm(getCigar(r));
    const cigarFull = `${line} ${cigar}`.trim();
    const blob = lower(cigarFull);

    if (mode === "maduro") return blob.includes("maduro");
    if (mode === "natural") return blob.includes("natural");
    return true;
  }

  // =========================================================
  // ✅ BANDS (Padron SVG artwork)
  // =========================================================
  const PADRON_BANDS = [
    { key: "padronseriesband", label: "Padron Series", src: "/img/icons/padronseriesband.svg" },
    {
      key: "padronfamilyreserveband",
      label: "Family Reserve",
      src: "/img/icons/padronfamilyreserveband.svg",
    },
    { key: "padron1926serieband", label: "1926", src: "/img/icons/padron1926serieband.svg" },
    { key: "padronblackseriesband", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
    {
      key: "padron1964anniversaryband",
      label: "1964",
      src: "/img/icons/padron1964anniversaryband.svg",
    },
    { key: "padrondamasoband", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
  ];

  function bandKeyMatchesRow(bandKey, r) {
    const line = lower(getLine(r));
    const cigar = lower(getCigar(r));
    const full = `${line} ${cigar}`;

    switch (bandKey) {
      case "padron1926serieband":
        return full.includes("1926");
      case "padron1964anniversaryband":
        return full.includes("1964");
      case "padronfamilyreserveband":
        return full.includes("family reserve") || full.includes("familyreserve");
      case "padrondamasoband":
        return full.includes("damaso");
      case "padronblackseriesband":
        return full.includes("black");
      case "padronseriesband":
        return (
          !bandKeyMatchesRow("padron1926serieband", r) &&
          !bandKeyMatchesRow("padron1964anniversaryband", r) &&
          !bandKeyMatchesRow("padronfamilyreserveband", r) &&
          !bandKeyMatchesRow("padrondamasoband", r) &&
          !bandKeyMatchesRow("padronblackseriesband", r)
        );
      default:
        return false;
    }
  }

  function renderBandsOptions() {
    if (!bandsOptionsEl) return;

    const items = BRAND_SLUG === "padron" ? PADRON_BANDS : [];

    bandsOptionsEl.innerHTML = items
      .map((b) => {
        const checked = state.bandKeys.has(b.key);
        return `
          <label class="bands-row" role="button" tabindex="0">
            <div class="bands-art">
              <img class="bands-img" src="${esc(b.src)}" alt="${esc(b.label)}" />
            </div>
            <div class="bands-meta">
              <div class="bands-label">${esc(b.label)}</div>
            </div>
            <input class="bands-check" type="checkbox" data-band-key="${esc(b.key)}" ${
              checked ? "checked" : ""
            } />
          </label>
        `;
      })
      .join("");

    bandsOptionsEl.querySelectorAll("[data-band-key]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const k = cb.getAttribute("data-band-key");
        if (!k) return;
        if (cb.checked) state.bandKeys.add(k);
        else state.bandKeys.delete(k);
      });
    });
  }

  function openBandsSheet() {
    renderBandsOptions();
    openSheetEl(sheetBands);
  }

  // =========================================================
  // ✅ FILTERS
  // =========================================================
  const FILTER_KEYS = ["RG", "Length", "Wrapper Shade", "Shape", "Vitola", "Strength"];

  function getRowValueForKey(r, key) {
    switch (key) {
      case "RG":
        return norm(getRing(r));
      case "Length":
        return norm(getLength(r));
      case "Wrapper Shade":
        return norm(getWrapperShade(r));
      case "Shape":
        return norm(getShape(r));
      case "Vitola":
        return norm(getVitola(r));
      case "Strength":
        return norm(getStrength(r));
      default:
        return "";
    }
  }

  function uniqueSortedValuesForKey(key) {
    const set = new Set();
    state.all.filter(inBrand).forEach((r) => {
      const v = getRowValueForKey(r, key);
      if (v) set.add(v);
    });

    const arr = Array.from(set);

    if (key === "RG") {
      arr.sort((a, b) => Number(a) - Number(b));
      return arr;
    }
    if (key === "Length") {
      arr.sort(
        (a, b) =>
          Number(String(a).replace(/[^\d.]/g, "")) - Number(String(b).replace(/[^\d.]/g, ""))
      );
      return arr;
    }

    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }

  function ensureSetForFilter(key) {
    if (!state.filters.values.has(key)) state.filters.values.set(key, new Set());
    return state.filters.values.get(key);
  }

  function anyFiltersApplied() {
    if (state.wrapperState !== "all") return true;
    if (state.bandKeys.size) return true;

    for (const [, set] of state.filters.values) {
      if (set && set.size) return true;
    }
    for (const [, v] of state.filters.toggles) {
      if (v) return true;
    }
    if (norm(state.q)) return true;
    return false;
  }

  function setFiltersConfirmState() {
    if (!filtersConfirm) return;
    filtersConfirm.disabled = !anyFiltersApplied();
  }

  function showFiltersHome() {
    if (!filtersHome || !filtersDetail) return;

    filtersHome.hidden = false;
    filtersDetail.hidden = true;

    if (filtersBack) filtersBack.hidden = true;
    if (filtersTitle) filtersTitle.textContent = "Filters";
    if (filtersSearch) filtersSearch.value = "";

    state.filterKey = "";
    setFiltersConfirmState();
  }

  function showFiltersDetail(key) {
    state.filterKey = key;

    if (filtersHome) filtersHome.hidden = true;
    if (filtersDetail) filtersDetail.hidden = false;

    if (filtersBack) filtersBack.hidden = false;
    if (filtersTitle) filtersTitle.textContent = key;

    renderFiltersDetailList();
    setFiltersConfirmState();
  }

  function renderFiltersDetailList() {
    if (!filtersList) return;
    const key = state.filterKey;
    if (!key) return;

    const allVals = uniqueSortedValuesForKey(key);
    const q = lower(filtersSearch?.value || "");
    const selected = ensureSetForFilter(key);

    const rows = allVals
      .filter((v) => (q ? lower(v).includes(q) : true))
      .map((v) => {
        const isOn = selected.has(v);
        return `
          <button type="button" class="filters-item" data-filter-val="${esc(v)}">
            <span class="filters-item-label">${esc(v)}</span>
            <span class="filters-item-check ${isOn ? "is-on" : ""}" aria-hidden="true"></span>
          </button>
        `;
      })
      .join("");

    filtersList.innerHTML =
      rows || `<div class="filters-empty">No values</div>`;

    filtersList.querySelectorAll("[data-filter-val]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-filter-val") || "";
        if (!v) return;
        if (selected.has(v)) selected.delete(v);
        else selected.add(v);
        renderFiltersDetailList();
        setFiltersConfirmState();
      });
    });
  }

  function bindFiltersUI() {
    filtersBtn?.addEventListener("click", () => {
      showFiltersHome();
      openSheetEl(sheetFilters);
    });

    $$("[data-open-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-open-filter") || "";
        if (!FILTER_KEYS.includes(key)) return;
        showFiltersDetail(key);
      });
    });

    filtersBack?.addEventListener("click", showFiltersHome);
    filtersSearch?.addEventListener("input", () => renderFiltersDetailList());

    $$("[data-toggle-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-toggle-key") || "";
        if (!k) return;
        const cur = !!state.filters.toggles.get(k);
        state.filters.toggles.set(k, !cur);
        btn.classList.toggle("is-on", !cur);
        setFiltersConfirmState();
      });
    });

    filtersConfirm?.addEventListener("click", () => {
      closeAllSheets();
      apply();
    });
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", () => openBandsSheet());
    bandsConfirmBtn?.addEventListener("click", () => {
      closeAllSheets();
      apply();
    });
  }

  // =========================================================
  // ✅ APPLY FILTERS + RENDER
  // =========================================================
  function rowPassesFilters(r) {
    if (!matchesWrapper(r)) return false;

    if (state.bandKeys.size) {
      let ok = false;
      for (const k of state.bandKeys) {
        if (bandKeyMatchesRow(k, r)) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }

    for (const [key, set] of state.filters.values) {
      if (!set || set.size === 0) continue;
      const v = getRowValueForKey(r, key);
      if (!set.has(v)) return false;
    }

    return true;
  }

  function apply() {
    const q = lower(state.q);

    state.view = state.all
      .filter(inBrand)
      .filter(rowPassesFilters)
      .filter((r) => {
        if (!q) return true;
        const blob = `${getLine(r)} ${getCigar(r)} ${getWrapper(r)} ${getOrigin(r)} ${getRing(r)} ${getLength(r)} ${getMSRP(r)}`.toLowerCase();
        return blob.includes(q);
      });

    render();
  }

  function render() {
    if (!listEl) return;

    if (!state.view.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No cigars found.";
      }
      return;
    }
    if (statusEl) statusEl.hidden = true;

    listEl.innerHTML = state.view
      .map((r) => {
        const brand = norm(getBrand(r));
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const cigarFull = `${line} ${cigar}`.trim();

        const vitola = norm(getVitola(r));
        const strength = norm(getStrength(r));
        const shape = norm(getShape(r));
        const wrapperShade = norm(getWrapperShade(r));

        const wrapper = norm(getWrapper(r));
        const binder = norm(getBinder(r));
        const filler = norm(getFiller(r));
        const origin = norm(getOrigin(r));
        const ring = norm(getRing(r));
        const length = norm(getLength(r));
        const msrp = norm(getMSRP(r));
        const image = norm(getImage(r));

        const receiptItem = buildReceiptItem({ brand, line, cigar, vitola, msrp });
        const brandIconSrc = `/img/icons/brands/${slug(brand || BRAND)}.svg`;

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
                aria-label="Add to invoice"
                data-receipt-item='${esc(JSON.stringify(receiptItem))}'>+</button>
            </div>

          </div>
        `;
      })
      .join("");
  }

  function bindClicks() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const add = e.target.closest("[data-receipt-item]");
      if (add) return;

      const row = e.target.closest("[data-row]");
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

        key: `${slug(row.dataset.brand)}|${slug(row.dataset.line)}|${slug(
          row.dataset.cigarFull || row.dataset.cigar
        )}`,
      };

      openCigarDetail(item);
    });
  }

  // =========================================================
  // ✅ BOOT
  // =========================================================
  async function boot() {
    // Ensure overlay exists early so CSS can target it
    ensureBackdrop();

    fixDuplicateBackButtons();
    bindInvoicePill();

    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    if (brandIconWrap) {
      const src = `/img/icons/brands/${BRAND_SLUG}.svg`;
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="">`;
    }

    bindClicks();
    bindSheetClosers();
    bindWrapperToggle();
    bindBandsUI();
    bindFiltersUI();

    searchEl?.addEventListener("input", () => {
      state.q = norm(searchEl.value || "");
      apply();
    });

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);
      apply();
      if (statusEl) statusEl.hidden = true;
    } catch (e) {
      console.error(e);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load cigars.";
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
