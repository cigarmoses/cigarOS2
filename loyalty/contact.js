/* /loyalty/contact.js (FULL UPDATED)
   Updates:
   - Brand picker rows use new CSS layout (larger icons, regular text)
   - Removed inline font styles so CSS controls typography
   - Add/Edit inline next to Brands
   - All previous fixes preserved
*/

(() => {
  "use strict";

  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  const BRAND_ICON_BASE = "/img/icons/brands/";

  const ICON_BASE = "/img/icons/loyalty/";
  const ICONS = {
    military: `${ICON_BASE}military.svg`,
    paramedic: `${ICON_BASE}paramedic.svg`,
    firefighter: `${ICON_BASE}firefighter.svg`,
    police: `${ICON_BASE}police.svg`,
    locker: `${ICON_BASE}locker.svg`,
    regular: `${ICON_BASE}regular.svg`,
  };

  const CONTACT_ICON_BASE = "/img/icons/";
  const CONTACT_ICONS = {
    phone: `${CONTACT_ICON_BASE}blackphone.svg`,
    email: `${CONTACT_ICON_BASE}blackemail.svg`,
    address: `${CONTACT_ICON_BASE}blackaddress.svg`,
    birthday: `${CONTACT_ICON_BASE}blackbirthday.svg`,
    cigarsocial_primary: `/img/icons/cigarsocial.svg`,
    cigarsocial_fallback: `${CONTACT_ICON_BASE}blackprofile.svg`,
  };

  const $ = (s) => document.querySelector(s);

  const backBtn = $("#lcBack");
  const nameEl = $("#lcName");
  const akaEl = $("#lcAka");
  const noteEl = $("#lcNote");
  const iconsEl = $("#lcIcons");
  const editBtn = $("#lcEditBtn");

  const tabs = Array.from(document.querySelectorAll(".lc-tab"));
  const panelHistory = $("#panelHistory");
  const panelContact = $("#panelContact");
  const panelFavorites = $("#panelFavorites");

  const safeJSON = (s, f) => { try { return JSON.parse(s); } catch { return f; } };
  const writeJSON = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const toStr = (v) => (v == null ? "" : String(v)).trim();

  function getParam(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function escapeHTML(s){
    return (s ?? "")
      .toString()
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function escapeAttr(s){
    return escapeHTML(s);
  }

  function readCustomers(){
    const list = safeJSON(localStorage.getItem(CUSTOMERS_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function writeCustomers(list){
    writeJSON(CUSTOMERS_KEY, list);
    window.dispatchEvent(new Event("cigaros:customers-changed"));
  }

  function showTab(tab){
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    panelHistory.style.display   = tab==="history"   ? "" : "none";
    panelContact.style.display   = tab==="contact"   ? "" : "none";
    panelFavorites.style.display = tab==="favorites" ? "" : "none";
  }

  function brandIconPath(name){
    const slug = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"");
    return `${BRAND_ICON_BASE}${slug}.svg`;
  }

  /* ---------------- FAVORITES PANEL ---------------- */

  function getFavBrands(customer){
    const out=[];
    for(let i=1;i<=50;i++){
      const v=toStr(customer[`Fav brand ${i}`]);
      if(v) out.push(v);
    }
    return out;
  }

  function setFavBrands(customer,brands){
    for(let i=1;i<=50;i++) delete customer[`Fav brand ${i}`];
    brands.slice(0,50).forEach((b,i)=>{
      customer[`Fav brand ${i+1}`]=b;
    });
  }

  function renderFavoritesPanel(customer){
    const favBrands = getFavBrands(customer);

    panelFavorites.innerHTML = `
      <div class="section-head">
        <div class="section-title">Brands</div>
        <a class="section-link" href="#" id="favBrandsEditLink">Add / Edit</a>
      </div>

      ${
        favBrands.length
          ? `<div class="brand-icons">
              ${favBrands.map(b => `
                <img src="${escapeAttr(brandIconPath(b))}"
                     alt="${escapeAttr(b)}"
                     onerror="this.style.display='none';">
              `).join("")}
            </div>`
          : `<div class="empty-line">No favorite brands yet</div>`
      }

      <div class="section-title">Cigars</div>
      <div class="empty-line">No favorite cigars yet</div>
    `;

    $("#favBrandsEditLink")?.addEventListener("click",(e)=>{
      e.preventDefault();
      openBrandSheet(customer);
    });
  }

  /* ---------------- BRAND SHEET ---------------- */

  let sheetBackdrop, sheet, sheetSearch, sheetList;
  let activeCustomerRef=null;
  let draftSelected=new Set();

  function ensureSheet(){
    if(sheet) return;

    sheetBackdrop=document.createElement("div");
    sheetBackdrop.className="lc-sheet-backdrop";
    sheetBackdrop.style.display="none";

    sheet=document.createElement("div");
    sheet.className="lc-sheet";
    sheet.style.display="none";

    sheet.innerHTML=`
      <div class="lc-sheet-head">
        <button type="button" class="lc-sheet-x">Cancel</button>
        <div class="lc-sheet-title">Favorite Brands</div>
        <button type="button" class="lc-sheet-done">Done</button>
      </div>
      <div class="lc-sheet-search">
        <input type="search" class="lc-sheet-input"
          placeholder="Search brands"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false">
      </div>
      <div class="lc-sheet-list"></div>
    `;

    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);

    sheetSearch=sheet.querySelector(".lc-sheet-input");
    sheetList=sheet.querySelector(".lc-sheet-list");

    sheetBackdrop.addEventListener("pointerdown",()=>closeSheet(false));
    sheet.querySelector(".lc-sheet-x").addEventListener("click",()=>closeSheet(false));
    sheet.querySelector(".lc-sheet-done").addEventListener("click",()=>closeSheet(true));
    sheetSearch.addEventListener("input",()=>renderSheetList(sheetSearch.value||""));
  }

  function openSheet(){
    sheetBackdrop.style.display="";
    sheet.style.display="";
    requestAnimationFrame(()=>sheetSearch.focus());
  }

  function closeSheet(apply){
    if(apply && activeCustomerRef){
      const customers=readCustomers();
      const id=toStr(activeCustomerRef.id);
      const idx=customers.findIndex(c=>toStr(c.id)===id);
      if(idx>=0){
        setFavBrands(customers[idx],Array.from(draftSelected));
        writeCustomers(customers);
        renderFavoritesPanel(customers[idx]);
      }
    }
    sheetBackdrop.style.display="none";
    sheet.style.display="none";
    sheetSearch.value="";
    sheetList.innerHTML="";
    draftSelected=new Set();
    activeCustomerRef=null;
  }

  function openBrandSheet(customer){
    ensureSheet();
    activeCustomerRef=customer;
    draftSelected=new Set(getFavBrands(customer));
    renderSheetList("");
    openSheet();
  }

  function normalizeForSearch(s){
    return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  }

  function renderSheetList(q){
    const nq=normalizeForSearch(q);

    const rows = BRAND_MASTER
      .filter(b=>{
        if(!nq) return true;
        return normalizeForSearch(b).includes(nq);
      })
      .map(b=>{
        const checked=draftSelected.has(b)?"checked":"";
        return `
          <label class="lc-brand-row">
            <input type="checkbox"
                   class="lc-brand-check"
                   data-brand="${escapeAttr(b)}"
                   ${checked}>
            <img src="${escapeAttr(brandIconPath(b))}"
                 alt=""
                 onerror="this.style.display='none';">
            <span>${escapeHTML(b)}</span>
          </label>
        `;
      }).join("");

    sheetList.innerHTML = rows || `<div class="empty-line">No matches</div>`;

    sheetList.querySelectorAll('input[data-brand]').forEach(cb=>{
      cb.addEventListener("change",(e)=>{
        const brand=e.target.getAttribute("data-brand");
        if(e.target.checked) draftSelected.add(brand);
        else draftSelected.delete(brand);
      });
    });
  }

  /* ---------------- INIT ---------------- */

  function init(){
    backBtn?.addEventListener("click",()=>history.back());

    const id=getParam("id");
    const customers=readCustomers();
    const customer=customers.find(c=>toStr(c.id)===id);

    if(!customer){
      nameEl.textContent="Contact not found";
      showTab("contact");
      return;
    }

    tabs.forEach(btn=>{
      btn.addEventListener("click",()=>showTab(btn.dataset.tab));
    });

    showTab("contact");
    renderFavoritesPanel(customer);
  }

  try{ init(); }
  catch(err){
    console.error("contact.js error:",err);
  }

})();
