/* /pos/cigars/cigars.js
   FULL PREMIUM REBUILD
   - iOS 26 style modal
   - Glass UI prep
   - Fixed close button (top right)
   - Cleaned interactions
   - Ring slider upgraded
*/

(() => {
"use strict";

/* =========================
   HELPERS
========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const CSV_URL =
"https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

const searchInput = $("#cigars-search-input");
const listRoot = $("#cigarsList");
const appliedRoot = $("#cigarsAppliedFilters");
const favBrandsRoot = $("#favBrandsScroll");

let modalRoot = $("#filter-modal");

/* =========================
   DATA
========================= */
let DATA_ROWS = Array.isArray(window.__CIGAR_SHEET_ROWS__)
? window.__CIGAR_SHEET_ROWS__
: [];

const FAVORITE_BRANDS_KEY = "cigaros_favorite_brands";
const RECENT_BRANDS_KEY = "cigaros_recent_brands";

/* =========================
   STATE
========================= */
const state = {
selected: {
manufacturer: new Set(),
brand: new Set(),
vitola: new Set(),
ring: new Set(),
length: new Set(),
strength: new Set(),
shape: new Set(),
shade: new Set(),
},
activeKey: "vitola",
activeSearch: "",
includeCubans: false,
};

/* =========================
   UTILS
========================= */
function norm(v){
return String(v ?? "").trim();
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function slugify(name){
return String(name || "")
.toLowerCase()
.replace(/[^a-z0-9]+/g,"");
}

/* =========================
   ICONS
========================= */
function iconPathFor(key,label){
const slug = slugify(label);
if(!slug) return "";

if(key==="brand") return `/img/icons/brands/${slug}.svg`;
if(key==="manufacturer") return `/img/icons/manufacturers/${slug}.svg`;

return "";
}

/* =========================
   CSV PARSER
========================= */
function parseCSV(text){
const rows=[];
let i=0,field="",row=[],inQuotes=false;

while(i<text.length){
const c=text[i];

if(c==='"'){
if(inQuotes && text[i+1]==='"'){
field+='"'; i+=2; continue;
}
inQuotes=!inQuotes;
i++; continue;
}

if(!inQuotes && (c===","||c==="\n")){
row.push(field); field="";

if(c===","){ i++; continue; }

rows.push(row); row=[];
i++; continue;
}

field+=c; i++;
}

if(field || row.length){
row.push(field);
rows.push(row);
}

return rows;
}

function rowsToObjects(rows){
const headers = rows[0];
return rows.slice(1).map(r=>{
const o={};
headers.forEach((h,i)=> o[h]=r[i] ?? "");
return o;
});
}

/* =========================
   BRAND SUMMARY
========================= */
function buildBrandSummary(rows){
const map = new Map();

rows.forEach(r=>{
const brand = norm(r.Brand) || "Unknown";
const manufacturer = norm(r.Manufacturer);

if(!map.has(brand)){
map.set(brand,{brand,manufacturer,count:0});
}

map.get(brand).count++;
});

return [...map.values()];
}
/* =========================
   GLOBAL FILTER STATE
========================= */
function ensureGlobalState(){
  if(!window.__CIGAR_FILTER_STATE__){
    window.__CIGAR_FILTER_STATE__ = {
      q:"",
      includeCubans:false,
      filters:{
        manufacturer:new Set(),
        brand:new Set(),
        vitola:new Set(),
        ring:new Set(),
        length:new Set(),
        strength:new Set(),
        shape:new Set(),
        shade:new Set(),
      },
    };
  }
}

function getField(row, keys){
  for(const k of keys){
    const v = row?.[k];
    if(v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function isCubanRow(row){
  const cuban = getField(row, ["Cuban","cuban"]);
  const origin = getField(row, ["Origin","origin","Country"]).toLowerCase();
  return ["x","yes","true","1","cuban"].includes(cuban.toLowerCase()) || origin.includes("cuba");
}

function rowMatchesFilters(row,g){
  if(!g.includeCubans && isCubanRow(row)) return false;

  const brand = norm(getField(row,["Brand","brand"]));
  const manufacturer = norm(getField(row,["Manufacturer","manufacturer"]));
  const vitola = norm(getField(row,["Vitola","vitola","Style"]));
  const ring = norm(getField(row,["RG","Ring","ring"]));
  const length = norm(getField(row,["Length","length"]));
  const strength = norm(getField(row,["Strength","strength"]));
  const shape = norm(getField(row,["Shape","shape"]));
  const shade = norm(getField(row,["Wrapper Shade","shade"]));

  const checks = {brand,manufacturer,vitola,ring,length,strength,shape,shade};

  for(const key in checks){
    const set = g.filters?.[key];
    if(set instanceof Set && set.size && !set.has(checks[key])) return false;
  }

  const q = norm(g.q).toLowerCase();
  if(q){
    const cigar = norm(getField(row,["Cigar","Name","Cigar Name"]));
    const hay = `${brand} ${manufacturer} ${vitola} ${ring} ${length} ${strength} ${shape} ${shade} ${cigar}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }

  return true;
}

function hasActiveFilters(g){
  return Object.values(g.filters || {}).some(v => v instanceof Set && v.size);
}

/* =========================
   BRAND GRID
========================= */
function renderBrandsGrid(summary){
  if(!listRoot) return;

  listRoot.innerHTML = `
    <div class="brands-grid">
      ${summary.map(c=>{
        const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
        const icon = iconPathFor("brand", c.brand);

        return `
          <a href="${href}" data-brand-link="${escapeHtml(c.brand)}">
            <img src="${escapeHtml(icon)}" alt="${escapeHtml(c.brand)}"
              loading="lazy" decoding="async"
              onerror="this.style.opacity='.18';this.style.filter='grayscale(1)';" />
            <div class="category-name">${escapeHtml(c.brand)}</div>
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function renderResultsRows(summary){
  if(!listRoot) return;

  listRoot.innerHTML = `
    <div class="cigars-results">
      ${summary.map(c=>{
        const href = `/pos/cigars/brand/?brand=${encodeURIComponent(c.brand)}`;
        const icon = iconPathFor("brand", c.brand);

        return `
          <a class="brand-row" href="${href}" data-brand-link="${escapeHtml(c.brand)}">
            <img class="row-ico" src="${escapeHtml(icon)}" alt=""
              loading="lazy" decoding="async"
              onerror="this.style.display='none';" />
            <div class="brand-row-left">
              <div class="brand-row-title">${escapeHtml(c.brand)}</div>
              <div class="brand-row-sub">${escapeHtml(c.manufacturer || "—")}</div>
            </div>
            <div class="brand-row-right">
              <div class="brand-row-msrp">${escapeHtml(String(c.count))}</div>
              <div class="brand-row-arrow">›</div>
            </div>
          </a>
        `;
      }).join("")}
    </div>
  `;
}

/* =========================
   FAVORITE RAIL
========================= */
function readJsonArray(key){
  try{
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  }catch{
    return [];
  }
}

function writeJsonArray(key,value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch{}
}

function getFavoriteBrands(){
  return readJsonArray(FAVORITE_BRANDS_KEY);
}

function getRecentBrands(){
  return readJsonArray(RECENT_BRANDS_KEY);
}

function pushRecentBrand(name){
  const target = norm(name);
  if(!target) return;

  const next = [
    target,
    ...getRecentBrands().filter(b => norm(b).toLowerCase() !== target.toLowerCase())
  ].slice(0,12);

  writeJsonArray(RECENT_BRANDS_KEY,next);
}

function renderFavoriteBrands(summary){
  if(!favBrandsRoot) return;

  const starter = ["Padron","Davidoff","Opus X","Arturo Fuente","Aladino","Rocky Patel"];
  const names = [...getFavoriteBrands(), ...getRecentBrands(), ...starter];

  const seen = new Set();
  const cards = [];

  names.forEach(name=>{
    const key = norm(name).toLowerCase();
    if(!key || seen.has(key)) return;
    seen.add(key);

    const match = summary.find(b => norm(b.brand).toLowerCase() === key) || {brand:name};

    cards.push(match);
  });

  favBrandsRoot.innerHTML = cards.slice(0,8).map(b=>{
    const icon = iconPathFor("brand", b.brand);
    const href = `/pos/cigars/brand/?brand=${encodeURIComponent(b.brand)}`;

    return `
      <a class="fav-brand-card" href="${href}" data-brand="${escapeHtml(b.brand)}">
        <div class="fav-brand-icon">
          <img src="${escapeHtml(icon)}" alt="${escapeHtml(b.brand)}" loading="lazy" decoding="async" />
        </div>
        <div class="fav-brand-name">${escapeHtml(b.brand)}</div>
      </a>
    `;
  }).join("");
}

/* =========================
   APPLIED FILTER CHIPS
========================= */
function renderAppliedChips(g){
  if(!appliedRoot) return;

  const chips = [];

  Object.entries(g.filters || {}).forEach(([key,set])=>{
    if(!(set instanceof Set) || !set.size) return;

    set.forEach(val=>{
      chips.push(`
        <div class="af-chip" data-chip-key="${escapeHtml(key)}" data-chip-val="${escapeHtml(val)}">
          <span>${escapeHtml(key)}: ${escapeHtml(val)}</span>
          <button class="af-chip__x" type="button">×</button>
        </div>
      `);
    });
  });

  if(g.q || hasActiveFilters(g) || g.includeCubans){
    chips.push(`
      <div class="af-chip af-clear">
        <span>Clear</span>
        <button class="af-chip__x" type="button" id="af-clear-all">×</button>
      </div>
    `);
  }

  appliedRoot.innerHTML = chips.join("");

  $$(".af-chip__x", appliedRoot).forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.preventDefault();

      if(btn.id === "af-clear-all"){
        g.q = "";
        g.includeCubans = false;
        Object.keys(g.filters).forEach(k => g.filters[k] = new Set());
        if(searchInput) searchInput.value = "";
        renderAll();
        return;
      }

      const chip = btn.closest(".af-chip");
      const key = chip?.getAttribute("data-chip-key");
      const val = chip?.getAttribute("data-chip-val");

      if(key && val && g.filters[key]) g.filters[key].delete(val);

      renderAll();
    });
  });
}

function renderAll(){
  ensureGlobalState();

  const g = window.__CIGAR_FILTER_STATE__;
  renderAppliedChips(g);

  const allRows = DATA_ROWS || [];
  const fullSummary = buildBrandSummary(allRows);

  renderFavoriteBrands(fullSummary);

  const filteredRows = allRows.filter(r => rowMatchesFilters(r,g));
  let summary = buildBrandSummary(filteredRows);

  const qOn = !!norm(g.q);
  const filtersOn = hasActiveFilters(g);

  if(!summary.length && !qOn && !filtersOn && !g.includeCubans){
    summary = fullSummary;
  }

  if(!summary.length){
    listRoot.innerHTML = `<div class="cigars-empty">No results.</div>`;
    return;
  }

  if(qOn || filtersOn || g.includeCubans){
    renderResultsRows(summary);
  }else{
    renderBrandsGrid(summary);
  }
}

const CATEGORIES = [
  { key:"manufacturer", label:"Manufacturers" },
  { key:"brand", label:"Brands" },
  { key:"vitola", label:"Vitolas" },
  { key:"ring", label:"Ring" },
  { key:"length", label:"Length" },
  { key:"strength", label:"Strength" },
  { key:"shape", label:"Shape" },
  { key:"shade", label:"Wrap. Shade" },
];

function getValuesForKey(key){
  const fieldMap = {
    manufacturer:["Manufacturer","manufacturer"],
    brand:["Brand","brand"],
    vitola:["Vitola","vitola","Style","style"],
    ring:["RG","Ring","ring"],
    length:["Length","length"],
    strength:["Strength","strength"],
    shape:["Shape","shape"],
    shade:["Wrapper Shade","WrapperShade","shade"],
  };

  const keys = fieldMap[key] || [key];
  const vals = [];

  DATA_ROWS.forEach(row=>{
    if(!state.includeCubans && isCubanRow(row)) return;

    for(const k of keys){
      if(row[k] != null && String(row[k]).trim() !== ""){
        vals.push(row[k]);
        break;
      }
    }
  });

  return [...new Set(vals.map(norm).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}

function countSelectedForKey(key){
  return state.selected[key] instanceof Set ? state.selected[key].size : 0;
}
   
/* =========================
   INLINE PREMIUM FILTER STYLES
========================= */
function ensureInjectedStyles(){
  if($("#cigars-inline-filter-style")) return;

  const style = document.createElement("style");
  style.id = "cigars-inline-filter-style";

  style.textContent = `
    #filter-modal.fm{ z-index:99999; }

    #filter-modal .fm__sheet{
      left:50% !important;
      right:auto !important;
      width:calc(100vw - 24px) !important;
      max-width:430px !important;
      max-height:88vh;
      transform:translate(-50%, 110%) !important;
      border-radius:34px 34px 0 0;
      overflow:hidden;
      background:rgba(246,247,251,.94);
      backdrop-filter:blur(34px) saturate(180%);
      -webkit-backdrop-filter:blur(34px) saturate(180%);
      box-shadow:0 -24px 70px rgba(0,0,0,.34);
    }

    #filter-modal.is-open .fm__sheet{
      transform:translate(-50%, 0) !important;
    }

    .fm.fm--tabs .fm__header{
      position:relative;
      padding:22px 60px 12px 20px;
      border-bottom:none;
    }

    .fm.fm--tabs .fm__header-top{
      display:block;
    }

    .fm.fm--tabs .fm__title{
      margin:0;
      font-size:34px;
      line-height:1;
      font-weight:900;
      letter-spacing:-.045em;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__close{
      position:absolute;
      top:16px;
      right:16px;
      width:36px;
      height:36px;
      border-radius:999px;
      border:1px solid rgba(15,26,44,.08);
      background:rgba(255,255,255,.78);
      color:rgba(15,26,44,.64);
      display:grid;
      place-items:center;
      box-shadow:0 8px 20px rgba(15,26,44,.08);
    }

    .fm.fm--tabs .fm__close svg{
      width:20px;
      height:20px;
    }

    .fm.fm--tabs .fm__body{
      display:block;
      padding:0;
      overflow:hidden;
    }

    .fm.fm--tabs .fm__tabbar{
      display:flex;
      gap:10px;
      overflow:auto;
      padding:0 18px 16px;
      scrollbar-width:none;
    }

    .fm.fm--tabs .fm__tabbar::-webkit-scrollbar{ display:none; }

    .fm.fm--tabs .fm__tab{
      flex:0 0 auto;
      min-height:40px;
      padding:0 15px;
      border-radius:999px;
      border:1px solid rgba(15,26,44,.08);
      background:rgba(255,255,255,.62);
      color:rgba(15,26,44,.62);
      font-size:15px;
      font-weight:750;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      cursor:pointer;
      white-space:nowrap;
      box-shadow:0 8px 18px rgba(15,26,44,.04);
    }

    .fm.fm--tabs .fm__tab.is-active{
      background:#0f1a2c;
      color:#fff;
      box-shadow:0 12px 24px rgba(15,26,44,.18);
    }

    .fm.fm--tabs .fm__tab-count{
      min-width:20px;
      height:20px;
      padding:0 6px;
      border-radius:999px;
      background:#5aa9e8;
      color:#fff;
      font-size:12px;
      font-weight:900;
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    .fm.fm--tabs .fm__panel{
      display:flex;
      flex-direction:column;
      min-height:0;
      max-height:calc(88vh - 174px);
    }

    .fm.fm--tabs .fm__search-wrap{
      padding:0 18px 12px;
    }

    .fm.fm--tabs .fm__search-row{
      height:48px;
      margin:0;
      border-radius:18px;
      background:rgba(255,255,255,.72);
      border:1px solid rgba(15,26,44,.08);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.72);
    }

    .fm.fm--tabs .fm__search-input{
      font-size:16px;
      font-weight:650;
    }

    .fm.fm--tabs .fm__cuban-row{
      display:none;
    }

    .fm.fm--tabs .fm__list{
      overflow:auto;
      padding:0 18px 14px;
    }

    .fm.fm--tabs .fm__row{
      display:grid;
      grid-template-columns:30px 150px 1fr;
      gap:12px;
      align-items:center;
      min-height:62px;
      padding:11px 12px;
      border-radius:20px;
      border:1px solid rgba(15,26,44,.08);
      background:rgba(255,255,255,.78);
      margin-bottom:10px;
      box-shadow:0 10px 24px rgba(15,26,44,.05);
    }

    .fm.fm--tabs .fm__row.is-selected{
      background:rgba(90,169,232,.13);
      border-color:rgba(90,169,232,.28);
    }

    .fm.fm--tabs .fm__row--logo{
      grid-template-columns:30px 42px minmax(0,1fr);
    }

    .fm.fm--tabs .fm__cb{
      width:22px;
      height:22px;
      border-radius:8px;
      border:2px solid rgba(15,26,44,.18);
      background:#fff;
      display:grid;
      place-items:center;
    }

    .fm.fm--tabs .fm__cb.is-checked{
      background:#5aa9e8;
      border-color:#5aa9e8;
      color:#fff;
    }

    .fm.fm--tabs .fm__cb svg{
      width:14px;
      height:14px;
    }

    .fm.fm--tabs .fm__label{
      grid-column:2;
      min-width:0;
      font-size:17px;
      font-weight:800;
      letter-spacing:-.025em;
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__info{
      display:none;
    }

    .fm.fm--tabs .fm__icon{
      grid-column:3;
      width:100%;
      min-width:0;
      height:42px;
      display:flex;
      align-items:center;
      justify-content:flex-start;
      overflow:visible;
    }

    .fm.fm--tabs .fm__icon img{
      height:32px;
      width:100%;
      object-fit:contain;
      object-position:left center;
      display:block;
      transform:none !important;
    }

    .fm.fm--tabs .fm__icon--brand,
    .fm.fm--tabs .fm__icon--manufacturer{
      grid-column:auto;
      width:42px;
      min-width:42px;
      height:42px;
      justify-content:center;
    }

    .fm.fm--tabs .fm__icon--brand img,
    .fm.fm--tabs .fm__icon--manufacturer img{
      width:36px;
      height:36px;
      max-width:36px;
      object-fit:contain;
    }

    .fm.fm--tabs .fm__actions{
      position:relative;
      z-index:2;
      display:grid;
      grid-template-columns:1fr 1.35fr;
      gap:10px;
      padding:14px 18px calc(14px + env(safe-area-inset-bottom));
      background:rgba(246,247,251,.92);
      border-top:1px solid rgba(15,26,44,.06);
    }

    .fm.fm--tabs .fm__btn{
      height:52px;
      border-radius:18px;
      font-size:17px;
      font-weight:850;
      border:0;
    }

    .fm.fm--tabs .fm__btn--reset{
      background:rgba(15,26,44,.08);
      color:#0f1a2c;
    }

    .fm.fm--tabs .fm__btn--apply{
      background:#0f1a2c;
      color:#fff;
      box-shadow:0 12px 24px rgba(15,26,44,.20);
    }

    .fm__range-ui{
      padding:6px 2px 12px;
    }

    .fm__range-card{
      position:relative;
      overflow:hidden;
      border-radius:30px;
      padding:22px 18px 18px;
      background:
        radial-gradient(circle at 50% -20%, rgba(90,169,232,.28), transparent 48%),
        rgba(255,255,255,.78);
      border:1px solid rgba(255,255,255,.72);
      box-shadow:0 18px 42px rgba(15,26,44,.10);
    }

    .fm__range-kicker{
      font-size:13px;
      font-weight:850;
      color:#5aa9e8;
      text-transform:uppercase;
      letter-spacing:.08em;
      text-align:center;
      margin-bottom:8px;
    }

    .fm__range-title{
      font-size:36px;
      font-weight:950;
      letter-spacing:-.06em;
      line-height:.95;
      color:#0f1a2c;
      text-align:center;
      margin-bottom:8px;
    }

    .fm__range-sub{
      max-width:280px;
      margin:0 auto 22px;
      font-size:15px;
      line-height:1.3;
      font-weight:650;
      color:rgba(15,26,44,.55);
      text-align:center;
    }

    .fm__range-values{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:14px;
      margin-bottom:22px;
    }

    .fm__range-values span{
      font-size:16px;
      font-weight:850;
      color:rgba(15,26,44,.42);
    }

    .fm__range-pill{
      min-width:96px;
      height:82px;
      padding:0 10px;
      border-radius:26px;
      background:#fff;
      border:1px solid rgba(15,26,44,.07);
      box-shadow:0 10px 24px rgba(15,26,44,.07);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:2px;
    }

    .fm__range-pill label{
      font-size:11px;
      font-weight:850;
      color:rgba(15,26,44,.42);
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .fm__range-input{
      width:78px;
      border:0;
      background:transparent;
      color:#5aa9e8;
      font-size:38px;
      line-height:1;
      font-weight:950;
      text-align:center;
      outline:none;
      appearance:textfield;
      -moz-appearance:textfield;
    }

    .fm__range-input::-webkit-outer-spin-button,
    .fm__range-input::-webkit-inner-spin-button{
      -webkit-appearance:none;
      margin:0;
    }

    .fm__range-track-wrap{
      position:relative;
      height:64px;
      margin:2px 4px 18px;
      display:flex;
      align-items:center;
    }

    .fm__range-track-fill{
      position:absolute;
      left:0;
      right:0;
      height:12px;
      border-radius:999px;
      background:linear-gradient(90deg,#4da3ff,#8fd3ff);
      box-shadow:0 8px 18px rgba(90,169,232,.28);
      pointer-events:none;
    }

    .fm__range-sliders{
      position:absolute;
      inset:0;
    }

    .fm__range-sliders input[type="range"]{
      position:absolute;
      left:0;
      top:21px;
      width:100%;
      pointer-events:none;
      appearance:none;
      -webkit-appearance:none;
      background:transparent;
    }

    .fm__range-sliders input[type="range"]::-webkit-slider-runnable-track{
      height:12px;
      border-radius:999px;
      background:rgba(15,26,44,.10);
    }

    .fm__range-sliders input[type="range"]::-webkit-slider-thumb{
      pointer-events:auto;
      appearance:none;
      -webkit-appearance:none;
      width:46px;
      height:46px;
      margin-top:-17px;
      border-radius:50%;
      background:#fff;
      border:10px solid #5aa9e8;
      box-shadow:0 10px 24px rgba(15,26,44,.18);
    }

    .fm__range-note{
      padding:12px 14px;
      border-radius:18px;
      background:rgba(15,26,44,.06);
      font-size:14px;
      font-weight:750;
      color:rgba(15,26,44,.60);
      text-align:center;
    }

    .fm__range-note strong{
      color:#0f1a2c;
      font-weight:950;
    }

    .fm__measure-main{
      display:block;
      font-size:20px;
      font-weight:900;
      line-height:1;
    }

    .fm__measure-unit{
      display:block;
      margin-top:4px;
      font-size:12px;
      font-weight:800;
      color:rgba(15,26,44,.46);
    }

    @media (max-width:390px){
      .fm__range-title{ font-size:32px; }

      .fm__range-pill{
        min-width:86px;
        height:76px;
      }

      .fm__range-input{
        width:68px;
        font-size:34px;
      }

      .fm.fm--tabs .fm__row{
        grid-template-columns:26px 118px 1fr;
        gap:8px;
      }
    }
  `;

  document.head.appendChild(style);
}
function ensureModal(){
  ensureInjectedStyles();

  if(!modalRoot){
    modalRoot = document.createElement("div");
    modalRoot.id = "filter-modal";
    modalRoot.className = "fm fm--hidden fm--tabs";
    modalRoot.hidden = true;
    modalRoot.setAttribute("aria-hidden", "true");
    document.body.appendChild(modalRoot);
  }else{
    modalRoot.classList.add("fm--tabs");
  }

  if(!modalRoot.querySelector(".fm__sheet")){
    modalRoot.innerHTML = `
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
          <div class="fm__tabbar" id="fm-tabbar"></div>

          <div class="fm__panel">
            <div class="fm__search-wrap">
              <div class="fm__search-row">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                </svg>

                <input class="fm__search-input" id="fm-search-inline" placeholder="Search" autocomplete="off" />

                <button class="fm__mic-btn" type="button" aria-label="Clear search" id="fm-search-clear">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="fm__cuban-row">
              <button class="fm__cuban-toggle" type="button" id="fm-cuban-toggle" aria-label="Include Cubans">
                <span class="fm__cuban-check">✓</span>
                <span class="fm__cuban-text">Include Cubans 🇨🇺</span>
              </button>
            </div>

            <div class="fm__list" id="fm-list"></div>
          </div>
        </div>

        <div class="fm__info-sheet" id="fm-info-sheet" aria-live="polite">
          <button class="fm__info-close" type="button" id="fm-info-close" aria-label="Close info">×</button>
          <h3 class="fm__info-title" id="fm-info-title"></h3>
          <p class="fm__info-text" id="fm-info-text"></p>
        </div>

        <div class="fm__actions">
          <button class="fm__btn fm__btn--reset" type="button" id="fm-reset">Reset</button>
          <button class="fm__btn fm__btn--apply" type="button" id="fm-apply">Apply</button>
        </div>
      </div>
    `;
  }
}

function renderCubanToggle(){
  const btn = $("#fm-cuban-toggle", modalRoot);
  if(!btn) return;
  btn.classList.toggle("is-on", !!state.includeCubans);
}

function renderTabs(){
  const tabbar = $("#fm-tabbar", modalRoot);
  if(!tabbar) return;

  tabbar.innerHTML = CATEGORIES.map((c) => {
    const active = c.key === state.activeKey ? " is-active" : "";
    const count = countSelectedForKey(c.key);

    return `
      <button class="fm__tab${active}" type="button" data-cat="${escapeHtml(c.key)}">
        <span>${escapeHtml(c.label)}</span>
        ${count ? `<span class="fm__tab-count">${count}</span>` : ""}
      </button>
    `;
  }).join("");

  $$(".fm__tab", tabbar).forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-cat");
      if(!key) return;

      state.activeKey = key;
      state.activeSearch = "";

      closeInfoSheet();
      renderTabs();
      renderList();

      const inp = $("#fm-search-inline", modalRoot);
      if(inp && key !== "ring") {
        inp.value = "";
        inp.focus();
      }
    });
  });
}

function renderRingRangeFilter(list){
  const rawValues = getValuesForKey("ring")
    .map((label) => ({
      label: norm(label),
      num: Number(String(label).replace(/[^0-9.]/g, "")),
    }))
    .filter((o) => o.label && Number.isFinite(o.num))
    .sort((a, b) => a.num - b.num);

  if(!rawValues.length){
    list.innerHTML = `<div class="fm__empty">No ring sizes found.</div>`;
    return;
  }

  const nums = rawValues.map((o) => o.num);
  const minValue = Math.min(...nums);
  const maxValue = Math.max(...nums);

  const selectedNums = [...state.selected.ring]
    .map((v) => Number(String(v).replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n));

  const currentMin = selectedNums.length ? Math.min(...selectedNums) : minValue;
  const currentMax = selectedNums.length ? Math.max(...selectedNums) : maxValue;

  list.innerHTML = `
    <div class="fm__range-ui">
      <div class="fm__range-card">
        <div class="fm__range-kicker">Ring Gauge</div>
        <div class="fm__range-title">${currentMin}–${currentMax}</div>
        <div class="fm__range-sub">Only show cigars within this ring gauge range.</div>

        <div class="fm__range-values">
          <div class="fm__range-pill">
            <label for="ring-min-input">Min</label>
            <input class="fm__range-input" id="ring-min-input" type="number" value="${currentMin}" min="${minValue}" max="${maxValue}" />
          </div>

          <span>to</span>

          <div class="fm__range-pill">
            <label for="ring-max-input">Max</label>
            <input class="fm__range-input" id="ring-max-input" type="number" value="${currentMax}" min="${minValue}" max="${maxValue}" />
          </div>
        </div>

        <div class="fm__range-track-wrap">
          <div class="fm__range-track-fill" id="ring-track-fill"></div>
          <div class="fm__range-sliders">
            <input id="ring-min-slider" type="range" min="${minValue}" max="${maxValue}" value="${currentMin}" step="1" />
            <input id="ring-max-slider" type="range" min="${minValue}" max="${maxValue}" value="${currentMax}" step="1" />
          </div>
        </div>

        <div class="fm__range-note">
          Showing <strong id="ring-count-label">0</strong> ring sizes from
          <strong id="ring-min-label">${currentMin}</strong> to
          <strong id="ring-max-label">${currentMax}</strong>
        </div>
      </div>
    </div>
  `;

  const minInput = $("#ring-min-input", list);
  const maxInput = $("#ring-max-input", list);
  const minSlider = $("#ring-min-slider", list);
  const maxSlider = $("#ring-max-slider", list);
  const minLabel = $("#ring-min-label", list);
  const maxLabel = $("#ring-max-label", list);
  const countLabel = $("#ring-count-label", list);
  const title = $(".fm__range-title", list);
  const trackFill = $("#ring-track-fill", list);

  function syncSelected(min, max){
    state.selected.ring.clear();

    rawValues.forEach((o) => {
      if(o.num >= min && o.num <= max){
        state.selected.ring.add(o.label);
      }
    });

    renderTabs();
  }

  function updateTrack(min, max){
    const span = Math.max(1, maxValue - minValue);
    const left = ((min - minValue) / span) * 100;
    const right = 100 - ((max - minValue) / span) * 100;

    if(trackFill){
      trackFill.style.left = `${left}%`;
      trackFill.style.right = `${right}%`;
    }
  }

  function update(fromMin, fromMax){
    let min = Number(fromMin);
    let max = Number(fromMax);

    if(!Number.isFinite(min)) min = minValue;
    if(!Number.isFinite(max)) max = maxValue;

    min = Math.max(minValue, Math.min(min, maxValue));
    max = Math.max(minValue, Math.min(max, maxValue));

    if(min > max) [min, max] = [max, min];

    minInput.value = min;
    maxInput.value = max;
    minSlider.value = min;
    maxSlider.value = max;

    minLabel.textContent = min;
    maxLabel.textContent = max;

    const count = rawValues.filter((o) => o.num >= min && o.num <= max).length;

    if(countLabel) countLabel.textContent = String(count);
    if(title) title.textContent = `${min}–${max}`;

    updateTrack(min, max);
    syncSelected(min, max);
  }

  minInput?.addEventListener("input", () => update(minInput.value, maxInput.value));
  maxInput?.addEventListener("input", () => update(minInput.value, maxInput.value));
  minSlider?.addEventListener("input", () => update(minSlider.value, maxInput.value));
  maxSlider?.addEventListener("input", () => update(minInput.value, maxSlider.value));

  update(currentMin, currentMax);
}
function renderList(){
  const list = $("#fm-list", modalRoot);
  const input = $("#fm-search-inline", modalRoot);

  if(!list) return;
  if(input) input.value = state.activeSearch;

  const key = state.activeKey;
  const values = getValuesForKey(key);
  const selectedSet = state.selected[key];

  if(key === "ring"){
    renderRingRangeFilter(list);
    return;
  }

  const q = norm(state.activeSearch).toLowerCase();
  const filtered = !q
    ? values
    : values.filter((v) => norm(v).toLowerCase().includes(q));

  if(!filtered.length){
    list.innerHTML = `<div class="fm__empty">No options found.</div>`;
    return;
  }

  list.innerHTML = filtered.map((v) => {
    const label = norm(v);
    const isSelected = selectedSet.has(label);
    const isLogoRow = key === "manufacturer" || key === "brand";

    const brandOrManufacturerIcon = isLogoRow ? iconPathFor(key, label) : "";
    const cigarIcon =
      key === "vitola" || key === "shape" ? getCigarFilterIcon(label, key) : "";

    const iconSrc = brandOrManufacturerIcon || cigarIcon;

    const iconClass =
      key === "manufacturer"
        ? "fm__icon fm__icon--manufacturer"
        : key === "brand"
        ? "fm__icon fm__icon--brand"
        : "fm__icon fm__icon--cigar";

    const infoBtn =
      key === "shape" && getShapeInfo(label)
        ? `<button class="fm__info" type="button" data-info="${escapeHtml(label)}" aria-label="About ${escapeHtml(label)}">i</button>`
        : isLogoRow
        ? ""
        : `<span class="fm__info" aria-hidden="true"></span>`;

    const cb = isSelected
      ? `
        <div class="fm__cb is-checked" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `
      : `<div class="fm__cb" aria-hidden="true"></div>`;

    const icon = iconSrc
      ? `
        <div class="${iconClass}">
          <img
            src="${escapeHtml(iconSrc)}"
            alt=""
            loading="lazy"
            decoding="async"
            onerror="this.style.display='none';"
          />
        </div>
      `
      : `<div class="${iconClass}" aria-hidden="true"></div>`;

    const labelHtml =
      key === "length"
        ? `<span class="fm__measure-main">${escapeHtml(label)}</span><span class="fm__measure-unit">inches</span>`
        : escapeHtml(label);

    if(isLogoRow){
      return `
        <div class="fm__row fm__row--logo ${isSelected ? "is-selected" : ""}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(label)}">
          ${cb}
          ${icon}
          <div class="fm__label">${labelHtml}</div>
        </div>
      `;
    }

    return `
      <div class="fm__row ${isSelected ? "is-selected" : ""}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(label)}">
        ${cb}
        <div class="fm__label">${labelHtml}</div>
        ${infoBtn}
        ${icon}
      </div>
    `;
  }).join("");

  $$(".fm__row", list).forEach((row) => {
    row.addEventListener("click", (e) => {
      const target = e.target;

      if(target instanceof Element && target.closest(".fm__info")) return;

      const rowKey = row.getAttribute("data-key") || "";
      const val = row.getAttribute("data-value") || "";

      if(!rowKey || !val || !(state.selected[rowKey] instanceof Set)) return;

      if(state.selected[rowKey].has(val)) state.selected[rowKey].delete(val);
      else state.selected[rowKey].add(val);

      closeInfoSheet();
      renderTabs();
      renderList();
    });
  });

  $$("[data-info]", list).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const label = btn.getAttribute("data-info") || "";
      const text = getShapeInfo(label);

      if(!text) return;

      openInfoSheet(label, text);
    });
  });
}

function closeInfoSheet(){
  $("#fm-info-sheet", modalRoot)?.classList.remove("is-open");
}

function openInfoSheet(title, text){
  const sheet = $("#fm-info-sheet", modalRoot);
  const titleEl = $("#fm-info-title", modalRoot);
  const textEl = $("#fm-info-text", modalRoot);

  if(!sheet || !titleEl || !textEl) return;

  titleEl.textContent = title;
  textEl.textContent = text;
  sheet.classList.add("is-open");
}

function openModal(){
  ensureModal();
  renderCubanToggle();

  modalRoot.hidden = false;
  modalRoot.classList.remove("fm--hidden");
  modalRoot.classList.add("is-open");
  modalRoot.setAttribute("aria-hidden", "false");

  document.documentElement.classList.add("sheet-open");

  renderTabs();
  renderList();

  window.setTimeout(() => {
    if(state.activeKey !== "ring"){
      $("#fm-search-inline", modalRoot)?.focus();
    }
  }, 60);
}

function closeModal(){
  if(!modalRoot) return;

  closeInfoSheet();

  modalRoot.classList.remove("is-open");
  modalRoot.classList.add("fm--hidden");
  modalRoot.setAttribute("aria-hidden", "true");

  document.documentElement.classList.remove("sheet-open");

  window.setTimeout(() => {
    if(!modalRoot.classList.contains("is-open")){
      modalRoot.hidden = true;
    }
  }, 260);
}

function syncLocalFromGlobal(){
  ensureGlobalState();

  const g = window.__CIGAR_FILTER_STATE__;

  Object.keys(state.selected).forEach((k) => {
    const set = g.filters?.[k];
    state.selected[k] = set instanceof Set ? new Set([...set]) : new Set();
  });

  state.includeCubans = !!g.includeCubans;
}

function pushLocalToGlobal(){
  ensureGlobalState();

  const g = window.__CIGAR_FILTER_STATE__;

  Object.keys(state.selected).forEach((k) => {
    g.filters[k] = new Set([...state.selected[k]]);
  });

  g.includeCubans = !!state.includeCubans;
  g.q = (searchInput?.value || g.q || "").toString();

  renderAll();
}

function resetLocalSelections(){
  Object.keys(state.selected).forEach((k) => {
    state.selected[k].clear();
  });

  state.includeCubans = false;

  closeInfoSheet();
  renderCubanToggle();
  renderTabs();
  renderList();
}

function openFiltersFromButton(e){
  if(e){
    e.preventDefault();
    e.stopPropagation();
  }

  syncLocalFromGlobal();
  openModal();
}

function bindFilterButton(root = document){
  const buttons = root.querySelectorAll?.(
    "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
  );

  if(!buttons || !buttons.length) return;

  buttons.forEach((btn) => {
    if(btn.__cigarsFilterBound) return;

    btn.__cigarsFilterBound = true;

    btn.addEventListener("click", openFiltersFromButton, { passive:false });
    btn.addEventListener("pointerup", openFiltersFromButton, { passive:false });
    btn.addEventListener("touchend", openFiltersFromButton, { passive:false });
  });
}

function observeForFilterButton(){
  const mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if(!(n instanceof Element)) return;

        bindFilterButton(n);

        if(
          n.matches?.(
            "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
          )
        ){
          bindFilterButton(document);
        }
      });
    });
  });

  mo.observe(document.documentElement, { childList:true, subtree:true });
}

searchInput?.addEventListener("input", () => {
  ensureGlobalState();
  window.__CIGAR_FILTER_STATE__.q = (searchInput.value || "").toString();
  renderAll();
});

document.addEventListener("click", (e) => {
  const target = e.target;

  if(!(target instanceof Element)) return;

  const filterBtn = target.closest(
    "#btn-open-filters, .cigars-filter-btn, #cigars-filter-btn, [data-open-filters]"
  );

  if(filterBtn){
    openFiltersFromButton(e);
    return;
  }

  if(!modalRoot || modalRoot.classList.contains("fm--hidden")) return;

  if(target.closest("[data-fm-close]")){
    closeModal();
    return;
  }

  if(target.closest("#fm-info-close")){
    closeInfoSheet();
    return;
  }

  if(target.closest("#fm-reset")){
    resetLocalSelections();
    return;
  }

  if(target.closest("#fm-apply")){
    pushLocalToGlobal();
    closeModal();
    return;
  }

  if(target.closest("#fm-search-clear")){
    state.activeSearch = "";
    renderList();

    if(state.activeKey !== "ring"){
      $("#fm-search-inline", modalRoot)?.focus();
    }

    return;
  }

  if(target.closest("#fm-cuban-toggle")){
    state.includeCubans = !state.includeCubans;

    closeInfoSheet();
    renderCubanToggle();
    renderTabs();
    renderList();
  }
});

document.addEventListener("input", (e) => {
  if(!modalRoot || modalRoot.classList.contains("fm--hidden")) return;

  const t = e.target;

  if(!(t instanceof HTMLInputElement)) return;
  if(t.id !== "fm-search-inline") return;

  state.activeSearch = t.value || "";
  renderList();
});

document.addEventListener("keydown", (e) => {
  if(e.key !== "Escape") return;
  if(!modalRoot || modalRoot.classList.contains("fm--hidden")) return;

  const infoSheet = $("#fm-info-sheet", modalRoot);

  if(infoSheet?.classList.contains("is-open")){
    closeInfoSheet();
    return;
  }

  closeModal();
});

async function init(){
  try{
    ensureGlobalState();
    ensureModal();

    if(searchInput){
      searchInput.value = window.__CIGAR_FILTER_STATE__.q || "";
    }

    bindFilterButton(document);
    observeForFilterButton();

    if(Array.isArray(window.__CIGAR_SHEET_ROWS__) && window.__CIGAR_SHEET_ROWS__.length){
      DATA_ROWS = window.__CIGAR_SHEET_ROWS__;
    }else{
      const res = await fetch(CSV_URL, { cache:"no-store" });

      if(!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

      const text = await res.text();
      const parsed = parseCSV(text);

      DATA_ROWS = rowsToObjects(parsed);
      window.__CIGAR_SHEET_ROWS__ = DATA_ROWS;
    }

    renderAll();
  }catch(err){
    console.error("cigars.js init error:", err);

    if(listRoot){
      listRoot.innerHTML = `<div class="cigars-empty">Failed to load cigars.</div>`;
    }
  }
}

init();
})();
