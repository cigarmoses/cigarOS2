/* /loyalty/contact.js
   - Folder tabs + stretched content panel
   - Quick note placeholder behavior
   - Contact values use icons (more width, no wrapping)
   - Favorites pulled from JSON-style columns:
       "Fav brand 1", "Fav brand 2", ...
       "Fav cigar", "Fav cigar 2", ...
   - Edit toggles unlock fields, Done saves to localStorage customers

   UPDATES:
   ✅ History tab shows true YTD spend (sum of sales/invoices in current year)
   ✅ Birthday pulled from column "Birthday" and displayed as "Month D" (e.g., August 15)
   ✅ Age calculated ONLY if Birthday includes a year
   ✅ Birthday + Age integrated into Contact grid properly
*/

(() => {
  const CUSTOMERS_KEY = "cigaros_customers_v1";
  const SALES_KEY = "cigaros_sales_v1";

  // Brand icons live here (per your repo convention)
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

  // Address helpers (2-line format)
  function normalizeSpaces(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function parseAddressParts(addressRaw) {
    const raw = normalizeSpaces(addressRaw);
    if (!raw) return { line1: "", line2: "" };

    if (raw.includes("\n")) {
      const parts = raw.split("\n").map((x) => normalizeSpaces(x)).filter(Boolean);
      return { line1: parts[0] || "", line2: parts.slice(1).join(" ") || "" };
    }

    const parts = raw.split(",").map((x) => normalizeSpaces(x)).filter(Boolean);
    if (parts.length >= 3) {
      return {
        line1: parts[0],
        line2: `${parts[1]}, ${parts.slice(2).join(", ")}`
      };
    }

    if (parts.length === 2) {
      return { line1: parts[0], line2: parts[1] };
    }

    return { line1: raw, line2: "" };
  }

  function joinAddressParts(line1Raw, line2Raw) {
    const line1 = normalizeSpaces(line1Raw);
    const line2 = normalizeSpaces(line2Raw);

    if (!line1 && !line2) return "";
    if (line1 && !line2) return line1;
    if (!line1 && line2) return line2;

    return `${line1}, ${line2}`;
  }

  // Birthday / Age helpers
  function parseBirthdayRaw(raw) {
    const s = normalizeSpaces(raw);
    if (!s) return { ok: false, month: null, day: null, year: null };

    // MM/DD or MM/DD/YYYY
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (mdy) {
      const mm = Number(mdy[1]);
      const dd = Number(mdy[2]);
      let yy = mdy[3] ? Number(mdy[3]) : null;
      if (yy != null && yy < 100) yy = 2000 + yy; // best-effort
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return { ok: true, month: mm, day: dd, year: yy };
      }
    }

    // Try Date parse (handles "August 15 1985", "Aug 15, 1985", ISO, etc.)
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const month = d.getMonth() + 1;
      const day = d.getDate();
      // Only trust year if the original string clearly included a year-like token
      const hasYearToken = /\b(19|20)\d{2}\b/.test(s);
      const year = hasYearToken ? d.getFullYear() : null;
      return { ok: true, month, day, year };
    }

    // Month name + day optionally year: "August 15" or "August 15 1985"
    const nameDayYear = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    if (nameDayYear) {
      const monthName = nameDayYear[1].toLowerCase();
      const day = Number(nameDayYear[2]);
      const year = nameDayYear[3] ? Number(nameDayYear[3]) : null;

      const months = {
        january:1, february:2, march:3, april:4, may:5, june:6,
        july:7, august:8, september:9, october:10, november:11, december:12,
        jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12
      };
      const month = months[monthName];
      if (month && day >= 1 && day <= 31) {
        return { ok: true, month, day, year };
      }
    }

    return { ok: false, month: null, day: null, year: null };
  }

  function formatMonthDay(month, day) {
    if (!month || !day) return "";
    const dt = new Date(2000, month - 1, day);
    return dt.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }

  function computeAgeFromYMD(year, month, day) {
    if (!year || !month || !day) return null;
    const now = new Date();
    let age = now.getFullYear() - year;
    const hasHadBirthdayThisYear =
      (now.getMonth() + 1 > month) ||
      (now.getMonth() + 1 === month && now.getDate() >= day);
    if (!hasHadBirthdayThisYear) age -= 1;
    return age >= 0 && age < 130 ? age : null;
  }

  // ✅ UPDATED: cigar pills try to route to the Brand page when brand is known,
  // otherwise fall back to global cigars search.
  function cigarDetailHref(displayNameRaw) {
    const raw = toStr(displayNameRaw);
    if (!raw) return "/pos/cigars/";

    let brand = "";
    let cigar = "";

    if (raw.includes("|")) {
      const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        brand = parts[0];
        cigar = parts.slice(1).join(" | ");
      }
    } else if (raw.includes(" - ")) {
      const parts = raw.split(" - ").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        brand = parts[0];
        cigar = parts.slice(1).join(" - ");
      }
    }

    if (brand && cigar) {
      return `/pos/cigars/brand?brand=${encodeURIComponent(brand)}&q=${encodeURIComponent(cigar)}`;
    }

    return `/pos/cigars/?q=${encodeURIComponent(raw)}`;
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

    // ✅ YTD total (current calendar year)
    const currentYear = new Date().getFullYear();
    const ytdTotal = matches
      .filter((s) => {
        const dt = new Date(s.date ?? s.createdAt ?? s.timestamp ?? 0);
        const t = dt.getTime();
        if (!t) return false;
        return dt.getFullYear() === currentYear;
      })
      .reduce((sum, s) => {
        const total = Number(s.total ?? s.amount ?? s.grandTotal ?? 0) || 0;
        return sum + total;
      }, 0);

    const ytdHTML = `
      <div class="lc-ytd">
        <div class="lc-ytd-label">YTD:</div>
        <div class="lc-ytd-value">${money(ytdTotal)}</div>
      </div>
    `;

    if (!matches.length) {
      panelHistory.innerHTML = `
        <div class="lc-row">
          <div class="left" style="color:#8e8e93;">No transactions yet</div>
        </div>
        ${ytdHTML}
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
      ${ytdHTML}
    `;
  }

  function iconSVG(type) {
    if (type === "phone") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L9.9 10.7a16 16 0 0 0 3.4 3.4l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z"></path>
      </svg>`;
    if (type === "mail") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v16H4z"></path>
        <path d="M4 6l8 6 8-6"></path>
      </svg>`;
    if (type === "pin") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11z"></path>
        <path d="M12 10.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"></path>
      </svg>`;
    if (type === "cake") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 21h16v-8a4 4 0 0 1-4 2 4 4 0 0 1-4-2 4 4 0 0 1-4 2 4 4 0 0 1-4-2v8z"></path>
        <path d="M4 13a4 4 0 0 0 4 2 4 4 0 0 0 4-2 4 4 0 0 0 4 2 4 4 0 0 0 4-2"></path>
        <path d="M7 10h10v3H7z"></path>
        <path d="M12 3c1.2 1 .9 2.2 0 3-1.1-.8-1.2-2 0-3z"></path>
      </svg>`;
    if (type === "calendar") return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3"></path>
        <path d="M17 3v3"></path>
        <path d="M4 7h16"></path>
        <path d="M5 5h14a1 1 0 0 1 1 1v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z"></path>
      </svg>`;
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 21a8 8 0 1 0-16 0"></path>
        <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"></path>
      </svg>`;
  }

  function getAddress(c) {
    return toStr(c.address ?? c.Address ?? c["Address"] ?? "");
  }
  function getCigarSocial(c) {
    return toStr(c.cigarSocial ?? c["Cigar Social"] ?? c["CigarSocial"] ?? "");
  }

  function getBirthdayRaw(c) {
    return toStr(c["Birthday"] ?? c.birthday ?? c.Birthday ?? "");
  }

  function renderContact(customer, editing) {
    const phoneShown = editing ? toStr(customer.phone) : formatPhone(toStr(customer.phone));
    const email = toStr(customer.email);

    const addressRaw = getAddress(customer);
    const addr = parseAddressParts(addressRaw);

    const cigarSocial = getCigarSocial(customer);

    // Birthday / Age
    const bdayRaw = getBirthdayRaw(customer);
    const b = parseBirthdayRaw(bdayRaw);
    const bdayDisplay = b.ok ? formatMonthDay(b.month, b.day) : (bdayRaw || "");
    const ageVal = (b.ok && b.year) ? computeAgeFromYMD(b.year, b.month, b.day) : null;

    // View-mode: address becomes 2 lines (stacked)
    const addressViewHTML = `
      <div class="lc-lines" aria-label="Address">
        <div class="lc-line1">${escapeHTML(addr.line1 || "—")}</div>
        <div class="lc-line2">${escapeHTML(addr.line2 || "")}</div>
      </div>
    `;

    // Edit-mode: two inputs
    const addressEditHTML = `
      <div class="lc-addr-edit">
        <input class="lc-field" id="fAddr1" value="${escapeAttr(addr.line1)}" placeholder="Street" autocomplete="street-address" />
        <input class="lc-field" id="fAddr2" value="${escapeAttr(addr.line2)}" placeholder="City, State ZIP" autocomplete="postal-code" />
      </div>
    `;

    panelContact.innerHTML = `
      <div class="lc-kv">
        <div class="ico">${iconSVG("phone")}</div>
        <div class="v">
          <input class="lc-field" id="fPhone"
            value="${escapeAttr(phoneShown)}"
            ${editing ? "" : "readonly"}
            inputmode="tel" autocomplete="tel"
            placeholder="412-555-1212">
        </div>

        <div class="ico">${iconSVG("mail")}</div>
        <div class="v">
          <input class="lc-field" id="fEmail"
            value="${escapeAttr(email)}"
            ${editing ? "" : "readonly"}
            inputmode="email" autocomplete="email"
            placeholder="name@email.com">
        </div>

        <div class="ico">${iconSVG("pin")}</div>
        <div class="v v-addr">
          ${editing ? addressEditHTML : addressViewHTML}
        </div>

        <div class="ico">${iconSVG("user")}</div>
        <div class="v">
          <input class="lc-field" id="fCigarSocial"
            value="${escapeAttr(cigarSocial)}"
            ${editing ? "" : "readonly"}
            autocapitalize="none" autocomplete="nickname"
            placeholder="@username">
        </div>

        <div class="ico">${iconSVG("cake")}</div>
        <div class="v">
          <input class="lc-field" id="fBirthday"
            value="${escapeAttr(bdayDisplay || "—")}"
            readonly
            placeholder="—">
        </div>

        <div class="ico">${iconSVG("calendar")}</div>
        <div class="v">
          <div class="lc-age">${ageVal != null ? `Age: ${ageVal}` : "—"}</div>
        </div>
      </div>
    `;
  }

  function renderFavorites(customer) {
    const brands = getFavBrandsFromColumns(customer);
    const cigars = getFavCigarsFromColumns(customer);

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
          ${cigars.map((c) => `
            <a class="pill" href="${cigarDetailHref(c)}">${escapeHTML(c)}</a>
          `).join("")}
        </div>`
      : `<div class="empty-line">No favorite cigars yet</div>`;

    panelFavorites.innerHTML = `
      <div class="section-title">Brands</div>
      ${brandIconsHTML}
      <div class="section-title">Cigars</div>
      ${cigarPillsHTML}
    `;
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
      <span class="lc-name-edit" role="group" aria-label="Name">
        <input class="lc-field lc-name-first"
          id="fFirst"
          value="${escapeAttr(first)}"
          placeholder="First"
          autocomplete="given-name" />
        <input class="lc-field lc-name-last"
          id="fLast"
          value="${escapeAttr(last)}"
          placeholder="Last"
          autocomplete="family-name" />
      </span>
    `;

    const nick = nickname(c);
    akaEl.style.display = "";
    akaEl.innerHTML = `
      <span style="color:#8e8e93;font-weight:600;">aka </span>
      <input class="lc-field" id="fNick" value="${escapeAttr(nick)}" placeholder="Nickname" autocomplete="nickname" />
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

    const fAddr1 = document.getElementById("fAddr1");
    const fAddr2 = document.getElementById("fAddr2");

    const fCigarSocial = document.getElementById("fCigarSocial");

    if (fPhone) c.phone = normalizePhoneToDigits(fPhone.value) || toStr(fPhone.value);
    if (fEmail) c.email = toStr(fEmail.value);

    if (fAddr1 || fAddr2) {
      c.address = joinAddressParts(
        fAddr1 ? fAddr1.value : "",
        fAddr2 ? fAddr2.value : ""
      );
    } else {
      const fAddress = document.getElementById("fAddress");
      if (fAddress) c.address = toStr(fAddress.value);
    }

    if (fCigarSocial) c.cigarSocial = toStr(fCigarSocial.value);

    // Birthday is read-only here by request (pulled from JSON column)
    // Age is computed from Birthday year automatically

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
