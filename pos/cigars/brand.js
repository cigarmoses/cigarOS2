/* /pos/cigars/brand.js
   Brand page controller + GLOBAL cigar detail popup
   - Loads cigars from your Google Sheet CSV
   - Renders list rows
   - Adds data-key on every row (Column V header: "key")
   - Clicking any cigar row opens the detail popup
   - Cigar image resolved from: img/cigars/{brand}/{brand}{line+cigar}.png (slugified)
   - Fonts: uses SF Pro Display Heavy + Medium via classes already in HTML
*/

(() => {
  // =========================
  // 1) CONFIG (SET THIS)
  // =========================
  // Paste the SAME CSV export URL you use on the main POS cigars page.
  // Example looks like:
  // https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
  const CSV_URL = ""; // <-- SET THIS

  // Brand icons live here (your repo already uses this style)
  const BRAND_ICON_PATH = (brandSlug) => `/img/icons/brands/${brandSlug}.svg`;

  // Cigar images live here:
  // img/cigars/{brand}/padron60thanniversaryperfecto.png
  const CIGAR_IMG_PATH = (brandSlug, file) => `/img/cigars/${brandSlug}/${file}`;

  // =========================
  // 2) DOM
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);

  const elBrandTitle = $("#brand-title");
  const elBrandIcon  = $("#brand-icon");
  const elList       = $("#brand-list");
  const elError      = $("#brand-error");
  const elSearch     = $("#brand-search");

  // Popup
  const pop = $("#cigar-pop");
  const popScrim = $("#cigar-pop-scrim");
  const popClose = $("#cigar-pop-close");

  const popBrand = $("#pop-brand");
  const popSub = $("#pop-sub");
  const popBrandIco = $("#pop-brand-ico");
  const popImg = $("#pop-img");

  const popRing = $("#pop-ring");
  const popLength = $("#pop-length");
  const popStrength = $("#pop-strength");
  const popVitola = $("#pop-vitola");
  const popWrapper = $("#pop-wrapper");
  const popBinder = $("#pop-binder");
  const popFiller = $("#pop-filler");
  const popOrigin = $("#pop-origin");
  const popWShade = $("#pop-wshade");

  const popRanksWrap = $("#pop-ranks");
  const popRank1 = $("#pop-rank-1");
  const popRank2 = $("#pop-rank-2");

  // =========================
  // 3) HELPERS
  // =========================
  function qs(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name) || "";
  }

  function norm(s) {
    return (s ?? "").toString().trim();
  }

  function slugify(s) {
    return norm(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function brandSlugFromKey(key) {
    // key format you showed: brand|line|cigar (and sometimes more)
    const k = norm(key);
    const first = k.split("|")[0] || "";
    return slugify(first);
  }

  function lineCigarFromKey(key) {
    const parts = norm(key).split("|").map(p => norm(p)).filter(Boolean);
    // brand|line|cigar|... -> join everything after brand as the “display name”
    return parts.length >= 2 ? parts.slice(1).join(" ") : "";
  }

  function fileFromKey(key) {
    // Build filename like: padron + (line+cigar) slug, then .png
    const parts = norm(key).split("|").map(p => norm(p)).filter(Boolean);
    const brand = slugify(parts[0] || "");
    const rest = parts.length >= 2 ? parts.slice(1).join(" ") : "";
    const restSlug = slugify(rest);
    return `${brand}${restSlug}.png`;
  }

  function parseCSV(text) {
    // Basic CSV parser that handles quoted fields
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur);
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    // flush last
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    if (!rows.length) return { headers: [], items: [] };

    const headers = rows[0].map(h => norm(h));
    const items = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => obj[h] = norm(r[idx] ?? ""));
      return obj;
    });

    return { headers, items };
  }

  function pick(obj, ...names) {
    for (const n of names) {
      if (n in obj && norm(obj[n]) !== "") return obj[n];
    }
    return "";
  }

  function openPopup() {
    pop.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
  }

  function closePopup() {
    pop.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
  }

  // Simple swipe-down close (mobile)
  let touchStartY = null;
  function onTouchStart(e) {
    touchStartY = e.touches?.[0]?.clientY ?? null;
  }
  function onTouchMove(e) {
    if (touchStartY == null) return;
    const y = e.touches?.[0]?.clientY ?? touchStartY;
    const dy = y - touchStartY;
    if (dy > 90) { // swipe down threshold
      touchStartY = null;
      closePopup();
    }
  }

  // =========================
  // 4) DATA + RENDER
  // =========================
  let ALL = [];
  let VIEW = [];
  let BRAND = norm(qs("brand"));
  let BRAND_SLUG = slugify(BRAND);

  function setBrandUI() {
    elBrandTitle.textContent = BRAND || "Brand";
    BRAND_SLUG = slugify(BRAND || "");
    elBrandIcon.src = BRAND_SLUG ? BRAND_ICON_PATH(BRAND_SLUG) : "";
    elBrandIcon.alt = BRAND || "";
  }

  function renderList(items) {
    elList.innerHTML = "";

    if (!items.length) return;

    const frag = document.createDocumentFragment();

    items.forEach((row) => {
      const key = pick(row, "key", "Key", "KEY");
      // fallback if key missing (still show row but popup won’t open reliably)
      const safeKey = norm(key);

      const cigarName = pick(row, "Cigar", "cigar", "CIGAR") || lineCigarFromKey(safeKey) || "Cigar";
      const vitola = pick(row, "Vitola", "vitola", "VITOLA");
      const msrp = pick(row, "MSRP", "msrp", "Price", "price");

      const li = document.createElement("div");
      li.className = "brand-item";
      li.dataset.key = safeKey;

      // Icon (brand)
      const ico = document.createElement("img");
      ico.className = "item-ico";
      ico.alt = "";
      ico.src = BRAND_SLUG ? BRAND_ICON_PATH(BRAND_SLUG) : "";

      // Text block (this is the clickable “pink area”)
      const txt = document.createElement("div");
      txt.className = "item-txt";
      txt.innerHTML = `
        <div class="item-name">${cigarName}</div>
        <div class="item-sub">${vitola || ""}</div>
      `;

      // Price + plus
      const right = document.createElement("div");
      right.className = "item-right";

      const price = document.createElement("div");
      price.className = "item-price";
      price.textContent = msrp ? Number(msrp).toFixed(2) : "0.00";

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "item-plus";
      plus.setAttribute("aria-label", "Add");
      plus.textContent = "+";

      // prevent popup when plus is pressed
      plus.addEventListener("click", (e) => {
        e.stopPropagation();
        // your existing add-to-bill logic likely lives elsewhere;
        // leave as-is for now (no breakage).
        // If you already have a handler, you can call it here.
      });

      right.appendChild(price);
      right.appendChild(plus);

      // Clicking the row opens popup
      li.addEventListener("click", () => {
        if (!safeKey) return;
        openCigarPopupByKey(safeKey);
      });

      li.appendChild(ico);
      li.appendChild(txt);
      li.appendChild(right);

      frag.appendChild(li);
    });

    elList.appendChild(frag);
  }

  function applySearchAndRender() {
    const q = norm(elSearch.value).toLowerCase();

    let out = VIEW;

    if (q) {
      out = out.filter((r) => {
        const cigar = pick(r, "Cigar", "cigar", "CIGAR").toLowerCase();
        const vitola = pick(r, "Vitola", "vitola", "VITOLA").toLowerCase();
        const key = pick(r, "key", "Key", "KEY").toLowerCase();
        return cigar.includes(q) || vitola.includes(q) || key.includes(q);
      });
    }

    renderList(out);
  }

  // =========================
  // 5) POPUP POPULATION
  // =========================
  function openCigarPopupByKey(key) {
    const row = ALL.find(r => norm(pick(r, "key", "Key", "KEY")) === norm(key));
    if (!row) return;

    const brandFromRow = pick(row, "Brand", "brand", "Manufacturer", "manufacturer") || BRAND;
    const brandSlug = slugify(brandFromRow || brandSlugFromKey(key) || BRAND_SLUG);

    // Display name (subtitle): “Line + Cigar”
    const line = pick(row, "Line", "line");
    const cigar = pick(row, "Cigar", "cigar");
    const subtitle =
      (line && cigar) ? `${line} ${cigar}` :
      cigar ? cigar :
      lineCigarFromKey(key) || " ";

    popBrand.textContent = brandFromRow || BRAND || "Brand";
    popSub.textContent = subtitle;

    // Brand icon
    popBrandIco.src = brandSlug ? BRAND_ICON_PATH(brandSlug) : "";
    popBrandIco.alt = brandFromRow || BRAND || "";

    // Fields
    popRing.textContent = pick(row, "RG", "Ring", "ring", "Ring Size") || "—";
    popLength.textContent = pick(row, "Length", "length") || "—";
    popStrength.textContent = pick(row, "Strength", "strength") || "—";
    popVitola.textContent = pick(row, "Vitola", "vitola") || "—";

    popWrapper.textContent = pick(row, "Wrapper", "wrapper") || "—";
    popBinder.textContent = pick(row, "Binder", "binder") || "—";
    popFiller.textContent = pick(row, "Filler", "filler") || "—";
    popOrigin.textContent = pick(row, "Origin", "origin") || "—";
    popWShade.textContent = pick(row, "Wrapper Shade", "WrapperShade", "wrapper shade", "wrapper_shade") || "—";

    // Rankings (optional)
    const caRank = pick(row, "CA Rank", "CA Top 25 Rank", "Cigar Aficionado Rank");
    const caYear = pick(row, "CA Year", "CA Top 25 Year", "Cigar Aficionado Year");
    const cjRank = pick(row, "CJ Rank", "Cigar Journal Rank");
    const cjYear = pick(row, "CJ Year", "Cigar Journal Year");

    const hasCA = !!(caRank || caYear);
    const hasCJ = !!(cjRank || cjYear);

    if (hasCA || hasCJ) {
      popRanksWrap.style.display = "grid";
      popRank1.textContent = hasCA ? `#${caRank || "—"}` : "#1";
      popRank2.textContent = hasCJ ? `#${cjRank || "—"}` : "#2";
    } else {
      popRanksWrap.style.display = "none";
    }

    // Image: from computed filename unless an explicit column exists
    const explicitImg = pick(row, "Cigar IMG", "Cigar Image", "Image", "IMG", "img");
    let imgSrc = "";

    if (explicitImg) {
      // If sheet stores a full URL or a relative path, respect it
      imgSrc = explicitImg.startsWith("http") ? explicitImg : `/${explicitImg.replace(/^\/+/, "")}`;
    } else {
      const file = fileFromKey(key);
      imgSrc = CIGAR_IMG_PATH(brandSlug, file);
    }

    popImg.onerror = () => {
      // If missing image, hide it (no broken icon)
      popImg.style.display = "none";
    };
    popImg.onload = () => {
      popImg.style.display = "block";
    };
    popImg.src = imgSrc;

    openPopup();
  }

  // =========================
  // 6) LOAD
  // =========================
  async function load() {
    try {
      setBrandUI();

      if (!CSV_URL) {
        // If no URL set, show error
        elError.style.display = "block";
        elError.textContent = "CSV_URL is not set in /pos/cigars/brand.js";
        return;
      }

      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
      const csvText = await res.text();

      const { items } = parseCSV(csvText);
      ALL = items;

      // Filter to this brand page
      // We try to match Brand column first; fallback to key’s brand segment.
      VIEW = ALL.filter((r) => {
        const b = slugify(pick(r, "Brand", "brand"));
        const k = pick(r, "key", "Key", "KEY");
        const kb = brandSlugFromKey(k);
        return (BRAND_SLUG && b === BRAND_SLUG) || (BRAND_SLUG && kb === BRAND_SLUG);
      });

      applySearchAndRender();

      // Search binding
      elSearch.addEventListener("input", applySearchAndRender);

      // Popup close bindings
      popScrim.addEventListener("click", closePopup);
      popClose.addEventListener("click", closePopup);
      pop.addEventListener("touchstart", onTouchStart, { passive: true });
      pop.addEventListener("touchmove", onTouchMove, { passive: true });

      // ESC close
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && pop.getAttribute("aria-hidden") === "false") closePopup();
      });

    } catch (err) {
      console.error(err);
      elError.style.display = "block";
    }
  }

  load();
})();
