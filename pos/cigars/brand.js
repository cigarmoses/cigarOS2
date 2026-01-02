/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Updates in this version:
   - Filters popup now matches Cigars home layout (no Manufacturer/Brand)
   - Top pill order: Ring, Length, Wrapper Shade, Shape, Vitolas, Strength
   - Toggles are NOT pills anymore:
     Flavored / Tubo / Tin
     Box-Pressed / Packs / Barberpole
     -> white text + circle, blue when selected
   - Applied filters chips:
     * inside filters popup (top)
     * under the controls row on the main brand page
     * X removes immediately
   - Detail list view with Back button inside popup
   - Logic stacks with Bands + Wrapper toggle + Search as requested
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

  // Multi-select field filters (Sets)
  let activeFilters = {};   // { "Vitola": Set(["robusto"]) ... }
  let pendingFilters = {};

  // Boolean toggles (single on/off)
  let activeToggles = {
    "Flavored": false,
    "Tubo": false,
    "Tin": false,
    "Box-Pressed": false,
    "Pack": false,
    "Barber": false,
  };
  let pendingToggles = { ...activeToggles };

  // Band filters
  let pendingBands = new Set();
  let activeBands = new Set();

  let wrapperState = "all"; // maduro | natural | all

  // Filters popup view state
  let filtersMode = "home"; // home | detail
  let currentField = "";    // which pill opened (e.g., "Vitola")
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

  // ---------- list render ----------
  function renderList(rows) {
    if (!listEl) return;

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
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rowEl = e.currentTarget.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";

        const row = rows.find((x) => {
          const rid = x.key || `${x.Brand || ""}-${x.Cigar || ""}-${x.Vitola || ""}`;
          return rid === id;
        });
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: row.Cigar,
          brand: row.Brand,
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: bestIconForRow(row) || "",
        });
      });
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
      !($("#sheet-filters")?.hasAttribute("hidden")) ||
      !($("#sheet-bands")?.hasAttribute("hidden")) ||
      !($("#sheet-receipt")?.hasAttribute("hidden"));
    if (!anyOpen) backdrop?.setAttribute("hidden", "");
    document.body.classList.remove("pos-modal-open");
  }

  function closeAllSheets() {
    closeSheet(sheetFilters);
    closeSheet(sheetBands);
    const receipt = $("#sheet-receipt");
    if (receipt) closeSheet(receipt);
  }

  function initSheetCloseHandlers() {
    $$("[data-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sheet = btn.closest(".sheet");
        if (sheet) closeSheet(sheet);
      });
    });

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
      // numeric-ish sort, but keep original strings
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

    if (filtersTitle) filtersTitle.textContent = isDetail ? (currentField || "Filters") : "Filters";
    if (!isDetail && filtersSearch) filtersSearch.value = "";
  }

  function openFiltersSheet() {
    // clone current actives into pending when opening
    pendingFilters = cloneFilterSets(activeFilters);
    pendingToggles = { ...activeToggles };

    // ensure toggles UI reflects current
    syncToggleButtons();

    // chips in popup
    renderFiltersPopupAppliedChips();

    // show home grid by default
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
        pendingToggles[key] = !pendingToggles[key]; // clicking again toggles off ✅
        syncToggleButtons();
        // apply immediately
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

        // apply immediately
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

    // field filters
    for (const [field, set] of Object.entries(activeFilters)) {
      if (!set || !set.size) continue;
      for (const v of set.values()) {
        // v is stored normalized (lowercase)
        // show as “field: value”
        chips.push({
          type: "field",
          field,
          value: v,
          label: `${field}: ${v}`,
        });
      }
    }

    // toggles
    for (const [tKey, on] of Object.entries(activeToggles)) {
      if (!on) continue;
      // label cases for display
      const pretty =
        tKey === "Box-Pressed" ? "Box-pressed" :
        tKey === "Pack" ? "Packs" :
        tKey === "Barber" ? "Barberpole" :
        tKey;
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
      const v = chip.value; // normalized
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
    // pills inside filters popup
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

    // back inside filters popup
    filtersBack?.addEventListener("click", () => {
      closeDetailToHome();
    });

    // search inside detail view
    filtersSearch?.addEventListener("input", filterDetailListBySearch);

    // confirm just closes popup (filters already applied live)
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

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
