// /pos/cigars/brand.js
// FINAL LOCKED VERSION — DO NOT REPLACE CSV URL
// Uses confirmed working Google Sheets CSV export
//
// FIXES IN THIS VERSION:
// ✅ Cigars load again (brand match checks Brand OR Brand aka OR Manufacturer)
// ✅ Filters sheet opens + closes (X / Close / Confirm / backdrop / ESC)
// ✅ Bands sheet opens + closes + renders correct Padron band art cards
// ✅ Receipt sheet opens + closes (button, close, backdrop, ESC) + badge updates
// ✅ Bands filtering searches BOTH Line and Cigar (per your rule)

(function () {
  "use strict";

  /* ===============================
     CONFIG (LOCKED)
  =============================== */
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const RECEIPT_KEY = "pos_receipt_items_v1";

  /* ===============================
     HELPERS
  =============================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (v) => (v ?? "").toString().trim();
  const norm = (v) => txt(v).toLowerCase();
  const uniq = (arr) => Array.from(new Set(arr));
  const money = (v) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  };

  function safeOn(el, ev, fn) {
    if (el) el.addEventListener(ev, fn, { passive: ev !== "keydown" });
  }

  function getBrandParam() {
    return new URL(location.href).searchParams.get("brand") || "";
  }

  function slugBrand(s) {
    return norm(s)
      .replace(/&/g, "and")
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function csvToObjects(csv) {
    // Robust-ish CSV parser (handles quoted commas)
    const rows = [];
    let row = [],
      cur = "",
      q = false;

    for (let i = 0; i < csv.length; i++) {
      const c = csv[i],
        n = csv[i + 1];

      if (c === '"' && q && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        q = !q;
        continue;
      }
      if (c === "," && !q) {
        row.push(cur);
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !q) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur || row.length) {
      row.push(cur);
      rows.push(row);
    }

    const headers = (rows.shift() || []).map((h) => txt(h));
    return rows
      .filter((r) => r.some((x) => txt(x) !== ""))
      .map((r) => {
        const o = {};
        headers.forEach((h, i) => (o[h] = txt(r[i])));
        return o;
      });
  }

  function wrapperBucket(row) {
    const s = norm(
      row["Wrapper Shade"] ||
        row["Wrapper"] ||
        row["Cigar"] ||
        row["Line"] ||
        ""
    );

    if (s.includes("maduro") || s.includes("oscuro") || s.includes("negro"))
      return "maduro";

    if (
      s.includes("natural") ||
      s.includes("claro") ||
      s.includes("connecticut") ||
      s.includes("rosado") ||
      s.includes("shade")
    )
      return "natural";

    return "either";
  }

  /* ===============================
     STATE
  =============================== */
  const state = {
    brandRaw: getBrandParam(),
    brand: norm(getBrandParam()),
    all: [],
    view: [],
    search: "",
    wrapper: "all", // all | maduro | natural
    bands: new Set(), // selected "band keys" (not necessarily the full line text)
    receipt: [],
  };

  /* ===============================
     DOM (multi-selector safe)
  =============================== */
  function pickOne(selectors) {
    for (const s of selectors) {
      const el = $(s);
      if (el) return el;
    }
    return null;
  }

  const el = {
    // header
    title: pickOne(["#brand-title", ".brand-title", "h1.brand-title"]),
    iconBox: pickOne(["#brand-icon", ".brand-icon"]),
    back: pickOne(["#brand-back", ".pos-back", ".icon-btn#brand-back"]),

    // list/search/status
    list: pickOne(["#brand-list", ".brand-list"]),
    status: pickOne(["#brand-status", ".brand-status"]),
    search: pickOne(["#brand-search", "input[type='search']#brand-search"]),

    // buttons
    btnFilters: pickOne(["#btn-filters", "#brand-filters", "button[data-open='filters']"]),
    btnBands: pickOne(["#btn-bands", "#brand-bands", "button[data-open='bands']"]),

    // wrapper toggle
    segWrap: pickOne(["#wrapper-seg", "#wrapper-seg-wrap", ".seg#wrapper-seg", "#wrapper-seg[data-state]"]),
    segMaduro: pickOne(["#seg-maduro", "button#seg-maduro"]),
    segNatural: pickOne(["#seg-natural", "button#seg-natural"]),
    segSwitch: pickOne(["#seg-switch", ".seg-dot", "button#seg-switch"]),

    // sheets + backdrop
    sheetBackdrop: pickOne(["#sheet-backdrop", "#sheetBackdrop", ".sheet-backdrop"]),
    sheetReceipt: pickOne(["#sheet-receipt", "#receipt-sheet", ".sheet#sheet-receipt"]),
    sheetBands: pickOne(["#sheet-bands", "#bands-sheet", ".sheet#sheet-bands"]),
    sheetFilters: pickOne(["#sheet-filters", "#filters-sheet", ".sheet#sheet-filters"]),

    // bands area + actions
    bandsGrid: pickOne(["#bands-options", "#bands-grid", ".bands-options"]),
    bandsClear: pickOne(["#bands-clear", "button#bands-clear", "[data-bands-clear]"]),
    bandsConfirm: pickOne(["#bands-confirm", "button#bands-confirm", "[data-bands-confirm]"]),

    // receipt ui
    receiptFab: pickOne(["#receipt-open", ".receipt-fab", "button#receipt-open"]),
    receiptBadge: pickOne(["#receipt-count", ".receipt-badge", "#receipt-badge"]),
    receiptItems: pickOne(["#receipt-items", ".receipt-items", "#receiptItems"]),
    receiptClear: pickOne(["#receipt-clear", "button#receipt-clear", "[data-receipt-clear]"]),
  };

  /* ===============================
     SHEETS (bottom sheets)
  =============================== */
  function isShown(node) {
    if (!node) return false;
    if (node.hidden) return false;
    const st = getComputedStyle(node);
    return st.display !== "none" && st.visibility !== "hidden" && st.opacity !== "0";
  }

  function openSheet(sheetEl) {
    if (!sheetEl || !el.sheetBackdrop) return;
    // close others
    closeAllSheets();

    el.sheetBackdrop.hidden = false;
    sheetEl.hidden = false;

    // lock body scroll on iOS
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeAllSheets() {
    // hide all sheets
    $$(".sheet").forEach((s) => (s.hidden = true));

    if (el.sheetReceipt) el.sheetReceipt.hidden = true;
    if (el.sheetBands) el.sheetBands.hidden = true;
    if (el.sheetFilters) el.sheetFilters.hidden = true;

    if (el.sheetBackdrop) el.sheetBackdrop.hidden = true;

    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function wireSheetClosers(scope) {
    if (!scope) return;

    // Common close controls:
    // - anything with data-sheet-close
    // - buttons that say Close / Confirm (Confirm should also close)
    // - top-right X buttons (common ids/classes)
    const closers = [
      ...$$("[data-sheet-close]", scope),
      ...$$(".sheet-close", scope),
      ...$$(".sheet-x", scope),
      ...$$(".close", scope),
      ...$$("#filters-close, #bands-close, #receipt-close", scope),
      ...$$("button", scope).filter((b) => {
        const t = norm(b.textContent);
        return t === "close" || t === "confirm" || t === "x" || t === "✕" || t === "×";
      }),
    ];

    closers.forEach((btn) =>
      safeOn(btn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAllSheets();
      })
    );
  }

  /* ===============================
     RECEIPT
  =============================== */
  function loadReceipt() {
    try {
      state.receipt = JSON.parse(localStorage.getItem(RECEIPT_KEY) || "[]");
      if (!Array.isArray(state.receipt)) state.receipt = [];
    } catch {
      state.receipt = [];
    }
  }

  function saveReceipt() {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(state.receipt));
  }

  function updateReceiptUI() {
    if (el.receiptBadge) {
      const count = state.receipt.length;
      el.receiptBadge.textContent = String(count);
      el.receiptBadge.hidden = count === 0;
    }

    if (el.receiptItems) {
      el.receiptItems.innerHTML = state.receipt
        .map(
          (i) => `
          <div class="receipt-row">
            <div class="receipt-name">${txt(i.name)}</div>
            <div class="receipt-price">$${money(i.price)}</div>
          </div>`
        )
        .join("");
    }

    saveReceipt();
  }

  function addToReceipt(row) {
    state.receipt.push({
      name: row["Cigar"] || row["Line"] || "Cigar",
      price: money(row["MSRP"]),
    });
    updateReceiptUI();
  }

  /* ===============================
     BRAND ICON
  =============================== */
  function brandIconCandidates(brandName) {
    const slug = slugBrand(brandName || "");
    // Primary per your repo memory: /img/icons/brands (plural)
    // Fallback: /img/icons/brand (singular)
    return [
      `/img/icons/brands/${slug}.svg`,
      `/img/icons/brand/${slug}.svg`,
      `/img/icons/brands/${slug}.png`,
      `/img/icons/brand/${slug}.png`,
    ];
  }

  function mountBrandIcon(target, brandName) {
    if (!target) return;

    const candidates = brandIconCandidates(brandName);
    const img =
      target.tagName && target.tagName.toLowerCase() === "img"
        ? target
        : (() => {
            target.innerHTML = "";
            const im = document.createElement("img");
            im.alt = "";
            target.appendChild(im);
            return im;
          })();

    let idx = 0;
    img.decoding = "async";
    img.loading = "eager";
    img.src = candidates[idx];
    img.onerror = () => {
      idx += 1;
      if (idx < candidates.length) img.src = candidates[idx];
    };
  }

  function setBrandHeader() {
    if (el.title) el.title.textContent = state.brandRaw || "Brand";
    mountBrandIcon(el.iconBox, state.brandRaw || state.brand);
  }

  /* ===============================
     BANDS (Padron band art)
     - Source column is Line OR Cigar, so we search both.
  =============================== */
  function bandKeyForRow(row) {
    const hay = norm(`${row["Line"] || ""} ${row["Cigar"] || ""}`);

    if (hay.includes("1926")) return "1926";
    if (hay.includes("1964") || hay.includes("anniversary")) return "1964";
    if (hay.includes("damaso")) return "damaso";

    // If it’s a Family Reserve / Serie label without art, keep it as text-only group
    if (hay.includes("family reserve")) return "family";
    if (hay.includes("serie 1926")) return "1926";
    if (hay.includes("serie 1964")) return "1964";

    return "other";
  }

  function bandDisplay(key) {
    // You provided these exact paths:
    // /img/icons/padron1926serieband.svg
    // /img/icons/padron1964anniversaryband.svg
    // /img/icons/padrondamasoband.svg
    switch (key) {
      case "1926":
        return { title: "1926", img: "/img/icons/padron1926serieband.svg" };
      case "1964":
        return { title: "1964", img: "/img/icons/padron1964anniversaryband.svg" };
      case "damaso":
        return { title: "Damaso", img: "/img/icons/padrondamasoband.svg" };
      case "family":
        return { title: "Family Reserve", img: "" };
      default:
        return { title: "Other", img: "" };
    }
  }

  function renderBandsOptions() {
    if (!el.bandsGrid) return;

    // Determine which band keys exist for this brand dataset
    const keys = uniq(state.all.map(bandKeyForRow)).filter((k) => k !== "other");

    // If nothing matched, just show lines as text checkboxes (fallback)
    if (!keys.length) {
      const lines = uniq(state.all.map((r) => txt(r["Line"])).filter(Boolean)).sort((a, b) =>
        a.localeCompare(b)
      );

      el.bandsGrid.innerHTML = lines
        .map((line) => {
          const checked = state.bands.has(line) ? "checked" : "";
          return `<label class="chip"><input type="checkbox" value="${line}" ${checked}>${line}</label>`;
        })
        .join("");
      return;
    }

    // Render as big centered "cards" with band art
    el.bandsGrid.innerHTML = keys
      .map((k) => {
        const info = bandDisplay(k);
        const checked = state.bands.has(k) ? "checked" : "";
        const imgHtml = info.img
          ? `<img class="band-art" src="${info.img}" alt="${info.title} band">`
          : `<div class="band-art band-art--empty"></div>`;

        return `
          <label class="band-card">
            <div class="band-card-inner">
              ${imgHtml}
              <div class="band-card-row">
                <div class="band-card-title">${info.title}</div>
                <input class="band-card-check" type="checkbox" value="${k}" ${checked} />
              </div>
            </div>
          </label>
        `;
      })
      .join("");

    // If your CSS doesn’t have these classes yet, this forces usable sizing/layout.
    // (Safe to inject; it only affects these new band classes.)
    ensureBandStyles();
  }

  let bandStylesInjected = false;
  function ensureBandStyles() {
    if (bandStylesInjected) return;
    bandStylesInjected = true;

    const css = `
      .band-card{ display:block; width:100%; margin:14px 0 0; }
      .band-card-inner{
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 22px;
        padding: 14px;
        box-shadow: 0 18px 40px rgba(0,0,0,.30);
      }
      .band-art{
        width: 100%;
        height: auto;
        border-radius: 16px;
        display:block;
        background: rgba(0,0,0,.12);
      }
      .band-card-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-top: 12px;
      }
      .band-card-title{
        font-weight: 900;
        font-size: 22px;
        letter-spacing: -.01em;
        color: rgba(255,255,255,.92);
      }
      .band-card-check{
        width: 26px;
        height: 26px;
        accent-color: #0f7aff;
      }
    `;

    const style = document.createElement("style");
    style.setAttribute("data-brandjs", "bands");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function applyBandsFromUI() {
    state.bands.clear();

    // supports both the old checkbox chips and the new band cards
    const checks = [
      ...$$("#bands-options input[type='checkbox']:checked"),
      ...$$(".band-card-check:checked"),
    ];

    checks.forEach((i) => state.bands.add(i.value));
  }

  /* ===============================
     FILTERS
     - Brand match: Brand OR Brand aka OR Manufacturer
     - Bands filter: checks Line OR Cigar (per your rule)
  =============================== */
  function rowMatchesBrand(row) {
    const b = norm(row["Brand"]);
    const ba = norm(row["Brand aka"]);
    const m = norm(row["Manufacturer"]);
    return b === state.brand || ba === state.brand || m === state.brand;
  }

  function rowMatchesBands(row) {
    if (!state.bands.size) return true;

    // If we’re using band-keys (1926/1964/damaso), match via bandKeyForRow()
    const key = bandKeyForRow(row);
    if (state.bands.has(key)) return true;

    // Fallback if someone selected a literal Line string in the old UI:
    const line = txt(row["Line"]);
    if (state.bands.has(line)) return true;

    // IMPORTANT: you told me source may be Line OR Cigar name, so check both
    const cigar = txt(row["Cigar"]);
    if (state.bands.has(cigar)) return true;

    return false;
  }

  function applyFilters() {
    const q = norm(state.search);

    state.view = state.all.filter((r) => {
      // wrapper toggle
      if (state.wrapper !== "all") {
        const wb = wrapperBucket(r);
        if (wb !== state.wrapper) return false;
      }

      // search
      if (q) {
        const hay = norm(
          `${r["Cigar"]} ${r["Line"]} ${r["Vitola"]} ${r["Wrapper Shade"]} ${r["Wrapper"]}`
        );
        if (!hay.includes(q)) return false;
      }

      // bands
      if (!rowMatchesBands(r)) return false;

      return true;
    });

    renderList();
  }

  /* ===============================
     LIST RENDER
  =============================== */
  function renderList() {
    if (!el.list) return;
    el.list.innerHTML = "";

    if (!state.view.length) {
      if (el.status) {
        el.status.hidden = false;
        el.status.textContent = "No cigars match.";
      }
      return;
    }
    if (el.status) el.status.hidden = true;

    const brandIconSrc = brandIconCandidates(state.brandRaw || state.brand)[0];

    state.view.forEach((row) => {
      const item = document.createElement("div");
      item.className = "brand-row";

      const cigarName = txt(row["Cigar"]) || "(Unnamed cigar)";
      const vitola = txt(row["Vitola"]) || "";
      const price = money(row["MSRP"]);

      // Left icon is expected by your “good” screenshot
      item.innerHTML = `
        <div class="row-icon" aria-hidden="true">
          <img class="row-icon-img" alt="" src="${brandIconSrc}">
        </div>

        <div class="row-main" role="button" tabindex="0" aria-label="${cigarName}">
          <div class="row-title">${cigarName}</div>
          <div class="row-sub">${vitola}</div>
        </div>

        <div class="row-price">${price}</div>
        <button class="row-add" type="button" aria-label="Add ${cigarName}">+</button>
      `;

      // If your CSS currently uses a 3-col grid, this prevents layout break:
      // (Icon + main stack; price + plus sit right)
      // Safe: only applies if your stylesheet doesn’t define these.
      ensureRowIconStyles();

      const main = item.querySelector(".row-main");
      const addBtn = item.querySelector(".row-add");

      safeOn(main, "click", () => addToReceipt(row));
      safeOn(main, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addToReceipt(row);
        }
      });

      safeOn(addBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        addToReceipt(row);
      });

      // icon fallback cycling
      const rowImg = item.querySelector(".row-icon-img");
      if (rowImg) {
        const candidates = brandIconCandidates(state.brandRaw || state.brand);
        let idx = 0;
        rowImg.onerror = () => {
          idx += 1;
          if (idx < candidates.length) rowImg.src = candidates[idx];
        };
      }

      el.list.appendChild(item);
    });
  }

  let rowIconStylesInjected = false;
  function ensureRowIconStyles() {
    if (rowIconStylesInjected) return;
    rowIconStylesInjected = true;

    const css = `
      /* Ensure the left brand icon works even if the grid was previously 3 columns */
      .brand-row{
        grid-template-columns: 58px 1fr auto auto !important;
      }
      .row-icon{
        width: 54px;
        height: 54px;
        border-radius: 16px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.10);
        overflow: hidden;
        display:grid;
        place-items:center;
      }
      .row-icon-img{
        width: 100%;
        height: 100%;
        object-fit: cover;
        display:block;
      }
    `;

    const style = document.createElement("style");
    style.setAttribute("data-brandjs", "rowicon");
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===============================
     TOGGLE UI STATE (Maduro / Natural / All)
  =============================== */
  function syncToggleUI() {
    if (el.segMaduro)
      el.segMaduro.setAttribute(
        "aria-pressed",
        state.wrapper === "maduro" ? "true" : "false"
      );
    if (el.segNatural)
      el.segNatural.setAttribute(
        "aria-pressed",
        state.wrapper === "natural" ? "true" : "false"
      );

    if (el.segWrap) el.segWrap.setAttribute("data-state", state.wrapper);
  }

  function setWrapper(next) {
    state.wrapper = next;
    syncToggleUI();
    applyFilters();
  }

  /* ===============================
     INIT + EVENTS
  =============================== */
  function setStatus(msg) {
    if (!el.status) return;
    el.status.hidden = false;
    el.status.textContent = msg;
  }

  function wireEvents() {
    safeOn(el.back, "click", () => history.back());

    // search
    safeOn(el.search, "input", (e) => {
      state.search = norm(e.target.value);
      applyFilters();
    });

    // toggle words
    safeOn(el.segMaduro, "click", (e) => {
      e.preventDefault();
      setWrapper("maduro");
    });
    safeOn(el.segNatural, "click", (e) => {
      e.preventDefault();
      setWrapper("natural");
    });

    // toggle switch (if currently all, first click -> maduro)
    safeOn(el.segSwitch, "click", (e) => {
      e.preventDefault();
      if (state.wrapper === "all") return setWrapper("maduro");
      setWrapper(state.wrapper === "maduro" ? "natural" : "maduro");
    });

    // open sheets
    safeOn(el.btnBands, "click", (e) => {
      e.preventDefault();
      openSheet(el.sheetBands);
    });
    safeOn(el.btnFilters, "click", (e) => {
      e.preventDefault();
      openSheet(el.sheetFilters);
    });

    // receipt open
    safeOn(el.receiptFab, "click", (e) => {
      e.preventDefault();
      openSheet(el.sheetReceipt);
    });

    // backdrop closes ANY open sheet
    safeOn(el.sheetBackdrop, "click", (e) => {
      e.preventDefault();
      closeAllSheets();
    });

    // wire closers inside each sheet (X, Close, Confirm, etc.)
    wireSheetClosers(el.sheetBands);
    wireSheetClosers(el.sheetFilters);
    wireSheetClosers(el.sheetReceipt);

    // Bands confirm/clear (explicit buttons)
    safeOn(el.bandsConfirm, "click", (e) => {
      e.preventDefault();
      applyBandsFromUI();
      closeAllSheets();
      applyFilters();
    });

    safeOn(el.bandsClear, "click", (e) => {
      e.preventDefault();
      state.bands.clear();
      // uncheck UI too
      [
        ...$$("#bands-options input[type='checkbox']"),
        ...$$(".band-card-check"),
      ].forEach((i) => (i.checked = false));
      closeAllSheets();
      applyFilters();
    });

    // receipt clear
    safeOn(el.receiptClear, "click", (e) => {
      e.preventDefault();
      state.receipt = [];
      updateReceiptUI();
    });

    // ESC closes sheets
    safeOn(document, "keydown", (e) => {
      if (e.key === "Escape") closeAllSheets();
    });
  }

  function init() {
    loadReceipt();
    updateReceiptUI();

    setBrandHeader();
    wireEvents();

    if (!state.brand) {
      setStatus("Missing ?brand= in URL.");
      return;
    }

    setStatus("Loading…");

    fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" })
      .then((r) => r.text())
      .then(csvToObjects)
      .then((rows) => {
        // Brand match must be flexible (Brand OR Brand aka OR Manufacturer)
        state.all = rows.filter(rowMatchesBrand);

        if (!state.all.length) {
          setStatus(`No rows found for "${state.brandRaw}".`);
          renderBandsOptions(); // still render (empty)
          renderList(); // empty
          return;
        }

        // Build bands list + default wrapper
        renderBandsOptions();
        state.wrapper = "all";
        syncToggleUI();

        if (el.status) el.status.hidden = true;
        applyFilters();
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to load cigars.");
      });
  }

  init();
})();
