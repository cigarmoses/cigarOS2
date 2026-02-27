/* /pos/cigars/brand.js
   FULL REPLACEMENT
   Fixes:
   - Filters sheet restored to OLD iOS layout (left rail + right options + search)
   - Bands sheet restored to BIG band cards + Confirm button
   - Row click navigates to cigar detail PAGE
   - + button uses data-add-to-cart so /pos/cart.js adds correctly
   - Cart icon click + badge handled by /pos/cart.js
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

  const brandParam = norm(qp("brand") || qp("b") || qp("name"));
  const brandTitle = $("#brand-title");
  const brandIcon = $("#brand-icon");
  const backBtn = $("#brand-back");

  const listRoot = $("#brand-list");
  const statusEl = $("#brand-status");

  // Controls
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  const seg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // Sheets
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  const sheetFilters = $("#sheet-filters");
  const filtersApplyBtn = $("#filters-apply");
  const filtersClearBtn = $("#filters-clear");
  const filtersRailBtns = $$(".rail-btn");
  const filtersSearch = $("#filters-search");
  const filtersOptions = $("#filters-options");

  // State
  let allRows = [];
  let brandRows = [];
  let activeWrapper = "all"; // all | maduro | natural

  const selected = {
    vitola: new Set(),
    ring: new Set(),
    length: new Set(),
    strength: new Set(),
    shape: new Set(),
    shade: new Set(),
    band: new Set(), // padron band keys
  };

  let activeTab = "vitola";

  // =========================
  // CSV parsing + column map
  // =========================
  function parseCSV(text) {
    // Simple CSV parser that supports quotes.
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i + 1];

      if (ch === '"' && inQ && nxt === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (!inQ && ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }
      if (!inQ && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && nxt === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      cur += ch;
    }
    row.push(cur);
    rows.push(row);

    // Trim trailing empty rows
    while (rows.length && rows[rows.length - 1].every((c) => !norm(c))) rows.pop();
    return rows;
  }

  function colIndex(headers) {
    const map = new Map();
    headers.forEach((h, i) => map.set(lower(h), i));
    return (keys) => {
      for (const k of keys) {
        const idx = map.get(lower(k));
        if (typeof idx === "number") return idx;
      }
      return -1;
    };
  }

  function get(row, idx, fallback = "") {
    if (idx < 0) return fallback;
    return norm(row[idx] ?? fallback);
  }

  // canonical getters with multiple header options
  let IDX = null;
  function getBrand(r) {
    return get(r, IDX(["Brand", "Manufacturer", "Maker", "Company", "brand"]));
  }
  function getLine(r) {
    return get(r, IDX(["Line", "Series", "Collection", "Product Line", "Sub Brand"]));
  }
  function getCigar(r) {
    return get(r, IDX(["Cigar Name", "Name", "Cigar", "Product"]));
  }
  function getVitola(r) {
    return get(r, IDX(["Vitola", "Style", "Size", "Vitola / Size"]));
  }
  function getRing(r) {
    return get(r, IDX(["Ring", "RG", "Ring Gauge"]));
  }
  function getLength(r) {
    return get(r, IDX(["Length", "Len"]));
  }
  function getStrength(r) {
    return get(r, IDX(["Strength"]));
  }
  function getShape(r) {
    return get(r, IDX(["Shape"]));
  }
  function getShade(r) {
    return get(r, IDX(["Wrapper Shade", "Shade", "Wrapper Color"]));
  }
  function getWrapper(r) {
    return get(r, IDX(["Wrapper", "Wrapper Type"]));
  }
  function getPrice(r) {
    const raw = get(r, IDX(["Price", "MSRP", "Retail", "Unit Price"]), "0");
    const n = parseFloat(String(raw).replace(/[^\d.]/g, "")) || 0;
    return n;
  }
  function getId(r) {
    return get(r, IDX(["ID", "Cigar ID", "Row ID", "SKU", "Key"]));
  }

  // =========================
  // Padron bands (images you already have)
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

  // =========================
  // UI helpers
  // =========================
  function openSheet(el) { el.hidden = false; document.body.style.overflow = "hidden"; }
  function closeSheet(el) { el.hidden = true; document.body.style.overflow = ""; }

  function wireSheetClose(el) {
    el.addEventListener("click", (e) => {
      if (e.target === el) closeSheet(el);
    });
    el.querySelectorAll("[data-sheet-close]").forEach((b) => b.addEventListener("click", () => closeSheet(el)));
  }

  function setStatus(msg, show = true) {
    statusEl.textContent = msg;
    statusEl.hidden = !show;
  }

  function uniqSorted(arr, numeric = false) {
    const set = new Set(arr.map(norm).filter(Boolean));
    const out = Array.from(set);
    if (numeric) out.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
    else out.sort((a, b) => a.localeCompare(b));
    return out;
  }

  // =========================
  // Filters sheet (rail + panel)
  // =========================
  function setActiveTab(tab) {
    activeTab = tab;
    filtersRailBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    renderFilterOptions();
  }

  function valuesForTab(tab) {
    switch (tab) {
      case "vitola": return uniqSorted(brandRows.map(getVitola));
      case "ring": return uniqSorted(brandRows.map(getRing), true);
      case "length": return uniqSorted(brandRows.map(getLength), true);
      case "strength": return uniqSorted(brandRows.map(getStrength));
      case "shape": return uniqSorted(brandRows.map(getShape));
      case "shade": return uniqSorted(brandRows.map(getShade));
      default: return [];
    }
  }

  function selectionSetForTab(tab) {
    switch (tab) {
      case "vitola": return selected.vitola;
      case "ring": return selected.ring;
      case "length": return selected.length;
      case "strength": return selected.strength;
      case "shape": return selected.shape;
      case "shade": return selected.shade;
      default: return new Set();
    }
  }

  function renderFilterOptions() {
    if (!filtersOptions) return;

    const q = lower(filtersSearch?.value || "");
    const values = valuesForTab(activeTab).filter((v) => !q || lower(v).includes(q));
    const selSet = selectionSetForTab(activeTab);

    filtersOptions.innerHTML = values
      .map((v) => {
        const id = `opt_${activeTab}_${lower(v).replace(/[^a-z0-9]+/g, "_")}`;
        const checked = selSet.has(v) ? "checked" : "";
        return `
          <div class="filters-opt">
            <label for="${id}">
              <input id="${id}" type="checkbox" ${checked} data-tab="${activeTab}" data-value="${encodeURIComponent(v)}">
              <span>${v}</span>
            </label>
          </div>
        `;
      })
      .join("");

    // checkbox wiring
    filtersOptions.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const tab = cb.dataset.tab;
        const value = decodeURIComponent(cb.dataset.value || "");
        const set = selectionSetForTab(tab);
        if (cb.checked) set.add(value);
        else set.delete(value);
      });
    });
  }

  function clearAllFilters() {
    Object.values(selected).forEach((set) => set.clear());
    filtersSearch.value = "";
    setActiveTab(activeTab);
  }

  function filtersMatchRow(r) {
    // wrapper segmented (Maduro/Natural)
    if (activeWrapper === "maduro") {
      const w = lower(getShade(r) || getWrapper(r));
      if (!w.includes("maduro")) return false;
    }
    if (activeWrapper === "natural") {
      const w = lower(getShade(r) || getWrapper(r));
      if (!(w.includes("natural") || w.includes("claro"))) return false;
    }

    // padron band filter
    if (selected.band.size) {
      let ok = false;
      for (const k of selected.band) {
        if (bandKeyMatchesRow(k, r)) { ok = true; break; }
      }
      if (!ok) return false;
    }

    // checkbox filters
    const checks = [
      ["vitola", getVitola],
      ["ring", getRing],
      ["length", getLength],
      ["strength", getStrength],
      ["shape", getShape],
      ["shade", getShade],
    ];

    for (const [key, fn] of checks) {
      const set = selected[key];
      if (set && set.size) {
        const v = fn(r);
        if (!set.has(v)) return false;
      }
    }
    return true;
  }

  // =========================
  // Bands sheet (big cards)
  // =========================
  function renderBands() {
    const isPadron = lower(brandParam).includes("padron");
    if (!isPadron) {
      bandsOptions.innerHTML = `<div style="padding:18px;color:rgba(255,255,255,.7)">No bands available for this brand yet.</div>`;
      return;
    }

    bandsOptions.innerHTML = PADRON_BANDS.map((b) => {
      const checked = selected.band.has(b.key) ? "checked" : "";
      return `
        <div class="band-card">
          <img src="${b.src}" alt="${b.label}">
          <div class="band-card-foot">
            <div class="band-name">${b.label}</div>
            <input class="band-check" type="checkbox" ${checked} data-band="${b.key}" aria-label="${b.label}">
          </div>
        </div>
      `;
    }).join("");

    bandsOptions.querySelectorAll("input[data-band]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const k = cb.dataset.band;
        if (!k) return;
        if (cb.checked) selected.band.add(k);
        else selected.band.delete(k);
      });
    });
  }

  // =========================
  // Wrapper segmented
  // =========================
  function setWrapper(state) {
    activeWrapper = state;
    seg.dataset.state = state;
    segMaduro.setAttribute("aria-pressed", String(state === "maduro"));
    segNatural.setAttribute("aria-pressed", String(state === "natural"));
    renderList();
  }

  function cycleWrapper() {
    if (activeWrapper === "all") setWrapper("maduro");
    else if (activeWrapper === "maduro") setWrapper("natural");
    else setWrapper("all");
  }

  // =========================
  // List rendering
  // =========================
  function fmtPrice(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function renderList() {
    if (!listRoot) return;

    const q = lower($("#brand-search")?.value || "");
    const rows = brandRows.filter((r) => {
      if (q) {
        const hay = `${lower(getCigar(r))} ${lower(getLine(r))} ${lower(getVitola(r))}`;
        if (!hay.includes(q)) return false;
      }
      return filtersMatchRow(r);
    });

    listRoot.innerHTML = rows.map((r) => {
      const name = norm(getCigar(r));
      const vitola = norm(getVitola(r));
      const price = getPrice(r);
      const id = getId(r) || `${lower(name)}_${lower(vitola)}`.replace(/[^a-z0-9_]+/g, "_");

      // Use brand icon as row image (matches your current look)
      const img = brandIcon.querySelector("img")?.getAttribute("src") || "";
      return `
        <article class="brand-row" data-row>
          <img class="row-ico" src="${img}" alt="">
          <div class="brand-row-left" data-open="${encodeURIComponent(id)}">
            <div class="brand-row-title">${name}</div>
            <div class="brand-row-sub">${vitola || norm(getShape(r))}</div>
          </div>

          <div class="brand-row-right">
            <div class="brand-row-msrp">${fmtPrice(price)}</div>
            <button
              class="pos-add"
              type="button"
              aria-label="Add"
              data-add-to-cart
              data-id="${encodeURIComponent(id)}"
              data-name="${encodeURIComponent(name)}"
              data-brand="${encodeURIComponent(brandParam || getBrand(r))}"
              data-line="${encodeURIComponent(getLine(r))}"
              data-vitola="${encodeURIComponent(vitola)}"
              data-price="${fmtPrice(price)}"
            >+</button>
          </div>
        </article>
      `;
    }).join("");

    // Row click -> detail page
    listRoot.querySelectorAll("[data-open]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = decodeURIComponent(el.getAttribute("data-open") || "");
        if (!id) return;
        location.href = `/pos/cigars/cigar.html?id=${encodeURIComponent(id)}`;
      });
    });
  }

  // =========================
  // Init
  // =========================
  async function load() {
    brandTitle.textContent = brandParam || "Brand";

    if (backBtn) backBtn.addEventListener("click", () => history.back());

    // Sheets
    wireSheetClose(sheetBands);
    wireSheetClose(sheetFilters);

    btnBands?.addEventListener("click", () => {
      renderBands();
      openSheet(sheetBands);
    });

    btnFilters?.addEventListener("click", () => {
      // reset tab UI (keep selections)
      filtersSearch.value = "";
      setActiveTab(activeTab);
      openSheet(sheetFilters);
    });

    bandsConfirmBtn?.addEventListener("click", () => {
      closeSheet(sheetBands);
      renderList();
    });

    filtersApplyBtn?.addEventListener("click", () => {
      closeSheet(sheetFilters);
      renderList();
    });

    filtersClearBtn?.addEventListener("click", () => {
      clearAllFilters();
      renderList();
    });

    filtersRailBtns.forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));

    filtersSearch?.addEventListener("input", () => renderFilterOptions());

    // Wrapper segmented
    segMaduro?.addEventListener("click", () => setWrapper(activeWrapper === "maduro" ? "all" : "maduro"));
    segNatural?.addEventListener("click", () => setWrapper(activeWrapper === "natural" ? "all" : "natural"));
    segSwitch?.addEventListener("click", cycleWrapper);

    $("#brand-search")?.addEventListener("input", renderList);

    // Fetch data
    try {
      setStatus("Loading…", true);
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const csv = await res.text();
      const table = parseCSV(csv);
      const headers = table[0] || [];
      IDX = colIndex(headers);

      allRows = table.slice(1);
      brandRows = allRows.filter((r) => {
        if (!brandParam) return true;
        return lower(getBrand(r)) === lower(brandParam);
      });

      // icon (brand tile)
      const slug = lower(brandParam).replace(/[^a-z0-9]+/g, "");
      const iconUrl = `/img/icons/brands/${slug}.svg`;
      brandIcon.innerHTML = `<img src="${iconUrl}" alt="">`;

      setStatus("", false);
      setWrapper("all");
      setActiveTab("vitola");
      renderList();
    } catch (e) {
      console.error(e);
      setStatus("Failed to load brand data.", true);
    }
  }

  load();
})();
