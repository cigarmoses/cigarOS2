/* /pos/cigars/brand.js
   FULL REPLACEMENT (fixes)
   - Filters + Bands sheets work
   - Add button actually adds to cart
   - Row tap opens cigar detail
   - No JSON-in-attribute escaping bugs
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

  // Maduro/Natural segmented control
  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // Sheets
  const sheetFilters = $("#sheet-filters"); // must exist in HTML
  const sheetBands = $("#sheet-bands");     // must exist in HTML
  const sheetReceipt = $("#sheet-receipt"); // optional; ok if missing

  // Bands content
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // =========================================================
  // Invoice open helpers
  // =========================================================
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

    // ✅ use your SVGs
    invoiceIcon.src = count > 0 ? "/img/icons/cart-red.svg" : "/img/icons/cart-blue.svg";
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

  // =========================================================
  // CIGAR DETAIL MODAL
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
      if (e.key === "Escape" && detailOverlay?.classList.contains("open")) closeCigarDetail();
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
        <div class="k">${esc(k)}</div>
        <div class="v">${esc(vv)}</div>
      </div>
    `;
  }

  function openCigarDetail(row) {
    ensureCigarDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = norm(row?.brand || BRAND || "Brand");
    const cigarName = norm(row?.cigarFull || row?.cigar || "");

    const brandIcon = bestBrandHeaderIcon(row) || "";
    const picked = pickCigarImage(row);

    const nameForFile = slug(row?.cigarFull || row?.cigar || cigarName);
    const brandForFolder = slug(row?.brand || BRAND || "");

    const imgCandidates = [
      picked,
      `/img/cigars/${brandForFolder}/${nameForFile}.png`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpg`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpeg`,
    ].filter(Boolean);

    const cigarImg = imgCandidates[0] || "";

    const rg = norm(row?.ring || "");
    const len = norm(row?.length || "");
    const strength = norm(row?.strength || "");
    const vitola = norm(row?.vitola || "");
    const shape = norm(row?.shape || "");
    const wrapper = norm(row?.wrapper || "");
    const binder = norm(row?.binder || "");
    const filler = norm(row?.filler || "");
    const origin = norm(row?.origin || "");
    const shade = norm(row?.wrapperShade || "");

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>

      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${esc(brand)}</div>
            <div class="cd-name">${esc(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            ${brandIcon ? `<img src="${esc(brandIcon)}" alt="">` : ``}
          </div>
        </div>

        <div class="cd-main">
          <div class="cd-img">
            ${cigarImg ? `<img class="cigar-detail-stick" src="${esc(cigarImg)}" alt="">` : ``}
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat"><div class="k">RING</div><div class="v">${esc(String(rg || "—"))}</div></div>
              <div class="cd-stat"><div class="k">LENGTH</div><div class="v">${esc(String(len || "—"))}</div></div>
              <div class="cd-stat small"><div class="k">SHAPE</div><div class="v">${esc(String(shape || "—"))}</div></div>
              <div class="cd-stat small"><div class="k">VITOLA</div><div class="v">${esc(String(vitola || "—"))}</div></div>
            </div>

            <div class="cd-block">
              ${renderKV("WRAPPER", wrapper)}
              ${renderKV("BINDER", binder)}
              ${renderKV("FILLER", filler)}
              ${renderKV("ORIGIN", origin)}
            </div>

            <div class="cd-block single">${renderKV("STRENGTH", strength)}</div>
            <div class="cd-block single">${renderKV("WRAPPER SHADE", shade)}</div>

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
      const msrpVal = row?.msrp ?? row?.price ?? 0;

      window.CigarOSCart?.add?.({
        id: row?.key || `${brand}-${cigarName}-${vitola}`,
        name: cigarName,
        brand: brand,
        category: "Cigars",
        sub: vitola ? `${vitola}${len && rg ? ` • ${len} × ${rg}` : ""}` : "",
        price: Number(msrpVal || 0),
        img: "",
      });

      refreshInvoiceIcon();
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
  // SHEETS (Filters / Bands)
  // =========================================================
  function openSheet(el) {
    if (!el) return;
    document.body.classList.add("pos-modal-open");
    el.hidden = false;
    el.classList.add("is-open");
  }

  function closeAllSheets() {
    document.body.classList.remove("pos-modal-open");
    [sheetFilters, sheetBands, sheetReceipt].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-open");
      el.hidden = true;
    });
  }

  function bindSheetClosers() {
    // close buttons
    $$("[data-sheet-close]").forEach((btn) => btn.addEventListener("click", closeAllSheets));

    // click outside sheet
    [sheetFilters, sheetBands, sheetReceipt].forEach((wrap) => {
      if (!wrap) return;
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) closeAllSheets();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  // =========================================================
  // STATE + brand filter
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
  // WRAPPER TOGGLE (Maduro/Natural)
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

    segMaduro?.addEventListener("click", (e) => {
      e.preventDefault();
      setWrapperState("maduro");
    });

    segNatural?.addEventListener("click", (e) => {
      e.preventDefault();
      setWrapperState("natural");
    });

    // optional tap center dot cycles
    segSwitch?.addEventListener("click", (e) => {
      e.preventDefault();
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
        <label class="bands-row" role="button" tabindex="0">
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

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openBandsSheet();
    });

    bandsConfirmBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllSheets();
      apply();
    });
  }

  // =========================================================
  // FILTER APPLY + RENDER
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

    listEl.innerHTML = state.view.map((r, idx) => {
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

      const brandIconSrc = `/img/icons/brands/${slug(brand || BRAND)}.svg`;

      return `
        <div class="brand-row" data-row data-idx="${idx}">
          <img class="row-ico" alt="" src="${esc(brandIconSrc)}"
               onerror="this.style.visibility='hidden';" />

          <div class="brand-row-left" data-open-detail="1">
            <div class="brand-row-title"><div>${esc(cigarFull || cigar)}</div></div>
            <div class="brand-row-sub"><div>${esc(vitola)}</div></div>
          </div>

          <div class="brand-row-right">
            <div class="brand-row-msrp">${esc(msrp)}</div>
            <button type="button" class="pos-add" aria-label="Add to invoice" data-action="add" data-idx="${idx}">+</button>
          </div>

          <div class="row-meta" hidden
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
            data-image="${esc(image)}"></div>
        </div>
      `;
    }).join("");
  }

  function bindClicks() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest?.('[data-action="add"]');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();

        const idx = Number(addBtn.getAttribute("data-idx"));
        const r = state.view[idx];
        if (!r) return;

        const brand = norm(getBrand(r) || BRAND);
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const cigarFull = `${line} ${cigar}`.trim();
        const vitola = norm(getVitola(r));
        const ring = norm(getRing(r));
        const length = norm(getLength(r));
        const msrp = getMSRP(r);

        window.CigarOSCart?.add?.({
          id: `${slug(brand)}-${slug(cigarFull || cigar)}-${slug(vitola)}`,
          name: cigarFull || cigar,
          brand,
          category: "Cigars",
          sub: vitola ? `${vitola}${length && ring ? ` • ${length} × ${ring}` : ""}` : "",
          price: priceNum(msrp),
          img: "",
        });

        refreshInvoiceIcon();
        return;
      }

      const row = e.target.closest?.("[data-row]");
      if (!row) return;

      // ignore clicks on right-side pricing area if needed
      const idx = Number(row.getAttribute("data-idx"));
      const r = state.view[idx];
      if (!r) return;

      const brand = norm(getBrand(r) || BRAND);
      const line = norm(getLine(r));
      const cigar = norm(getCigar(r));
      const cigarFull = `${line} ${cigar}`.trim();

      openCigarDetail({
        brand,
        line,
        cigar,
        cigarFull,
        vitola: norm(getVitola(r)),
        shape: norm(getShape(r)),
        strength: norm(getStrength(r)),
        wrapperShade: norm(getWrapperShade(r)),
        wrapper: norm(getWrapper(r)),
        binder: norm(getBinder(r)),
        filler: norm(getFiller(r)),
        origin: norm(getOrigin(r)),
        ring: norm(getRing(r)),
        length: norm(getLength(r)),
        msrp: norm(getMSRP(r)),
        image: norm(getImage(r)),
        key: `${slug(brand)}|${slug(line)}|${slug(cigarFull || cigar)}`,
        price: priceNum(getMSRP(r)),
      });
    });
  }

  // =========================================================
  // FILTERS (placeholder open/close only for now)
  // (your prior filter UI can live inside #sheet-filters)
  // =========================================================
  function bindFiltersUI() {
    filtersBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openSheet(sheetFilters);
    });
  }

  // =========================================================
  // BOOT
  // =========================================================
  async function boot() {
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

    refreshInvoiceIcon();
    setInterval(refreshInvoiceIcon, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
