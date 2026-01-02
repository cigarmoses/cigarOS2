/* /pos/cigars/brand.js (FULL FILE REPLACEMENT)
   Brand POS page controller (Cigars)

   ✅ Filters popup now mirrors Cigars home layout:
   - Main grid (Ring / Wrapper Shade / Vitolas / Strength + toggles + view all)
   - Tap a filter => drilldown list view with Back button + search
   - Shows applied filters at top of popup + under controls on page (with X)
   - Bands filter logic remains additive (AND) with Filters & Wrapper toggle
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
  const appliedRowEl = $("#brand-applied");

  const backBtn = $("#brand-back");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  // wrapper toggle
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-switch");

  // Sheets
  const backdrop = $("#sheet-backdrop");

  // Filters popup (new)
  const sheetFilters = $("#sheet-filters");
  const filtersTitle = $("#filters-title");
  const filtersBack = $("#filters-back");
  const filtersApplied = $("#filters-applied");
  const filtersMain = $("#filters-main");
  const filtersSub = $("#filters-sub");
  const filtersList = $("#filters-list");
  const filtersSearch = $("#filters-search");
  const filtersConfirm = $("#filters-confirm");
  const filtersViewAllBtn = $("#filters-viewall");
  const filtersExpanded = $("#filters-expanded");

  // Bands popup
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // ---------- State ----------
  let ALL = [];
  let VIEW = [];

  // Field filters
  let activeFilters = {};     // { fieldName: Set(lowercased) }
  let pendingFilters = {};

  // Toggle filters (truthy fields)
  let activeToggles = {
    flavored:false,
    boxpressed:false,
    tin:false,
    pack:false,
    barberpole:false,
    tubo:false,
    favorite:false,
  };
  let pendingToggles = { ...activeToggles };

  // Bands
  let pendingBands = new Set();
  let activeBands = new Set();

  // wrapper toggle state
  let wrapperState = "all"; // maduro | natural | all

  // Filters UI state
  let currentKey = null;
  let currentValues = [];

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
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

  function isTruthyCell(v) {
    const s = (v ?? "").toString().trim().toLowerCase();
    if (!s) return false;
    if (s === "0" || s === "false" || s === "no" || s === "n") return false;
    return true;
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

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    VIEW = ALL.filter((row) => {
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      // ✅ Wrapper toggle MUST filter by CIGAR NAME ONLY
      const cigarName = norm(row.Cigar || "");
      if (wrapperState === "maduro") {
        if (!cigarName.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        if (!cigarName.includes("natural")) return false;
      }

      // field filters (activeFilters)
      for (const [field, set] of Object.entries(activeFilters)) {
        if (!set || !set.size) continue;
        const v = norm(row[field] || "");
        if (!set.has(v)) return false;
      }

      // toggle filters (truthy fields)
      if (activeToggles.flavored && !isTruthyCell(row["Flavored"])) return false;
      if (activeToggles.boxpressed && !isTruthyCell(row["Box-Pressed"])) return false;
      if (activeToggles.tin && !isTruthyCell(row["Tin"])) return false;
      if (activeToggles.pack && !isTruthyCell(row["Pack"])) return false;
      if (activeToggles.barberpole && !isTruthyCell(row["Barber"])) return false;
      if (activeToggles.tubo && !isTruthyCell(row["Tubo"])) return false;
      if (activeToggles.favorite && !isTruthyCell(row["Favorite"])) return false;

      // bands filter
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
    renderAppliedRows(); // ✅ keep UI in sync
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
        const sheet = btn.closest(".sheet") || btn.closest("#sheet-filters") || btn.closest("#sheet-bands");
        if (sheet) closeSheet(sheet);
      });
    });

    backdrop?.addEventListener("click", closeAllSheets);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // ---------- Filters system (new) ----------
  const FILTER_MAP = {
    ring:   { title: "Ring",         field: "RG" },
    shade:  { title: "Wrapper Shade",field: "Wrapper Shade" },
    vitola: { title: "Vitolas",      field: "Vitola" },
    strength:{title: "Strength",     field: "Strength" },
    length: { title: "Length",       field: "Length" },
    shape:  { title: "Shape",        field: "Shape" },
  };

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

  function uniqSorted(values) {
    const set = new Set();
    values.forEach((v) => {
      const s = (v ?? "").toString().trim().replace(/\s+/g, " ");
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function cloneFilterSets(obj) {
    const out = {};
    for (const [k, set] of Object.entries(obj || {})) out[k] = new Set(set ? [...set] : []);
    return out;
  }

  function buildValuesForField(fieldName) {
    const vals = [];
    ALL.forEach((row) => {
      const v = (row[fieldName] ?? "").toString().trim();
      if (v) vals.push(v);
    });
    return uniqSorted(vals);
  }

  function showFiltersMain() {
    currentKey = null;
    currentValues = [];
    filtersBack?.setAttribute("hidden", "");
    if (filtersTitle) filtersTitle.textContent = "Filters";
    filtersSub?.setAttribute("hidden", "");
    filtersMain?.removeAttribute("hidden");
    if (filtersSearch) filtersSearch.value = "";
    syncFilterPillsActive();
    renderFiltersAppliedChips();
  }

  function showFiltersSub(key) {
    currentKey = key;
    const meta = FILTER_MAP[key];
    if (!meta) return;

    if (filtersTitle) filtersTitle.textContent = meta.title || "Filter";
    filtersBack?.removeAttribute("hidden");
    filtersMain?.setAttribute("hidden", "");
    filtersSub?.removeAttribute("hidden");

    let vals = buildValuesForField(meta.field);
    if (key === "shade") vals = orderWrapperShades(vals);

    currentValues = vals;

    if (filtersSearch) filtersSearch.value = "";
    renderFiltersList(vals);
    setTimeout(() => filtersSearch?.focus(), 40);
  }

  function renderFiltersList(values) {
    if (!filtersList || !currentKey) return;
    const meta = FILTER_MAP[currentKey];
    if (!meta) return;

    const field = meta.field;
    const selectedSet = pendingFilters[field] || new Set();

    filtersList.innerHTML = values
      .map((v) => {
        const label = (v ?? "").toString().trim().replace(/\s+/g, " ");
        const isSelected = selectedSet.has(norm(label));
        return `
          <div class="fl-row ${isSelected ? "is-selected" : ""}" data-val="${escapeAttr(label)}">
            <div class="fl-label">${escapeHTML(label)}</div>
            <div class="fl-check" aria-hidden="true"></div>
          </div>
        `;
      })
      .join("");

    $$(".fl-row").forEach((rowEl) => {
      rowEl.addEventListener("click", () => {
        const raw = rowEl.getAttribute("data-val") || "";
        const keyNorm = norm(raw);
        if (!keyNorm) return;

        pendingFilters[field] ||= new Set();

        if (pendingFilters[field].has(keyNorm)) {
          pendingFilters[field].delete(keyNorm);
          rowEl.classList.remove("is-selected");
        } else {
          pendingFilters[field].add(keyNorm);
          rowEl.classList.add("is-selected");
        }

        renderFiltersAppliedChips();
      });
    });
  }

  function syncFilterPillsActive() {
    // field pills
    $$("[data-fm-open]").forEach((btn) => {
      const key = btn.getAttribute("data-fm-open");
      const meta = FILTER_MAP[key];
      if (!meta) return;
      const set = pendingFilters[meta.field];
      btn.classList.toggle("is-active", !!set && set.size > 0);
    });

    // toggle pills
    $$("[data-fm-toggle]").forEach((btn) => {
      const t = btn.getAttribute("data-fm-toggle");
      if (!t) return;
      btn.classList.toggle("is-active", !!pendingToggles[t]);
    });
  }

  function renderFiltersAppliedChips() {
    if (!filtersApplied) return;

    const chips = buildAppliedChipModel(pendingFilters, pendingToggles, pendingBands ? new Set(pendingBands) : new Set());
    if (!chips.length) {
      filtersApplied.setAttribute("hidden", "");
      filtersApplied.innerHTML = "";
      return;
    }

    filtersApplied.removeAttribute("hidden");
    filtersApplied.innerHTML = chips
      .map((c) => {
        return `
          <span class="ap-chip" data-chip="${escapeAttr(c.id)}">
            ${escapeHTML(c.label)}
            <button type="button" aria-label="Remove">×</button>
          </span>
        `;
      })
      .join("");

    // bind remove
    filtersApplied.querySelectorAll(".ap-chip").forEach((chipEl) => {
      const id = chipEl.getAttribute("data-chip") || "";
      const btn = chipEl.querySelector("button");
      btn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeChipById(id, pendingFilters, pendingToggles, pendingBands);
        syncFilterPillsActive();
        renderFiltersAppliedChips();
        if (currentKey) renderFiltersList(currentValues);
      });
    });
  }

  function buildAppliedChipModel(filtersObj, togglesObj, bandsSet) {
    const chips = [];

    // field chips
    for (const [field, set] of Object.entries(filtersObj || {})) {
      if (!set || !set.size) continue;
      [...set].forEach((v) => {
        const prettyField = field;
        const prettyVal = v;
        const id = `f|${field}|${v}`;
        chips.push({ id, label: `${prettyField}: ${prettyVal}` });
      });
    }

    // toggle chips
    const toggleLabels = {
      flavored: "Flavored",
      boxpressed: "Box-Pressed",
      tin: "Tin",
      pack: "Packs",
      barberpole: "Barberpole",
      tubo: "Tubo",
      favorite: "Favorite",
    };
    for (const [k, on] of Object.entries(togglesObj || {})) {
      if (!on) continue;
      chips.push({ id: `t|${k}`, label: toggleLabels[k] || k });
    }

    // bands chips (show as Band: 1964 etc)
    if (bandsSet && bandsSet.size) {
      [...bandsSet].forEach((b) => {
        chips.push({ id: `b|${b}`, label: `Band: ${b}` });
      });
    }

    return chips;
  }

  function removeChipById(id, filtersObj, togglesObj, bandsSet) {
    const parts = (id || "").split("|");
    if (parts.length < 2) return;

    const type = parts[0];
    if (type === "f" && parts.length >= 3) {
      const field = parts[1];
      const val = parts.slice(2).join("|");
      const set = filtersObj[field];
      if (set) set.delete(val);
      if (set && set.size === 0) delete filtersObj[field];
      return;
    }

    if (type === "t" && parts.length >= 2) {
      const k = parts[1];
      if (k in togglesObj) togglesObj[k] = false;
      return;
    }

    if (type === "b" && parts.length >= 2) {
      const token = parts.slice(1).join("|");
      bandsSet?.delete(token);
      return;
    }
  }

  function renderAppliedRows() {
    // on-page chips from ACTIVE state (not pending)
    if (!appliedRowEl) return;

    const chips = buildAppliedChipModel(activeFilters, activeToggles, activeBands);
    if (!chips.length) {
      appliedRowEl.setAttribute("hidden", "");
      appliedRowEl.innerHTML = "";
      return;
    }

    appliedRowEl.removeAttribute("hidden");
    appliedRowEl.innerHTML = chips
      .map((c) => {
        return `
          <span class="ap-chip" data-chip="${escapeAttr(c.id)}">
            ${escapeHTML(c.label)}
            <button type="button" aria-label="Remove">×</button>
          </span>
        `;
      })
      .join("");

    appliedRowEl.querySelectorAll(".ap-chip").forEach((chipEl) => {
      const id = chipEl.getAttribute("data-chip") || "";
      const btn = chipEl.querySelector("button");
      btn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // remove from ACTIVE, then re-apply
        if (id.startsWith("b|")) {
          const token = id.slice(2);
          activeBands.delete(token);
        } else if (id.startsWith("t|")) {
          const k = id.slice(2);
          if (k in activeToggles) activeToggles[k] = false;
        } else if (id.startsWith("f|")) {
          const parts = id.split("|");
          const field = parts[1];
          const val = parts.slice(2).join("|");
          const set = activeFilters[field];
          if (set) set.delete(val);
          if (set && set.size === 0) delete activeFilters[field];
        }

        applyAllFilters();
      });
    });
  }

  function openFiltersSheet() {
    // clone active into pending
    pendingFilters = cloneFilterSets(activeFilters);
    pendingToggles = { ...activeToggles };
    pendingBands = new Set(activeBands);

    // reset views
    showFiltersMain();

    // expanded collapsed default
    filtersExpanded?.setAttribute("hidden", "");
    openSheet(sheetFilters);
  }

  // bindings
  function initFiltersUI() {
    // open drilldown
    $$("[data-fm-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-fm-open");
        if (!key) return;
        showFiltersSub(key);
      });
    });

    // toggle pills
    $$("[data-fm-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-fm-toggle");
        if (!t) return;
        pendingToggles[t] = !pendingToggles[t];
        btn.classList.toggle("is-active", pendingToggles[t]);
        renderFiltersAppliedChips();
      });
    });

    // back
    filtersBack?.addEventListener("click", () => {
      showFiltersMain();
    });

    // view all
    filtersViewAllBtn?.addEventListener("click", () => {
      if (!filtersExpanded) return;
      const isHidden = filtersExpanded.hasAttribute("hidden");
      if (isHidden) filtersExpanded.removeAttribute("hidden");
      else filtersExpanded.setAttribute("hidden", "");
    });

    // search in subview
    filtersSearch?.addEventListener("input", () => {
      const q = norm(filtersSearch.value);
      if (!q) return renderFiltersList(currentValues);
      const filtered = (currentValues || []).filter((v) => norm(v).includes(q));
      renderFiltersList(filtered);
    });

    // confirm => commit pending to active
    filtersConfirm?.addEventListener("click", () => {
      activeFilters = cloneFilterSets(pendingFilters);
      activeToggles = { ...pendingToggles };
      activeBands = new Set(pendingBands);

      closeSheet(sheetFilters);
      applyAllFilters();
    });
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

  // ✅ confirm button should be GREY by default, BLUE only if at least 1 selection
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

  function initButtons() {
    btnFilters?.addEventListener("click", (e) => {
      e.preventDefault();
      openFiltersSheet();
    });

    btnBands?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
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
    initFiltersUI();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
