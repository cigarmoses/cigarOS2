/* /loyalty/contact.js
   - Folder tabs + stretched content panel
   - Quick note placeholder behavior
   - Contact tab:
      ✅ Uses new black contact icons in /img/icons/*.svg
      ✅ Address = 2 lines (view) + 2 fields (edit)
      ✅ NO extra icon below address (address is ONE row)
      ✅ Removes role row entirely (prevents “locker” row)
      ✅ Cigar Social icon:
         - Uses /img/icons/cigarsocial.svg
         - Falls back to /img/icons/blackprofile.svg
         - Never shows the blue broken-image “?” (auto-hides on failure)
   - Favorites:
      ✅ Adds "Add / Edit" favorite brands link (iOS blue)
      ✅ Opens bottom sheet brand picker:
         checkbox LEFT, brand icon MIDDLE, brand name RIGHT
      ✅ Saves selected brands back to customer as:
         "Fav brand 1", "Fav brand 2", ... (and clears old extras)
*/

(() => {
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

  // ---- BRAND MASTER LIST (the list you provided, including Sinistro) ----
  // Used for the brand picker.
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

  // Contact info icons
  const CONTACT_ICON_BASE = "/img/icons/";
  const CONTACT_ICONS = {
    phone: `${CONTACT_ICON_BASE}blackphone.svg`,
    email: `${CONTACT_ICON_BASE}blackemail.svg`,
    address: `${CONTACT_ICON_BASE}blackaddress.svg`,
    birthday: `${CONTACT_ICON_BASE}blackbirthday.svg`,
    cigarsocial_primary: `/img/icons/cigarsocial.svg`,
    cigarsocial_fallback: `${CONTACT_ICON_BASE}blackprofile.svg`,
  };

  const $ = (sel) => document.querySelector(sel);

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

  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const toStr = (v) => (v == null ? "" : String(v)).trim();

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
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

  function isTruthyMarker(v, columnTitle) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    const s = String(v).trim().toLowerCase();
    if (!s) return false;
    if (s === "0" || s === "no" || s === "false" || s === "n") return false;
    if (s === "x" || s === "y" || s === "1" || s === "yes" || s === "true") return true;
    if (/^\d+(\.\d+)?$/.test(s)) return true;

    const col = String(columnTitle || "").trim().toLowerCase();
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
    const s = String(v).trim().toLowerCase();
    return s === "x";
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

  function formatPhone(raw) {
    const d = String(raw || "").replace(/\D+/g, "");
    if (!d) return "";
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === "1") return `${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`;
    return raw;
  }

  function normalizePhoneToDigits(raw) {
    return String(raw || "").replace(/\D+/g, "");
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
    if (hasColumnValue(c, "Paramedic")) roleIcons.push("paramedic");
    if (hasColumnValue(c, "Firefighter")) roleIcons.push("firefighter");
    if (hasColumnValue(c, "Police")) roleIcons.push("police");

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

  function money(n) {
    const x = Number(n || 0);
    return `$${x.toFixed(2)}`;
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

  function iconIMG(src, alt, fallbackSrc) {
    const safeAlt = escapeAttr(alt || "");
    const safeSrc = escapeAttr(src || "");
    const safeFallback = fallbackSrc ? escapeAttr(fallbackSrc) : "";

    if (!safeFallback) {
      return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy"
        onerror="this.style.display='none';">`;
    }

    return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy"
      onerror="if(!this.dataset.fbk){this.dataset.fbk='1';this.src='${safeFallback}';}else{this.style.display='none';}">`;
  }

  function renderContact(customer, editing) {
    const dash = "-";

    const phoneRaw = toStr(customer.phone);
    const phoneShown = editing ? phoneRaw : formatPhone(phoneRaw);
    const email = toStr(customer.email);

    const addrRaw = getAddressRaw(customer);
    const addr = splitAddressTwoLines(addrRaw);

    const cigarSocial = getCigarSocial(customer);
    const bday = getBirthdayText(customer);

    const vPhone = phoneShown || dash;
    const vEmail = email || dash;
    const vBday = bday || dash;
    const vCS = cigarSocial || dash;

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
          <input class="lc-field" id="fAddr1" value="${escapeAttr(addr.line1)}" placeholder="143 Beram Ave">
          <input class="lc-field" id="fAddr2" value="${escapeAttr(addr.line2)}" placeholder="Bridgeville, PA 15017">
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

  // ----- Favorite Brands Editor (bottom sheet) -----
  let brandSheet = null;
  let brandBackdrop = null;
  let brandSearch = null;
  let brandListEl = null;
  let brandDoneBtn = null;
  let brandCloseBtn = null;

  let brandDraftSelected = new Set();

  function ensureBrandSheet() {
    if (brandSheet) return;

    brandBackdrop = document.createElement("div");
    brandBackdrop.className = "lc-sheet-backdrop";
    brandBackdrop.style.display = "none";

    brandSheet = document.createElement("div");
    brandSheet.className = "lc-sheet";
    brandSheet.style.display = "none";

    brandSheet.innerHTML = `
      <div class="lc-sheet-head">
        <button type="button" class="lc-sheet-x" aria-label="Close">Cancel</button>
        <div class="lc-sheet-title">Favorite Brands</div>
        <button type="button" class="lc-sheet-done" aria-label="Done">Done</button>
      </div>

      <div class="lc-sheet-search">
        <input type="search" class="lc-sheet-input" placeholder="Search brands" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" />
      </div>

      <div class="lc-sheet-list" role="list"></div>
    `;

    document.body.appendChild(brandBackdrop);
    document.body.appendChild(brandSheet);

    // Prevent taps inside the sheet from bubbling to the backdrop
    brandSheet.addEventListener("click", (e) => e.stopPropagation());

    brandSearch = brandSheet.querySelector(".lc-sheet-input");
    brandListEl = brandSheet.querySelector(".lc-sheet-list");
    brandDoneBtn = brandSheet.querySelector(".lc-sheet-done");
    brandCloseBtn = brandSheet.querySelector(".lc-sheet-x");

    const close = () => closeBrandSheet(false);

    brandBackdrop.addEventListener("click", close);
    brandCloseBtn.addEventListener("click", close);

    brandDoneBtn.addEventListener("click", () => closeBrandSheet(true));

    brandSearch.addEventListener("input", () => {
      renderBrandSheetList(brandSearch.value || "");
    });
  }

  // ... remainder of your file unchanged except:
  // - nameEl editing class toggles
  // - default tab is Contact on init
  // (Zip contains the complete file.)
})();
