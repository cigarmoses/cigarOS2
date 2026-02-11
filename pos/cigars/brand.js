/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Fixes blur issue:
   - Uses .sheet pseudo-backdrop (blur behind only)
   - Overrides any global filter/blur on body.pos-modal-open in brand.css

   ✅ Brand Filters UI now matches main cigars page layout (minus Manufacturers + Brands)
*/

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
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

  // ---- brand context ----
  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---- DOM (page) ----
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  const brandBackBtn = $("#brand-back");
  const posBackBtn = $(".pos-back");
  const backBtn = brandBackBtn || posBackBtn;

  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  // Maduro/Natural segmented control
  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // Sheets (Bands) — already in brand.html
  const sheetBands = $("#sheet-bands");
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // =========================================================
  // CSV parsing
  // =========================================================
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

  // HUB header fallbacks
  const getBrand = (r) => pick(r, ["Brand", "Brand AKA", "Brand aka", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola", "Style"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getRing = (r) => pick(r, ["RG", "Ring", "Ring Gauge"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getMSRP = (r) => pick(r, ["MSRP", "Price"]);

  const getWrapperShade = (r) =>
    pick(r, ["Wrapper Shade", "WrapperShade", "Wrapper shade", "wrapper shade", "Shade"]);

  const getWrapper = (r) => pick(r, ["Wrapper", "Wrapper Type"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin", "Country", "Country of Origin"]);
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
  // ✅ STATE
  // =========================================================
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all", // all | maduro | natural
    bandKeys: new Set(),

    // Brand page filters (same categories as main page minus manufacturer/brand)
    filters: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
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

  function matchesWrapper(r) {
    const mode = state.wrapperState;
    if (mode === "all") return true;

    const line = norm(getLine(r));
    const cigar = norm(getCigar(r));
    const blob = lower(`${line} ${cigar}`);

    if (mode === "maduro") return blob.includes("maduro");
    if (mode === "natural") return blob.includes("natural");
    return true;
  }

  // =========================================================
  // ✅ BANDS (Padron SVG artwork)
  // =========================================================
  const PADRON_BANDS = [
    { key: "padronseriesband", label: "Padron Series", src: "/img/icons/padronseriesband.svg" },
    { key: "padronfamilyreserveband", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
    { key: "padron1926serieband", label: "1926", src: "/img/icons/padron1926serieband.svg" },
    { key: "padronblackseriesband", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
    { key: "padron1964anniversaryband", label: "1964", src: "/img/icons/padron1964anniversaryband.svg" },
    { key: "padrondamasoband", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
  ];

  function bandKeyMatchesRow(bandKey, r) {
    const line = lower(getLine(r));
    const cigar = lower(getCigar(r));
    const full = `${line} ${cigar}`;

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

    bandsOptionsEl.innerHTML = items
      .map((b) => {
        const checked = state.bandKeys.has(b.key);
        return `
          <div class="band-row">
            <div class="band-art">
              <img class="band-img" src="${esc(b.src)}" alt="${esc(b.label)}">
            </div>
            <div class="band-meta">
              <div class="band-label">${esc(b.label)}</div>
              <input class="band-check" type="checkbox" data-band-key="${esc(b.key)}" ${checked ? "checked" : ""} />
            </div>
          </div>
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
    if (!sheetBands) return;
    renderBandsOptions();
    document.body.classList.add("pos-modal-open");
    sheetBands.hidden = false;
  }

  function closeBandsSheet() {
    if (!sheetBands) return;
    sheetBands.hidden = true;
    document.body.classList.remove("pos-modal-open");
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", openBandsSheet);

    // Close X button (data-sheet-close exists in your markup)
    $$("[data-sheet-close]", sheetBands || document).forEach((btn) => {
      btn.addEventListener("click", closeBandsSheet);
    });

    // Confirm -> apply
    bandsConfirmBtn?.addEventListener("click", () => {
      closeBandsSheet();
      apply();
    });

    // click outside content closes (tap backdrop area)
    sheetBands?.addEventListener("click", (e) => {
      if (e.target === sheetBands) closeBandsSheet();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheetBands?.hidden) closeBandsSheet();
    });
  }

  // =========================================================
  // ✅ FILTER MODAL (same layout as main cigars page, minus manufacturer/brand)
  // =========================================================
  let fmRoot = null;

  const FILTER_CATS = [
    { key: "vitola", label: "Vitolas" },
    { key: "ring", label: "Ring" },
    { key: "length", label: "Length" },
    { key: "strength", label: "Strength" },
    { key: "shape", label: "Shape" },
    { key: "shade", label: "Wrap. Shade" },
  ];

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

  const VITOLA_ORDER = [
    "Toro","Robusto","Gordo","Churchill","Corona","Petit Corona","Corona Gorda","Lonsdale",
    "Lancero","Panetela","Belicoso","Torpedo","Piramide","Perfecto","Diadema","Figurado",
    "Double Corona","Petit Robusto","Short Robusto",
  ];

  function uniqSorted(values) {
    const set = new Set();
    for (const v of values) {
      const s = norm(v);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function orderList(values, preferredOrder) {
    const list = uniqSorted(values);
    const seen = new Set();
    const ordered = [];

    for (const item of preferredOrder) {
      const match = list.find((v) => v.toLowerCase() === item.toLowerCase());
      if (match) {
        ordered.push(match);
        seen.add(match.toLowerCase());
      }
    }
    for (const v of list) {
      const k = v.toLowerCase();
      if (!seen.has(k)) ordered.push(v);
    }
    return ordered;
  }

  function getRowValByKey(r, key) {
    switch (key) {
      case "vitola": return norm(getVitola(r));
      case "ring": return norm(getRing(r));
      case "length": return norm(getLength(r));
      case "strength": return norm(getStrength(r));
      case "shape": return norm(getShape(r));
      case "shade": return norm(getWrapperShade(r));
      default: return "";
    }
  }

  function valuesForKey(key) {
    const vals = [];
    state.all.filter(inBrand).forEach((r) => {
      const v = getRowValByKey(r, key);
      if (v) vals.push(v);
    });

    if (key === "shade") return orderList(vals, WRAPPER_SHADE_ORDER);
    if (key === "vitola") return orderList(vals, VITOLA_ORDER);

    if (key === "ring") return uniqSorted(vals).sort((a, b) => Number(a) - Number(b));
    if (key === "length") {
      return uniqSorted(vals).sort((a, b) => {
        const na = Number(String(a).replace(/[^\d.]/g, ""));
        const nb = Number(String(b).replace(/[^\d.]/g, ""));
        return na - nb;
      });
    }

    return uniqSorted(vals);
  }

  const fmState = {
    activeKey: "vitola",
    activeValues: [],
    activeSearch: "",
  };

  function ensureFilterModal() {
    if (fmRoot) return;

    fmRoot = document.createElement("div");
    fmRoot.id = "filter-modal";
    fmRoot.className = "fm fm--hidden";
    fmRoot.setAttribute("aria-hidden", "true");

    fmRoot.innerHTML = `
      <div class="fm__backdrop" data-fm-close></div>

      <div class="fm__sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="fm__header">
          <h2 class="fm__title">Filters</h2>
          <button class="fm__close" type="button" aria-label="Close filters" data-fm-close>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="fm__body">
          <div class="fm__cats" id="fm-cats"></div>

          <div class="fm__panel">
            <div class="fm__search-row">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                      fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
              </svg>
              <input class="fm__search-input" id="fm-search" placeholder="Search" autocomplete="off" />
              <button class="fm__mic-btn" type="button" aria-label="Voice search (coming soon)"></button>
            </div>

            <div class="fm__list" id="fm-list"></div>
          </div>
        </div>

        <div class="fm__actions">
          <button class="fm__btn fm__btn--reset" type="button" id="fm-reset">Reset</button>
          <button class="fm__btn fm__btn--apply" type="button" id="fm-apply">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(fmRoot);

    // close handlers
    fmRoot.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-fm-close]")) closeFilterModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && fmRoot && !fmRoot.classList.contains("fm--hidden")) {
        closeFilterModal();
      }
    });

    // reset/apply
    fmRoot.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.closest("#fm-reset")) {
        Object.keys(state.filters).forEach((k) => state.filters[k].clear());
        renderFMList();
        return;
      }

      if (t.closest("#fm-apply")) {
        closeFilterModal();
        apply();
      }
    });

    // search
    fmRoot.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.id !== "fm-search") return;
      fmState.activeSearch = t.value || "";
      renderFMList();
    });
  }

  function openFilterModal() {
    ensureFilterModal();

    document.body.classList.add("pos-modal-open");
    fmRoot.classList.remove("fm--hidden");
    fmRoot.setAttribute("aria-hidden", "false");

    renderFMCats();
    setFMCategory(fmState.activeKey);

    window.setTimeout(() => {
      $("#fm-search", fmRoot)?.focus();
    }, 60);
  }

  function closeFilterModal() {
    if (!fmRoot) return;
    fmRoot.classList.add("fm--hidden");
    fmRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pos-modal-open");
  }

  function renderFMCats() {
    const catsEl = $("#fm-cats", fmRoot);
    if (!catsEl) return;

    catsEl.innerHTML = FILTER_CATS.map((c) => {
      const active = c.key === fmState.activeKey ? "is-active" : "";
      return `<button class="fm__cat-btn ${active}" type="button" data-cat="${esc(c.key)}">${esc(c.label)}</button>`;
    }).join("");

    $$(".fm__cat-btn", catsEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-cat");
        if (!key) return;
        setFMCategory(key);
      });
    });
  }

  function setFMCategory(key) {
    if (!state.filters[key]) return;

    fmState.activeKey = key;
    fmState.activeSearch = "";

    const inp = $("#fm-search", fmRoot);
    if (inp) inp.value = "";

    $$(".fm__cat-btn", fmRoot).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-cat") === key);
    });

    fmState.activeValues = valuesForKey(key);
    renderFMList();
  }

  function renderFMList() {
    const listEl = $("#fm-list", fmRoot);
    if (!listEl) return;

    const key = fmState.activeKey;
    const selectedSet = state.filters[key];
    const q = lower(fmState.activeSearch);

    const values = fmState.activeValues || [];
    const filtered = !q ? values : values.filter((v) => lower(v).includes(q));

    listEl.innerHTML = filtered.map((v) => {
      const label = norm(v);
      const isOn = selectedSet.has(label);

      return `
        <div class="fm__row ${isOn ? "is-selected" : ""}" data-value="${esc(label)}">
          <div class="fm__label">${esc(label)}</div>
          <div class="fm__cb ${isOn ? "is-checked" : ""}" aria-hidden="true">
            ${isOn ? `
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            ` : ``}
          </div>
        </div>
      `;
    }).join("");

    $$(".fm__row", listEl).forEach((row) => {
      row.addEventListener("click", () => {
        const val = row.getAttribute("data-value") || "";
        if (!val) return;

        if (selectedSet.has(val)) selectedSet.delete(val);
        else selectedSet.add(val);

        renderFMList();
      });
    });
  }

  function bindFiltersUI() {
    filtersBtn?.addEventListener("click", openFilterModal);
  }

  // =========================================================
  // ✅ APPLY FILTERS + RENDER
  // =========================================================
  function rowPassesFilters(r) {
    if (!matchesWrapper(r)) return false;

    // Bands filter
    if (state.bandKeys.size) {
      let ok = false;
      for (const k of state.bandKeys) {
        if (bandKeyMatchesRow(k, r)) { ok = true; break; }
      }
      if (!ok) return false;
    }

    // Main filters (multi-select)
    for (const key of Object.keys(state.filters)) {
      const set = state.filters[key];
      if (!set || set.size === 0) continue;

      const v = getRowValByKey(r, key);
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
            data-vitola="${esc(vitola)}"
            data-ring="${esc(norm(getRing(r)))}"
            data-length="${esc(norm(getLength(r)))}"
            data-shape="${esc(norm(getShape(r)))}"
            data-strength="${esc(norm(getStrength(r)))}"
            data-wrapper="${esc(norm(getWrapper(r)))}"
            data-binder="${esc(norm(getBinder(r)))}"
            data-filler="${esc(norm(getFiller(r)))}"
            data-origin="${esc(norm(getOrigin(r)))}"
            data-wrapper-shade="${esc(norm(getWrapperShade(r)))}"
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

  // =========================================================
  // ✅ Row click -> detail (kept simple: uses existing behavior if you add it later)
  // =========================================================
  function bindClicks() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const add = e.target.closest("[data-receipt-item]");
      if (add) return;

      // (You can re-hook your cigar detail modal here if needed)
    });
  }

  // =========================================================
  // ✅ BOOT
  // =========================================================
  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    if (brandIconWrap) {
      const src = `/img/icons/brands/${BRAND_SLUG}.svg`;
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="">`;
    }

    bindClicks();
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
