/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ UPDATE (FILTER UI MATCH):
   - Brand page Filters now uses the SAME bottom-sheet filter modal layout as /pos/cigars (main)
   - Removes Manufacturers + Brands categories on brand pages
   - Filters apply ONLY within the current brand context
   - Keeps everything else: Bands sheet, Maduro/Natural toggle, row click detail modal, add-to-cart wiring
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
  const lower = (s) => norm(s).toLowerCase();

  // accent-safe slug (Padrón -> padron)
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

  // Bands sheet targets
  const bandsOptionsEl = $("#bands-options");
  const bandsConfirmBtn = $("#bands-confirm");

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
  const getVitola = (r) => pick(r, ["Vitola", "Style"]);
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
  // ✅ STATE
  // =========================================================
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all", // all | maduro | natural
    bandKeys: new Set(),
    // actual applied filters (brand page):
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
    // existing sheet system stays for Bands
    renderBandsOptions();
    const bd = $("#sheet-backdrop");
    if (bd) {
      bd.hidden = false;
      bd.classList.add("open");
    }
    document.body.classList.add("pos-modal-open");
    sheetBands.hidden = false;
    sheetBands.classList.add("is-open");
  }

  function closeBandAndReceiptSheets() {
    const bd = $("#sheet-backdrop");
    document.body.classList.remove("pos-modal-open");
    [sheetBands, sheetReceipt].forEach((el) => {
      if (!el) return;
      el.classList.remove("is-open");
      el.hidden = true;
    });
    if (bd) {
      bd.classList.remove("open");
      bd.hidden = true;
    }
  }

  function bindBandSheetClosers() {
    // x buttons
    $$("[data-sheet-close]").forEach((btn) => btn.addEventListener("click", closeBandAndReceiptSheets));

    // backdrop
    const bd = $("#sheet-backdrop");
    bd?.addEventListener("click", closeBandAndReceiptSheets);

    // escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBandAndReceiptSheets();
    });
  }

  function bindBandsUI() {
    bandsBtn?.addEventListener("click", () => openBandsSheet());
    bandsConfirmBtn?.addEventListener("click", () => {
      closeBandAndReceiptSheets();
      apply();
    });
  }

  // =========================================================
  // ✅ APPLY FILTERS + RENDER
  // =========================================================
  function rowPassesAppliedFilters(r) {
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

    // applied sets
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
        const blob = `${getLine(r)} ${getCigar(r)} ${getWrapper(r)} ${getOrigin(r)} ${getRing(r)} ${getLength(r)} ${getMSRP(r)}`
          .toLowerCase();
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
  // ✅ NEW: MAIN-PAGE STYLE FILTER MODAL (NO BRAND/MFG)
  // =========================================================
  const FM_KEYS = [
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

  function orderWrapperShades(values) {
    const list = uniqSorted(values);
    const seen = new Set();
    const ordered = [];

    for (const item of WRAPPER_SHADE_ORDER) {
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

  function orderVitolas(values) {
    const list = uniqSorted(values);
    const seen = new Set();
    const ordered = [];

    for (const item of VITOLA_ORDER) {
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

  function getValuesForFmKey(key) {
    const rows = state.all.filter(inBrand);
    const vals = [];

    for (const r of rows) {
      if (!r) continue;
      if (key === "vitola") vals.push(getVitola(r));
      if (key === "ring") vals.push(getRing(r));
      if (key === "length") vals.push(getLength(r));
      if (key === "strength") vals.push(getStrength(r));
      if (key === "shape") vals.push(getShape(r));
      if (key === "shade") vals.push(getWrapperShade(r));
    }

    if (key === "shade") return orderWrapperShades(vals);
    if (key === "vitola") return orderVitolas(vals);

    const cleaned = uniqSorted(vals);

    if (key === "ring") {
      cleaned.sort((a, b) => Number(a) - Number(b));
      return cleaned;
    }
    if (key === "length") {
      cleaned.sort(
        (a, b) =>
          Number(String(a).replace(/[^\d.]/g, "")) - Number(String(b).replace(/[^\d.]/g, ""))
      );
      return cleaned;
    }

    return cleaned;
  }

  // modal DOM
  let fmRoot = null;

  // local (draft) selection state while modal open
  const fmState = {
    selected: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
    activeKey: "shade",
    activeValues: [],
    activeSearch: "",
  };

  function syncFmLocalFromApplied() {
    fmState.selected.vitola = new Set([...state.applied.vitola]);
    fmState.selected.ring = new Set([...state.applied.ring]);
    fmState.selected.length = new Set([...state.applied.length]);
    fmState.selected.strength = new Set([...state.applied.strength]);
    fmState.selected.shape = new Set([...state.applied.shape]);
    fmState.selected.shade = new Set([...state.applied.shade]);
  }

  function pushFmLocalToApplied() {
    state.applied.vitola = new Set([...fmState.selected.vitola]);
    state.applied.ring = new Set([...fmState.selected.ring]);
    state.applied.length = new Set([...fmState.selected.length]);
    state.applied.strength = new Set([...fmState.selected.strength]);
    state.applied.shape = new Set([...fmState.selected.shape]);
    state.applied.shade = new Set([...fmState.selected.shade]);
    apply();
  }

  function ensureFilterModal() {
    if (!fmRoot) {
      fmRoot = document.createElement("div");
      fmRoot.id = "filter-modal";
      fmRoot.className = "fm fm--hidden";
      fmRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(fmRoot);
    }

    if (!fmRoot.querySelector(".fm__sheet")) {
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

                <button class="fm__mic-btn" type="button" aria-label="Voice search (coming soon)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
                          fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                    <path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                    <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  </svg>
                </button>
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
    }
  }

  function renderFmCats() {
    const catsEl = $("#fm-cats", fmRoot);
    if (!catsEl) return;

    catsEl.innerHTML = FM_KEYS.map((c) => {
      const active = c.key === fmState.activeKey ? "is-active" : "";
      return `<button class="fm__cat-btn ${active}" type="button" data-cat="${esc(c.key)}">${esc(
        c.label
      )}</button>`;
    }).join("");

    $$(".fm__cat-btn", catsEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-cat");
        if (!key) return;
        setFmActiveCategory(key);
      });
    });
  }

  function setFmActiveCategory(key) {
    if (!fmState.selected[key]) return;

    fmState.activeKey = key;
    fmState.activeSearch = "";

    const inp = $("#fm-search", fmRoot);
    if (inp) inp.value = "";

    $$(".fm__cat-btn", fmRoot).forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-cat") === key);
    });

    fmState.activeValues = getValuesForFmKey(key);
    renderFmList();
  }

  function renderFmList() {
    const listEl = $("#fm-list", fmRoot);
    if (!listEl) return;

    const key = fmState.activeKey;
    const selectedSet = fmState.selected[key];

    const q = norm(fmState.activeSearch).toLowerCase();
    const values = fmState.activeValues || [];
    const filtered = !q ? values : values.filter((v) => norm(v).toLowerCase().includes(q));

    listEl.innerHTML = filtered
      .map((v) => {
        const label = norm(v);
        const isSelected = selectedSet.has(label);

        const cb = isSelected
          ? `<div class="fm__cb is-checked" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>`
          : `<div class="fm__cb" aria-hidden="true"></div>`;

        // no icons for brand page modal categories
        const icon = `<div class="fm__icon" aria-hidden="true"></div>`;

        return `
          <div class="fm__row ${isSelected ? "is-selected" : ""}" data-value="${esc(label)}">
            ${cb}
            ${icon}
            <div class="fm__label">${esc(label)}</div>
          </div>
        `;
      })
      .join("");

    $$(".fm__row", listEl).forEach((row) => {
      row.addEventListener("click", () => {
        const val = row.getAttribute("data-value") || "";
        if (!val) return;

        if (selectedSet.has(val)) selectedSet.delete(val);
        else selectedSet.add(val);

        row.classList.toggle("is-selected");
        const cb = $(".fm__cb", row);
        if (cb) cb.classList.toggle("is-checked", selectedSet.has(val));

        if (cb) {
          cb.innerHTML = selectedSet.has(val)
            ? `<svg viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>`
            : "";
        }
      });
    });
  }

  function openFilterModal() {
    ensureFilterModal();

    fmRoot.classList.remove("fm--hidden");
    fmRoot.classList.add("is-open");
    fmRoot.setAttribute("aria-hidden", "false");

    renderFmCats();
    setFmActiveCategory(fmState.activeKey);

    window.setTimeout(() => {
      $("#fm-search", fmRoot)?.focus();
    }, 60);
  }

  function closeFilterModal() {
    if (!fmRoot) return;
    fmRoot.classList.remove("is-open");
    fmRoot.classList.add("fm--hidden");
    fmRoot.setAttribute("aria-hidden", "true");
  }

  function bindFilterModalEvents() {
    // open
    filtersBtn?.addEventListener("click", () => {
      syncFmLocalFromApplied();
      openFilterModal();
    });

    // close (backdrop / x)
    document.addEventListener("click", (e) => {
      if (!fmRoot || fmRoot.classList.contains("fm--hidden")) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-fm-close]")) closeFilterModal();
    });

    // escape
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!fmRoot || fmRoot.classList.contains("fm--hidden")) return;
      closeFilterModal();
    });

    // search within active list
    document.addEventListener("input", (e) => {
      if (!fmRoot || fmRoot.classList.contains("fm--hidden")) return;
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.id !== "fm-search") return;
      fmState.activeSearch = t.value || "";
      renderFmList();
    });

    // reset/apply
    document.addEventListener("click", (e) => {
      if (!fmRoot || fmRoot.classList.contains("fm--hidden")) return;
      const t = e.target;
      if (!(t instanceof Element)) return;

      if (t.closest("#fm-reset")) {
        for (const k of Object.keys(fmState.selected)) fmState.selected[k].clear();
        renderFmList();
        return;
      }

      if (t.closest("#fm-apply")) {
        pushFmLocalToApplied();
        closeFilterModal();
      }
    });
  }

  // =========================================================
  // ✅ BOOT
  // =========================================================
  async function boot() {
    fixDuplicateBackButtons();
    bindInvoicePill();

    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    backBtn?.addEventListener("click", () => history.back());

    if (brandIconWrap) {
      const src = `/img/icons/brands/${BRAND_SLUG}.svg`;
      brandIconWrap.innerHTML = `<img src="${esc(src)}" alt="">`;
    }

    bindClicks();
    bindBandSheetClosers();
    bindWrapperToggle();
    bindBandsUI();

    // ✅ new filter modal bindings
    bindFilterModalEvents();

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
