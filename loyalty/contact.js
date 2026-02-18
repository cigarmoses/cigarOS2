/* /loyalty/contact.js
   - Folder tabs + stretched content panel
   - Quick note placeholder behavior
   - Contact tab:
      ✅ Uses new black contact icons in /img/icons/*.svg
      ✅ Address = 2 lines (view) + 2 fields (edit)
      ✅ NO extra icon below address (address is ONE row)
      ✅ Removes role row entirely (prevents “locker” row)
      ✅ Cigar Social icon:
         - Tries /img/icon/cigarsocial.svg first (per your note)
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
    // Try user-requested path first, then fallback (and never show broken-image ?)
    cigarsocial_primary: `/img/icon/cigarsocial.svg`,
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
    // never show broken icon placeholder
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

  // ---- Favorites parsing from JSON-style columns ----
  function keyIsFavBrand(k) {
    const s = String(k || "").trim().toLowerCase();
    return s.startsWith("fav brand");
  }
  function keyIsFavCigar(k) {
    const s = String(k || "").trim().toLowerCase();
    return s.startsWith("fav cigar");
  }
  function keyIsFavCigarId(k) {
    const s = String(k || "").trim().toLowerCase();
    return s.startsWith("fav cigar id");
  }
  function numFromKey(k) {
    const m = String(k || "").match(/(\d+)/);
    return m ? Number(m[1]) : 1;
  }

  function getFavBrandsFromColumns(c) {
    const pairs = Object.keys(c || {})
      .filter(keyIsFavBrand)
      .map((k) => ({ k, n: numFromKey(k), v: toStr(c[k]) }))
      .filter((x) => x.v);

    pairs.sort((a, b) => a.n - b.n);
    return pairs.map((x) => x.v);
  }

  function setFavBrandsToColumns(c, brands) {
    // clear existing Fav brand N keys
    Object.keys(c || {}).forEach((k) => {
      if (keyIsFavBrand(k)) delete c[k];
    });

    // write new keys: Fav brand 1..N
    (brands || []).forEach((b, idx) => {
      c[`Fav brand ${idx + 1}`] = String(b || "").trim();
    });
  }

  function getFavCigarsFromColumns(c) {
    const pairs = Object.keys(c || {})
      .filter(keyIsFavCigar)
      .map((k) => ({ k, n: numFromKey(k), v: toStr(c[k]) }))
      .filter((x) => x.v);

    pairs.sort((a, b) => a.n - b.n);
    return pairs.map((x) => x.v);
  }

  function getFavCigarIdsFromColumns(c) {
    const pairs = Object.keys(c || {})
      .filter(keyIsFavCigarId)
      .map((k) => ({ k, n: numFromKey(k), v: toStr(c[k]) }))
      .filter((x) => x.v);

    pairs.sort((a, b) => a.n - b.n);
    return pairs.map((x) => x.v);
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function brandIconPath(brandName) {
    const slug = slugify(brandName).replace(/-/g, "");
    return `${BRAND_ICON_BASE}${slug}.svg`;
  }

  function cigarDetailHref(displayName, cigarIdMaybe) {
    const cigarId = toStr(cigarIdMaybe);
    if (cigarId) return `/cigars/cigar?id=${encodeURIComponent(cigarId)}`;
    const raw = toStr(displayName);
    return raw ? `/pos/cigars/?q=${encodeURIComponent(raw)}` : "/pos/cigars/";
  }

  // ---------- panels ----------
  function renderHistory(customer, sales) {
    const cid = String(customer.id);
    const phone = toStr(customer.phone);
    const email = toStr(customer.email).toLowerCase();

    const matches = (sales || []).filter((s) => {
      const sid = toStr(s.customerId ?? s.contactId ?? s.customer_id);
      if (sid && String(sid) === cid) return true;

      const sPhone = toStr(s.phone ?? s.customerPhone ?? s.customer_phone);
      const sEmail = toStr(s.email ?? s.customerEmail ?? s.customer_email).toLowerCase();

      if (phone && sPhone && phone === sPhone) return true;
      if (email && sEmail && email === sEmail) return true;

      return false;
    });

    if (!matches.length) {
      panelHistory.innerHTML = `
        <div class="lc-row">
          <div class="left" style="color:#8e8e93;">No transactions yet</div>
        </div>
      `;
      return;
    }

    matches.sort((a, b) => {
      const da = new Date(a.date ?? a.createdAt ?? a.timestamp ?? 0).getTime() || 0;
      const db = new Date(b.date ?? b.createdAt ?? b.timestamp ?? 0).getTime() || 0;
      return db - da;
    });

    const rows = matches.slice(0, 25).map((s) => {
      const dt = new Date(s.date ?? s.createdAt ?? s.timestamp ?? Date.now());
      const label = dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });

      const total = Number(s.total ?? s.amount ?? s.grandTotal ?? 0) || 0;

      const pdfUrl =
        toStr(s.pdfUrl ?? s.pdfURL ?? s.invoicePdf ?? s.invoicePdfUrl ?? s.receiptPdfUrl ?? "");

      const viewHTML = pdfUrl
        ? `<a href="${pdfUrl}" target="_blank" rel="noopener">view</a>`
        : `<a href="javascript:void(0)" style="opacity:.35; pointer-events:none;">view</a>`;

      return `
        <div class="lc-row">
          <div class="left">${label}</div>
          <div class="mid">${money(total)}</div>
          <div class="right">${viewHTML}</div>
        </div>
      `;
    }).join("");

    panelHistory.innerHTML = `
      ${rows}
      <a class="lc-mutedlink" href="javascript:void(0)">view all transactions</a>
    `;
  }

  function getAddressRaw(c) {
    return toStr(c.address ?? c.Address ?? c["Address"] ?? "");
  }

  // Split address into 2 lines (view/edit)
  function splitAddressTwoLines(raw) {
    const s = toStr(raw);
    if (!s) return { line1: "", line2: "" };

    if (s.includes("\n")) {
      const parts = s.split("\n").map((x) => x.trim()).filter(Boolean);
      return { line1: parts[0] || "", line2: parts.slice(1).join(" ") || "" };
    }

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
    // Build an <img> that never shows the blue broken image placeholder
    // and can swap to a fallback src once.
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
    const phoneShown = editing ? toStr(customer.phone) : formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);

    const addrRaw = getAddressRaw(customer);
    const addr = splitAddressTwoLines(addrRaw);

    const cigarSocial = getCigarSocial(customer);
    const bday = getBirthdayText(customer);

    // Address is ONE row: one icon, one value block containing both lines.
    const addressHTML = editing
      ? `
        <div class="v v-addr">
          <div class="lc-addr-edit">
            <input class="lc-field" id="fAddr1" value="${escapeAttr(addr.line1)}" placeholder="143 Beram Ave">
            <input class="lc-field" id="fAddr2" value="${escapeAttr(addr.line2)}" placeholder="Bridgeville, PA 15017">
          </div>
        </div>
      `
      : `
        <div class="v v-addr">
          <div class="lc-lines">
            <div class="lc-line1">${escapeHTML(addr.line1 || "—")}</div>
            ${addr.line2 ? `<div class="lc-line2">${escapeHTML(addr.line2)}</div>` : ""}
          </div>
        </div>
      `;

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="ico">${iconIMG(CONTACT_ICONS.phone, "Phone")}</div>
        <div class="v">
          <input class="lc-field" id="fPhone" value="${escapeAttr(phoneShown)}" ${editing ? "" : "readonly"} placeholder="412-555-1212">
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.email, "Email")}</div>
        <div class="v">
          <input class="lc-field" id="fEmail" value="${escapeAttr(email)}" ${editing ? "" : "readonly"} placeholder="name@email.com">
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.address, "Address")}</div>
        ${addressHTML}

        <div class="ico">${iconIMG(CONTACT_ICONS.birthday, "Birthday")}</div>
        <div class="v">
          <input class="lc-field" id="fBirthday" value="${escapeAttr(bday)}" ${editing ? "" : "readonly"} placeholder="August 15">
        </div>

        <div class="ico">${iconIMG(CONTACT_ICONS.cigarsocial_primary, "Cigar Social", CONTACT_ICONS.cigarsocial_fallback)}</div>
        <div class="v">
          <input class="lc-field" id="fCigarSocial" value="${escapeAttr(cigarSocial)}" ${editing ? "" : "readonly"} placeholder="@username">
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
        <input type="search" class="lc-sheet-input" placeholder="Search brands" autocomplete="off" />
      </div>

      <div class="lc-sheet-list" role="list"></div>
    `;

    document.body.appendChild(brandBackdrop);
    document.body.appendChild(brandSheet);

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

  function openBrandSheet(customer) {
    ensureBrandSheet();

    // seed selection from current customer favorites
    const current = getFavBrandsFromColumns(customer);
    brandDraftSelected = new Set(current.map((x) => String(x).trim()).filter(Boolean));

    brandSearch.value = "";
    renderBrandSheetList("");

    brandBackdrop.style.display = "block";
    brandSheet.style.display = "block";

    // iOS-ish: focus after animation
    setTimeout(() => brandSearch.focus(), 50);
    document.body.style.overflow = "hidden";
  }

  function closeBrandSheet(apply) {
    brandBackdrop.style.display = "none";
    brandSheet.style.display = "none";
    document.body.style.overflow = "";

    if (!apply) return;

    const customers = readCustomers();
    const idx = customers.findIndex((c) => String(c.id) === String(activeCustomerId));
    if (idx === -1) return;

    const c = customers[idx];
    const next = Array.from(brandDraftSelected).filter(Boolean);

    // Keep order consistent with BRAND_MASTER (so it’s predictable)
    const masterIndex = new Map(BRAND_MASTER.map((b, i) => [b, i]));
    next.sort((a, b) => (masterIndex.get(a) ?? 999999) - (masterIndex.get(b) ?? 999999));

    setFavBrandsToColumns(c, next);

    c.updatedAt = new Date().toISOString();
    customers[idx] = c;
    writeCustomers(customers);

    renderFavorites(c);
  }

  function renderBrandSheetList(query) {
    const q = String(query || "").trim().toLowerCase();

    const visible = BRAND_MASTER.filter((b) => {
      if (!q) return true;
      return String(b).toLowerCase().includes(q);
    });

    brandListEl.innerHTML = visible.map((name) => {
      const checked = brandDraftSelected.has(name);
      const icon = brandIconPath(name);

      // checkbox LEFT, icon MIDDLE, name RIGHT
      return `
        <label class="lc-brand-row" role="listitem">
          <input class="lc-brand-check" type="checkbox" ${checked ? "checked" : ""} data-brand="${escapeAttr(name)}">
          <img class="lc-brand-ico" src="${escapeAttr(icon)}" alt="${escapeAttr(name)}"
               loading="lazy"
               onerror="this.style.visibility='hidden';">
          <span class="lc-brand-name">${escapeHTML(name)}</span>
        </label>
      `;
    }).join("");

    brandListEl.querySelectorAll(".lc-brand-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const b = cb.getAttribute("data-brand");
        if (!b) return;
        if (cb.checked) brandDraftSelected.add(b);
        else brandDraftSelected.delete(b);
      });
    });
  }

  function renderFavorites(customer) {
    const brands = getFavBrandsFromColumns(customer);
    const cigars = getFavCigarsFromColumns(customer);
    const cigarIds = getFavCigarIdsFromColumns(customer);

    const brandIconsHTML = brands.length
      ? `<div class="brand-icons">
          ${brands.map((b) => `
            <img src="${brandIconPath(b)}" alt="${escapeAttr(b)}" title="${escapeAttr(b)}" loading="lazy"
                 onerror="this.style.display='none';" />
          `).join("")}
        </div>`
      : `<div class="empty-line">No favorite brands yet</div>`;

    const cigarPillsHTML = cigars.length
      ? `<div class="pills">
          ${cigars.map((label, i) => `
            <a class="pill" href="${cigarDetailHref(label, cigarIds[i])}">${escapeHTML(label)}</a>
          `).join("")}
        </div>`
      : `<div class="empty-line">No favorite cigars yet</div>`;

    // Add/Edit link is always visible, iOS blue, opens brand sheet
    panelFavorites.innerHTML = `
      <div class="section-head">
        <div class="section-title">Brands</div>
        <a class="section-link" href="javascript:void(0)" id="favBrandsEditLink">Add / Edit</a>
      </div>
      ${brandIconsHTML}

      <div class="section-title" style="margin-top:14px;">Cigars</div>
      ${cigarPillsHTML}
    `;

    const link = document.getElementById("favBrandsEditLink");
    if (link) {
      link.addEventListener("click", () => {
        // open selector for currently active customer
        openBrandSheet(customer);
      });
    }
  }

  // ---------- edit mode ----------
  let editMode = false;
  let activeCustomerId = null;

  function nickname(c) {
    return toStr(c.nickname ?? c.nick ?? "");
  }

  function makeHeaderEditable(c) {
    const first = toStr(c.firstName);
    const last = toStr(c.lastName);

    nameEl.innerHTML = `
      <input class="lc-field" id="fFirst" value="${escapeAttr(first)}" placeholder="First" />
      <span style="display:inline-block;width:8px;"></span>
      <input class="lc-field" id="fLast" value="${escapeAttr(last)}" placeholder="Last" />
    `;

    const nick = nickname(c);
    akaEl.style.display = "";
    akaEl.innerHTML = `
      <span style="color:#8e8e93;font-weight:600;">aka </span>
      <input class="lc-field" id="fNick" value="${escapeAttr(nick)}" placeholder="Nickname" />
    `;
  }

  function teardownHeaderEditable(c) {
    const first = toStr(c.firstName);
    const last = toStr(c.lastName);
    nameEl.textContent = `${first} ${last}`.trim() || "—";

    const nick = nickname(c);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }
  }

  function setNoteValue(c) {
    noteEl.value = toStr(c.note);
    noteEl.readOnly = !editMode;
  }

  function setEditMode(on) {
    editMode = !!on;
    editBtn.textContent = editMode ? "DONE" : "EDIT";

    const customers = readCustomers();
    const c = customers.find((x) => String(x.id) === String(activeCustomerId));
    if (!c) return;

    setNoteValue(c);
    renderContact(c, editMode);
    renderFavorites(c);

    if (editMode) makeHeaderEditable(c);
    else teardownHeaderEditable(c);
  }

  function saveEdits() {
    const customers = readCustomers();
    const idx = customers.findIndex((c) => String(c.id) === String(activeCustomerId));
    if (idx === -1) return;

    const c = customers[idx];

    const fFirst = document.getElementById("fFirst");
    const fLast = document.getElementById("fLast");
    const fNick = document.getElementById("fNick");

    if (fFirst) c.firstName = toStr(fFirst.value);
    if (fLast) c.lastName = toStr(fLast.value);
    if (fNick) c.nickname = toStr(fNick.value);

    c.note = toStr(noteEl.value);

    const fPhone = document.getElementById("fPhone");
    const fEmail = document.getElementById("fEmail");
    const fCigarSocial = document.getElementById("fCigarSocial");
    const fBirthday = document.getElementById("fBirthday");

    const fAddr1 = document.getElementById("fAddr1");
    const fAddr2 = document.getElementById("fAddr2");

    if (fPhone) c.phone = normalizePhoneToDigits(fPhone.value) || toStr(fPhone.value);
    if (fEmail) c.email = toStr(fEmail.value);

    if (fAddr1 || fAddr2) {
      c.address = joinAddressTwoLines(fAddr1?.value, fAddr2?.value);
    }

    if (fCigarSocial) c.cigarSocial = toStr(fCigarSocial.value);
    if (fBirthday) c.birthday = toStr(fBirthday.value);

    c.updatedAt = new Date().toISOString();

    customers[idx] = c;
    writeCustomers(customers);

    renderIcons(c);
    teardownHeaderEditable(c);
    setNoteValue(c);
    renderContact(c, false);
    renderFavorites(c);
  }

  // ---------- init ----------
  function init() {
    backBtn?.addEventListener("click", () => history.back());

    activeCustomerId = getParam("id");

    const customers = readCustomers();
    const customer = customers.find((c) => String(c.id) === String(activeCustomerId));

    if (!customer) {
      nameEl.textContent = "Not found";
      panelHistory.innerHTML = `<div class="lc-row"><div class="left" style="color:#8e8e93;">Customer not found</div></div>`;
      return;
    }

    teardownHeaderEditable(customer);

    const nick = nickname(customer);
    if (nick) {
      akaEl.style.display = "";
      akaEl.textContent = `aka ${nick}`;
    } else {
      akaEl.style.display = "none";
      akaEl.textContent = "";
    }

    editMode = false;
    setNoteValue(customer);

    renderIcons(customer);

    tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

    showTab("history");

    const sales = readSales();
    renderHistory(customer, sales);
    renderContact(customer, false);
    renderFavorites(customer);

    editBtn.textContent = "EDIT";
    editBtn?.addEventListener("click", () => {
      if (!editMode) return setEditMode(true);
      saveEdits();
      setEditMode(false);
    });
  }

  init();
})();
