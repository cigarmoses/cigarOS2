/* /pos/cigars/brand.js
   FULL REPLACEMENT FILE (v14)
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
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  };

  const includesCI = (hay, needle) =>
    String(hay || "").toLowerCase().includes(String(needle || "").toLowerCase());

  function getParam(name){
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function parseCSV(text){
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
    search: "",
    wrapperMode: "maduro",
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

  function getStoredTheme(){
    const attrTheme = document.documentElement.getAttribute("data-theme");
    const stored = localStorage.getItem("theme") || localStorage.getItem("appearance");
    if (stored === "light" || stored === "dark") return stored;
    return attrTheme === "light" ? "light" : "dark";
  }

  function applyTheme(theme){
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    localStorage.setItem("appearance", next);

    const toggle = $("#theme-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(next === "dark"));
      toggle.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function ensureMoonToggle(){
    if (!themeDock) return;

    themeDock.innerHTML = `
      <button id="theme-toggle" class="theme-toggle moon-toggle" type="button" aria-label="Toggle theme">
        <span class="moon-track" aria-hidden="true"></span>
        <span class="moon-knob" aria-hidden="true">
          <svg class="moon-icon" viewBox="0 0 24 24" width="14" height="14">
            <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"></path>
          </svg>
        </span>
      </button>
    `;

    const toggle = $("#theme-toggle");
    toggle?.addEventListener("click", () => {
      const current = getStoredTheme();
      applyTheme(current === "dark" ? "light" : "dark");
    });

    applyTheme(getStoredTheme());
  }

  backBtn?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/pos/cigars/";
  });

  invoiceBtn?.addEventListener("click", () => {
    window.location.href = "/pos/invoice/";
  });

  void invoiceBadge;

  function openSheet(el){
    if (!el) return;
    el.hidden = false;
    document.documentElement.classList.add("sheet-open");
  }

  function closeSheet(el){
    if (!el) return;
    el.hidden = true;
    document.documentElement.classList.remove("sheet-open");
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches("[data-sheet-close]")) closeSheet(sheetBands);
    if (t === sheetBands) closeSheet(sheetBands);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSheet(sheetBands);
      if (filterModal?.isOpen?.()) filterModal.close();
    }
  });

  let filterModal = null;

  function ensureFilterModal(){
    if (filterModal) return filterModal;

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
    const search = $(".fm__searchInput", modal);

    const cats = [
      ["vitola", "Vitola"],
      ["ring", "Ring"],
      ["length", "Length"],
      ["strength", "Strength"],
      ["shape", "Shape"],
      ["shade", "Shade"],
    ];

    let currentKey = "vitola";
    let dataMap = {};
    let localSearch = "";

    function selectedSetFor(key){
      return state.filters[key];
    }

    function renderTabs(){
      left.innerHTML = "";
      cats.forEach(([key, label]) => {
        const b = document.createElement("button");
        b.className = `fm__tab${currentKey === key ? " is-on" : ""}`;
        b.type = "button";
        b.textContent = label;
        b.addEventListener("click", () => {
          currentKey = key;
          renderTabs();
          renderList();
        });
        left.appendChild(b);
      });
    }

    function renderList(){
      const items = Array.isArray(dataMap[currentKey]) ? dataMap[currentKey] : [];
      const q = localSearch.trim().toLowerCase();
      const filtered = q ? items.filter((x) => String(x).toLowerCase().includes(q)) : items;
      const set = selectedSetFor(currentKey);

      list.innerHTML = "";
      if (!filtered.length) {
        list.innerHTML = `<div class="filters-note">No options found.</div>`;
        return;
      }

      filtered.forEach((val) => {
        const row = document.createElement("label");
        row.className = "fm__item";
        row.innerHTML = `
          <span>${esc(val)}</span>
          <input class="fm__itemCheck" type="checkbox" ${set.has(val) ? "checked" : ""} />
        `;
        const cb = $("input", row);
        cb.addEventListener("change", () => {
          if (cb.checked) set.add(val);
          else set.delete(val);
        });
        list.appendChild(row);
      });
    }

    function open(data){
      dataMap = data || {};
      currentKey = "vitola";
      localSearch = "";
      search.value = "";
      renderTabs();
      renderList();
      modal.hidden = false;
      document.documentElement.classList.add("sheet-open");
    }

    function close(){
      modal.hidden = true;
      document.documentElement.classList.remove("sheet-open");
    }

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches("[data-fm-close]")) close();
      if (t && t.matches && t.matches("[data-fm-clear]")) {
        Object.values(state.filters).forEach((set) => set.clear());
        renderList();
      }
      if (t && t.matches && t.matches("[data-fm-apply]")) {
        close();
        applyAll();
      }
    });

    search.addEventListener("input", () => {
      localSearch = search.value || "";
      renderList();
    });

    filterModal = {
      open,
      close,
      isOpen: () => !modal.hidden,
    };

    return filterModal;
  }

  function buildFilterData(rows){
    const norm = (v) => String(v || "").trim();
    const uniqSorted = (vals, numeric = false) => {
      const u = uniq(vals.map(norm).filter(Boolean));
      return u.sort((a, b) => numeric ? (parseFloat(a) - parseFloat(b)) : a.localeCompare(b));
    };

    return {
      vitola: uniqSorted(rows.map((r) => r.vitola || r.style || r.vitola_name), false),
      ring: uniqSorted(rows.map((r) => r.ring), true),
      length: uniqSorted(rows.map((r) => r.length), true),
      strength: uniqSorted(rows.map((r) => r.strength), false),
      shape: uniqSorted(rows.map((r) => r.shape), false),
      shade: uniqSorted(rows.map((r) => r.wrapper_shade || r.wrapperShade || r.wrapper), false),
    };
  }

  function applyWrapperMode(rows){
    const mode = state.wrapperMode;
    return rows.filter((r) => {
      const shade = r.wrapper_shade || r.wrapperShade || r.wrapper || "";
      if (mode === "maduro") return includesCI(shade, "maduro");
      if (mode === "natural") return includesCI(shade, "natural");
      return true;
    });
  }

  function applySearch(rows){
    const q = String(state.search || "").trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = r.cigar || r.name || r.title || "";
      const vit = r.vitola || r.style || "";
      return String(name).toLowerCase().includes(q) || String(vit).toLowerCase().includes(q);
    });
  }

  function applyBandSelected(rows){
    if (!state.bandSelected.size) return rows;

    return rows.filter((r) => {
      const key = String(r.band_key || "").trim();
      return key && state.bandSelected.has(key);
    });
  }

  function applyFilterSets(rows){
    const f = state.filters;
    const v = (x) => String(x || "").trim();

    return rows.filter((r) => {
      const vitola = v(r.vitola || r.style || r.vitola_name);
      const ring = v(r.ring);
      const length = v(r.length);
      const strength = v(r.strength);
      const shape = v(r.shape);
      const shade = v(r.wrapper_shade || r.wrapperShade || r.wrapper);

      if (f.vitola.size && !f.vitola.has(vitola)) return false;
      if (f.ring.size && !f.ring.has(ring)) return false;
      if (f.length.size && !f.length.has(length)) return false;
      if (f.strength.size && !f.strength.has(strength)) return false;
      if (f.shape.size && !f.shape.has(shape)) return false;
      if (f.shade.size && !f.shade.has(shade)) return false;

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

  function resolveRowIcon(r){
    const candidates = [
      r.brand_icon,
      r.brandIcon,
      r.icon,
      r.logo,
      brandIconImg?.getAttribute("src") || "",
    ].filter(Boolean);

    return candidates[0] || "";
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
    if (Number.isFinite(n)) return fmtMoney(n);
    return "";
  }

  function resolveBandLabel(r){
    return String(r.band || r.band_group || r.band_key || "").trim();
  }

  function resolveBandArt(r){
    return String(r.band_art || r.bandArt || r.band_image || r.band_img || "").trim();
  }

  function renderList(rows){
    listEl.innerHTML = "";

    if (!rows.length) {
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

      const rowIcon = $(".row-ico", card);
      if (rowIcon) {
        rowIcon.addEventListener("error", () => {
          rowIcon.style.visibility = "hidden";
        });
      }

      const goDetail = () => {
        if (!id) return;
        window.location.href = `/pos/cigars/cigar.html?id=${encodeURIComponent(id)}`;
      };

      const addBtn = $(".pos-add", card);
      addBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      card.addEventListener("click", (e) => {
        if (e.target.closest(".pos-add")) return;
        goDetail();
      });

      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.target.closest(".pos-add")) {
          e.preventDefault();
          goDetail();
        }
      });

      listEl.appendChild(card);
    });
  }

  function getBandOptions(rows){
    const map = new Map();

    rows.forEach((r) => {
      const label = resolveBandLabel(r);
      const art = resolveBandArt(r);
      const key = `${label}__${art}`.trim();

      if (!label || !art) return;
      if (!map.has(key)) {
        map.set(key, { key, label, src: art });
      }
    });

    return Array.from(map.values());
  }

  function renderBandOptions(opts){
    bandsOptions.innerHTML = "";

    if (!opts.length) {
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
        if (cb.checked) state.bandSelected.add(b.key);
        else state.bandSelected.delete(b.key);
      });

      const img = $(".band-art", card);
      img?.addEventListener("error", () => {
        card.remove();
        if (!bandsOptions.children.length) {
          bandsOptions.innerHTML = `<div class="filters-note">No bands available for this brand.</div>`;
        }
      });

      bandsOptions.appendChild(card);
    });
  }

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

  async function boot(){
    ensureMoonToggle();

    const brand = (getParam("brand") || getParam("b") || "").trim();
    state.brand = brand;
    brandTitle.textContent = brand || "Brand";

    const icon = (getParam("icon") || "").trim();
    if (icon) brandIconImg.src = icon;

    const res = await fetch(CSV_URL, { cache: "no-store" });
    const txt = await res.text();
    const csv = parseCSV(txt);
    const rows = mapRows(csv);

    const brandKeys = ["brand", "brand_name", "manufacturer_brand", "cigar_brand"];
    const getBrandVal = (r) => {
      for (const k of brandKeys) {
        if (r[k]) return r[k];
      }
      return "";
    };

    const brandLower = brand.toLowerCase();
    const filtered = rows.filter((r) => getBrandVal(r).toLowerCase() === brandLower);

    if (!brand && filtered.length) {
      state.brand = getBrandVal(filtered[0]);
      brandTitle.textContent = state.brand;
    }

    state.rowsAll = filtered.map((r) => {
      const label = resolveBandLabel(r);
      const art = resolveBandArt(r);
      return {
        ...r,
        band_key: label && art ? `${label}__${art}` : "",
        wrapper_shade: r.wrapper_shade || r.wrapperShade || r.wrapper || "",
      };
    });

    setWrapperMode(state.wrapperMode);
    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if (listEl) listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
  });
})();
