/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   RESTORE CONTRACT:
   ✅ Uses existing DOM in /pos/cigars/brand.html (NO injected sheet/modal)
   ✅ Brand icon -> #brand-icon (uses Brand IMG or Manufacturer IMG)
   ✅ Row content matches your “perfect” UI:
      - Title: Cigar (only)
      - Sub: Wrapper Shade (or Wrapper) — Vitola
   ✅ Row tap (left area) opens YOUR existing cigar detail popup:
      - #cigarDetailOverlay + #cigarDetailBody + #cigarDetailClose
   ✅ Green + adds to invoice (JSON payload handled by updated cart.js)
   ✅ Filters/Bands buttons use #btn-filters / #btn-bands
   ✅ Wrapper toggle uses #wrapper-seg data-state (maduro/all/natural)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  const norm = (s) => String(s ?? "").trim();
  const lower = (s) => norm(s).toLowerCase();
  const slug = (s) => lower(s).replace(/[^a-z0-9]+/g, "");
  const esc = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const BRAND = norm(qp("brand"));
  const BRAND_SLUG = slug(BRAND);

  // ---- DOM ----
  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back");

  const filtersBtn = $("#btn-filters");
  const bandsBtn = $("#btn-bands");

  const wrapperSeg = $("#wrapper-seg");
  const segMaduro = $("#seg-maduro");
  const segNatural = $("#seg-natural");
  const segSwitch = $("#seg-switch");

  // existing sheets / overlay
  const sheetBackdrop = $("#sheet-backdrop");
  const sheetFilters = $("#sheet-filters");
  const sheetBands = $("#sheet-bands");

  const cigarOverlay = $("#cigarDetailOverlay");
  const cigarClose = $("#cigarDetailClose");
  const cigarBody = $("#cigarDetailBody");

  // ---- CSV parse ----
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
        } else inQ = !inQ;
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

  // columns (your header list)
  const getManufacturer = (r) => pick(r, ["Manufacturer"]);
  const getBrand = (r) => pick(r, ["Brand"]);
  const getLine = (r) => pick(r, ["Line"]);
  const getCigar = (r) => pick(r, ["Cigar"]);
  const getVitola = (r) => pick(r, ["Vitola"]);
  const getWrapper = (r) => pick(r, ["Wrapper"]);
  const getWrapperShade = (r) => pick(r, ["Wrapper Shade"]);
  const getBinder = (r) => pick(r, ["Binder"]);
  const getFiller = (r) => pick(r, ["Filler"]);
  const getOrigin = (r) => pick(r, ["Origin"]);
  const getLength = (r) => pick(r, ["Length"]);
  const getRG = (r) => pick(r, ["RG"]);
  const getShape = (r) => pick(r, ["Shape"]);
  const getStrength = (r) => pick(r, ["Strength"]);
  const getMSRP = (r) => pick(r, ["MSRP"]);
  const getBrandImg = (r) => pick(r, ["Brand IMG", "Manufacturer IMG"]);
  const getCigarImg = (r) => pick(r, ["Cigar IMG"]);

  const priceNum = (x) => {
    const n = Number(String(x ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  function inThisBrand(r) {
    if (!BRAND) return true;
    const b = norm(getBrand(r)) || norm(getManufacturer(r));
    return slug(b) === BRAND_SLUG;
  }

  // ---- state ----
  const state = {
    all: [],
    view: [],
    q: "",
    wrapperState: "all", // maduro | natural | all
  };

  // ---- sheets open/close (existing HTML) ----
  function openSheet(el) {
    if (!sheetBackdrop || !el) return;
    sheetBackdrop.hidden = false;
    el.hidden = false;
    sheetBackdrop.classList.add("open");
    el.classList.add("open");
  }

  function closeAllSheets() {
    if (sheetBackdrop) {
      sheetBackdrop.hidden = true;
      sheetBackdrop.classList.remove("open");
    }
    [sheetFilters, sheetBands].forEach((s) => {
      if (!s) return;
      s.hidden = true;
      s.classList.remove("open");
    });
  }

  // ---- cigar detail overlay (existing HTML) ----
  function openCigarDetail(item) {
    if (!cigarOverlay || !cigarBody) return;

    // build body using your existing brand.css cd-* styles
    const img = item.cigarImg;
    const imgHTML = img
      ? `<img class="cigar-detail-stick" src="${esc(img)}" alt="" onerror="this.remove(); this.parentElement.innerHTML='<div class=img-ph>Image coming soon</div>'">`
      : `<div class="img-ph">Image coming soon</div>`;

    cigarBody.innerHTML = `
      <div class="cd-headercard">
        <div style="min-width:0;">
          <div class="cd-brand">${esc(item.brandTitle)}</div>
          <div class="cd-name">${esc(item.cigar)}</div>
        </div>
        <div class="cd-h-icon">
          ${
            item.brandImg
              ? `<img src="${esc(item.brandImg)}" alt="" onerror="this.style.display='none'">`
              : ``
          }
        </div>
      </div>

      <div class="cd-main">
        <div class="cd-img">${imgHTML}</div>

        <div class="cd-right">
          <div class="cd-grid2">
            <div class="cd-stat">
              <div class="k">MSRP</div>
              <div class="v">${esc(item.msrp || "0.00")}</div>
            </div>

            <div class="cd-stat">
              <div class="k">RG</div>
              <div class="v">${esc(item.rg || "")}</div>
            </div>

            <div class="cd-stat small">
              <div class="k">VITOLA</div>
              <div class="v">${esc(item.vitola || "")}</div>
            </div>

            <div class="cd-stat small">
              <div class="k">SHAPE</div>
              <div class="v">${esc(item.shape || "")}</div>
            </div>
          </div>

          <div class="cd-block">
            <div class="cd-kv">
              <div class="k">WRAPPER</div>
              <div class="v">${esc(item.wrapperShade || item.wrapper || "")}</div>
            </div>
            <div class="cd-kv">
              <div class="k">BINDER</div>
              <div class="v">${esc(item.binder || "")}</div>
            </div>
            <div class="cd-kv">
              <div class="k">FILLER</div>
              <div class="v">${esc(item.filler || "")}</div>
            </div>
            <div class="cd-kv">
              <div class="k">ORIGIN</div>
              <div class="v">${esc(item.origin || "")}</div>
            </div>
            <div class="cd-kv">
              <div class="k">LENGTH</div>
              <div class="v">${esc(item.length || "")}</div>
            </div>
            <div class="cd-kv">
              <div class="k">STRENGTH</div>
              <div class="v">${esc(item.strength || "")}</div>
            </div>
          </div>

          <div class="cd-actions">
            <button class="cd-btn" type="button" id="cdAddBtn">ADD</button>
            <button class="cd-btn" type="button" disabled>EDIT</button>
            <button class="cd-btn" type="button" disabled>COMPARE</button>
          </div>
        </div>
      </div>
    `;

    cigarOverlay.classList.add("open");
    document.body.classList.add("cigar-detail-open");

    const addBtn = $("#cdAddBtn");
    if (addBtn) {
      addBtn.onclick = () => {
        // direct add (reliable)
        if (window.CigarOSCart?.add) {
          window.CigarOSCart.add(item.cartItem);
        }
        // keep modal open or close? (your UX previously closes after add)
        closeCigarDetail();
      };
    }
  }

  function closeCigarDetail() {
    if (!cigarOverlay) return;
    cigarOverlay.classList.remove("open");
    document.body.classList.remove("cigar-detail-open");
    if (cigarBody) cigarBody.innerHTML = "";
  }

  // ---- build cart payload as JSON for + button ----
  function buildCartItem(item) {
    const id = `${slug(item.brandTitle)}|${slug(item.line)}|${slug(item.cigar)}|${priceNum(item.msrp)}`;
    return {
      id,
      type: "product",
      category: "Cigars",
      brand: item.brandTitle,
      name: item.cigar,
      sub: `${item.wrapperShade || item.wrapper || ""}${item.vitola ? ` — ${item.vitola}` : ""}`.trim(),
      price: priceNum(item.msrp),
      img: item.cigarImg || "",
      qty: 1,
    };
  }

  // ---- filtering ----
  function wrapperPass(r) {
    const want = state.wrapperState;
    if (want === "all") return true;

    const w = lower(getWrapperShade(r) || getWrapper(r));
    if (!w) return true;

    const isMaduro = w.includes("maduro");
    if (want === "maduro") return isMaduro;
    if (want === "natural") return !isMaduro;
    return true;
  }

  function apply() {
    const q = lower(state.q);

    state.view = state.all
      .filter(inThisBrand)
      .filter(wrapperPass)
      .filter((r) => {
        if (!q) return true;
        const blob = [
          getCigar(r),
          getVitola(r),
          getWrapperShade(r),
          getWrapper(r),
          getMSRP(r),
        ]
          .map((x) => lower(x))
          .join(" ");
        return blob.includes(q);
      });

    render();
  }

  // ---- render rows in “perfect” layout ----
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
        const brandTitle = norm(getBrand(r) || getManufacturer(r) || BRAND || "Brand");
        const line = norm(getLine(r));
        const cigar = norm(getCigar(r));
        const vitola = norm(getVitola(r));
        const wrapper = norm(getWrapper(r));
        const wrapperShade = norm(getWrapperShade(r));
        const binder = norm(getBinder(r));
        const filler = norm(getFiller(r));
        const origin = norm(getOrigin(r));
        const length = norm(getLength(r));
        const rg = norm(getRG(r));
        const shape = norm(getShape(r));
        const strength = norm(getStrength(r));
        const msrp = norm(getMSRP(r));
        const brandImg = norm(getBrandImg(r));
        const cigarImg = norm(getCigarImg(r));

        const sub = `${wrapperShade || wrapper}${vitola ? ` — ${vitola}` : ""}`.trim();

        const item = {
          brandTitle,
          line,
          cigar,
          vitola,
          wrapper,
          wrapperShade,
          binder,
          filler,
          origin,
          length,
          rg,
          shape,
          strength,
          msrp,
          brandImg,
          cigarImg,
        };
        const cartItem = buildCartItem(item);

        return `
          <div class="brand-row" data-row
               data-item='${esc(JSON.stringify({ ...item, cartItem }))}'>
            <div class="row-ico">
              ${
                brandImg
                  ? `<img src="${esc(brandImg)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';" />`
                  : `<div style="width:100%;height:100%;display:grid;place-items:center;font-weight:900;color:rgba(255,255,255,.55);font-size:12px;">IMG<br/>SOON</div>`
              }
            </div>

            <div class="row-main" data-open-detail>
              <div class="row-title">${esc(cigar)}</div>
              <div class="row-sub">${esc(sub || " ")}</div>
            </div>

            <div class="row-price">${esc(msrp || "0.00")}</div>

            <button type="button"
              class="row-add"
              aria-label="Add to invoice"
              data-receipt-item='${esc(JSON.stringify(cartItem))}'>+</button>
          </div>
        `;
      })
      .join("");
  }

  // ---- events ----
  function bind() {
    backBtn?.addEventListener("click", () => history.back());

    // search
    searchEl?.addEventListener("input", () => {
      state.q = norm(searchEl.value || "");
      apply();
    });

    // wrapper toggle
    function setWrapperState(next) {
      state.wrapperState = next;
      if (wrapperSeg) wrapperSeg.setAttribute("data-state", next);

      if (segMaduro) segMaduro.setAttribute("aria-pressed", String(next === "maduro"));
      if (segNatural) segNatural.setAttribute("aria-pressed", String(next === "natural"));

      apply();
    }

    segMaduro?.addEventListener("click", () => setWrapperState("maduro"));
    segNatural?.addEventListener("click", () => setWrapperState("natural"));
    segSwitch?.addEventListener("click", () => {
      // cycle: all -> maduro -> natural -> all
      const cur = state.wrapperState;
      setWrapperState(cur === "all" ? "maduro" : cur === "maduro" ? "natural" : "all");
    });

    // sheets (existing)
    filtersBtn?.addEventListener("click", () => openSheet(sheetFilters));
    bandsBtn?.addEventListener("click", () => openSheet(sheetBands));

    sheetBackdrop?.addEventListener("click", closeAllSheets);
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sheet-close]")) closeAllSheets;
    });

    // cigar overlay close
    cigarClose?.addEventListener("click", closeCigarDetail);
    cigarOverlay?.addEventListener("click", (e) => {
      // click outside sheet closes
      if (e.target === cigarOverlay) closeCigarDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllSheets();
        closeCigarDetail();
      }
    });

    // row click -> open detail (ignore + button)
    listEl?.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".row-add,[data-receipt-item]");
      if (addBtn) return; // cart.js handles add

      const row = e.target.closest("[data-row]");
      if (!row) return;

      const raw = row.getAttribute("data-item");
      const payload = raw ? JSON.parse(raw) : null;
      if (!payload) return;

      // open cigar detail
      openCigarDetail({
        ...payload,
        cartItem: payload.cartItem,
      });
    });
  }

  async function boot() {
    if (brandTitleEl) brandTitleEl.textContent = BRAND || "Brand";

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading…";
    }

    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      state.all = csvToObjects(text);

      // set brand icon from first matching row
      const first = state.all.find(inThisBrand);
      const iconSrc = first ? norm(getBrandImg(first)) : "";
      if (brandIconEl) {
        brandIconEl.innerHTML = iconSrc
          ? `<img src="${esc(iconSrc)}" alt="" onerror="this.style.display='none';" />`
          : ``;
      }

      bind();
      apply();

      if (statusEl) statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Failed to load cigars.";
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
