/* /pos/cigars/brand.js
   Brand page
   - Loads cigar rows from Google Sheets CSV
   - Brand-specific filtering
   - Bands sheet
   - Bottom-sheet filters
   - Cart qty steppers
   - Vitola/shape SVG icons in brand filters
*/

(() => {
  "use strict";

  const CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brandTitle = $("#brand-title");
  const brandIconImg = $("#brand-icon-img");
  const searchInput = $("#brand-search");
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");
  const seg = $("#wrapper-seg");
  const segSwitch = $("#wrapper-switch");
  const segBtns = $$(".seg-btn", seg || document);
  const listEl = $("#brand-list");
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");
  const backBtn = $("#back-btn");
  const brandSearchBtn = $("#brandSearchBtn");

  const state = {
    brand: "",
    rowsAll: [],
    search: "",
    wrapperMode: "all",
    bandSelected: new Set(),
    filters: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
  };

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }

  function normalizeFilenamePart(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseMoneyValue(v) {
    const cleaned = String(v || "").replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtMoney(v) {
    const n = parseMoneyValue(v);
    return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
  }

  function parseCSV(text) {
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cur.push(field);
          field = "";
        } else if (ch === "\n") {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if (ch !== "\r") {
          field += ch;
        }
      }
    }

    cur.push(field);
    rows.push(cur);
    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "_");
  }

  function mapRows(csv) {
    const header = csv[0] || [];
    const keys = header.map(normalizeHeader);
    const out = [];

    for (let i = 1; i < csv.length; i++) {
      const r = csv[i];
      if (!r || r.every((c) => !String(c || "").trim())) continue;

      const obj = {};
      keys.forEach((k, idx) => {
        obj[k] = (r[idx] ?? "").trim();
      });
      out.push(obj);
    }

    return out;
  }

  function getField(r, keys) {
    for (const k of keys) {
      if (r && r[k] != null && String(r[k]).trim() !== "") {
        return String(r[k]).trim();
      }
    }
    return "";
  }

  function resolveBrandVal(r) {
    return getField(r, ["brand", "brand_name", "manufacturer_brand", "cigar_brand"]);
  }

  function resolveManufacturerVal(r) {
    return getField(r, ["manufacturer", "maker"]);
  }

  function resolveDetailKey(r) {
    return getField(r, ["key", "cigar_id", "id", "row_id"]);
  }

  function resolveName(r) {
    return getField(r, ["cigar"]); // strictly column H
  }

  function resolveLine(r) {
    return getField(r, ["line"]); // strictly column G
  }

  function resolveDisplayName(r) {
    const line = resolveLine(r);
    const name = resolveName(r);

    if (line && name) return `${line} ${name}`.replace(/\s+/g, " ").trim();
    return (line || name || "").replace(/\s+/g, " ").trim();
  }

  function resolveVitola(r) {
    return getField(r, ["vitola", "style", "vitola_name"]);
  }

  function resolvePrice(r) {
    return fmtMoney(getField(r, ["msrp", "price", "cost", "cigar_cost"]));
  }

  function resolvePriceNumber(r) {
    return parseMoneyValue(getField(r, ["msrp", "price", "cost", "cigar_cost"]));
  }

  function resolveRing(r) {
    return getField(r, ["ring", "ring_gauge", "rg"]);
  }

  function resolveLength(r) {
    return getField(r, ["length"]);
  }

  function resolveShape(r) {
    return getField(r, ["shape"]);
  }

  function resolveWrapper(r) {
    return getField(r, ["wrapper"]);
  }

  function resolveBinder(r) {
    return getField(r, ["binder"]);
  }

  function resolveFiller(r) {
    return getField(r, ["filler"]);
  }

  function resolveOrigin(r) {
    return getField(r, ["origin", "country_of_origin", "country"]);
  }

  function resolveStrength(r) {
    return getField(r, ["strength"]);
  }

  function resolveShade(r) {
    return getField(r, ["wrapper_shade", "wrapper_shade_type", "shade", "wrapper"]);
  }

  function resolveImage(r) {
    return getField(r, ["cigar_img", "image", "img", "photo", "cigar_image"]);
  }

  function resolveBrandImage(r) {
    return getField(r, ["brand_img", "brand_image", "brandicon", "brand_icon"]);
  }

  function resolveUrl(r) {
    return getField(r, ["url", "link", "href", "page_url", "product_url", "slug_url"]);
  }

  function buildGeneratedImageNames(r) {
    const brand = normalizeFilenamePart(resolveBrandVal(r) || state.brand);
    const line = normalizeFilenamePart(resolveLine(r));
    const cigar = normalizeFilenamePart(resolveName(r));
    const vitola = normalizeFilenamePart(resolveVitola(r));

    const names = [];

    if (brand && line && cigar) {
      names.push(`${brand}${line}${cigar}`);
    }

    if (brand && line && cigar && vitola) {
      names.push(`${brand}${line}${cigar}${vitola}`);
    }

    if (line && cigar) {
      names.push(`${line}${cigar}`);
    }

    if (line && cigar && vitola) {
      names.push(`${line}${cigar}${vitola}`);
    }

    return Array.from(new Set(names));
  }

  function brandIconPath() {
    const row = state.rowsAll.find((r) => normalizeBrand(resolveBrandVal(r)) === normalizeBrand(state.brand));
    const fromSheet = normalizeAssetPath(row ? resolveBrandImage(row) : "");
    if (fromSheet) return fromSheet;
    return `/img/icons/brands/${normalizeBrand(state.brand)}.svg`;
  }

  function listRowImageCandidates(r) {
    const candidates = [];
    const fromSheet = normalizeAssetPath(resolveImage(r));
    const brandFolder = normalizeBrand(resolveBrandVal(r) || state.brand);

    if (fromSheet) candidates.push(fromSheet);

    buildGeneratedImageNames(r).forEach((name) => {
      candidates.push(`/img/cigars/${brandFolder}/${name}.png`);
    });

    candidates.push(brandIconPath());

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function listRowIconPath(r) {
    const candidates = listRowImageCandidates(r);
    return candidates[0] || brandIconPath();
  }

  function bindImageFallback(img, candidates) {
    if (!img || !Array.isArray(candidates) || !candidates.length) return;

    let index = 0;
    img.src = candidates[index];

    img.addEventListener("error", () => {
      index += 1;
      if (index < candidates.length) {
        img.src = candidates[index];
      }
    });
  }

  function resolveBand(r) {
    const direct = getField(r, ["band", "band_key", "band_group", "band_name"]);
    if (direct) return direct;

    if (normalizeBrand(state.brand) !== "padron") return "";

    const full = `${resolveName(r)} ${resolveVitola(r)} ${resolveShade(r)}`.toLowerCase();

    if (full.includes("family reserve")) return "Family Reserve";
    if (full.includes("1964") || full.includes("anniversary")) return "1964 Anniversary";
    if (full.includes("1926")) return "1926";
    if (full.includes("black")) return "Black Series";
    if (full.includes("damaso")) return "Damaso";

    return "Padron Series";
  }

  function resolveBandArt(r) {
    const direct = getField(r, ["band_art", "band_image", "band_img", "band_art_url", "band_url"]);
    if (direct) return direct;

    if (normalizeBrand(state.brand) !== "padron") return "";

    const full = `${resolveName(r)} ${resolveVitola(r)} ${resolveShade(r)}`.toLowerCase();

    if (full.includes("family reserve")) return "/img/icons/padronfamilyreserveband.svg";
    if (full.includes("1964") || full.includes("anniversary")) return "/img/icons/padron1964anniversaryband.svg";
    if (full.includes("1926")) return "/img/icons/padron1926serieband.svg";
    if (full.includes("black")) return "/img/icons/padronblackseriesband.svg";
    if (full.includes("damaso")) return "/img/icons/padrondamasoband.svg";

    return "/img/icons/padronseriesband.svg";
  }

  function getCigarFilterIcon(value = "", group = "") {
    const v = String(value || "").toLowerCase().trim();

    if (group === "vitola") {
      if (v.includes("double corona")) return "/uxui/cigaricons/doublecorona.svg";
      if (v.includes("petit corona")) return "/uxui/cigaricons/petitcorona.svg";
      if (v.includes("corona gorda")) return "/uxui/cigaricons/corona.svg";
      if (v.includes("lancero")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("churchill")) return "/uxui/cigaricons/churchill.svg";
      if (v.includes("presidente")) return "/uxui/cigaricons/presidente.svg";
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("torpedo")) return "/uxui/cigaricons/torpedo.svg";
      if (v.includes("lonsdale")) return "/uxui/cigaricons/lonsdale.svg";
      if (v.includes("gordo")) return "/uxui/cigaricons/gordo.svg";
      if (v.includes("robusto")) return "/uxui/cigaricons/robusto.svg";
      if (v.includes("toro")) return "/uxui/cigaricons/toro.svg";
      if (v.includes("corona")) return "/uxui/cigaricons/corona.svg";
    }

    if (group === "shape") {
      if (v.includes("perfecto")) return "/uxui/cigaricons/perfecto.svg";
      if (v.includes("torpedo")) return "/uxui/cigaricons/torpedo.svg";
      if (v.includes("parejo")) return "/uxui/cigaricons/robusto.svg";
      if (v.includes("figurado")) return "/uxui/cigaricons/perfecto.svg";
    }

    return "";
  }

  function setBrandHeader() {
    if (brandTitle) brandTitle.textContent = state.brand || "Brand";
    if (!brandIconImg) return;

    brandIconImg.style.visibility = "";
    brandIconImg.src = brandIconPath();
    brandIconImg.onerror = () => {
      brandIconImg.style.visibility = "hidden";
    };
  }

  function openBandsSheet() {
    if (!sheetBands) return;
    sheetBands.hidden = false;
    document.documentElement.classList.add("sheet-open");
  }

  function closeBandsSheet() {
    if (!sheetBands) return;
    sheetBands.hidden = true;
    document.documentElement.classList.remove("sheet-open");
  }

  function openDetail(r) {
    const key = resolveDetailKey(r);
    if (!key) return;
    window.location.href = `/pos/cigars/cigar.html?key=${encodeURIComponent(key)}`;
  }

  let filterModal = null;

  function ensureFilterModal() {
    if (filterModal) return filterModal;

    const modal = document.createElement("div");
    modal.className = "fm fm--hidden";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="fm__backdrop" data-fm-close></div>
      <div class="fm__sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="fm__header">
          <h2 class="fm__title">Filters</h2>
          <button class="fm__close" type="button" data-fm-close aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>
            </svg>
          </button>
        </div>

        <div class="fm__body">
          <div class="fm__cats"></div>

          <div class="fm__panel">
            <div class="fm__search-row">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
                <path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              </svg>
              <input class="fm__search-input" type="search" placeholder="Search" />
              <button class="fm__mic-btn" type="button" aria-label="Clear search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 15a3 3 0 0 0 3-3V8a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" fill="currentColor"></path>
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                </svg>
              </button>
            </div>

            <div class="fm__list"></div>
          </div>
        </div>

        <div class="fm__actions">
          <button class="fm__btn fm__btn--reset" type="button" data-fm-clear>Reset</button>
          <button class="fm__btn fm__btn--apply" type="button" data-fm-apply>Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cats = $(".fm__cats", modal);
    const list = $(".fm__list", modal);
    const input = $(".fm__search-input", modal);
    const micBtn = $(".fm__mic-btn", modal);

    const categoryDefs = [
      { key: "vitola", label: "Vitolas" },
      { key: "ring", label: "Ring" },
      { key: "length", label: "Length" },
      { key: "strength", label: "Strength" },
      { key: "shape", label: "Shape" },
      { key: "shade", label: "Wrap. Shade" },
    ];

    let activeKey = "vitola";
    let dataByKey = {};

    function renderCats() {
      cats.innerHTML = "";
      categoryDefs.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `fm__cat-btn${activeKey === c.key ? " is-active" : ""}`;
        b.textContent = c.label;
        b.addEventListener("click", () => {
          activeKey = c.key;
          renderCats();
          renderList();
        });
        cats.appendChild(b);
      });
    }

    function renderList() {
      const q = String(input.value || "").trim().toLowerCase();
      const values = (dataByKey[activeKey] || []).filter((v) => !q || v.toLowerCase().includes(q));
      list.innerHTML = "";

      values.forEach((value) => {
        const row = document.createElement("button");
        const isSelected = state.filters[activeKey].has(value);
        const icon = getCigarFilterIcon(value, activeKey);

        row.type = "button";
        row.className = `fm__row${isSelected ? " is-selected" : ""}`;
        row.innerHTML = `
          <span class="fm__cb${isSelected ? " is-checked" : ""}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
          <span class="fm__icon">${icon ? `<img src="${esc(icon)}" alt="">` : ""}</span>
          <span class="fm__label">${esc(value)}</span>
        `;

        row.addEventListener("click", () => {
          if (state.filters[activeKey].has(value)) state.filters[activeKey].delete(value);
          else state.filters[activeKey].add(value);
          renderList();
        });

        list.appendChild(row);
      });
    }

    function open(data) {
      dataByKey = data;
      activeKey = "vitola";
      input.value = "";
      renderCats();
      renderList();
      modal.hidden = false;
      modal.classList.remove("fm--hidden");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("sheet-open");
    }

    function close() {
      modal.classList.remove("is-open");
      modal.classList.add("fm--hidden");
      modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sheet-open");
      window.setTimeout(() => {
        if (!modal.classList.contains("is-open")) modal.hidden = true;
      }, 260);
    }

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("[data-fm-close]")) {
        close();
        return;
      }
      if (t && t.closest && t.closest("[data-fm-clear]")) {
        Object.values(state.filters).forEach((set) => set.clear());
        renderList();
        return;
      }
      if (t && t.closest && t.closest("[data-fm-apply]")) {
        close();
        applyAll();
      }
    });

    input.addEventListener("input", renderList);

    micBtn?.addEventListener("click", () => {
      input.value = "";
      renderList();
      input.focus();
    });

    filterModal = { open, close };
    return filterModal;
  }

  function uniqSorted(vals, numeric = false) {
    const arr = Array.from(new Set(vals.map((v) => String(v || "").trim()).filter(Boolean)));
    return arr.sort((a, b) => {
      if (!numeric) return a.localeCompare(b);
      return parseFloat(a) - parseFloat(b);
    });
  }

  function buildFilterData(rows) {
    return {
      vitola: uniqSorted(rows.map(resolveVitola)),
      ring: uniqSorted(rows.map(resolveRing), true),
      length: uniqSorted(rows.map(resolveLength), true),
      strength: uniqSorted(rows.map(resolveStrength)),
      shape: uniqSorted(rows.map(resolveShape)),
      shade: uniqSorted(rows.map(resolveShade)),
    };
  }

  function applyWrapperMode(rows) {
    if (normalizeBrand(state.brand) !== "padron") return rows;
    if (state.wrapperMode === "all") return rows;

    return rows.filter((r) => {
      const shade = resolveShade(r).toLowerCase();
      const name = resolveName(r).toLowerCase();

      if (state.wrapperMode === "maduro") {
        return shade.includes("maduro") || name.includes("maduro");
      }

      if (state.wrapperMode === "natural") {
        return shade.includes("natural") || name.includes("natural");
      }

      return true;
    });
  }

  function applySearch(rows) {
    const q = String(state.search || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = resolveName(r).toLowerCase();
      const vitola = resolveVitola(r).toLowerCase();
      const ring = resolveRing(r).toLowerCase();
      const length = resolveLength(r).toLowerCase();
      return name.includes(q) || vitola.includes(q) || ring.includes(q) || length.includes(q);
    });
  }

  function applyBandSelected(rows) {
    if (!state.bandSelected.size) return rows;

    return rows.filter((r) => {
      const band = resolveBand(r);
      return band && state.bandSelected.has(band);
    });
  }

  function applyFilterSets(rows) {
    return rows.filter((r) => {
      const vitola = resolveVitola(r);
      const ring = resolveRing(r);
      const length = resolveLength(r);
      const strength = resolveStrength(r);
      const shape = resolveShape(r);
      const shade = resolveShade(r);

      if (state.filters.vitola.size && !state.filters.vitola.has(vitola)) return false;
      if (state.filters.ring.size && !state.filters.ring.has(ring)) return false;
      if (state.filters.length.size && !state.filters.length.has(length)) return false;
      if (state.filters.strength.size && !state.filters.strength.has(strength)) return false;
      if (state.filters.shape.size && !state.filters.shape.has(shape)) return false;
      if (state.filters.shade.size && !state.filters.shade.has(shade)) return false;

      return true;
    });
  }

  function buildCartItem(r) {
    const detailKey = resolveDetailKey(r);
    return {
      key: detailKey || `${normalizeBrand(state.brand)}|${resolveLine(r)}|${resolveName(r)}|${resolveVitola(r)}`,
      type: "cigar",
      category: "Cigars",
      id: detailKey || resolveName(r),
      brand: state.brand,
      line: resolveLine(r),
      cigar: resolveName(r),
      name: resolveName(r),
      vitola: resolveVitola(r),
      ring: resolveRing(r),
      length: resolveLength(r),
      shape: resolveShape(r),
      wrapper: resolveWrapper(r),
      binder: resolveBinder(r),
      filler: resolveFiller(r),
      origin: resolveOrigin(r),
      shade: resolveShade(r),
      strength: resolveStrength(r),
      msrp: resolvePriceNumber(r),
      image: listRowIconPath(r),
      url: detailKey ? `/pos/cigars/cigar.html?key=${encodeURIComponent(detailKey)}` : (resolveUrl(r) || "")
    };
  }

  function getRowQty(item) {
    return window.cigarOSCart?.getItemQty?.(item) || 0;
  }

  function renderList(rows) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(state.brand)}</div>`;
      return;
    }

    rows.forEach((r) => {
      const item = buildCartItem(r);
      const qty = getRowQty(item);
      const priceText = resolvePrice(r) || "—";
      const iconCandidates = listRowImageCandidates(r);
      const iconPath = iconCandidates[0] || brandIconPath();

      const row = document.createElement("article");
      row.className = "brand-row";
      row.innerHTML = `
        <img class="row-ico" src="${esc(iconPath)}" alt="" loading="lazy" />
        <div class="brand-row-left">
          <div class="brand-row-title">${esc(resolveDisplayName(r) || "Unnamed cigar")}</div>
          <div class="brand-row-sub">${esc(resolveVitola(r) || "—")}</div>
        </div>
        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(priceText)}</div>
          <div class="brand-row-qty">
            <button class="qty-btn qty-btn--minus" type="button" aria-label="Decrease">−</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn qty-btn--plus" type="button" aria-label="Increase">+</button>
          </div>
        </div>
      `;

      const icon = $(".row-ico", row);
      const left = $(".brand-row-left", row);
      const minusBtn = $(".qty-btn--minus", row);
      const plusBtn = $(".qty-btn--plus", row);

      bindImageFallback(icon, iconCandidates);

      left?.addEventListener("click", () => openDetail(r));
      icon?.addEventListener("click", () => openDetail(r));

      plusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = window.cigarOSCart?.getItemQty?.(item) || 0;
        window.cigarOSCart?.setQty?.(item, current + 1);
      });

      minusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const current = window.cigarOSCart?.getItemQty?.(item) || 0;
        window.cigarOSCart?.setQty?.(item, Math.max(0, current - 1));
      });

      listEl.appendChild(row);
    });
  }

  function getBandOptions(rows) {
    if (normalizeBrand(state.brand) === "padron") {
      return [
        { key: "Padron Series", label: "Padron Series", src: "/img/icons/padronseriesband.svg" },
        { key: "Family Reserve", label: "Family Reserve", src: "/img/icons/padronfamilyreserveband.svg" },
        { key: "1926", label: "1926", src: "/img/icons/padron1926serieband.svg" },
        { key: "Black Series", label: "Black Series", src: "/img/icons/padronblackseriesband.svg" },
        { key: "Damaso", label: "Damaso", src: "/img/icons/padrondamasoband.svg" },
        { key: "1964 Anniversary", label: "1964 Anniversary", src: "/img/icons/padron1964anniversaryband.svg" }
      ];
    }

    const map = new Map();
    rows.forEach((r) => {
      const label = resolveBand(r);
      const art = resolveBandArt(r);
      if (!label || !art) return;
      if (!map.has(label)) map.set(label, { key: label, label, src: art });
    });

    return Array.from(map.values());
  }

  function renderBandOptions(opts) {
    if (!bandsOptions) return;

    bandsOptions.innerHTML = "";

    if (!opts.length) {
      bandsOptions.innerHTML = `<div class="empty">No bands available for this brand.</div>`;
      return;
    }

    opts.forEach((b) => {
      const card = document.createElement("div");
      card.className = "band-card";
      card.innerHTML = `
        <img class="band-art" src="${esc(b.src)}" alt="" loading="lazy" />
        <div class="band-meta">
          <div class="band-name">${esc(b.label)}</div>
          <input class="band-check" type="checkbox" ${state.bandSelected.has(b.key) ? "checked" : ""} />
        </div>
      `;
      const cb = $(".band-check", card);
      cb?.addEventListener("change", () => {
        if (cb.checked) state.bandSelected.add(b.key);
        else state.bandSelected.delete(b.key);
      });
      bandsOptions.appendChild(card);
    });
  }

  function applyAll() {
    let rows = [...state.rowsAll];
    rows = applyWrapperMode(rows);
    rows = applyFilterSets(rows);
    rows = applyBandSelected(rows);
    rows = applySearch(rows);
    renderList(rows);
  }

  function setWrapperMode(mode) {
    state.wrapperMode = mode;
    seg?.setAttribute("data-state", mode);

    segBtns.forEach((b) => {
      b.classList.toggle("is-on", b.dataset.state === mode);
    });

    applyAll();
  }

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  btnFilters?.addEventListener("click", () => {
    ensureFilterModal().open(buildFilterData(applyWrapperMode([...state.rowsAll])));
  });

  btnBands?.addEventListener("click", () => {
    const opts = getBandOptions(state.rowsAll);
    renderBandOptions(opts);
    openBandsSheet();
  });

  bandsConfirm?.addEventListener("click", () => {
    closeBandsSheet();
    applyAll();
  });

  segSwitch?.addEventListener("click", () => {
    if (normalizeBrand(state.brand) !== "padron") return;

    if (state.wrapperMode === "maduro") setWrapperMode("natural");
    else if (state.wrapperMode === "natural") setWrapperMode("all");
    else setWrapperMode("maduro");
  });

  segBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (normalizeBrand(state.brand) !== "padron") return;
      setWrapperMode(b.dataset.state || "all");
    });
  });

  brandSearchBtn?.addEventListener("click", () => {
    window.openGlobalSearch?.();
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("[data-sheet-close]")) closeBandsSheet();
    if (t === sheetBands) closeBandsSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeBandsSheet();
      if (filterModal) filterModal.close();
    }
  });

  document.addEventListener("cigaros:cart-changed", () => applyAll());

  async function boot() {
    if (!listEl) return;

    state.brand = (getParam("brand") || "Padron").trim();
    setBrandHeader();

    const isPadron = normalizeBrand(state.brand) === "padron";

    if (btnBands) {
      btnBands.style.display = isPadron ? "" : "none";
    }

    if (seg) {
      if (isPadron) {
        seg.style.display = "";
        seg.setAttribute("data-state", state.wrapperMode);
      } else {
        seg.style.display = "none";
        state.wrapperMode = "all";
      }
    }

    segBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.state === state.wrapperMode));

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const txt = await res.text();
    const rows = mapRows(parseCSV(txt));
    const normalizedPageBrand = normalizeBrand(state.brand);

    const exact = rows.filter((r) => normalizeBrand(resolveBrandVal(r)) === normalizedPageBrand);
    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb && (rb.includes(normalizedPageBrand) || normalizedPageBrand.includes(rb));
    });

    const manufacturerFallback = rows.filter((r) => normalizeBrand(resolveManufacturerVal(r)) === normalizedPageBrand);

    state.rowsAll = (exact.length ? exact : fuzzy.length ? fuzzy : manufacturerFallback).map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    if (!state.rowsAll.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(state.brand)}</div>`;
      return;
    }

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if (listEl) {
      listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
    }
  });
})();
