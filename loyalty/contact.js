/* /loyalty/contact.js (FULL)
   Fixes:
   1) Contact page no longer blank (always initializes + renders)
   2) Tabs order: Contact → History → Favorites (default Contact)
   3) Empty fields show "-" (view mode)
   4) Contact values remain Regular (handled by CSS, we don’t force bold)
   5) Edit mode shows First + Last name inputs (last name no longer missing)
   6) Cigar Social icon pulls from /img/icons/cigarsocial.svg (fallback to blackprofile)
   7) Favorite brand picker:
      - scrolls to bottom
      - search works for "Padron", "Opus X", "opusx"
      - never closes while typing
*/

(() => {
  "use strict";

  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  const BRAND_ICON_BASE = "/img/icons/brands/"; // plural

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

  // Brand list for picker
  const BRAND_MASTER = [
    "1502","20 Acre Farm","601 La Bomba","7-20-04","A Flores","A Turrent","Abuelo","Accomplice","ACID",
    "Adventura","Aganorsa Leaf","Aging Room","AJ Fernandez","Aladino","Alec Bradley","Aliados","Ambrosia",
    "Angel Cuesta","Antigua Esteli","Artesano del Tobacco","Artista","Arturo Fuente","Ashton","Asylum",
    "Atabey","ATL Cigar Co.","Aurora","AVO","Balmoral","Bespoke","Black Label Trading Co.","Black Works Studio",
    "Blackened","Bolivar","Brick House","Brioso","Brun del Ré","Buena Vista","Buffalo Ten","Byron","Cabaiguan",
    "Cain","Caldwell","Camacho","CAO","Carlos Andre","Carlos Toraño","Casa 1910","Casa Blanca","Casa Cuba",
    "Casa Fernandez","Casa Magna","Casa Turrent","Casdagli","Cavalier Genève","Chateau Diadem","CLE",
    "Cloud Hopper","COHIBA","Cohiba (Cuban)","Confidencial","Conspiracy","Crazy Alice","Crowned Heads",
    "Cuba Aliados","Cubiche","Cuesta Rey","Cumpay","Curivari","Daniel Marshall","Davidoff","Diamond Crown",
    "Dias de Gloria","Diplomaticos","Diplomaticos (Cuban)","Dominicana","Don Kiki","Don Pepin Garcia","Don Tomas",
    "Doña Nieves","Drew Estate","Dunbarton","Dunhill","EGM","Eiroa","El Centurion","El Galan","El Güegüense",
    "El Pulpo","El Rey Del Mundo","El Rey del Mundo (Cuban)","El Septimo","El Titan de Bronze","Emilio",
    "EP Carrillo","Excalibur","Factory Smokes Maduro","Factory Smokes Shade","Factory Smokes Sungrown",
    "Factory Smokes Sweet","Fat Bottom Betty","Ferio Tego","Fernando Leon","Flor de Copan","Flor de las Antillas",
    "Flor de Selva","Fonseca","Foundation","Four Kicks","Garofalo","Gellis Family Cigars","Girl With No Name",
    "Gispert","Great Wall","Gurkha","H. Upmann","Hamlet","Havana Honeys","Henry Clay","Herrera Esteli",
    "Highclere Castle","Hoyo","Hoyo de Monterrey","Illusione","Isla Del Sol","Island Jim","Israel Meerapfel",
    "Java","JC Newman","Jose Seijas","Joya de Nicaragua","Juan Lopez","Karen Berger","K by Karen Berger",
    "Kentucky Fire Cured","Kristoff","Kuyt’s","La Aroma de Cuba","La Aurora","La Boheme","La Estrella Cubana",
    "La Flor Dominicana","La Galera","La Gloria Cubana","La Palina","Larutan","Laura Chavin","Leaf by Oscar",
    "Leather Rose","Leonel","Liga Privada","Litto Gomez","Los Statos","Luciano","Macanudo","Matilde","MBombay",
    "Micallef","Monte by Montecristo","Montecristo","Montenegro","My Father","Nasser","Nica Rustica","Nicaroma",
    "NUB","Odyssey","Oliva","Olmec","OneOff","Opus X","Oscar Valladares","Ozgener Family Cigars","Padilla",
    "Padron","Pappy Van Winkle","Partagas","Patina","Perdomo","Perla del Mar","Peterson","Pinar Del Rio",
    "Plasencia","Platinum Nova","Powstanie","Principle","Punch","Puros Indios","Quintero","Rafael Gonzalez",
    "Ramon Allones","Regius","Rocky Patel","Rojas","RoMa Craft","Romeo y Julieta","Room 101","Saint Luis Rey",
    "San Cristobal","San Lotano","Sancho Panza","Sancho Panza (Cuban)","Sindicato","Sinistro","Southern Draw",
    "Stolen Throne","Sublimes","Sweet Jane","Tabak","Tatascan","Tatuaje","The American","Trinidad","Undercrown",
    "United Cigars","VegaFina","VegaFina & Great Wall","Vegas","Vegas de Fonseca","Vegas del Purial","Vegas Robaina",
    "Ventura Cigar Co.","Viaje","Villa Zamorano","Villiger","Viva La Vida","Warped","Warzone","West Tampa","Zino"
  ];

  const $ = (sel) => document.querySelector(sel);

  // DOM
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

  // ---------- helpers ----------
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const toStr = (v) => (v == null ? "" : String(v)).trim();

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
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
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readCustomers() {
    const list = safeJSON(localStorage.getItem(CUSTOMERS_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function writeCustomers(list) {
    writeJSON(CUSTOMERS_KEY, list);
    window.dispatchEvent(new Event("cigaros:customers-changed"));
  }

  function readSales() {
    const list = safeJSON(localStorage.getItem(SALES_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D+/g, "");
    if (!d) return "";
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === "1") return `${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
    return String(raw || "");
  }

  function normalizeForSearch(s) {
    // supports: "opus x" == "opusx"
    return String(s || "")
      .toLowerCase()
      .replace(/[\u2019']/g, "'")
      .replace(/[^a-z0-9]+/g, "");
  }

  function isTruthyMarker(v, colName) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (s === "0" || s === "no" || s === "false" || s === "n") return false;
    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;
    if (/^\d+(\.\d+)?$/.test(s)) return true;
    const col = String(colName || "").trim().toLowerCase();
    if (col && (s === col || s.includes(col))) return true;
    return true;
  }

  function hasColumnValue(obj, columnTitle) {
    if (!obj) return false;
    const k = columnTitle;
    const variants = [
      obj[k],
      obj[k?.toLowerCase()],
      obj[k?.toUpperCase()],
      obj[k?.replace(/\s+/g, "")],
      obj[k?.toLowerCase()?.replace(/\s+/g, "")],
    ];
    return variants.some((v) => isTruthyMarker(v, columnTitle));
  }

  function isExplicitX(v) {
    if (v == null) return false;
    return String(v).trim().toLowerCase() === "x";
  }

  function hasExplicitX(obj, columnTitle) {
    if (!obj) return false;
    const k = columnTitle;
    const variants = [
      obj[k],
      obj[k?.toLowerCase()],
      obj[k?.toUpperCase()],
      obj[k?.replace(/\s+/g, "")],
      obj[k?.toLowerCase()?.replace(/\s+/g, "")],
    ];
    return variants.some((v) => isExplicitX(v));
  }

  function lockerNumOnly(c) {
    const raw = String(
      c.lockerNumber ||
      c["Locker number"] ||
      c.locker ||
      c["Locker"] ||
      ""
    ).trim();
    const n = raw.replace(/\D+/g, "");
    return n || "";
  }

  function isLockerCustomer(c) {
    return hasColumnValue(c, "Locker") || !!lockerNumOnly(c);
  }

  function isRegularCustomer(c) {
    return hasExplicitX(c, "Regular");
  }

  function buildIconBox(src, alt) {
    const wrap = document.createElement("div");
    wrap.className = "lc-ico";
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    img.onerror = () => { img.style.display = "none"; };
    wrap.appendChild(img);
    return wrap;
  }

  function renderIcons(c) {
    iconsEl.innerHTML = "";

    const roleIcons = [];
    if (hasColumnValue(c, "Military")) roleIcons.push("military");
    if (hasColumnValue(c, "Police")) roleIcons.push("police");
    if (hasColumnValue(c, "Firefighter")) roleIcons.push("firefighter");
    if (hasColumnValue(c, "Paramedic")) roleIcons.push("paramedic");

    const tier = isLockerCustomer(c) ? "locker" : (isRegularCustomer(c) ? "regular" : null);
    const list = tier ? [...roleIcons, tier] : [...roleIcons];

    if (!list.length) return;
    list.forEach((key) => iconsEl.appendChild(buildIconBox(ICONS[key], key)));
  }

  function showTab(tab) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    panelHistory.style.display = tab === "history" ? "" : "none";
    panelContact.style.display = tab === "contact" ? "" : "none";
    panelFavorites.style.display = tab === "favorites" ? "" : "none";
  }

  function iconIMG(src, alt, fallbackSrc) {
    const safeAlt = escapeAttr(alt || "");
    const safeSrc = escapeAttr(src || "");
    const safeFallback = fallbackSrc ? escapeAttr(fallbackSrc) : "";

    if (!safeFallback) {
      return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" onerror="this.style.display='none';">`;
    }
    return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy"
      onerror="if(!this.dataset.fbk){this.dataset.fbk='1';this.src='${safeFallback}';}else{this.style.display='none';}">`;
  }

  function getAddressRaw(c) {
    return toStr(c.address ?? c.Address ?? c["Address"] ?? "");
  }

  function splitAddressTwoLines(raw) {
    const s = toStr(raw).replace(/\r\n/g, "\n");
    if (!s) return { line1: "", line2: "" };

    const parts = s.split("\n").map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return { line1: parts[0], line2: parts.slice(1).join(", ") };

    if (s.includes(",")) {
      const idx = s.indexOf(",");
      const a = s.slice(0, idx).trim();
      const b = s.slice(idx + 1).trim();
      return { line1: a, line2: b };
    }
    return { line1: s, line2: "" };
  }

  function joinAddressTwoLines(line1, line2) {
    const a = toStr(line1);
    const b = toStr(line2);
    if (a && b) return `${a}\n${b}`;
    return a || b || "";
  }

  function getCigarSocial(c) {
    return toStr(c.cigarSocial ?? c["Cigar Social"] ?? c["CigarSocial"] ?? "");
  }

  function getBirthdayText(c) {
    return toStr(c.birthday ?? c.Birthday ?? c["Birthday"] ?? c.dob ?? c.DOB ?? c["DOB"] ?? "");
  }

  // ---------- render blocks ----------
  function renderHeader(customer, editing) {
    const first = toStr(customer.firstName ?? customer.first ?? customer["First name"] ?? customer["First"] ?? "");
    const last  = toStr(customer.lastName  ?? customer.last  ?? customer["Last name"]  ?? customer["Last"]  ?? "");
    const aka   = toStr(customer.aka ?? customer.nickname ?? customer["aka"] ?? customer["Nickname"] ?? "");
    const note  = toStr(customer.note ?? customer.quickNote ?? customer["Quick note"] ?? customer["Note"] ?? "");

    if (!editing) {
      const full = (first || last) ? `${first}${first && last ? " " : ""}${last}` : "-";
      nameEl.classList.remove("editing");
      nameEl.innerHTML = escapeHTML(full);
    } else {
      nameEl.classList.add("editing");
      nameEl.innerHTML = `
        <input class="lc-field" id="fFirst" value="${escapeAttr(first)}" placeholder="First">
        <input class="lc-field" id="fLast" value="${escapeAttr(last)}" placeholder="Last">
      `;
    }

    if (aka) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${aka}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }

    noteEl.value = note;
    noteEl.readOnly = !editing;

    renderIcons(customer);
  }

  function renderContactPanel(customer, editing) {
    const dash = "-";

    const phoneRaw = toStr(customer.phone ?? customer["Phone"] ?? "");
    const phoneShown = editing ? phoneRaw : formatPhone(phoneRaw);
    const email = toStr(customer.email ?? customer["Email"] ?? "");
    const addrRaw = getAddressRaw(customer);
    const addr = splitAddressTwoLines(addrRaw);
    const bday = getBirthdayText(customer);
    const cigarSocial = getCigarSocial(customer);

    const vPhone = phoneShown || dash;
    const vEmail = email || dash;
    const vBday  = bday || dash;
    const vCS    = cigarSocial || dash;

    const addressViewHTML = `
      <div class="v v-addr">
        <div class="lc-lines">
          <div class="lc-line1">${escapeHTML(addr.line1 || dash)}</div>
          <div class="lc-line2">${escapeHTML(addr.line2 || dash)}</div>
        </div>
      </div>
    `;

    const addressEditHTML = `
      <div class="v v-addr">
        <div class="lc-addr-edit">
          <input class="lc-field" id="fAddr1" value="${escapeAttr(addr.line1)}" placeholder="Street">
          <input class="lc-field" id="fAddr2" value="${escapeAttr(addr.line2)}" placeholder="City, ST ZIP">
        </div>
      </div>
    `;

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="ico">${iconIMG(CONTACT_ICONS.phone, "Phone")}</div>
        <div class="v">
          ${
            editing
              ? `<input class="lc-field" id="fPhone" value="${escapeAttr(phoneRaw)}" placeholder="412-555-1212">`
              : `<div class="lc-value">${escapeHTML(vPhone)}</div>`
          }
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.email, "Email")}</div>
        <div class="v">
          ${
            editing
              ? `<input class="lc-field" id="fEmail" value="${escapeAttr(email)}" placeholder="name@email.com">`
              : `<div class="lc-value">${escapeHTML(vEmail)}</div>`
          }
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.address, "Address")}</div>
        ${editing ? addressEditHTML : addressViewHTML}

        <div class="ico">${iconIMG(CONTACT_ICONS.birthday, "Birthday")}</div>
        <div class="v">
          ${
            editing
              ? `<input class="lc-field" id="fBirthday" value="${escapeAttr(bday)}" placeholder="August 15">`
              : `<div class="lc-value">${escapeHTML(vBday)}</div>`
          }
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.cigarsocial_primary, "Cigar Social", CONTACT_ICONS.cigarsocial_fallback)}</div>
        <div class="v">
          ${
            editing
              ? `<input class="lc-field" id="fCigarSocial" value="${escapeAttr(cigarSocial)}" placeholder="@username">`
              : `<div class="lc-value">${escapeHTML(vCS)}</div>`
          }
        </div>
      </div>
    `;
  }

  function renderHistoryPanel(customer) {
    const sales = readSales();

    const id = toStr(customer.id ?? customer.customerId ?? customer._id ?? "");
    const phoneDigits = String(customer.phone || "").replace(/\D+/g, "");

    const hits = sales.filter((s) => {
      const sid = toStr(s.customerId ?? s.customer_id ?? s.contactId ?? "");
      const sphone = String(s.phone ?? s.customerPhone ?? "").replace(/\D+/g, "");
      if (id && sid && sid === id) return true;
      if (phoneDigits && sphone && sphone === phoneDigits) return true;
      return false;
    });

    if (!hits.length) {
      panelHistory.innerHTML = `<a class="lc-mutedlink" href="#" onclick="return false;">No history yet</a>`;
      return;
    }

    // Simple rows
    panelHistory.innerHTML = hits
      .slice()
      .reverse()
      .map((s) => {
        const title = toStr(s.title ?? s.invoice ?? s.receipt ?? "Invoice");
        const total = toStr(s.total ?? s.grandTotal ?? s.amount ?? "");
        const when  = toStr(s.date ?? s.created ?? s.time ?? "");
        const link  = toStr(s.pdf ?? s.pdfUrl ?? s.url ?? "");
        return `
          <div class="lc-row">
            <div class="left">${escapeHTML(title)}<div style="color:#8e8e93;font-weight:600;font-size:14px;margin-top:4px;">${escapeHTML(when)}</div></div>
            <div class="mid">${escapeHTML(total ? `$${Number(total).toFixed(2)}` : "")}</div>
            <div class="right">${link ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener">View</a>` : ""}</div>
          </div>
        `;
      })
      .join("");
  }

  // Favorites brands are stored as "Fav brand 1", "Fav brand 2", etc.
  function getFavBrands(customer) {
    const out = [];
    for (let i = 1; i <= 50; i++) {
      const v = toStr(customer[`Fav brand ${i}`]);
      if (v) out.push(v);
    }
    return out;
  }

  function setFavBrands(customer, brands) {
    // clear existing
    for (let i = 1; i <= 50; i++) delete customer[`Fav brand ${i}`];
    // set new
    brands.slice(0, 50).forEach((b, idx) => {
      customer[`Fav brand ${idx + 1}`] = b;
    });
  }

  function brandIconPath(name) {
    // your repo convention: /img/icons/brands/{brandname lowercase no spaces}.svg
    const slug = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    return `${BRAND_ICON_BASE}${slug}.svg`;
  }

  function renderFavoritesPanel(customer) {
    const favBrands = getFavBrands(customer);

    const brandsHeader = `
      <div class="section-head">
        <div class="section-title">Brands</div>
        <a class="section-link" href="#" id="favBrandsEditLink">Add / Edit</a>
      </div>
    `;

    const brandsBody = favBrands.length
      ? `<div class="brand-icons">
          ${favBrands.map((b) =>
            `<img src="${escapeAttr(brandIconPath(b))}" alt="${escapeAttr(b)}"
              onerror="this.style.display='none';">`
          ).join("")}
        </div>`
      : `<div class="empty-line">No favorite brands yet</div>`;

    const cigarsHeader = `<div class="section-title">Cigars</div>`;
    const cigarsBody = `<div class="empty-line">No favorite cigars yet</div>`;

    panelFavorites.innerHTML = `
      ${brandsHeader}
      ${brandsBody}
      ${cigarsHeader}
      ${cigarsBody}
    `;

    const link = $("#favBrandsEditLink");
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      openBrandSheet(customer);
    });
  }

  // ---------- brand sheet ----------
  let sheetBackdrop = null;
  let sheet = null;
  let sheetSearch = null;
  let sheetList = null;
  let sheetDone = null;
  let sheetCancel = null;

  let activeCustomerRef = null;
  let draftSelected = new Set();

  function ensureSheet() {
    if (sheet) return;

    sheetBackdrop = document.createElement("div");
    sheetBackdrop.className = "lc-sheet-backdrop";
    sheetBackdrop.style.display = "none";

    sheet = document.createElement("div");
    sheet.className = "lc-sheet";
    sheet.style.display = "none";

    sheet.innerHTML = `
      <div class="lc-sheet-head">
        <button type="button" class="lc-sheet-x">Cancel</button>
        <div class="lc-sheet-title">Favorite Brands</div>
        <button type="button" class="lc-sheet-done">Done</button>
      </div>
      <div class="lc-sheet-search">
        <input type="search" class="lc-sheet-input"
          placeholder="Search brands"
          autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
          inputmode="search" enterkeyhint="search"
        />
      </div>
      <div class="lc-sheet-list" role="list"></div>
    `;

    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);

    // IMPORTANT: prevent sheet clicks from closing it
    sheet.addEventListener("pointerdown", (e) => e.stopPropagation());
    sheet.addEventListener("click", (e) => e.stopPropagation());

    sheetBackdrop.addEventListener("pointerdown", () => closeSheet(false));

    sheetSearch = sheet.querySelector(".lc-sheet-input");
    sheetList = sheet.querySelector(".lc-sheet-list");
    sheetDone = sheet.querySelector(".lc-sheet-done");
    sheetCancel = sheet.querySelector(".lc-sheet-x");

    sheetCancel.addEventListener("click", () => closeSheet(false));
    sheetDone.addEventListener("click", () => closeSheet(true));

    sheetSearch.addEventListener("input", () => renderSheetList(sheetSearch.value || ""));
  }

  function openSheet() {
    sheetBackdrop.style.display = "";
    sheet.style.display = "";
    // focus after paint
    requestAnimationFrame(() => sheetSearch.focus({ preventScroll: true }));
  }

  function closeSheet(apply) {
    if (apply && activeCustomerRef) {
      const customers = readCustomers();
      const id = toStr(activeCustomerRef.id ?? activeCustomerRef.customerId ?? activeCustomerRef._id ?? "");
      const idx = customers.findIndex((c) => toStr(c.id ?? c.customerId ?? c._id ?? "") === id);
      if (idx >= 0) {
        setFavBrands(customers[idx], Array.from(draftSelected));
        writeCustomers(customers);
        // refresh UI
        renderFavoritesPanel(customers[idx]);
      }
    }

    sheetBackdrop.style.display = "none";
    sheet.style.display = "none";
    sheetSearch.value = "";
    sheetList.innerHTML = "";
    activeCustomerRef = null;
    draftSelected = new Set();
  }

  function openBrandSheet(customer) {
    ensureSheet();
    activeCustomerRef = customer;

    draftSelected = new Set(getFavBrands(customer));
    renderSheetList("");
    openSheet();
  }

  function renderSheetList(q) {
    const nq = normalizeForSearch(q);

    const rows = BRAND_MASTER
      .filter((b) => {
        if (!nq) return true;
        const nb = normalizeForSearch(b);
        return nb.includes(nq);
      })
      .map((b) => {
        const checked = draftSelected.has(b) ? "checked" : "";
        const icon = brandIconPath(b);
        return `
          <label class="lc-brand-row">
            <input class="lc-brand-check" type="checkbox" data-brand="${escapeAttr(b)}" ${checked} />
            <img src="${escapeAttr(icon)}" alt="" style="width:26px;height:26px;border-radius:8px;"
              onerror="this.style.display='none';" />
            <div style="font-weight:700;font-size:18px;">${escapeHTML(b)}</div>
          </label>
        `;
      })
      .join("");

    sheetList.innerHTML = rows || `<div class="empty-line">No matches</div>`;

    // wire checkboxes
    sheetList.querySelectorAll('input[type="checkbox"][data-brand]').forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const brand = e.target.getAttribute("data-brand");
        if (!brand) return;
        if (e.target.checked) draftSelected.add(brand);
        else draftSelected.delete(brand);
      });
    });
  }

  // ---------- edit mode ----------
  let editing = false;
  let currentCustomer = null;

  function enterEdit() {
    editing = true;
    editBtn.textContent = "DONE";
    renderHeader(currentCustomer, true);
    renderContactPanel(currentCustomer, true);
    // keep on Contact tab
    showTab("contact");
  }

  function exitEditAndSave() {
    // pull from fields
    const fFirst = document.getElementById("fFirst");
    const fLast = document.getElementById("fLast");
    const fPhone = document.getElementById("fPhone");
    const fEmail = document.getElementById("fEmail");
    const fBirthday = document.getElementById("fBirthday");
    const fCigarSocial = document.getElementById("fCigarSocial");
    const fAddr1 = document.getElementById("fAddr1");
    const fAddr2 = document.getElementById("fAddr2");

    const customers = readCustomers();
    const id = toStr(currentCustomer.id ?? currentCustomer.customerId ?? currentCustomer._id ?? "");
    const idx = customers.findIndex((c) => toStr(c.id ?? c.customerId ?? c._id ?? "") === id);

    if (idx >= 0) {
      const c = customers[idx];

      c.firstName = toStr(fFirst?.value);
      c.lastName = toStr(fLast?.value);

      c.phone = toStr(fPhone?.value);
      c.email = toStr(fEmail?.value);

      c.birthday = toStr(fBirthday?.value);
      c.cigarSocial = toStr(fCigarSocial?.value);

      const joinedAddr = joinAddressTwoLines(toStr(fAddr1?.value), toStr(fAddr2?.value));
      c.address = joinedAddr;

      // quick note
      c.note = toStr(noteEl.value);

      customers[idx] = c;
      writeCustomers(customers);

      currentCustomer = c;
    }

    editing = false;
    editBtn.textContent = "EDIT";
    renderHeader(currentCustomer, false);
    renderContactPanel(currentCustomer, false);
    showTab("contact");
  }

  // ---------- init ----------
  function findCustomerById(customers, id) {
    if (!id) return null;
    return customers.find((c) => {
      const cid = toStr(c.id ?? c.customerId ?? c._id ?? c.contactId ?? "");
      return cid === id;
    }) || null;
  }

  function bindTabs() {
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (editing) return; // keep stable while editing
        showTab(btn.dataset.tab);
      });
    });
  }

  function init() {
    backBtn?.addEventListener("click", () => history.back());

    const id = getParam("id");
    const customers = readCustomers();
    const customer = findCustomerById(customers, id);

    if (!customer) {
      // Don’t blank: show a readable message
      nameEl.textContent = "Contact not found";
      panelHistory.innerHTML = `<a class="lc-mutedlink" href="/loyalty/">Back to Loyalty</a>`;
      panelContact.innerHTML = `<div class="empty-line">Missing or invalid contact id.</div>`;
      panelFavorites.innerHTML = `<div class="empty-line">—</div>`;
      showTab("contact");
      bindTabs();
      return;
    }

    currentCustomer = customer;

    // Tabs (Contact first)
    bindTabs();
    showTab("contact");

    // Render
    renderHeader(currentCustomer, false);
    renderContactPanel(currentCustomer, false);
    renderHistoryPanel(currentCustomer);
    renderFavoritesPanel(currentCustomer);

    // Edit toggle
    editBtn?.addEventListener("click", () => {
      if (!currentCustomer) return;
      if (!editing) enterEdit();
      else exitEditAndSave();
    });
  }

  // Always initialize
  try {
    init();
  } catch (err) {
    // fail-safe so it never looks "blank"
    console.error("contact.js init failed:", err);
    nameEl.textContent = "Contact error";
    panelContact.innerHTML = `<div class="empty-line">JS error — check console.</div>`;
    showTab("contact");
  }
})();
