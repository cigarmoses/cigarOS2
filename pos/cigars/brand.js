/* /pos/cigars/brand.js
   FULL REPLACEMENT
   - Fixes $/$$(root) support
   - Adds centered theme toggle + invoice button wiring
   - Keeps your existing logic (filters, bands, detail modal, add-to-cart)
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

  const escapeHTML = esc;
  const escapeAttr = esc;

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

  // Bands sheet
  const sheetBands = $("#sheet-bands");
  const sheetReceipt = $("#sheet-receipt"); // may not exist, ok
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

  // =========================================================
  // Invoice open helpers (matches your prior behavior)
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

  // optional: if cart exposes count, swap icon
  function refreshInvoiceIcon() {
    if (!invoiceIcon) return;

    const count =
      Number(window.CigarOSCart?.count?.()) ||
      Number(window.CigarOSCart?.items?.length) ||
      0;

    // rename these if your filenames differ
    invoiceIcon.src = count > 0 ? "/img/icons/cart-red.png" : "/img/icons/cart-empty.png";
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
  // CIGAR DETAIL MODAL (same as your version)
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
      ""
    );

    const brandIcon = bestBrandHeaderIcon(row) || "";
    const picked = pickCigarImage(row);

    const nameForFile = slug(row?.cigarFull || row?.cigar || cigarName);
    const brandForFolder = slug(row?.brand || row?.Brand || BRAND || "");

    const imgCandidates = [
      picked,
      `/img/cigars/${brandForFolder}/${nameForFile}.png`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpg`,
      `/img/cigars/${brandForFolder}/${nameForFile}.jpeg`,
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
    const shade = norm(row?.wrapperShade || row?.["Wrapper Shade"] || "");

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
              <div class="cd-stat"><div class="k">RING</div><div class="v">${escapeHTML(String(rg))}</div></div>
              <div class="cd-stat"><div class="k">LENGTH</div><div class="v">${escapeHTML(String(len))}</div></div>
              <div class="cd-stat small"><div class="k">SHAPE</div><div class="v">${escapeHTML(String(shape))}</div></div>
              <div class="cd-stat small"><div class="k">VITOLA</div><div class="v">${escapeHTML(String(vitola))}</div></div>
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
      const msrpVal = row?.msrp ?? row?.MSRP ?? row?.Price ?? row?.price ?? 0;

      window.CigarOSCart?.add?.({
        id: row?.key || `${brand}-${cigarName}-${vitola}`,
        name: cigarName,
        brand: brand,
        category: "Cigars",
        sub: vitola ? `${vitola} • ${len} × ${rg}` : "",
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
    document.body.classList.add("pos-modal-open");
    if (sheetBands) {
      sheetBands.hidden = false;
      sheetBands.classList.add("is-open");
    }
  }

  function closeBandAndReceiptSheets() {
    document.body.classList.remove("pos-modal-open");
    [sheetBands, sheetReceipt].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-open");
      el.hidden = true;
    });
  }

  function bindBandSheetClosers() {
    $$("[data-sheet-close]").forEach((btn) => btn.addEventListener("click", closeBandAndReceiptSheets));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBandAndReceiptSheets();
    });
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", openBandsSheet);
    bandsConfirmBtn?.addEventListener("click", () => {
      closeBandAndReceiptSheets();
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

    listEl.innerHTML = state.view.map((r) => {
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

  function bindClicks() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const add = e.target.closest("[data-receipt-item]");
      if (add) {
        refreshInvoiceIcon();
        return;
      }

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

        key: `${slug(row.dataset.brand)}|${slug(row.dataset.line)}|${slug(row.dataset.cigarFull || row.dataset.cigar)}`,
      };

      openCigarDetail(item);
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
    bindBandSheetClosers();
    bindWrapperToggle();
    bindBandsUI();

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
