/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   GOAL: Restore the OLD working UX using ONLY the existing UI in brand.html:
   - Uses #sheet-backdrop + #sheet-bands + #sheet-filters (no injected sheets)
   - Uses #cigarDetailOverlay modal (no injected modal)
   - Green + uses cart.js dataset contract (NOT JSON)
   - Maduro/Natural toggle filters correctly
   - Bands list populates from "Cigar IMG" for this brand
   - Filters sheet opens and works (basic multi-select by field + toggles)

   Fixes:
   1) Row top area = Vitola only (not "Maduro 29.25")
   2) Clicking left area opens cigar detail modal
   3/4) Brand icon shows in header
   5) Green + adds to invoice
   6) Maduro/Natural toggle filters results
   7) Bands sheet populates
   8) Filters sheet opens
   9) Receipt/invoice icon opens (cart.js)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();
  const slug = (s) => lower(s).replace(/[^a-z0-9]+/g, "");
  const money = (v) => {
    const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n.toFixed(2) : "";
  };

  const esc = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  // ---------- DOM refs from brand.html ----------
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  const sheetBackdrop = $("#sheet-backdrop");
  const sheetReceipt = $("#sheet-receipt");
  const sheetBands = $("#sheet-bands");
  const sheetFilters = $("#sheet-filters");

  // Bands sheet
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // Filters sheet
  const filtersHome = $("#filters-home");
  const filtersDetail = $("#filters-detail");
  const filtersList = $("#filters-list");
  const filtersTitle = $("#filters-title");
  const filtersBack = $("#filters-back");
  const filtersSearch = $("#filters-search");
  const filtersConfirm = $("#filters-confirm");
  const filtersApplied = $("#filters-applied");
  const filtersAppliedRow = $("#filters-applied-row");

  // Detail modal
  const cigarOverlay = $("#cigarDetailOverlay");
  const cigarBody = $("#cigarDetailBody");
  const cigarClose = $("#cigarDetailClose");

  // ---------- brand context ----------
  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---------- CSV parsing ----------
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

  // Your sheet columns (as provided)
  const getManufacturer = (r) => pick(r, ["Manufacturer"]);
  const getBrand = (r) => pick(r, ["Brand", "Manufacturer"]);
  const getLine = (r) => pick(r, ["Line"]);
  const getCigar = (r) => pick(r, ["Cigar"]);
  const getVitola = (r) => pick(r, ["Vitola"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getRG = (r) => pick(r, ["RG", "Ring", "Ring Gauge"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getWrapper = (r) => pick(r, ["Wrapper"]);
  const getWrapperShade = (r) => pick(r, ["Wrapper Shade"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getMSRP = (r) => pick(r, ["MSRP"]);
  const getBrandImg = (r) => pick(r, ["Brand IMG", "Manufacturer IMG"]);
  const getCigarImg = (r) => pick(r, ["Cigar IMG"]);
  const getKey = (r) => pick(r, ["key"]);

  // Toggles
  const getBool = (r, col) => {
    const v = lower(pick(r, [col]));
    return v === "1" || v === "true" || v === "yes" || v === "y" || v === "x";
  };

  // ---------- State ----------
  const state = {
    all: [],
    rows: [],

    q: "",
    wrapperState: "all", // all | maduro | natural

    // Bands: select 0..n cigar images
    bandImgs: new Set(),

    // Filters: per field selected values
    selected: {
      RG: new Set(),
      Length: new Set(),
      "Wrapper Shade": new Set(),
      Shape: new Set(),
      Vitola: new Set(),
      Strength: new Set(),
    },

    toggles: {
      Flavored: false,
      Tubo: false,
      Tin: false,
      "Box-Pressed": false,
      Pack: false,
      Barber: false,
    },

    // Filters UI subpage
    activeFilterKey: "", // e.g. "RG"
  };

  function inBrand(r) {
    if (!BRAND) return true;
    return slug(getBrand(r)) === BRAND_SLUG || slug(getManufacturer(r)) === BRAND_SLUG;
  }

  // ---------- Sheet controls (use existing UI) ----------
  function closeAllSheets() {
    // do NOT fight cart.js, but safely hide ours
    if (sheetBands) sheetBands.hidden = true;
    if (sheetFilters) sheetFilters.hidden = true;
    // leave receipt alone; cart.js controls it
    if (sheetBackdrop) {
      // only hide backdrop if receipt is NOT open
      const receiptOpen = sheetReceipt && !sheetReceipt.hidden;
      if (!receiptOpen) sheetBackdrop.hidden = true;
    }
  }

  function openSheet(sheetEl) {
    if (!sheetBackdrop || !sheetEl) return;
    // hide other non-receipt sheets
    if (sheetEl !== sheetBands && sheetBands) sheetBands.hidden = true;
    if (sheetEl !== sheetFilters && sheetFilters) sheetFilters.hidden = true;

    // show backdrop unless receipt is already open (still ok)
    sheetBackdrop.hidden = false;
    sheetEl.hidden = false;
    document.body.classList.add("pos-modal-open");
  }

  function closeSheetsIfNotReceipt() {
    const receiptOpen = sheetReceipt && !sheetReceipt.hidden;
    if (!receiptOpen) {
      closeAllSheets();
      document.body.classList.remove("pos-modal-open");
    }
  }

  // backdrop click should close OUR sheets (NOT receipt; cart.js already binds receipt behavior)
  if (sheetBackdrop && !sheetBackdrop.dataset.brandBound) {
    sheetBackdrop.dataset.brandBound = "1";
    sheetBackdrop.addEventListener("click", () => {
      // if receipt is open, cart.js will handle; we only close our sheets
      if (sheetBands && !sheetBands.hidden) sheetBands.hidden = true;
      if (sheetFilters && !sheetFilters.hidden) sheetFilters.hidden = true;

      const receiptOpen = sheetReceipt && !sheetReceipt.hidden;
      if (!receiptOpen) sheetBackdrop.hidden = true;
      document.body.classList.remove("pos-modal-open");
    });
  }

  // any [data-sheet-close] closes our sheets too (brand.html uses this)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sheet-close]");
    if (!btn) return;
    // cart.js closes receipt; we close ours
    if (sheetBands && !sheetBands.hidden) sheetBands.hidden = true;
    if (sheetFilters && !sheetFilters.hidden) sheetFilters.hidden = true;

    const receiptOpen = sheetReceipt && !sheetReceipt.hidden;
    if (!receiptOpen && sheetBackdrop) sheetBackdrop.hidden = true;
    document.body.classList.remove("pos-modal-open");
  });

  // ---------- Brand icon (top right) ----------
  function setHeaderBrandIcon(rowsForBrand) {
    if (!brandIconWrap) return;

    // 1) try Brand IMG / Manufacturer IMG from any row
    const imgUrl = norm(rowsForBrand.map(getBrandImg).find((x) => norm(x)));
    // 2) fallback to /img/icons/brands/{brandslug}.svg
    const fallback = BRAND_SLUG ? `/img/icons/brands/${BRAND_SLUG}.svg` : "";

    const src = imgUrl || fallback;
    if (!src) {
      brandIconWrap.innerHTML = "";
      return;
    }

    brandIconWrap.innerHTML = `
      <img src="${esc(src)}" alt="" onerror="this.style.display='none';" />
    `;
  }

  // ---------- Wrapper toggle ----------
  function setWrapperUI() {
    if (!wrapperSeg) return;
    wrapperSeg.setAttribute("data-state", state.wrapperState);

    const isMad = state.wrapperState === "maduro";
    const isNat = state.wrapperState === "natural";

    if (segMaduro) segMaduro.setAttribute("aria-pressed", String(isMad));
    if (segNatural) segNatural.setAttribute("aria-pressed", String(isNat));
  }

  function cycleWrapper() {
    state.wrapperState =
      state.wrapperState === "all"
        ? "maduro"
        : state.wrapperState === "maduro"
        ? "natural"
        : "all";
    setWrapperUI();
    applyAndRender();
  }

  // ---------- Filtering ----------
  function rowMatchesWrapper(r) {
    const w = lower(getWrapperShade(r) || getWrapper(r));
    if (state.wrapperState === "all") return true;
    if (state.wrapperState === "maduro") return w.includes("maduro");
    if (state.wrapperState === "natural") return w.includes("natural");
    return true;
  }

  function rowMatchesSearch(r) {
    const q = lower(state.q);
    if (!q) return true;
    const blob = [
      getBrand(r),
      getLine(r),
      getCigar(r),
      getVitola(r),
      getWrapper(r),
      getWrapperShade(r),
      getOrigin(r),
      getRG(r),
      getLength(r),
      getMSRP(r),
      getStrength(r),
      getShape(r),
    ]
      .map((x) => lower(x))
      .join(" ");
    return blob.includes(q);
  }

  function rowMatchesBands(r) {
    if (!state.bandImgs.size) return true;
    const img = norm(getCigarImg(r));
    return img && state.bandImgs.has(img);
  }

  function rowMatchesSelections(r) {
    // field selections
    const checks = [
      ["RG", norm(getRG(r))],
      ["Length", norm(getLength(r))],
      ["Wrapper Shade", norm(getWrapperShade(r) || getWrapper(r))],
      ["Shape", norm(getShape(r))],
      ["Vitola", norm(getVitola(r) || getCigar(r))],
      ["Strength", norm(getStrength(r))],
    ];

    for (const [k, v] of checks) {
      const set = state.selected[k];
      if (!set || set.size === 0) continue;
      if (!v) return false;
      if (!set.has(v)) return false;
    }

    // toggles
    const t = state.toggles;
    if (t.Flavored && !getBool(r, "F/S")) return false;
    if (t.Tubo && !getBool(r, "Tubo")) return false;
    if (t.Tin && !getBool(r, "Tin")) return false;
    if (t["Box-Pressed"] && !getBool(r, "Box-Pressed")) return false;
    if (t.Pack && !getBool(r, "Pack")) return false;
    if (t.Barber && !getBool(r, "Barber")) return false;

    return true;
  }

  function applyAndRender() {
    const rowsForBrand = state.all.filter(inBrand);

    state.rows = rowsForBrand
      .filter(rowMatchesWrapper)
      .filter(rowMatchesBands)
      .filter(rowMatchesSelections)
      .filter(rowMatchesSearch);

    renderList(state.rows);
    renderAppliedFilters();
  }

  // ---------- Render (RESTORE OLD ROW UX) ----------
  function renderList(rows) {
    if (!listEl) return;

    if (!rows.length) {
      listEl.innerHTML = "";
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "No cigars found.";
      }
      return;
    }
    if (statusEl) statusEl.hidden = true;

    listEl.innerHTML = rows
      .map((r) => {
        const brand = norm(getBrand(r)) || BRAND;
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const vitola = norm(getVitola(r)) || cigar; // ✅ Area #1 = Vitola only
        const wrapperShade = norm(getWrapperShade(r) || getWrapper(r));
        const origin = norm(getOrigin(r));
        const length = norm(getLength(r));
        const rg = norm(getRG(r));
        const msrpRaw = norm(getMSRP(r));
        const msrp = msrpRaw ? money(msrpRaw) : "";
        const cigarImg = norm(getCigarImg(r));
        const key = norm(getKey(r)) || `${slug(brand)}|${slug(line)}|${slug(vitola)}`;

        // cart.js CONTRACT: it reads dataset.* from the element with [data-receipt-item]
        const cartName = `${line ? line + " — " : ""}${vitola || "Cigar"}`;

        // Left icon = cigar image (or IMG SOON), matches your old UI screenshot
        const ico = cigarImg
          ? `<img class="row-ico" src="${esc(cigarImg)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'row-ico',innerHTML:'IMG<br>SOON'}));" />`
          : `<div class="row-ico" style="display:grid;place-items:center;font-weight:900;font-size:12px;line-height:1.05;color:rgba(255,255,255,.55);">IMG<br>SOON</div>`;

        return `
          <div class="brand-row" data-row
               data-key="${esc(key)}"
               data-brand="${esc(brand)}"
               data-line="${esc(line)}"
               data-cigar="${esc(cigar)}"
               data-vitola="${esc(vitola)}"
               data-wrapper="${esc(wrapperShade)}"
               data-origin="${esc(origin)}"
               data-length="${esc(length)}"
               data-rg="${esc(rg)}"
               data-msrp="${esc(msrp)}"
               data-img="${esc(cigarImg)}">
            ${ico}

            <div class="brand-row-left">
              <div class="brand-row-title">
                <div>${esc(line || brand)}</div>
                <div>${esc(vitola)}</div>
                ${wrapperShade ? `<div>${esc(wrapperShade)}</div>` : ``}
              </div>

              <div class="brand-row-sub">
                <div>${esc(origin)}</div>
                ${length ? `<div>• ${esc(length)}"</div>` : ``}
                ${rg ? `<div>• RG ${esc(rg)}</div>` : ``}
              </div>
            </div>

            <div class="brand-row-right">
              <div class="brand-row-msrp">${msrp ? esc(msrp) : ""}</div>

              <button type="button"
                class="pos-add"
                aria-label="Add to invoice"
                data-receipt-item="1"
                data-id="${esc(key)}"
                data-type="product"
                data-category="Cigars"
                data-brand="${esc(brand)}"
                data-name="${esc(cartName)}"
                data-price="${esc(msrp || "0")}"
                data-img="${esc(cigarImg)}"
                data-sub="${esc(origin)}"
              >+</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ---------- Detail Modal (use existing cigarDetailOverlay) ----------
  function openCigarDetailFromRow(rowEl) {
    if (!cigarOverlay || !cigarBody) return;

    const brand = norm(rowEl.dataset.brand);
    const line = norm(rowEl.dataset.line);
    const cigar = norm(rowEl.dataset.cigar);
    const vitola = norm(rowEl.dataset.vitola);
    const wrapper = norm(rowEl.dataset.wrapper);
    const origin = norm(rowEl.dataset.origin);
    const length = norm(rowEl.dataset.length);
    const rg = norm(rowEl.dataset.rg);
    const msrp = norm(rowEl.dataset.msrp);
    const img = norm(rowEl.dataset.img);

    document.body.classList.add("cigar-detail-open");

    cigarOverlay.classList.add("open");
    cigarOverlay.setAttribute("aria-hidden", "false");

    // Build a simple body consistent with your existing brand.css styles
    cigarBody.innerHTML = `
      <div class="cd-headercard">
        <div>
          <div class="cd-brand">${esc(line || brand || "Cigar")}</div>
          <div class="cd-name">${esc(vitola || cigar || "")}</div>
        </div>
        <div class="cd-h-icon">
          ${
            img
              ? `<img src="${esc(img)}" alt="" onerror="this.remove();" />`
              : `<div style="font-weight:900;color:rgba(15,26,44,.45);font-size:12px;text-align:center;line-height:1.1;">Image coming<br/>soon</div>`
          }
        </div>
      </div>

      <div class="cd-main">
        <div class="cd-img">
          ${
            img
              ? `<img class="cigar-detail-stick" src="${esc(img)}" alt="" onerror="this.remove();" />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(15,26,44,.45);font-weight:900;">Image coming soon</div>`
          }
        </div>

        <div class="cd-right">
          <div class="cd-grid2">
            <div class="cd-stat">
              <div class="k">MSRP</div>
              <div class="v">${esc(msrp ? `$${msrp}` : "—")}</div>
            </div>
            <div class="cd-stat">
              <div class="k">ORIGIN</div>
              <div class="v" style="font-size:18px;line-height:1.1;">${esc(origin || "—")}</div>
            </div>

            <div class="cd-stat small">
              <div class="k">LENGTH</div>
              <div class="v">${esc(length ? `${length}"` : "—")}</div>
            </div>
            <div class="cd-stat small">
              <div class="k">RING</div>
              <div class="v">${esc(rg ? `RG ${rg}` : "—")}</div>
            </div>
          </div>

          <div class="cd-block single">
            <div class="cd-kv">
              <div class="k">WRAPPER</div>
              <div class="v">${esc(wrapper || "—")}</div>
            </div>
          </div>

          <div class="cd-actions">
            <button class="cd-btn" type="button" id="cd-add-btn">ADD</button>
            <button class="cd-btn" type="button" disabled>EDIT</button>
            <button class="cd-btn" type="button" disabled>COMPARE</button>
          </div>
        </div>
      </div>
    `;

    // Add button inside modal uses the SAME cart.js dataset contract
    const addBtn = $("#cd-add-btn");
    if (addBtn) {
      addBtn.onclick = () => {
        // create a synthetic button that cart.js will catch
        const fake = document.createElement("button");
        fake.setAttribute("data-receipt-item", "1");
        fake.dataset.id = rowEl.dataset.key || "";
        fake.dataset.type = "product";
        fake.dataset.category = "Cigars";
        fake.dataset.brand = brand;
        fake.dataset.name = `${line ? line + " — " : ""}${vitola || cigar || "Cigar"}`;
        fake.dataset.price = msrp || "0";
        fake.dataset.img = img || "";
        fake.dataset.sub = origin || "";
        document.body.appendChild(fake);
        fake.click();
        fake.remove();
      };
    }
  }

  function closeCigarDetail() {
    if (!cigarOverlay) return;
    cigarOverlay.classList.remove("open");
    cigarOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  if (cigarClose && !cigarClose.dataset.bound) {
    cigarClose.dataset.bound = "1";
    cigarClose.addEventListener("click", closeCigarDetail);
  }
  if (cigarOverlay && !cigarOverlay.dataset.bound) {
    cigarOverlay.dataset.bound = "1";
    cigarOverlay.addEventListener("click", (e) => {
      // click outside sheet closes
      if (e.target === cigarOverlay) closeCigarDetail();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCigarDetail();
  });

  // Row click handling: ONLY left area opens modal; green + is handled by cart.js
  function bindRowClicksOnce() {
    if (!listEl || listEl.dataset.bound) return;
    listEl.dataset.bound = "1";
    listEl.addEventListener("click", (e) => {
      // ignore add button; cart.js will handle
      if (e.target.closest("[data-receipt-item]")) return;

      const row = e.target.closest("[data-row]");
      if (!row) return;

      // IMPORTANT: only open modal when clicking left area (matches old UX)
      const left = e.target.closest(".brand-row-left");
      if (!left) return;

      openCigarDetailFromRow(row);
    });
  }

  // ---------- Bands sheet (populate from Cigar IMG) ----------
  function openBandsSheet() {
    if (!bandsOptions || !sheetBands) return;

    // reset UI
    bandsOptions.innerHTML = "";
    if (bandsConfirm) bandsConfirm.disabled = true;

    const rowsForBrand = state.all.filter(inBrand);
    const imgs = Array.from(
      new Set(rowsForBrand.map((r) => norm(getCigarImg(r))).filter(Boolean))
    );

    if (!imgs.length) {
      bandsOptions.innerHTML = `
        <div style="padding:16px 6px;color:rgba(15,26,44,.65);font-weight:700;">
          No band art images found for this brand.<br/>
          <span style="font-weight:600;">Add URLs to the <b>Cigar IMG</b> column to enable band art.</span>
        </div>
      `;
      openSheet(sheetBands);
      return;
    }

    // render list with checkboxes
    bandsOptions.innerHTML = imgs
      .map((url) => {
        const checked = state.bandImgs.has(url);
        return `
          <div class="band-row" style="padding:10px 2px;">
            <div class="band-art">
              <img src="${esc(url)}" alt="" onerror="this.style.display='none';" />
            </div>
            <div class="band-meta">
              <div style="font-weight:800;color:#0f1a2c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%;">
                ${esc(url)}
              </div>
              <input class="band-check" type="checkbox" data-band-url="${esc(url)}" ${
                checked ? "checked" : ""
              } />
            </div>
          </div>
        `;
      })
      .join("");

    // bind checkbox changes
    $$('input[data-band-url]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const u = cb.getAttribute("data-band-url") || "";
        if (!u) return;
        if (cb.checked) state.bandImgs.add(u);
        else state.bandImgs.delete(u);

        if (bandsConfirm) bandsConfirm.disabled = state.bandImgs.size === 0;
      });
    });

    // confirm
    if (bandsConfirm && !bandsConfirm.dataset.bound) {
      bandsConfirm.dataset.bound = "1";
      bandsConfirm.addEventListener("click", () => {
        closeAllSheets();
        closeSheetsIfNotReceipt();
        applyAndRender();
      });
    }

    // enable confirm if already selected
    if (bandsConfirm) bandsConfirm.disabled = state.bandImgs.size === 0;

    openSheet(sheetBands);
  }

  // ---------- Filters sheet (basic but real) ----------
  function getUniqueValuesForKey(rows, key) {
    const map = {
      RG: (r) => norm(getRG(r)),
      Length: (r) => norm(getLength(r)),
      "Wrapper Shade": (r) => norm(getWrapperShade(r) || getWrapper(r)),
      Shape: (r) => norm(getShape(r)),
      Vitola: (r) => norm(getVitola(r) || getCigar(r)),
      Strength: (r) => norm(getStrength(r)),
    };
    const fn = map[key];
    if (!fn) return [];
    return Array.from(new Set(rows.map(fn).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function showFiltersHome() {
    if (!filtersHome || !filtersDetail) return;
    filtersHome.hidden = false;
    filtersDetail.hidden = true;
    if (filtersBack) filtersBack.hidden = true;
    if (filtersTitle) filtersTitle.textContent = "Filters";
    state.activeFilterKey = "";
  }

  function showFiltersDetail(key) {
    if (!filtersHome || !filtersDetail || !filtersList) return;

    state.activeFilterKey = key;
    if (filtersTitle) filtersTitle.textContent = key;
    if (filtersBack) filtersBack.hidden = false;

    filtersHome.hidden = true;
    filtersDetail.hidden = false;

    const rowsForBrand = state.all.filter(inBrand);
    const vals = getUniqueValuesForKey(rowsForBrand, key);

    const selected = state.selected[key] || new Set();
    filtersList.innerHTML = vals
      .map((v) => {
        const on = selected.has(v);
        return `
          <button type="button" class="filter-pill"
            data-filter-value="${esc(v)}"
            style="width:100%;justify-content:space-between;display:flex;">
            <span>${esc(v)}</span>
            <span style="width:18px;height:18px;border-radius:999px;border:2px solid ${
              on ? "#007aff" : "rgba(15,26,44,.18)"
            };background:${on ? "#007aff" : "transparent"};"></span>
          </button>
        `;
      })
      .join("");

    // bind value toggles
    $$('[data-filter-value]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-filter-value") || "";
        if (!v) return;
        const set = state.selected[key];
        if (set.has(v)) set.delete(v);
        else set.add(v);

        // re-render this detail view so the dots update
        showFiltersDetail(key);
        updateFiltersConfirmState();
      });
    });

    // search within values
    if (filtersSearch) {
      filtersSearch.value = "";
      filtersSearch.oninput = () => {
        const q = lower(filtersSearch.value);
        $$('[data-filter-value]').forEach((btn) => {
          const v = lower(btn.getAttribute("data-filter-value") || "");
          btn.style.display = !q || v.includes(q) ? "" : "none";
        });
      };
    }
  }

  function updateFiltersConfirmState() {
    if (!filtersConfirm) return;
    const any =
      Object.values(state.selected).some((s) => s.size > 0) ||
      Object.values(state.toggles).some(Boolean) ||
      state.wrapperState !== "all" ||
      state.bandImgs.size > 0;
    filtersConfirm.disabled = !any;
  }

  function renderAppliedFilters() {
    if (!filtersApplied || !filtersAppliedRow) return;

    const pills = [];

    // wrapper pill
    if (state.wrapperState !== "all") {
      pills.push(`Wrapper: ${state.wrapperState}`);
    }

    // bands pill
    if (state.bandImgs.size) {
      pills.push(`Bands: ${state.bandImgs.size}`);
    }

    // selection pills
    for (const [k, set] of Object.entries(state.selected)) {
      if (set.size) pills.push(`${k}: ${set.size}`);
    }
    // toggles pills
    for (const [k, on] of Object.entries(state.toggles)) {
      if (on) pills.push(k);
    }

    if (!pills.length) {
      filtersApplied.hidden = true;
      return;
    }

    filtersApplied.hidden = false;
    filtersAppliedRow.innerHTML = pills
      .map(
        (t) =>
          `<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);font-weight:800;font-size:12px;">${esc(
            t
          )}</span>`
      )
      .join(" ");
  }

  function openFiltersSheet() {
    if (!sheetFilters) return;

    // ensure home view
    showFiltersHome();
    updateFiltersConfirmState();

    // wire home buttons to open detail
    $$("[data-open-filter]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-open-filter") || "";
        if (!key) return;
        showFiltersDetail(key);
      });
    });

    // wire toggles
    $$("[data-toggle-key]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-toggle-key");
        if (!k || !(k in state.toggles)) return;
        state.toggles[k] = !state.toggles[k];
        btn.classList.toggle("is-on", state.toggles[k]);
        updateFiltersConfirmState();
      });
    });

    // back button
    if (filtersBack && !filtersBack.dataset.bound) {
      filtersBack.dataset.bound = "1";
      filtersBack.addEventListener("click", showFiltersHome);
    }

    // confirm applies
    if (filtersConfirm && !filtersConfirm.dataset.bound) {
      filtersConfirm.dataset.bound = "1";
      filtersConfirm.addEventListener("click", () => {
        closeAllSheets();
        closeSheetsIfNotReceipt();
        applyAndRender();
      });
    }

    openSheet(sheetFilters);
  }

  // ---------- Boot ----------
  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";
    if (backBtn) backBtn.addEventListener("click", () => history.back());

    // row clicks (modal)
    bindRowClicksOnce();

    // search
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        state.q = norm(searchEl.value);
        applyAndRender();
      });
    }

    // filters/bands buttons
    if (btnBands) btnBands.addEventListener("click", openBandsSheet);
    if (btnFilters) btnFilters.addEventListener("click", openFiltersSheet);

    // wrapper toggle
    setWrapperUI();
    if (segSwitch) segSwitch.addEventListener("click", cycleWrapper);
    if (segMaduro)
      segMaduro.addEventListener("click", () => {
        state.wrapperState = state.wrapperState === "maduro" ? "all" : "maduro";
        setWrapperUI();
        applyAndRender();
      });
    if (segNatural)
      segNatural.addEventListener("click", () => {
        state.wrapperState = state.wrapperState === "natural" ? "all" : "natural";
        setWrapperUI();
        applyAndRender();
      });

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);

      // Header brand icon uses brand rows (Brand IMG -> fallback SVG)
      const rowsForBrand = state.all.filter(inBrand);
      setHeaderBrandIcon(rowsForBrand);

      applyAndRender();

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
