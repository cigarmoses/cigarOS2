/* /pos/cigars/brand.js
   FULL REPLACEMENT
   Fixes:
   ✅ Sheets now close correctly (X / tap outside / Esc)
   ✅ Filters: left rail + right options + search
   ✅ Bands: big band cards + Confirm
   ✅ Row tap navigates to cigar detail page
   ✅ Cart button routes to /pos/invoice/
*/

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
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

  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  const brandBackBtn = $("#brand-back");
  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  const invoiceBtn = $("#invoice-btn");

  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  const sheetFilters = $("#sheet-filters");
  const sheetBands = $("#sheet-bands");

  const railBtns = $$(".rail-btn");
  const filtersSearch = $("#filters-search");
  const filtersOptions = $("#filters-options");
  const filtersClearBtn = $("#filters-clear");
  const filtersApplyBtn = $("#filters-apply");

  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // =========================
  // CSV parsing
  // =========================
  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nx = line[i + 1];
      if (ch === '"') {
        if (q && nx === '"') { cur += '"'; i++; }
        else q = !q;
        continue;
      }
      if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
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

  const getCigarId = (r) => pick(r, ["Cigar ID", "cigarId", "cigarid", "cigar_id", "key", "Key", "ID", "Id"]);
  const getBrand = (r) => pick(r, ["Brand", "Brand AKA", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola", "Style"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getWrapperShade = (r) => pick(r, ["Wrapper Shade", "WrapperShade", "Shade"]);
  const getRing = (r) => pick(r, ["Ring", "Ring Gauge", "RG"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);
  const getImage = (r) => pick(r, ["Image", "Img", "Photo", "Cigar Image", "Cigar IMG"]);

  // =========================
  // STATE
  // =========================
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all",
    bandKeys: new Set(),
    activeFilterTab: "vitola",
    applied: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    }
  };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r)) === BRAND_SLUG;
  }

  // =========================
  // SHEETS open/close (BULLETPROOF)
  // =========================
  function openSheet(el) {
    if (!el) return;
    el.hidden = false; // relies on .sheet[hidden]{display:none}
  }

  function closeSheet(el) {
    if (!el) return;
    el.hidden = true;
  }

  function closeAllSheets() {
    closeSheet(sheetFilters);
    closeSheet(sheetBands);
  }

  function bindSheetCloseHandlers() {
    // Close buttons (X)
    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-sheet-close]");
      if (closeBtn) closeAllSheets();
    });

    // Tap outside the card closes
    [sheetFilters, sheetBands].forEach((sheet) => {
      if (!sheet) return;
      sheet.addEventListener("click", (e) => {
        if (e.target === sheet) closeAllSheets();
      });
    });

    // Escape closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // =========================
  // Cart -> invoice
  // =========================
  function bindInvoiceButton() {
    invoiceBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "/pos/invoice/";
    });
  }

  // =========================
  // Wrapper segmented
  // =========================
  function matchesWrapper(r) {
    const mode = state.wrapperState;
    if (mode === "all") return true;

    const blob = lower(`${getLine(r)} ${getCigar(r)} ${getWrapperShade(r)}`);
    if (mode === "maduro") return blob.includes("maduro");
    if (mode === "natural") return blob.includes("natural");
    return true;
  }

  function setWrapperState(next) {
    state.wrapperState = next;
    if (wrapperSeg) wrapperSeg.dataset.state = next;
    segMaduro?.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    segNatural?.setAttribute("aria-pressed", next === "natural" ? "true" : "false");
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

  // =========================
  // Filters
  // =========================
  function uniqSorted(arr) {
    const out = Array.from(new Set(arr.map(norm))).filter(Boolean);
    out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return out;
  }

  function buildFilterOptionsForTab(tabKey) {
    const rows = state.all.filter(inBrand);

    switch (tabKey) {
      case "vitola": return uniqSorted(rows.map(getVitola));
      case "ring": return uniqSorted(rows.map(getRing));
      case "length": return uniqSorted(rows.map(getLength));
      case "strength": return uniqSorted(rows.map(getStrength));
      case "shape": return uniqSorted(rows.map(getShape));
      case "shade": return uniqSorted(rows.map(getWrapperShade));
      default: return [];
    }
  }

  function renderFiltersOptions() {
    if (!filtersOptions) return;

    const tab = state.activeFilterTab;
    const q = lower(filtersSearch?.value || "");
    const options = buildFilterOptionsForTab(tab).filter((v) => !q || lower(v).includes(q));
    const set = state.applied[tab];

    filtersOptions.innerHTML = options.map((v) => {
      const checked = set.has(v);
      return `
        <div class="filters-opt" role="listitem">
          <label>
            <input type="checkbox" data-fk="${esc(tab)}" data-fv="${esc(v)}" ${checked ? "checked" : ""} />
            <span>${esc(v)}</span>
          </label>
        </div>
      `;
    }).join("");
  }

  function setActiveTab(tabKey) {
    state.activeFilterTab = tabKey;
    railBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-tab") === tabKey));
    if (filtersSearch) filtersSearch.value = "";
    renderFiltersOptions();
  }

  function openFiltersSheet() {
    setActiveTab(state.activeFilterTab || "vitola");
    openSheet(sheetFilters);
  }

  function bindFiltersSheet() {
    railBtns.forEach((b) => {
      b.addEventListener("click", () => setActiveTab(b.getAttribute("data-tab") || "vitola"));
    });

    filtersSearch?.addEventListener("input", renderFiltersOptions);

    filtersOptions?.addEventListener("change", (e) => {
      const cb = e.target.closest?.("input[type='checkbox']");
      if (!cb) return;
      const fk = cb.getAttribute("data-fk");
      const fv = cb.getAttribute("data-fv");
      if (!fk || !fv) return;
      const set = state.applied[fk];
      if (!set) return;
      cb.checked ? set.add(fv) : set.delete(fv);
    });

    filtersClearBtn?.addEventListener("click", () => {
      Object.values(state.applied).forEach((s) => s.clear());
      renderFiltersOptions();
    });

    filtersApplyBtn?.addEventListener("click", () => {
      closeAllSheets();
      apply();
    });
  }

  function rowPassesAppliedFilters(r) {
    const want = state.applied;
    const checks = [
      ["vitola", getVitola],
      ["ring", getRing],
      ["length", getLength],
      ["strength", getStrength],
      ["shape", getShape],
      ["shade", getWrapperShade],
    ];

    for (const [k, fn] of checks) {
      const set = want[k];
      if (set && set.size) {
        const v = norm(fn(r));
        if (!set.has(v)) return false;
      }
    }
    return true;
  }

  // =========================
  // Bands (Padron demo mapping)
  // =========================
  const PADRON_BANDS = [
    { key: "padronseriesband", label: "Padron Series", src: "/img/icons/padronseriesband.svg" },
    { key: "padronfamilyreserveband", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
    { key: "padron1926serieband", label: "1926", src: "/img/icons/padron1926serieband.svg" },
    { key: "padronblackseriesband", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
    { key: "padron1964anniversaryband", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
    { key: "padrondamasoband", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
  ];

  function bandKeyMatchesRow(bandKey, r) {
    const full = `${lower(getLine(r))} ${lower(getCigar(r))}`;
    switch (bandKey) {
      case "padron1926serieband": return full.includes("1926");
      case "padron1964anniversaryband": return full.includes("1964");
      case "padronfamilyreserveband": return full.includes("family reserve") || full.includes("familyreserve");
      case "padrondamasoband": return full.includes("damaso");
      case "padronblackseriesband": return full.includes("black");
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

    bandsOptionsEl.innerHTML = items.map((b) => {
      const checked = state.bandKeys.has(b.key);
      return `
        <div class="band-card">
          <img src="${esc(b.src)}" alt="${esc(b.label)}" />
          <div class="band-card-foot">
            <div class="band-name">${esc(b.label)}</div>
            <input class="band-check" type="checkbox" data-band-key="${esc(b.key)}" ${checked ? "checked" : ""} />
          </div>
        </div>
      `;
    }).join("");

    $$("[data-band-key]", bandsOptionsEl).forEach((cb) => {
      cb.addEventListener("change", () => {
        const k = cb.getAttribute("data-band-key");
        if (!k) return;
        cb.checked ? state.bandKeys.add(k) : state.bandKeys.delete(k);
      });
    });
  }

  function rowPassesBands(r) {
    if (!state.bandKeys.size) return true;
    for (const k of state.bandKeys) if (bandKeyMatchesRow(k, r)) return true;
    return false;
  }

  function openBandsSheet() {
    renderBandsOptions();
    openSheet(sheetBands);
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", openBandsSheet);
    bandsConfirmBtn?.addEventListener("click", () => {
      closeAllSheets();
      apply();
    });
  }

  // =========================
  // Apply + render list
  // =========================
  function apply() {
    const q = lower(state.q);

    state.view = state.all
      .filter(inBrand)
      .filter(matchesWrapper)
      .filter(rowPassesBands)
      .filter(rowPassesAppliedFilters)
      .filter((r) => {
        if (!q) return true;
        const blob = lower([
          getLine(r), getCigar(r), getVitola(r), getRing(r), getLength(r),
          getStrength(r), getShape(r), getWrapperShade(r), getMSRP(r)
        ].join(" "));
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

    listEl.innerHTML = state.view.map((r) => {
      const cigarId = norm(getCigarId(r));
      const brand = norm(getBrand(r));
      const line = norm(getLine(r));
      const cigar = norm(getCigar(r));
      const title = `${line ? line + " " : ""}${cigar}`.trim();

      const vitola = norm(getVitola(r));
      const msrp = norm(getMSRP(r));
      const image = norm(getImage(r));

      const brandIconSrc = `/img/icons/brands/${slug(brand || BRAND)}.svg`;

      return `
        <div class="brand-row" data-row data-id="${esc(cigarId)}">
          <img class="row-ico" alt="" src="${esc(brandIconSrc)}" />
          <div class="brand-row-left" data-open-detail="1">
            <div class="brand-row-title">${esc(title || cigar)}</div>
            <div class="brand-row-sub">${esc(vitola)}</div>
          </div>
          <div class="brand-row-right">
            <div class="brand-row-msrp">${esc(msrp)}</div>
            <button type="button"
              class="pos-add add-to-cart"
              aria-label="Add to invoice"
              data-type="cigar"
              data-id="${esc(cigarId)}"
              data-brand="${esc(brand || BRAND)}"
              data-line="${esc(line)}"
              data-name="${esc(cigar)}"
              data-vitola="${esc(vitola)}"
              data-msrp="${esc(msrp)}"
              data-image="${esc(image)}">+</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function bindRowNav() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      if (e.target.closest?.(".pos-add")) return; // cart.js handles
      const row = e.target.closest?.("[data-row]");
      if (!row) return;
      if (!e.target.closest?.("[data-open-detail]")) return;

      const id = norm(row.getAttribute("data-id") || "");
      if (!id) return;

      location.href = `/pos/cigars/cigar.html?id=${encodeURIComponent(id)}`;
    });
  }

  // =========================
  // Boot
  // =========================
  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    brandBackBtn?.addEventListener("click", () => history.back());

    if (brandIconWrap && BRAND_SLUG) {
      const src = `/img/icons/brands/${BRAND_SLUG}.svg`;
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="">`;
    }

    // Ensure sheets are closed on load no matter what
    closeAllSheets();

    bindSheetCloseHandlers();
    bindInvoiceButton();
    bindRowNav();
    bindWrapperToggle();
    bindBandsUI();
    bindFiltersSheet();

    filtersBtn?.addEventListener("click", openFiltersSheet);

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
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
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
