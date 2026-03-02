/* /pos/cigars/brand.js
   FULL REPLACEMENT FILE (v13)

   Fixes (per your screenshots):
   ✅ No "background boxes" behind brand SVG/PNG logos (CSS handles visuals)
   ✅ Restore iOS-style Filters modal (same UX as /pos/cigars/, minus brand/manufacturer)
   ✅ Big Bands UI: full-width band art + left title + right checkbox
   ✅ Light mode uses black text and iOS paper background
   ✅ Green add button is the correct size and WORKS (hooks into /pos/cart.js)
   ✅ Clicking the cigar row/name navigates to cigar detail page (not image popup)
   ✅ Maduro/Natural toggle works
   ✅ Theme toggle uses the horizontal pill (via /css/theme-toggle.css)
*/

(() => {
  "use strict";

  const CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const uniq = (arr) => Array.from(new Set(arr));

  const fmtMoney = (v) => {
    const n = Number(v);
    if(!Number.isFinite(n)) return "";
    return n.toFixed(2);
  };

  const includesCI = (hay, needle) =>
    String(hay || "").toLowerCase().includes(String(needle || "").toLowerCase());

  function getParam(name){
    try{ return new URL(window.location.href).searchParams.get(name) || ""; }
    catch { return ""; }
  }

  // ---------- CSV parsing (simple, robust enough for Google CSV) ------------
  function parseCSV(text){
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for(let i=0;i<text.length;i++){
      const ch = text[i];
      const next = text[i+1];
      if(inQuotes){
        if(ch === '"' && next === '"'){
          field += '"';
          i++;
        } else if(ch === '"'){
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if(ch === '"') inQuotes = true;
        else if(ch === ','){
          cur.push(field);
          field = "";
        } else if(ch === '\n'){
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if(ch !== '\r'){
          field += ch;
        }
      }
    }
    cur.push(field);
    rows.push(cur);
    return rows;
  }

  function normalizeHeader(h){
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "_");
  }

  function mapRows(csv){
    const header = csv[0] || [];
    const keys = header.map(normalizeHeader);
    const out = [];
    for(let i=1;i<csv.length;i++){
      const r = csv[i];
      if(!r || r.every(c => !String(c||"").trim())) continue;
      const obj = {};
      keys.forEach((k, idx) => { obj[k] = (r[idx] ?? "").trim(); });
      out.push(obj);
    }
    return out;
  }

  // ---------- UI elements ---------------------------------------------------
  const backBtn = $("#back-btn");
  const invoiceBtn = $("#invoice-btn");
  const invoiceBadge = $("#invoice-badge");
  const themeDock = $("#theme-dock");

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

  const state = {
    brand: "",
    rowsAll: [],

    // UI state
    search: "",
    wrapperMode: "maduro", // "maduro" | "natural"
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

  // ---------- Navigation + invoice -----------------------------------------
  backBtn?.addEventListener("click", () => {
    // Go back if possible; else go to POS cigars home
    if(window.history.length > 1) window.history.back();
    else window.location.href = "/pos/cigars/";
  });

  invoiceBtn?.addEventListener("click", () => {
    window.location.href = "/pos/invoice/";
  });

  // Cart badge updates are handled by /pos/cart.js.
  // BUT: brand page still needs an element for the badge, so leave it alone here.
  void invoiceBadge;

  // ---------- Bands sheet helpers ------------------------------------------
  function openSheet(el){
    if(!el) return;
    el.hidden = false;
    document.documentElement.classList.add("sheet-open");
  }
  function closeSheet(el){
    if(!el) return;
    el.hidden = true;
    document.documentElement.classList.remove("sheet-open");
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if(t && t.matches && t.matches("[data-sheet-close]")) closeSheet(sheetBands);
    if(t === sheetBands) closeSheet(sheetBands);
  });

  // ---------- Filter modal (iOS-style) -------------------------------------
  let filterModal = null;

  function ensureFilterModal(){
    if(filterModal) return filterModal;

    const modal = document.createElement("div");
    modal.className = "fm";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="fm__backdrop" data-fm-close></div>
      <div class="fm__card" role="document">
        <div class="fm__head">
          <div class="fm__title">Filters</div>
          <button class="fm__close" type="button" data-fm-close aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="fm__body">
          <div class="fm__left" role="tablist" aria-label="Filter categories"></div>
          <div class="fm__right">
            <div class="fm__search">
              <span class="fm__searchIco" aria-hidden="true">🔎</span>
              <input class="fm__searchInput" type="search" placeholder="Search" autocomplete="off" />
            </div>
            <div class="fm__list" role="list"></div>
          </div>
        </div>
        <div class="fm__foot">
          <button class="fm__btn fm__btn--ghost" type="button" data-fm-clear>Clear</button>
          <button class="fm__btn fm__btn--primary" type="button" data-fm-apply>Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const left = $(".fm__left", modal);
    const list = $(".fm__list", modal);
    const input = $(".fm__searchInput", modal);

    const cats = [
      { key: "vitola", label: "Vitolas" },
      { key: "ring", label: "Ring" },
      { key: "length", label: "Length" },
      { key: "strength", label: "Strength" },
      { key: "shape", label: "Shape" },
      { key: "shade", label: "Wrap. Shade" },
    ];

    let activeKey = cats[0].key;
    let dataByKey = {};

    const renderLeft = () => {
      left.innerHTML = "";
      cats.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "fm__cat";
        b.dataset.key = c.key;
        b.textContent = c.label;
        b.addEventListener("click", () => setActive(c.key));
        left.appendChild(b);
      });
    };

    const setActive = (key) => {
      activeKey = key;
      $$(".fm__cat", left).forEach((b) => {
        const on = b.dataset.key === key;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      input.value = "";
      renderList();
    };

    const renderList = () => {
      const q = String(input.value || "").trim().toLowerCase();
      const values = (dataByKey[activeKey] || []).filter(v => !q || v.toLowerCase().includes(q));
      list.innerHTML = "";
      values.forEach((value) => {
        const row = document.createElement("label");
        row.className = "fm__row";
        row.innerHTML = `
          <input type="checkbox" class="fm__check" />
          <span class="fm__val"></span>
        `;
        row.querySelector(".fm__val").textContent = value;
        const cb = row.querySelector("input");
        cb.checked = state.filters[activeKey].has(value);
        cb.addEventListener("change", () => {
          if(cb.checked) state.filters[activeKey].add(value);
          else state.filters[activeKey].delete(value);
        });
        list.appendChild(row);
      });
    };

    const open = (data) => {
      dataByKey = data || {};
      renderLeft();
      setActive(activeKey);
      modal.hidden = false;
      document.documentElement.classList.add("fm-open");
      requestAnimationFrame(() => input.focus());
    };

    const close = () => {
      modal.hidden = true;
      document.documentElement.classList.remove("fm-open");
    };

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if(t && t.closest && t.closest("[data-fm-close]")) close();
    });

    input.addEventListener("input", renderList);

    $("[data-fm-clear]", modal).addEventListener("click", () => {
      Object.values(state.filters).forEach(set => set.clear());
      renderList();
    });

    $("[data-fm-apply]", modal).addEventListener("click", () => {
      close();
      applyAll();
    });

    filterModal = { open, close };
    return filterModal;
  }

  function buildFilterData(rows){
    const norm = (v) => String(v || "").trim();
    const uniqSorted = (vals, numeric=false) => {
      const u = uniq(vals.map(norm).filter(Boolean));
      return u.sort((a,b)=> numeric ? (parseFloat(a)-parseFloat(b)) : a.localeCompare(b));
    };
    return {
      vitola: uniqSorted(rows.map(r => r.vitola || r.style || r.vitola_name), false),
      ring: uniqSorted(rows.map(r => r.ring), true),
      length: uniqSorted(rows.map(r => r.length), true),
      strength: uniqSorted(rows.map(r => r.strength), false),
      shape: uniqSorted(rows.map(r => r.shape), false),
      shade: uniqSorted(rows.map(r => r.wrapper_shade || r.wrapperShade || r.wrapper), false),
    };
  }

  // ---------- Apply filters -------------------------------------------------
  function applyWrapperMode(rows){
    const mode = state.wrapperMode;
    return rows.filter(r => {
      const shade = r.wrapper_shade || r.wrapperShade || r.wrapper || "";
      if(mode === "maduro") return includesCI(shade, "maduro");
      if(mode === "natural") return includesCI(shade, "natural");
      return true;
    });
  }

  function applySearch(rows){
    const q = String(state.search || "").trim().toLowerCase();
    if(!q) return rows;
    return rows.filter(r => {
      const name = r.cigar || r.name || r.title || "";
      const vit = r.vitola || r.style || "";
      return String(name).toLowerCase().includes(q) || String(vit).toLowerCase().includes(q);
    });
  }

  function applyBandSelected(rows){
    if(!state.bandSelected.size) return rows;
    return rows.filter(r => {
      const key = String(r.band_key || r.band || r.band_group || "").trim();
      return key && state.bandSelected.has(key);
    });
  }

  function applyFilterSets(rows){
    const f = state.filters;
    const v = (x) => String(x || "").trim();
    return rows.filter(r => {
      const vitola = v(r.vitola || r.style || r.vitola_name);
      const ring = v(r.ring);
      const length = v(r.length);
      const strength = v(r.strength);
      const shape = v(r.shape);
      const shade = v(r.wrapper_shade || r.wrapperShade || r.wrapper);
      if(f.vitola.size && !f.vitola.has(vitola)) return false;
      if(f.ring.size && !f.ring.has(ring)) return false;
      if(f.length.size && !f.length.has(length)) return false;
      if(f.strength.size && !f.strength.has(strength)) return false;
      if(f.shape.size && !f.shape.has(shape)) return false;
      if(f.shade.size && !f.shade.has(shade)) return false;
      return true;
    });
  }

  function applyAll(){
    let rows = [...state.rowsAll];
    rows = applyWrapperMode(rows);
    rows = applyFilterSets(rows);
    rows = applyBandSelected(rows);
    rows = applySearch(rows);
    renderList(rows);
  }

  // ---------- Render list ---------------------------------------------------
  function resolveRowIcon(r){
    // prefer explicit icon fields
    const candidates = [
      r.brand_icon,
      r.brandIcon,
      r.icon,
      r.logo,
    ].filter(Boolean);
    if(candidates.length) return candidates[0];

    // fallback to brand icon from the page
    return brandIconImg?.getAttribute("src") || "";
  }

  function resolveId(r){
    return String(r.id || r.slug || r.cigar_id || r.row_id || "").trim();
  }

  function resolveName(r){
    return String(r.cigar || r.name || r.title || "").trim();
  }

  function resolveVitola(r){
    return String(r.vitola || r.style || r.vitola_name || "").trim();
  }

  function resolvePrice(r){
    const p = r.msrp || r.price || r.cost || "";
    const n = Number(p);
    if(Number.isFinite(n)) return fmtMoney(n);
    return "";
  }

  function resolveBand(r){
    return String(r.band || r.band_key || r.band_group || "").trim();
  }

  function resolveBandArt(r){
    return String(r.band_art || r.bandArt || r.band_image || r.band_img || "").trim();
  }

  function renderList(rows){
    listEl.innerHTML = "";
    if(!rows.length){
      listEl.innerHTML = `<div class="empty">No results</div>`;
      return;
    }

    rows.forEach((r) => {
      const id = resolveId(r);
      const name = resolveName(r);
      const vitola = resolveVitola(r);
      const icon = resolveRowIcon(r);
      const price = resolvePrice(r);

      const cartItem = {
        id: id || name,
        name,
        price: Number(r.msrp || r.price || 0) || 0,
        img: r.img || r.photo || r.image || "",
        brand: state.brand,
      };

      const card = document.createElement("article");
      card.className = "brand-row";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.innerHTML = `
        <img class="row-ico" src="${esc(icon)}" alt="" loading="lazy" />
        <div class="row-main">
          <div class="row-title">${esc(name)}</div>
          <div class="row-sub">${esc(vitola)}</div>
        </div>
        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(price)}</div>
          <button class="pos-add" type="button" aria-label="Add"
            data-add-cart
            data-cart-item='${esc(JSON.stringify(cartItem))}'>
            <span aria-hidden="true">+</span>
          </button>
        </div>
      `;

      const goDetail = () => {
        if(!id) return;
        window.location.href = `/pos/cigars/cigar.html?id=${encodeURIComponent(id)}`;
      };

      card.addEventListener("click", goDetail);
      card.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          goDetail();
        }
      });

      listEl.appendChild(card);
    });
  }

  // ---------- Bands options -------------------------------------------------
  function getBandOptions(rows){
    const map = new Map();
    rows.forEach((r) => {
      const key = resolveBand(r);
      const art = resolveBandArt(r);
      if(!key || !art) return;
      if(!map.has(key)) map.set(key, { key, label: key, src: art });
    });
    return Array.from(map.values());
  }

  function renderBandOptions(opts){
    bandsOptions.innerHTML = "";
    if(!opts.length){
      bandsOptions.innerHTML = `<div class="filters-note">No bands available for this brand.</div>`;
      return;
    }

    opts.forEach((b) => {
      const card = document.createElement("div");
      card.className = "band-card";
      const checked = state.bandSelected.has(b.key);
      card.innerHTML = `
        <img class="band-art" src="${esc(b.src)}" alt="" loading="lazy" />
        <div class="band-meta">
          <div class="band-name">${esc(b.label)}</div>
          <input class="band-check" type="checkbox" ${checked ? "checked" : ""} aria-label="${esc(b.label)}" />
        </div>
      `;
      const cb = $("input", card);
      cb.addEventListener("change", () => {
        if(cb.checked) state.bandSelected.add(b.key);
        else state.bandSelected.delete(b.key);
      });
      bandsOptions.appendChild(card);
    });
  }

  // ---------- Controls wiring ----------------------------------------------
  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  btnBands?.addEventListener("click", () => {
    const opts = getBandOptions(state.rowsAll);
    renderBandOptions(opts);
    openSheet(sheetBands);
  });

  bandsConfirm?.addEventListener("click", () => {
    closeSheet(sheetBands);
    applyAll();
  });

  btnFilters?.addEventListener("click", () => {
    // Filters are built from the *current wrapper mode* dataset
    const base = applyWrapperMode([...state.rowsAll]);
    const data = buildFilterData(base);
    ensureFilterModal().open(data);
  });

  function setWrapperMode(mode){
    state.wrapperMode = mode;
    seg?.setAttribute("data-state", mode);
    segBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.state === mode));
    applyAll();
  }

  segSwitch?.addEventListener("click", () => {
    setWrapperMode(state.wrapperMode === "maduro" ? "natural" : "maduro");
  });

  segBtns.forEach((b) => {
    b.addEventListener("click", () => setWrapperMode(b.dataset.state || "maduro"));
  });

  // ---------- Boot ----------------------------------------------------------
  async function boot(){
    // ensure theme toggle is visible and horizontal
    themeDock?.classList.add("ready");

    // brand can be passed as brand=Padron or b=padron
    const brand = (getParam("brand") || getParam("b") || "").trim();
    state.brand = brand;
    brandTitle.textContent = brand || "Brand";

    // brand icon, if passed
    const icon = (getParam("icon") || "").trim();
    if(icon) brandIconImg.src = icon;

    // load data
    const res = await fetch(CSV_URL, { cache: "no-store" });
    const txt = await res.text();
    const csv = parseCSV(txt);
    const rows = mapRows(csv);

    // Determine brand column
    const brandKeys = ["brand", "brand_name", "manufacturer_brand", "cigar_brand"].filter(Boolean);
    const getBrandVal = (r) => {
      for(const k of brandKeys){
        if(r[k]) return r[k];
      }
      return "";
    };

    const brandLower = brand.toLowerCase();
    const filtered = rows.filter(r => getBrandVal(r).toLowerCase() === brandLower);

    // If brand wasn't passed, try infer from the first row (still render)
    if(!brand && filtered.length){
      state.brand = getBrandVal(filtered[0]);
      brandTitle.textContent = state.brand;
    }

    // decorate rows with the band key used for the bands filter
    state.rowsAll = filtered.map((r) => {
      const bandKey = resolveBand(r);
      return {
        ...r,
        band_key: bandKey,
        wrapper_shade: r.wrapper_shade || r.wrapperShade || r.wrapper || "",
      };
    });

    // default wrapper mode
    setWrapperMode(state.wrapperMode);

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if(listEl) listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
  });
})();
