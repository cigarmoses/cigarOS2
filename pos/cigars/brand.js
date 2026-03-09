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
  const detailSheet = $("#sheet-detail");
  const themeToggle = $("#theme-toggle");
  const backBtn = $("#back-btn");

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

  function getParam(name){
    try { return new URL(window.location.href).searchParams.get(name) || ""; }
    catch { return ""; }
  }

  function normalizeBrand(v){
    return String(v || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(v){
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "";
  }

  function parseCSV(text){
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for(let i = 0; i < text.length; i++){
      const ch = text[i];
      const next = text[i + 1];

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
        if(ch === '"'){
          inQuotes = true;
        } else if(ch === ","){
          cur.push(field);
          field = "";
        } else if(ch === "\n"){
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if(ch !== "\r"){
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

    for(let i = 1; i < csv.length; i++){
      const r = csv[i];
      if(!r || r.every((c) => !String(c || "").trim())) continue;
      const obj = {};
      keys.forEach((k, idx) => { obj[k] = (r[idx] ?? "").trim(); });
      out.push(obj);
    }

    return out;
  }

  function getField(r, keys){
    for(const k of keys){
      if(r[k]) return String(r[k]).trim();
    }
    return "";
  }

  function resolveBrandVal(r){
    return getField(r, ["brand", "brand_name", "manufacturer_brand", "cigar_brand", "manufacturer"]);
  }

  function resolveId(r){
    return getField(r, ["id", "slug", "cigar_id", "row_id"]) || resolveName(r);
  }

  function resolveName(r){
    return getField(r, ["cigar", "name", "title"]);
  }

  function resolveVitola(r){
    return getField(r, ["vitola", "style", "vitola_name"]);
  }

  function resolvePrice(r){
    return fmtMoney(getField(r, ["msrp", "price", "cost"]));
  }

  function resolveRing(r){
    return getField(r, ["ring", "ring_gauge", "rg"]);
  }

  function resolveLength(r){
    return getField(r, ["length"]);
  }

  function resolveShape(r){
    return getField(r, ["shape"]);
  }

  function resolveWrapper(r){
    return getField(r, ["wrapper"]);
  }

  function resolveBinder(r){
    return getField(r, ["binder"]);
  }

  function resolveFiller(r){
    return getField(r, ["filler"]);
  }

  function resolveOrigin(r){
    return getField(r, ["origin", "country_of_origin", "country"]);
  }

  function resolveStrength(r){
    return getField(r, ["strength"]);
  }

  function resolveShade(r){
    return getField(r, ["wrapper_shade", "wrapper_shade_type", "shade", "wrapper"]);
  }

  function resolveImage(r){
    return getField(r, ["image", "img", "photo", "cigar_image"]);
  }

function resolveBand(r){
  return getField(r, ["band", "band_key", "band_group", "band_name"]);
}

function resolveBandArt(r){
  const direct = getField(r, [
    "band_art",
    "band_image",
    "band_img",
    "band_art_url",
    "band_url"
  ]);
  if (direct) return direct;

  if (normalizeBrand(state.brand) !== "padron") return "";

  const name = (resolveName(r) + " " + resolveVitola(r) + " " + resolveShade(r)).toLowerCase();

  if (name.includes("1926")) return "/img/icons/padron1926serieband.svg";
  if (name.includes("1964") || name.includes("anniversary")) return "/img/icons/padron1964anniversaryband.svg";
  if (name.includes("black")) return "/img/icons/padronblackseriesband.svg";
  if (name.includes("damaso")) return "/img/icons/padrondamasoband.svg";
  if (name.includes("family reserve")) return "/img/icons/padronfamilyreserveband.svg";

  return "/img/icons/padronseriesband.svg";
}

  function brandIconPath(){
    return `/img/icons/brands/${normalizeBrand(state.brand)}.svg`;
  }

  function setBrandHeader(){
    brandTitle.textContent = state.brand || "Brand";
    brandIconImg.src = brandIconPath();
    brandIconImg.onerror = () => { brandIconImg.style.visibility = "hidden"; };
  }

  function getSavedTheme(){
    return localStorage.getItem("theme") || document.documentElement.getAttribute("data-theme") || "dark";
  }

  function applyTheme(theme){
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle?.setAttribute("aria-pressed", String(next === "dark"));
  }

  function openBandsSheet(){
    sheetBands.hidden = false;
    document.documentElement.classList.add("sheet-open");
  }

  function closeBandsSheet(){
    sheetBands.hidden = true;
    document.documentElement.classList.remove("sheet-open");
  }

  function openDetail(r){
    $("#detail-brand").textContent = state.brand;
    $("#detail-name").textContent = resolveName(r);
    $("#detail-vitola").textContent = `${resolveVitola(r)}${resolvePrice(r) ? ` • ${resolvePrice(r)}` : ""}`;
    $("#detail-image").src = resolveImage(r) || brandIconPath();
    $("#detail-ring").textContent = resolveRing(r) || "—";
    $("#detail-length").textContent = resolveLength(r) || "—";
    $("#detail-shape").textContent = resolveShape(r) || "—";
    $("#detail-vitola-box").textContent = resolveVitola(r) || "—";
    $("#detail-wrapper").textContent = resolveWrapper(r) || "—";
    $("#detail-binder").textContent = resolveBinder(r) || "—";
    $("#detail-filler").textContent = resolveFiller(r) || "—";
    $("#detail-origin").textContent = resolveOrigin(r) || "—";
    $("#detail-strength").textContent = resolveStrength(r) || "—";
    $("#detail-shade").textContent = resolveShade(r) || "—";
    detailSheet.hidden = false;
  }

  function closeDetail(){
    detailSheet.hidden = true;
  }

  let filterModal = null;

  function ensureFilterModal(){
    if(filterModal) return filterModal;

    const modal = document.createElement("div");
    modal.className = "fm";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fm__backdrop" data-fm-close></div>
      <div class="fm__card" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="fm__head">
          <div class="fm__title">Filters</div>
          <button class="fm__close" type="button" data-fm-close aria-label="Close">×</button>
        </div>
        <div class="fm__body">
          <div class="fm__left"></div>
          <div class="fm__right">
            <div class="fm__search">
              <span aria-hidden="true">🔎</span>
              <input class="fm__searchInput" type="search" placeholder="Search" />
            </div>
            <div class="fm__list"></div>
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

    let activeKey = "vitola";
    let dataByKey = {};

    const renderLeft = () => {
      left.innerHTML = "";
      cats.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `fm__cat${activeKey === c.key ? " is-on" : ""}`;
        b.textContent = c.label;
        b.addEventListener("click", () => {
          activeKey = c.key;
          renderLeft();
          renderList();
        });
        left.appendChild(b);
      });
    };

    const renderList = () => {
      const q = String(input.value || "").trim().toLowerCase();
      const values = (dataByKey[activeKey] || []).filter((v) => !q || v.toLowerCase().includes(q));
      list.innerHTML = "";

      values.forEach((value) => {
        const row = document.createElement("label");
        row.className = "fm__row";
        row.innerHTML = `
          <input type="checkbox" class="fm__check" />
          <span>${esc(value)}</span>
        `;
        const cb = $("input", row);
        cb.checked = state.filters[activeKey].has(value);
        cb.addEventListener("change", () => {
          if(cb.checked) state.filters[activeKey].add(value);
          else state.filters[activeKey].delete(value);
        });
        list.appendChild(row);
      });
    };

    modal.addEventListener("click", (e) => {
      const t = e.target;
      if(t && t.closest && t.closest("[data-fm-close]")) close();
      if(t && t.closest && t.closest("[data-fm-clear]")){
        Object.values(state.filters).forEach((set) => set.clear());
        renderList();
      }
      if(t && t.closest && t.closest("[data-fm-apply]")){
        close();
        applyAll();
      }
    });

    input.addEventListener("input", renderList);

    function open(data){
      dataByKey = data;
      activeKey = "vitola";
      input.value = "";
      renderLeft();
      renderList();
      modal.hidden = false;
    }

    function close(){
      modal.hidden = true;
    }

    filterModal = { open, close };
    return filterModal;
  }

  function uniqSorted(vals, numeric = false){
    const a = Array.from(new Set(vals.map((v) => String(v || "").trim()).filter(Boolean)));
    return a.sort((x, y) => numeric ? (parseFloat(x) - parseFloat(y)) : x.localeCompare(y));
  }

  function buildFilterData(rows){
    return {
      vitola: uniqSorted(rows.map(resolveVitola)),
      ring: uniqSorted(rows.map(resolveRing), true),
      length: uniqSorted(rows.map(resolveLength), true),
      strength: uniqSorted(rows.map(resolveStrength)),
      shape: uniqSorted(rows.map(resolveShape)),
      shade: uniqSorted(rows.map(resolveShade)),
    };
  }

  function applyWrapperMode(rows){
    if(state.wrapperMode === "all") return rows;
    return rows.filter((r) => {
      const shade = resolveShade(r).toLowerCase();
      if(state.wrapperMode === "maduro") return shade.includes("maduro");
      if(state.wrapperMode === "natural") return shade.includes("natural");
      return true;
    });
  }

  function applySearch(rows){
    const q = String(state.search || "").trim().toLowerCase();
    if(!q) return rows;
    return rows.filter((r) =>
      resolveName(r).toLowerCase().includes(q) ||
      resolveVitola(r).toLowerCase().includes(q)
    );
  }

  function applyBandSelected(rows){
    if(!state.bandSelected.size) return rows;
    return rows.filter((r) => state.bandSelected.has(resolveBand(r)));
  }

  function applyFilterSets(rows){
    return rows.filter((r) => {
      const vitola = resolveVitola(r);
      const ring = resolveRing(r);
      const length = resolveLength(r);
      const strength = resolveStrength(r);
      const shape = resolveShape(r);
      const shade = resolveShade(r);

      if(state.filters.vitola.size && !state.filters.vitola.has(vitola)) return false;
      if(state.filters.ring.size && !state.filters.ring.has(ring)) return false;
      if(state.filters.length.size && !state.filters.length.has(length)) return false;
      if(state.filters.strength.size && !state.filters.strength.has(strength)) return false;
      if(state.filters.shape.size && !state.filters.shape.has(shape)) return false;
      if(state.filters.shade.size && !state.filters.shade.has(shade)) return false;

      return true;
    });
  }

  function renderList(rows){
    listEl.innerHTML = "";

    if(!rows.length){
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(state.brand)}</div>`;
      return;
    }

    rows.forEach((r) => {
      const card = document.createElement("article");
      card.className = "brand-row";

      const cartItem = {
        id: resolveId(r),
        name: resolveName(r),
        price: Number(resolvePrice(r) || 0) || 0,
        img: resolveImage(r) || "",
        brand: state.brand,
      };

      card.innerHTML = `
        <img class="row-ico" src="${esc(brandIconPath())}" alt="" loading="lazy" />
        <div class="row-main">
          <div class="row-title">${esc(resolveName(r))}</div>
          <div class="row-sub">${esc(resolveVitola(r))}</div>
        </div>
        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(resolvePrice(r))}</div>
          <button class="pos-add" type="button" aria-label="Add"
            data-add-cart
            data-cart-item='${esc(JSON.stringify(cartItem))}'>+</button>
        </div>
      `;

      $(".row-title", card)?.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetail(r);
      });

      $(".pos-add", card)?.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      listEl.appendChild(card);
    });
  }

  function getBandOptions(rows){
    const map = new Map();

    rows.forEach((r) => {
      const label = resolveBand(r);
      const art = resolveBandArt(r);
      if(!label || !art) return;
      if(!map.has(label)){
        map.set(label, { key: label, label, src: art });
      }
    });

    return Array.from(map.values());
  }

  function renderBandOptions(opts){
    bandsOptions.innerHTML = "";

    if(!opts.length){
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
        if(cb.checked) state.bandSelected.add(b.key);
        else state.bandSelected.delete(b.key);
      });
      bandsOptions.appendChild(card);
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

  function setWrapperMode(mode){
    state.wrapperMode = mode;
    seg.setAttribute("data-state", mode);
    segBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.state === mode));
    applyAll();
  }

  backBtn?.addEventListener("click", () => {
    if(history.length > 1) history.back();
    else location.href = "/pos/cigars/";
  });

  themeToggle?.addEventListener("click", () => {
    applyTheme(getSavedTheme() === "dark" ? "light" : "dark");
  });

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  btnFilters?.addEventListener("click", () => {
    ensureFilterModal().open(buildFilterData(applyWrapperMode([...state.rowsAll])));
  });

  btnBands?.addEventListener("click", () => {
    renderBandOptions(getBandOptions(state.rowsAll));
    openBandsSheet();
  });

  bandsConfirm?.addEventListener("click", () => {
    closeBandsSheet();
    applyAll();
  });

  segSwitch?.addEventListener("click", () => {
    const next = state.wrapperMode === "maduro" ? "natural" : state.wrapperMode === "natural" ? "all" : "maduro";
    setWrapperMode(next);
  });

  segBtns.forEach((b) => {
    b.addEventListener("click", () => setWrapperMode(b.dataset.state || "all"));
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if(t && t.closest && t.closest("[data-sheet-close]")) closeBandsSheet();
    if(t === sheetBands) closeBandsSheet();
    if(t && t.closest && t.closest("[data-detail-close]")) closeDetail();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape"){
      closeBandsSheet();
      closeDetail();
      if(filterModal) filterModal.close();
    }
  });

  async function boot(){
    applyTheme(getSavedTheme());

    state.brand = (getParam("brand") || "Padron").trim();
    setBrandHeader();

    const normalizedPageBrand = normalizeBrand(state.brand);
    btnBands.style.display = normalizedPageBrand === "padron" ? "" : "none";

    const res = await fetch(CSV_URL, { cache: "no-store" });
    const txt = await res.text();
    const rows = mapRows(parseCSV(txt));

    const exact = rows.filter((r) => normalizeBrand(resolveBrandVal(r)) === normalizedPageBrand);
    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb.includes(normalizedPageBrand) || normalizedPageBrand.includes(rb);
    });

    state.rowsAll = (exact.length ? exact : fuzzy).map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
  });
})();
