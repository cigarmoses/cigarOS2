/* /pos/cigars/brand.js
   FULL REPLACEMENT
   Fixes:
   - Filters sheet restored (brand-only; no manufacturer/brand filters)
   - Bands UI = big bands
   - Wrapper toggle sizing/position stays in row
   - Row click goes to DETAIL PAGE (not image popup)
   - Green + adds to invoice/cart
   - Cart icon click goes to invoice page
*/

(() => {
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

  // ---- brand context ----
  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---- DOM ----
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");

  const brandBackBtn = $("#brand-back");
  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  const invoiceBtn = $("#invoice-btn");
  const invoiceIcon = $("#invoice-icon");

  // Wrapper segmented control
  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // Sheets
  const sheetBands = $("#sheet-bands");
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  const sheetFilters = $("#sheet-filters");
  const filtersApplyBtn = $("#filters-apply");
  const filtersClearBtn = $("#filters-clear");

  const fRing = $("#f-ring");
  const fLength = $("#f-length");
  const fShade = $("#f-shade");
  const fShape = $("#f-shape");
  const fVitola = $("#f-vitola");
  const fStrength = $("#f-strength");

  // =========================================================
  // Invoice helpers
  // =========================================================
  function openInvoice() {
    location.href = "/pos/invoice.html";
  }

  function bindInvoiceButton() {
    if (!invoiceBtn) return;
    invoiceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInvoice();
    });
  }

  function refreshInvoiceIcon() {
    if (!invoiceIcon) return;

    const count =
      Number(window.CigarOSCart?.count?.()) ||
      Number(window.CigarOSCart?.items?.length) ||
      0;

    // Theme swap handled by /js/theme-toggle.js; here we only switch red if items exist (optional).
    // If you want ALWAYS red when items exist, keep this:
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (count > 0) {
      invoiceIcon.src = "/img/icons/cart-red.svg";
    } else {
      invoiceIcon.src = isDark ? "/img/icons/cart-red.svg" : "/img/icons/cart-blue.svg";
    }
  }

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

  const getBrand = (r) => pick(r, ["Brand", "Brand AKA", "Brand aka", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line", "Series", "Collection"]);
  const getCigar = (r) => pick(r, ["Cigar", "Name", "Cigar Name"]);
  const getVitola = (r) => pick(r, ["Vitola", "Style"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getWrapperShade = (r) => pick(r, ["Wrapper Shade", "WrapperShade", "Shade"]);
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
  // STATE
  // =========================================================
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all",
    bandKeys: new Set(),
    applied: {
      ring: new Set(),
      length: new Set(),
      shade: new Set(),
      shape: new Set(),
      vitola: new Set(),
      strength: new Set(),
    },
  };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r)) === BRAND_SLUG;
  }

  // =========================================================
  // WRAPPER TOGGLE
  // =========================================================
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

  // =========================================================
  // BANDS (Padron only)
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
        <label class="bands-row">
          <div class="bands-art">
            <img class="bands-img" src="${esc(b.src)}" alt="${esc(b.label)}" />
          </div>
          <div class="bands-meta">
            <div class="bands-label">${esc(b.label)}</div>
          </div>
          <input class="bands-check" type="checkbox" data-band-key="${esc(b.key)}" ${checked ? "checked" : ""} />
        </label>
      `;
    }).join("");

    $$("[data-band-key]", bandsOptionsEl).forEach((cb) => {
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
    openSheet(sheetBands);
  }

  // =========================================================
  // FILTERS SHEET (brand-only)
  // =========================================================
  function uniqSorted(arr) {
    const out = Array.from(new Set(arr.map(norm))).filter(Boolean);
    out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return out;
  }

  function chipHTML(label, groupKey, active) {
    return `
      <button type="button"
        class="fchip ${active ? "is-on" : ""}"
        data-fg="${esc(groupKey)}"
        data-fv="${esc(label)}">
        ${esc(label)}
      </button>
    `;
  }

  function buildFilterOptions() {
    // brand scoped
    const rows = state.all.filter(inBrand);

    const rings = uniqSorted(rows.map(getRing));
    const lengths = uniqSorted(rows.map(getLength));
    const shades = uniqSorted(rows.map(getWrapperShade));
    const shapes = uniqSorted(rows.map(getShape));
    const vitolas = uniqSorted(rows.map(getVitola));
    const strengths = uniqSorted(rows.map(getStrength));

    if (fRing) fRing.innerHTML = rings.map(v => chipHTML(v, "ring", state.applied.ring.has(v))).join("");
    if (fLength) fLength.innerHTML = lengths.map(v => chipHTML(v, "length", state.applied.length.has(v))).join("");
    if (fShade) fShade.innerHTML = shades.map(v => chipHTML(v, "shade", state.applied.shade.has(v))).join("");
    if (fShape) fShape.innerHTML = shapes.map(v => chipHTML(v, "shape", state.applied.shape.has(v))).join("");
    if (fVitola) fVitola.innerHTML = vitolas.map(v => chipHTML(v, "vitola", state.applied.vitola.has(v))).join("");
    if (fStrength) fStrength.innerHTML = strengths.map(v => chipHTML(v, "strength", state.applied.strength.has(v))).join("");
  }

  function openFiltersSheet() {
    buildFilterOptions();
    openSheet(sheetFilters);
  }

  function bindFiltersSheet() {
    if (!sheetFilters) return;

    sheetFilters.addEventListener("click", (e) => {
      const chip = e.target.closest?.(".fchip");
      if (!chip) return;

      const g = chip.getAttribute("data-fg");
      const v = chip.getAttribute("data-fv");
      if (!g || !v) return;

      const set = state.applied[g];
      if (!set) return;

      if (set.has(v)) set.delete(v);
      else set.add(v);

      chip.classList.toggle("is-on");
    });

    filtersClearBtn?.addEventListener("click", () => {
      Object.values(state.applied).forEach((s) => s.clear());
      buildFilterOptions();
    });

    filtersApplyBtn?.addEventListener("click", () => {
      closeSheets();
      apply();
    });
  }

  // =========================================================
  // SHEET OPEN/CLOSE
  // =========================================================
  function openSheet(el) {
    if (!el) return;
    document.body.classList.add("pos-modal-open");
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-open"));
  }

  function closeSheets() {
    document.body.classList.remove("pos-modal-open");
    [sheetBands, sheetFilters].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-open");
      el.hidden = true;
    });
  }

  function bindSheetClosers() {
    $$("[data-sheet-close]").forEach((btn) => btn.addEventListener("click", closeSheets));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSheets();
    });

    [sheetBands, sheetFilters].forEach((el) => {
      if (!el) return;
      el.addEventListener("click", (e) => {
        if (e.target === el) closeSheets();
      });
    });
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", openBandsSheet);
    bandsConfirmBtn?.addEventListener("click", () => {
      closeSheets();
      apply();
    });
  }

  // =========================================================
  // APPLY + RENDER
  // =========================================================
  function rowPassesAppliedFilters(r) {
    if (!matchesWrapper(r)) return false;

    if (state.bandKeys.size) {
      let ok = false;
      for (const k of state.bandKeys) {
        if (bandKeyMatchesRow(k, r)) { ok = true; break; }
      }
      if (!ok) return false;
    }

    const ring = norm(getRing(r));
    const length = norm(getLength(r));
    const shade = norm(getWrapperShade(r));
    const shape = norm(getShape(r));
    const vitola = norm(getVitola(r));
    const strength = norm(getStrength(r));

    if (state.applied.ring.size && !state.applied.ring.has(ring)) return false;
    if (state.applied.length.size && !state.applied.length.has(length)) return false;
    if (state.applied.shade.size && !state.applied.shade.has(shade)) return false;
    if (state.applied.shape.size && !state.applied.shape.has(shape)) return false;
    if (state.applied.vitola.size && !state.applied.vitola.has(vitola)) return false;
    if (state.applied.strength.size && !state.applied.strength.has(strength)) return false;

    return true;
  }

  function apply() {
    const q = lower(state.q);

    state.view = state.all
      .filter(inBrand)
      .filter(rowPassesAppliedFilters)
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

    listEl.innerHTML = state.view.map((r) => {
      const brand = norm(getBrand(r));
      const line = norm(getLine(r));
      const cigar = norm(getCigar(r));
      const cigarFull = `${line} ${cigar}`.trim();

      const vitola = norm(getVitola(r));
      const msrp = norm(getMSRP(r));
      const ring = norm(getRing(r));
      const length = norm(getLength(r));
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
          data-ring="${esc(ring)}"
          data-length="${esc(length)}"
          data-msrp="${esc(msrp)}"
          data-image="${esc(image)}">

          <img class="row-ico" alt="" src="${esc(brandIconSrc)}" />

          <div class="brand-row-left" data-open-detail="1">
            <div class="brand-row-title"><div>${esc(cigarFull || cigar)}</div></div>
            <div class="brand-row-sub"><div>${esc(vitola)}</div></div>
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
    }).join("");
  }

  // =========================================================
  // CLICK HANDLERS
  // =========================================================
  function addToCartFromJSON(json) {
    try {
      const item = JSON.parse(json);
      // Support either Cart.add(item) or add({id,name,price...})
      if (window.CigarOSCart?.add) {
        window.CigarOSCart.add({
          id: item.key || `${item.name}-${item.sub}`,
          name: item.name,
          brand: item.meta?.brand || BRAND,
          category: item.category || "Cigars",
          sub: item.sub || "",
          price: Number(item.price || 0),
          qty: 1,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function goToDetailPage(rowEl) {
    const brand = norm(rowEl.dataset.brand || BRAND);
    const cigarFull = norm(rowEl.dataset.cigarFull || rowEl.dataset.cigar || "");
    const vitola = norm(rowEl.dataset.vitola || "");
    const ring = norm(rowEl.dataset.ring || "");
    const length = norm(rowEl.dataset.length || "");
    const msrp = norm(rowEl.dataset.msrp || "");
    const img = norm(rowEl.dataset.image || "");

    // NOTE: this assumes you have /pos/cigars/detail.html
    // If your file name differs, change it here.
    const url =
      `/pos/cigars/detail.html` +
      `?brand=${encodeURIComponent(brand)}` +
      `&cigar=${encodeURIComponent(cigarFull)}` +
      `&vitola=${encodeURIComponent(vitola)}` +
      `&ring=${encodeURIComponent(ring)}` +
      `&length=${encodeURIComponent(length)}` +
      `&msrp=${encodeURIComponent(msrp)}` +
      `&img=${encodeURIComponent(img)}`;

    location.href = url;
  }

  function bindClicks() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      // add button
      const addBtn = e.target.closest?.("[data-receipt-item]");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        const json = addBtn.getAttribute("data-receipt-item") || "";
        const ok = addToCartFromJSON(json);
        refreshInvoiceIcon();
        if (!ok) console.warn("Cart add failed (window.CigarOSCart.add missing?)");
        return;
      }

      // open detail page (only when clicking the left text area)
      const row = e.target.closest?.("[data-row]");
      if (!row) return;

      const left = e.target.closest?.("[data-open-detail]");
      if (!left) return;

      goToDetailPage(row);
    });
  }

  // =========================================================
  // BOOT
  // =========================================================
  async function boot() {
    // ensure theme attribute exists (prevents “scale jump”)
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute("data-theme", "light");
    }

    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    brandBackBtn?.addEventListener("click", () => history.back());

    if (brandIconWrap) {
      const src = `/img/icons/brands/${BRAND_SLUG}.svg`;
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="">`;
    }

    bindInvoiceButton();
    bindClicks();
    bindSheetClosers();
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

    refreshInvoiceIcon();
    setInterval(refreshInvoiceIcon, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
