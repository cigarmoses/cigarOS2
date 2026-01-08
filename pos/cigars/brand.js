/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)

   ✅ Filters Sheet v3.1 (locked spec)
   ✅ Cigar Detail Popup (mockup matched)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);
  const qp = (k) => new URLSearchParams(location.search).get(k) || "";

  // ---------- DOM (core) ----------
  const brandTitleEl = $("#brand-title");
  const brandIconWrap = $("#brand-icon");
  const listEl = $("#brand-list");
  const statusEl = $("#brand-status");
  const searchEl = $("#brand-search");
  const backBtn = $("#brand-back");

  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");

  // wrapper toggle
  const wrapperSeg = $("#wrapper-seg");
  const btnMaduro = $("#seg-maduro");
  const btnNatural = $("#seg-natural");
  const segDot = $("#seg-switch");

  // applied filters row under controls (optional; kept)
  const brandAppliedWrap = $("#brand-applied");
  const brandAppliedRow = $("#brand-applied-row");

  // Backdrop + Sheets
  const backdrop = $("#sheet-backdrop");
  const sheetBands = $("#sheet-bands");
  const bandsOptions = $("#bands-options");
  const bandsConfirm = $("#bands-confirm");

  // Filters sheet
  const sheetFilters = $("#sheet-filters");

  // ---------- State ----------
  let ALL = [];
  let VIEW_BY_ID = Object.create(null);

  // Band filters
  let pendingBands = new Set();
  let activeBands = new Set();

  // Wrapper “maduro/natural/all”
  let wrapperState = "all"; // maduro | natural | all

  // Price range derived from data
  let PRICE_MIN = 0;
  let PRICE_MAX = 0;

  // Filters (ACTIVE = applied)
  const active = {
    priceMin: null,
    priceMax: null,
    fields: {
      Vitola: new Set(),
      RG: new Set(),
      Length: new Set(),
      "Wrapper Shade": new Set(),
      Strength: new Set(),
      Shape: new Set(),
    },
    onlyShow: "", // Barberpole, Box-Pressed, Flavored, Tins, Packs, Tubos
  };

  // Filters (PENDING = in open sheet)
  let pending = null;

  // Accordion open section key
  let openSection = "";

  // ---------- helpers ----------
  const norm = (s) => (s || "").toString().trim().toLowerCase();
  const normKeepCase = (s) => (s || "").toString().trim();

  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  const money = (n) =>
    window.CigarOSCart?.money ? window.CigarOSCart.money(n) : Number(n || 0).toFixed(2);

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
  }

  function escapeHTML(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function escapeAttr(s) {
    return escapeHTML(s).replaceAll("`", "");
  }

  function normalizeIconPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("img/")) s = "/" + s;
    if (!s.startsWith("/")) s = "/" + s;

    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/^\/img\/icons\/brands\/[a-z0-9]\/+/i, "/img/icons/brands/");
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function bestIconForRow(row) {
    const raw = row["Cigar IMG"] || row["Brand IMG"] || row["Manufacturer IMG"] || "";
    return normalizeIconPath(raw);
  }

  function bestBrandHeaderIcon(firstRow) {
    const raw = firstRow?.["Brand IMG"] || firstRow?.["Manufacturer IMG"] || "";
    const primary = normalizeIconPath(raw);
    if (primary) return primary;
    return bestIconForRow(firstRow || {});
  }

  function applyBrandHeader(brandName, firstRow) {
    if (brandTitleEl) brandTitleEl.textContent = brandName || "Brand";

    if (brandIconWrap) {
      const src = bestBrandHeaderIcon(firstRow);
      if (!src) {
        brandIconWrap.innerHTML = "";
        return;
      }
      brandIconWrap.innerHTML = `<img src="${escapeAttr(src)}" alt="" />`;
    }
  }

  // ---------- CSV parsing ----------
  function parseCSV(text) {
    const rows = [];
    let i = 0,
      field = "",
      row = [],
      inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        if (c === '"') {
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (c === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
          continue;
        }
        if (c === "\r") {
          i++;
          continue;
        }
        field += c;
        i++;
      }
    }
    row.push(field);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].every((x) => !x || !x.trim())) rows.pop();
    return rows;
  }

  function tableFromCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => (h || "").trim());

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = (rows[r][c] ?? "").trim();
      out.push(obj);
    }
    return out;
  }

  // ---------- LIST render ----------
  function injectRowOpenHitStylesOnce() {
    const id = "brand-row-openhit-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .brand-row{ position: relative; }
      .brand-row .row-openhit{
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 132px;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        z-index: 2;
        border-radius: 18px;
      }
      .brand-row .row-price,
      .brand-row .row-add{
        position: relative;
        z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  function renderList(rows) {
    if (!listEl) return;

    VIEW_BY_ID = Object.create(null);

    if (!rows.length) {
      listEl.innerHTML = "";
      setStatus("No results.");
      return;
    }

    setStatus("");

    listEl.innerHTML = rows
      .map((row) => {
        const name = row.Cigar || "";
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));
        const icon = bestIconForRow(row);
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`;

        VIEW_BY_ID[id] = row;

        return `
          <div class="brand-row" data-id="${escapeAttr(id)}">
            <img class="row-ico" src="${escapeAttr(icon)}" alt=""
                 onerror="this.style.opacity='0';this.style.pointerEvents='none';" />

            <div class="row-main" data-open>
              <div class="row-title">${escapeHTML(name)}</div>
              <div class="row-sub">${escapeHTML(sub)}</div>
            </div>

            <div class="row-price">${price}</div>
            <button class="row-add" type="button" aria-label="Add" data-add>+</button>

            <button class="row-openhit" type="button" aria-label="Open details" data-open-detail></button>
          </div>
        `;
      })
      .join("");

    injectRowOpenHitStylesOnce();
  }

  function initListDelegation() {
    if (!listEl) return;

    listEl.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const rowEl = addBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: row.Cigar,
          brand: row.Brand,
          category: "Cigars",
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: bestIconForRow(row) || "",
        });
        return;
      }

      const openBtn = e.target.closest("[data-open-detail], [data-open]");
      if (openBtn) {
        const rowEl = openBtn.closest(".brand-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = VIEW_BY_ID[id];
        if (!row) return;
        openCigarDetail(row);
        return;
      }
    });
  }

  // ---------- filtering helpers ----------
  function matchBandSource(row) {
    return `${row.Line || ""} ${row.Cigar || ""}`.toLowerCase();
  }

  function isTruthyCell(v) {
    const s = norm(v);
    if (!s) return false;
    if (s === "0" || s === "false" || s === "no" || s === "n") return false;
    return true;
  }

  function onlyShowPass(row) {
    const key = active.onlyShow;
    if (!key) return true;

    if (key === "Barberpole") return isTruthyCell(row.Barber);
    if (key === "Box-Pressed") return isTruthyCell(row["Box-Pressed"]);
    if (key === "Flavored") return isTruthyCell(row.Flavored);
    if (key === "Tins") return isTruthyCell(row.Tin);
    if (key === "Packs") return isTruthyCell(row.Pack);
    if (key === "Tubos") return isTruthyCell(row.Tubo);

    return true;
  }

  function applyAllFilters() {
    const q = norm(searchEl?.value || "");

    const out = ALL.filter((row) => {
      if (q) {
        const hay = norm(`${row.Cigar || ""} ${row.Vitola || ""} ${row.Line || ""}`);
        if (!hay.includes(q)) return false;
      }

      const cigarName = norm(row.Cigar || "");
      if (wrapperState === "maduro") {
        if (!cigarName.includes("maduro")) return false;
      } else if (wrapperState === "natural") {
        if (!cigarName.includes("natural")) return false;
      }

      const msrp = toNum(row.MSRP);
      if (active.priceMin != null && msrp < active.priceMin) return false;
      if (active.priceMax != null && msrp > active.priceMax) return false;

      for (const [field, set] of Object.entries(active.fields)) {
        if (!set || !set.size) continue;
        const cell = row[field] ?? "";
        const k = norm(cell);
        if (!set.has(k)) return false;
      }

      if (!onlyShowPass(row)) return false;

      if (activeBands.size) {
        const src = matchBandSource(row);
        let ok = false;
        activeBands.forEach((token) => {
          if (src.includes(token)) ok = true;
        });
        if (!ok) return false;
      }

      return true;
    });

    renderList(out);
  }

  // ---------- wrapper toggle ----------
  function setWrapperState(state) {
    wrapperState = state;
    if (wrapperSeg) wrapperSeg.dataset.state = state;

    btnMaduro?.setAttribute("aria-pressed", String(state === "maduro"));
    btnNatural?.setAttribute("aria-pressed", String(state === "natural"));

    applyAllFilters();
  }

  function initWrapperSeg() {
    if (!wrapperSeg) return;

    setWrapperState("all");

    btnMaduro?.addEventListener("click", () => setWrapperState("maduro"));
    btnNatural?.addEventListener("click", () => setWrapperState("natural"));

    segDot?.addEventListener("click", () => {
      if (wrapperState === "maduro") setWrapperState("all");
      else if (wrapperState === "all") setWrapperState("natural");
      else setWrapperState("maduro");
    });
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
      if (e.key === "Escape" && detailOverlay?.classList.contains("open")) closeCigarDetail();
    });
  }

  function pickCigarImage(row) {
    const raw = row["Cigar IMG"] || row["Cigar Image"] || row["Image"] || "";
    let src = normalizeIconPath(raw);

    if (!src) {
      const b = norm(row.Brand || "");
      const c = norm(row.Cigar || "");
      if (b === "padron" && (c.includes("60th") || c.includes("60"))) {
        src = "/img/cigars/padron/padron60thanniversaryperfecto.png";
      }
    }
    return src;
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

    const brand = row.Brand || qp("brand") || "Brand";
    const cigarName = row.Cigar || "";
    const brandIcon = bestBrandHeaderIcon(row) || bestIconForRow(row) || "";
    const cigarImg = pickCigarImage(row);

    const rg = row.RG || row["Ring"] || "";
    const len = row.Length || "";
    const strength = row.Strength || "";
    const vitola = row.Vitola || "";
    const shape = row.Shape || "";
    const wrapper = row.Wrapper || row["Wrapper Type"] || row["Wrapper"] || row["Wrapper Country"] || "";
    const binder = row.Binder || row["Binder Type"] || "";
    const filler = row.Filler || row["Filler Type"] || "";
    const origin = row.Origin || row["Country of Origin"] || row["Country"] || "";
    const shade = row["Wrapper Shade"] || row.Shade || "";

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
                <div class="v">${escapeHTML(String(rg || ""))}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${escapeHTML(String(len || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${escapeHTML(String(shape || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${escapeHTML(String(vitola || ""))}</div>
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
              <button type="button" class="cd-btn" disabled>COMPARE TO</button>
              <button type="button" class="cd-btn is-live" data-cd-action="add">ADD TO BILL</button>
              <button type="button" class="cd-btn" disabled>EDIT IN HUB</button>
            </div>
          </div>
        </div>
      </div>
    `;

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeCigarDetail);

    detailSheet.querySelector('[data-cd-action="add"]')?.addEventListener("click", () => {
      window.CigarOSCart?.add({
        id: row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}`,
        name: row.Cigar,
        brand: row.Brand,
        category: "Cigars",
        sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
        price: toNum(row.MSRP),
        img: bestIconForRow(row) || "",
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

  // ---------- init ----------
  function initBackButton() {
    if (!backBtn) return;
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.history.length > 1) return window.history.back();
      window.location.href = "/pos/cigars/";
    });
  }

  function computePriceRangeFromAll() {
    if (!ALL.length) {
      PRICE_MIN = 0;
      PRICE_MAX = 0;
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    ALL.forEach((r) => {
      const n = toNum(r.MSRP);
      if (!Number.isFinite(n)) return;
      if (n < min) min = n;
      if (n > max) max = n;
    });
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;

    const roundDown = (x) => Math.floor(x * 4) / 4;
    const roundUp = (x) => Math.ceil(x * 4) / 4;

    PRICE_MIN = roundDown(min);
    PRICE_MAX = roundUp(max);

    active.priceMin = PRICE_MIN;
    active.priceMax = PRICE_MAX;
  }

  async function load() {
    const brand = (qp("brand") || "").trim();
    if (!brand) {
      setStatus("Missing brand.");
      return;
    }

    setStatus("Loading…");

    const url = `${CSV_URL}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    const brandNorm = norm(brand);
    ALL = table.filter((r) => norm(r.Brand) === brandNorm);
    if (!ALL.length) ALL = table.filter((r) => norm(r["Brand aka"]) === brandNorm);

    applyBrandHeader(brand, ALL[0]);
    computePriceRangeFromAll();

    setStatus("");
    applyAllFilters();
  }

  function init() {
    initBackButton();
    initWrapperSeg();
    initListDelegation();

    searchEl?.addEventListener("input", applyAllFilters);

    load().catch((err) => {
      console.error("brand.js load error:", err);
      setStatus("Failed to load cigars.");
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
