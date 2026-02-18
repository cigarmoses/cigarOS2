/* /loyalty/contact.js
   - Folder tabs + stretched content panel
   - Quick note placeholder behavior
   - Contact tab:
      ✅ Uses new black contact icons in /img/icons/*.svg
      ✅ Address = 2 lines (view) + 2 fields (edit)
      ✅ NO extra icon below address (address is ONE row)
      ✅ Removes role row entirely (prevents “locker” row)
      ✅ Cigar Social icon uses /img/icons/cigarsocial.svg
   - Favorites:
      ✅ Brands section now supports Edit/Add via iOS bottom-sheet picker
         - Loads from /data/brands.json
         - UI: checkbox (left) + brand icon (middle) + name (right)
         - Saves to customer.favoriteBrands (array)
      ✅ Cigars pills kept as-is for now
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  const BRAND_ICON_BASE = "/img/icons/brands/"; // plural
  const BRANDS_JSON_URL = "/data/brands.json";

  const ICON_BASE = "/img/icons/loyalty/";
  const ICONS = {
    military: `${ICON_BASE}military.svg`,
    paramedic: `${ICON_BASE}paramedic.svg`,
    firefighter: `${ICON_BASE}firefighter.svg`,
    police: `${ICON_BASE}police.svg`,
    locker: `${ICON_BASE}locker.svg`,
    regular: `${ICON_BASE}regular.svg`,
  };

  // Contact info icons (uploaded)
  const CONTACT_ICON_BASE = "/img/icons/";
  const CONTACT_ICONS = {
    phone: `${CONTACT_ICON_BASE}blackphone.svg`,
    email: `${CONTACT_ICON_BASE}blackemail.svg`,
    address: `${CONTACT_ICON_BASE}blackaddress.svg`,
    birthday: `${CONTACT_ICON_BASE}blackbirthday.svg`,
    cigarsocial: `${CONTACT_ICON_BASE}cigarsocial.svg`, // ✅ requested
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

  // In-memory cache
  let BRANDS_CACHE = null;

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

  // ---- Favorites parsing from legacy JSON-style columns ----
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

  // ---------- history ----------
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

  // ---------- contact tab ----------
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

  function iconIMG(src, alt) {
    return `<img src="${src}" alt="${escapeAttr(alt || "")}" loading="lazy">`;
  }

  function renderContact(customer, editing) {
    const phoneShown = editing ? toStr(customer.phone) : formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);

    const addrRaw = getAddressRaw(customer);
    const addr = splitAddressTwoLines(addrRaw);

    const cigarSocial = getCigarSocial(customer);
    const bday = getBirthdayText(customer);

    // ✅ Address is ONE row: one icon, one value block containing both lines.
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

        <div class="ico">${iconIMG(CONTACT_ICONS.cigarsocial, "Cigar Social")}</div>
        <div class="v">
          <input class="lc-field" id="fCigarSocial" value="${escapeAttr(cigarSocial)}" ${editing ? "" : "readonly"} placeholder="@username">
        </div>
      </div>
    `;
  }

  // ---------- Favorite Brands: new array + legacy fallback ----------
  function getFavoriteBrands(customer) {
    const arr = customer?.favoriteBrands;
    if (Array.isArray(arr) && arr.length) {
      return arr.map(toStr).filter(Boolean);
    }
    // fallback legacy
    return getFavBrandsFromColumns(customer);
  }

  function setFavoriteBrands(customer, brands) {
    const clean = (brands || [])
      .map(toStr)
      .filter(Boolean);

    // de-dupe, preserve order
    const seen = new Set();
    const deduped = [];
    clean.forEach((b) => {
      const key = b.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(b);
    });

    customer.favoriteBrands = deduped;
  }

  // ---------- Favorites tab ----------
  function renderFavorites(customer) {
    const brands = getFavoriteBrands(customer);
    const cigars = getFavCigarsFromColumns(customer);
    const cigarIds = getFavCigarIdsFromColumns(customer);

    const hasBrands = brands.length > 0;
    const brandsActionLabel = hasBrands ? "Edit" : "Add";

    const brandsHeaderHTML = `
      <div class="lc-fav-head">
        <div class="section-title lc-fav-title">Brands</div>
        <button class="lc-fav-link" type="button" id="lcEditBrands">${brandsActionLabel}</button>
      </div>
    `;

    const brandIconsHTML = hasBrands
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

    panelFavorites.innerHTML = `
      ${brandsHeaderHTML}
      ${brandIconsHTML}
      <div class="section-title">Cigars</div>
      ${cigarPillsHTML}
    `;

    // wire action
    const btn = document.getElementById("lcEditBrands");
    btn?.addEventListener("click", () => openBrandsSheet(customer));
  }

  // ---------- Brand picker bottom sheet ----------
  function injectBrandSheetStylesOnce() {
    if (document.getElementById("lcBrandSheetStyles")) return;
    const style = document.createElement("style");
    style.id = "lcBrandSheetStyles";
    style.textContent = `
      /* Favorites brands header row */
      .lc-fav-head{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap: 12px;
      }
      .lc-fav-title{ padding-bottom: 8px; }
      .lc-fav-link{
        border:0;
        background:transparent;
        color:#007aff;
        font-size: 18px;
        font-weight: 500; /* regular/medium */
        padding: 16px 16px 8px;
        -webkit-tap-highlight-color: transparent;
      }

      /* Bottom sheet */
      .lc-sheet-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.28);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        display:flex;
        align-items:flex-end;
        justify-content:center;
        z-index: 9999;
      }
      .lc-sheet{
        width: min(520px, 100vw);
        background: #fff;
        border-radius: 18px 18px 0 0;
        box-shadow: 0 -18px 60px rgba(0,0,0,.18);
        overflow:hidden;
        padding-bottom: calc(10px + env(safe-area-inset-bottom));
      }
      .lc-sheet-top{
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(60,60,67,.12);
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
      }
      .lc-sheet-title{
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, Arial, sans-serif;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.2px;
      }
      .lc-sheet-btn{
        border:0;
        background:transparent;
        color:#007aff;
        font-size: 16px;
        font-weight: 600;
        padding: 8px 6px;
        -webkit-tap-highlight-color: transparent;
      }
      .lc-sheet-btn.muted{
        color: rgba(60,60,67,.65);
        font-weight: 600;
      }
      .lc-sheet-search{
        padding: 10px 14px 12px;
        border-bottom: 1px solid rgba(60,60,67,.12);
      }
      .lc-sheet-search input{
        width:100%;
        border:0;
        outline:none;
        border-radius: 12px;
        background: #f2f2f7;
        padding: 10px 12px;
        font-size: 16px;
        font-weight: 500;
      }
      .lc-sheet-list{
        max-height: min(62vh, 520px);
        overflow:auto;
        -webkit-overflow-scrolling: touch;
      }
      .lc-brand-row{
        display:flex;
        align-items:center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(60,60,67,.12);
      }
      .lc-brand-row:last-child{ border-bottom: none; }
      .lc-brand-check{
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 1.5px solid rgba(60,60,67,.35);
        display:grid;
        place-items:center;
        flex: 0 0 auto;
      }
      .lc-brand-check.on{
        background: #007aff;
        border-color: #007aff;
      }
      .lc-brand-check svg{
        width: 16px;
        height: 16px;
        fill:none;
        stroke:#fff;
        stroke-width: 2.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
      }
      .lc-brand-check.on svg{ opacity: 1; }
      .lc-brand-icon{
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 0 0 1px rgba(0,0,0,.06);
        padding: 4px;
        flex: 0 0 auto;
        object-fit: contain;
      }
      .lc-brand-name{
        flex:1;
        min-width:0;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, Arial, sans-serif;
        font-size: 17px;
        font-weight: 500; /* regular */
        color: #111;
        white-space: nowrap;
        overflow:hidden;
        text-overflow: ellipsis;
      }
      .lc-sheet-foot{
        padding: 10px 14px 12px;
        border-top: 1px solid rgba(60,60,67,.12);
        display:flex;
        justify-content:flex-end;
      }
      .lc-sheet-apply{
        border:0;
        border-radius: 12px;
        background: #007aff;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        padding: 10px 14px;
      }
    `;
    document.head.appendChild(style);
  }

  async function loadBrandsList() {
    if (Array.isArray(BRANDS_CACHE) && BRANDS_CACHE.length) return BRANDS_CACHE;

    try {
      const res = await fetch(BRANDS_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${BRANDS_JSON_URL} failed: ${res.status}`);
      const data = await res.json();

      const list = Array.isArray(data) ? data : (Array.isArray(data?.brands) ? data.brands : []);
      const cleaned = list.map(toStr).filter(Boolean);

      // de-dupe + sort A→Z
      const map = new Map();
      cleaned.forEach((b) => map.set(b.toLowerCase(), b));
      BRANDS_CACHE = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
      return BRANDS_CACHE;
    } catch (e) {
      console.warn("[Contact] Could not load /data/brands.json", e);
      BRANDS_CACHE = [];
      return BRANDS_CACHE;
    }
  }

  function openBrandsSheet(customer) {
    injectBrandSheetStylesOnce();

    const current = getFavoriteBrands(customer);
    const selected = new Set(current.map((x) => x.toLowerCase()));

    const backdrop = document.createElement("div");
    backdrop.className = "lc-sheet-backdrop";

    const sheet = document.createElement("div");
    sheet.className = "lc-sheet";
    sheet.innerHTML = `
      <div class="lc-sheet-top">
        <button class="lc-sheet-btn muted" type="button" id="lcBrandReset">Reset</button>
        <div class="lc-sheet-title">Favorite Brands</div>
        <button class="lc-sheet-btn" type="button" id="lcBrandDone">Done</button>
      </div>

      <div class="lc-sheet-search">
        <input id="lcBrandSearch" type="search" placeholder="Search brands" autocomplete="off" />
      </div>

      <div class="lc-sheet-list" id="lcBrandList">
        <div style="padding:14px;color:rgba(60,60,67,.65);font-weight:600;">Loading…</div>
      </div>

      <div class="lc-sheet-foot">
        <button class="lc-sheet-apply" type="button" id="lcBrandApply">Apply</button>
      </div>
    `;

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    const close = () => {
      if (backdrop?.parentNode) backdrop.parentNode.removeChild(backdrop);
    };

    // click outside to close (no save)
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });

    const listEl = sheet.querySelector("#lcBrandList");
    const searchEl = sheet.querySelector("#lcBrandSearch");
    const btnReset = sheet.querySelector("#lcBrandReset");
    const btnDone = sheet.querySelector("#lcBrandDone");
    const btnApply = sheet.querySelector("#lcBrandApply");

    const checkSVG = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    `;

    const renderList = (brands, q) => {
      const query = toStr(q).toLowerCase();
      const filtered = query
        ? brands.filter((b) => b.toLowerCase().includes(query))
        : brands;

      if (!filtered.length) {
        listEl.innerHTML = `<div style="padding:14px;color:rgba(60,60,67,.65);font-weight:600;">No matches</div>`;
        return;
      }

      listEl.innerHTML = filtered.map((b) => {
        const key = b.toLowerCase();
        const on = selected.has(key);
        const icon = brandIconPath(b);
        return `
          <div class="lc-brand-row" role="button" tabindex="0" data-brand="${escapeAttr(b)}">
            <div class="lc-brand-check ${on ? "on" : ""}">${checkSVG}</div>
            <img class="lc-brand-icon" src="${escapeAttr(icon)}" alt="${escapeAttr(b)}"
                 onerror="this.style.display='none';" />
            <div class="lc-brand-name">${escapeHTML(b)}</div>
          </div>
        `;
      }).join("");

      listEl.querySelectorAll(".lc-brand-row").forEach((row) => {
        const b = row.getAttribute("data-brand") || "";
        const key = b.toLowerCase();
        const toggle = () => {
          if (!b) return;
          if (selected.has(key)) selected.delete(key);
          else selected.add(key);

          // flip UI
          const box = row.querySelector(".lc-brand-check");
          if (box) box.classList.toggle("on", selected.has(key));
        };

        row.addEventListener("click", toggle);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        });
      });
    };

    const applySave = () => {
      // Save to the active customer in storage
      const customers = readCustomers();
      const idx = customers.findIndex((c) => String(c.id) === String(activeCustomerId));
      if (idx === -1) return;

      const c = customers[idx];

      // Use original casing from master list if possible:
      const allBrands = Array.isArray(BRANDS_CACHE) ? BRANDS_CACHE : [];
      const pickedLower = Array.from(selected.values());

      const picked = pickedLower.map((lower) => {
        const found = allBrands.find((x) => x.toLowerCase() === lower);
        return found || lower;
      });

      setFavoriteBrands(c, picked);
      c.updatedAt = new Date().toISOString();

      customers[idx] = c;
      writeCustomers(customers);

      // re-render favorites tab (and keep user there)
      renderFavorites(c);

      close();
    };

    btnApply?.addEventListener("click", applySave);
    btnDone?.addEventListener("click", applySave);

    btnReset?.addEventListener("click", () => {
      selected.clear();
      // reset to none
      loadBrandsList().then((brands) => renderList(brands, searchEl?.value));
    });

    searchEl?.addEventListener("input", () => {
      loadBrandsList().then((brands) => renderList(brands, searchEl.value));
    });

    // initial load
    loadBrandsList().then((brands) => {
      renderList(brands, "");
      setTimeout(() => searchEl?.focus?.(), 50);
    });
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
