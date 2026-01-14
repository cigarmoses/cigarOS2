/* /pos/cigars/favorites.js */

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (s) => document.querySelector(s);

  const backBtn = $("#fav-back");
  const brandsGrid = $("#fav-brands-grid");
  const cigarsList = $("#fav-cigars-list");
  const statusEl = $("#fav-status");

  const FAVORITE_BRANDS = [
    { name: "Padron", slug: "padron" },
    { name: "Arturo Fuente", slug: "arturofuente" },
    { name: "Aladino", slug: "aladino" },
  ];

  // ---------------------------
  // Utils
  // ---------------------------
  const normD = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const slugTight = (s) =>
    normD(s)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const escapeAttr = (s) => escapeHTML(s).replace(/"/g, "&quot;");

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
  }

  function toNum(v) {
    const n = Number(String(v ?? "").replace(/[^0-9.]+/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  // ---------------------------
  // Brand icons
  // ---------------------------
  function brandHref(slug) {
    return `/pos/cigars/brand.html?brand=${encodeURIComponent(slug)}`;
  }

  function brandSlugCandidatesFromName(brandName) {
    const raw = (brandName || "").toString().trim();
    const b = normD(raw);
    const slugs = new Set();

    const tight = slugTight(raw);
    if (tight) slugs.add(tight);

    // ✅ FIXED (was corrupted): remove parenthetical content safely
    const noParen = raw
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tightNoParen = slugTight(noParen);
    if (tightNoParen) slugs.add(tightNoParen);

    if (b.startsWith("la ")) {
      const noLa = slugTight(b.replace(/^la\s+/i, ""));
      if (noLa) slugs.add(noLa);
    }

    // common: "A.F." → "arturofuente"
    const af = slugTight(b.replace(/^a\.?\s*f\.?\s*/i, ""));
    if (af) slugs.add(af);

    return Array.from(slugs);
  }

  function setImgWithFallback(imgEl, candidates) {
    let idx = 0;
    const list = (candidates || []).filter(Boolean);

    function tryNext() {
      if (!imgEl) return;
      if (idx >= list.length) {
        imgEl.removeAttribute("src");
        return;
      }
      imgEl.src = list[idx++];
    }

    imgEl.onerror = tryNext;
    tryNext();
  }

  function resolveBrandIconCandidates(brandName) {
    const slugs = brandSlugCandidatesFromName(brandName);

    // IMPORTANT: your repo uses /img/icons/brands (plural)
    return slugs.map((s) => `/img/icons/brands/${s}.svg`);
  }

  // ---------------------------
  // Display name
  // ---------------------------
  function cleanTitle(s) {
    return (s || "").toString().trim().replace(/\s+/g, " ");
  }

  function buildDisplayName(row) {
    // Prefer explicit fields if present
    const line = cleanTitle(row.Line || row.Collection || row.Series || "");
    const cigar = cleanTitle(row.Cigar || row.Name || row.Title || row.CigarName || "");
    const joined = [line, cigar].filter(Boolean).join(" ");

    // fallback to anything “name-like”
    return joined || cleanTitle(row.Display || row["Display Name"] || row["Cigar Display"] || "");
  }

  // ---------------------------
  // CSV load
  // ---------------------------
  function parseCSV(text) {
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

    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    return rows;
  }

  async function load() {
    setStatus("Loading favorites…");

    const res = await fetch(CSV_URL, { cache: "no-store" });
    const text = await res.text();
    const grid = parseCSV(text);

    const headers = (grid.shift() || []).map((h) => (h || "").trim());
    const rows = grid.map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });

    return rows;
  }

  // ---------------------------
  // Detail modal (same idea as brand page)
  // ---------------------------
  let detailOverlay = null;
  let detailSheet = null;

  function ensureDetailModal() {
    if (detailOverlay) return;

    detailOverlay = document.createElement("div");
    detailOverlay.className = "cigar-detail-overlay";
    detailOverlay.setAttribute("aria-hidden", "true");
    detailOverlay.addEventListener("click", (e) => {
      if (e.target === detailOverlay) closeDetail();
    });

    detailSheet = document.createElement("div");
    detailSheet.className = "cigar-detail-sheet";
    detailSheet.setAttribute("role", "dialog");
    detailSheet.setAttribute("aria-modal", "true");

    detailOverlay.appendChild(detailSheet);
    document.body.appendChild(detailOverlay);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && detailOverlay.classList.contains("open")) closeDetail();
    });
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  function openDetail(row) {
    ensureDetailModal();

    const brand = row.Brand || row._brandHint || "Brand";
    const cigarName = buildDisplayName(row);

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>
      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${escapeHTML(brand)}</div>
            <div class="cd-name">${escapeHTML(cigarName)}</div>
          </div>
        </div>

        <div class="cd-grid">
          <div class="cd-box"><div class="cd-k">RING</div><div class="cd-v">${escapeHTML(row.RG || row.Ring || "")}</div></div>
          <div class="cd-box"><div class="cd-k">LENGTH</div><div class="cd-v">${escapeHTML(row.Length || "")}</div></div>
          <div class="cd-box"><div class="cd-k">SHAPE</div><div class="cd-v">${escapeHTML(row.Shape || "")}</div></div>
          <div class="cd-box"><div class="cd-k">VITOLA</div><div class="cd-v">${escapeHTML(row.Vitola || "")}</div></div>

          <div class="cd-wide">
            <div class="cd-wide-row"><div class="cd-k">WRAPPER</div><div class="cd-v">${escapeHTML(row.Wrapper || "")}</div></div>
            <div class="cd-wide-row"><div class="cd-k">BINDER</div><div class="cd-v">${escapeHTML(row.Binder || "")}</div></div>
            <div class="cd-wide-row"><div class="cd-k">FILLER</div><div class="cd-v">${escapeHTML(row.Filler || "")}</div></div>
            <div class="cd-wide-row"><div class="cd-k">ORIGIN</div><div class="cd-v">${escapeHTML(row.Origin || "")}</div></div>
          </div>

          <div class="cd-wide">
            <div class="cd-wide-row"><div class="cd-k">STRENGTH</div><div class="cd-v">${escapeHTML(row.Strength || "")}</div></div>
          </div>

          <div class="cd-wide">
            <div class="cd-wide-row"><div class="cd-k">WRAPPER SHADE</div><div class="cd-v">${escapeHTML(row["Wrapper Shade"] || row.Shade || "")}</div></div>
          </div>
        </div>

        <div class="cd-actions">
          <button type="button" class="cd-btn" data-close>Close</button>
        </div>
      </div>
    `;

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeDetail);
    detailSheet.querySelector("[data-close]")?.addEventListener("click", closeDetail);

    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("cigar-detail-open");
  }

  // ---------------------------
  // Render brands + cigars
  // ---------------------------
  function renderFavoriteBrands() {
    if (!brandsGrid) return;

    brandsGrid.innerHTML = FAVORITE_BRANDS.map((b, idx) => {
      const imgId = `favBrandIco_${idx}`;
      return `
        <a class="category-card" href="${escapeAttr(brandHref(b.slug))}">
          <img id="${imgId}" alt="${escapeAttr(b.name)}" />
          <div class="category-name">${escapeHTML(b.name)}</div>
        </a>
      `;
    }).join("");

    FAVORITE_BRANDS.forEach((b, idx) => {
      const img = document.getElementById(`favBrandIco_${idx}`);
      if (!img) return;
      const candidates = resolveBrandIconCandidates(b.name);
      setImgWithFallback(img, candidates);
    });
  }

  let ROW_BY_ID = Object.create(null);

  function renderFavoriteCigars(rows) {
    if (!cigarsList) return;
    ROW_BY_ID = Object.create(null);

    if (!rows.length) {
      cigarsList.innerHTML = "";
      setStatus("No favorites found.");
      return;
    }

    setStatus("");

    cigarsList.innerHTML = rows
      .map((row, idx) => {
        const id = String(row.key || row.ID || row.Id || row.SKU || `${idx}`);
        ROW_BY_ID[id] = row;

        const name = buildDisplayName(row) || "Cigar";
        const sub =
          row.Vitola
            ? `${row.Vitola}${row.Length && row.RG ? ` • ${row.Length} × ${row.RG}` : ""}`.trim()
            : (row.Shape || "");

        const price = toNum(row.MSRP).toFixed(2);

        const brand = row.Brand || row._brandHint || "";
        const iconCands = resolveBrandIconCandidates(brand);
        const candsEncoded = escapeAttr(iconCands.join("|"));

        return `
          <div class="fav-row" data-id="${escapeAttr(id)}" data-direct-add="1">
            <img class="fav-ico" data-ico data-cands="${candsEncoded}" alt="${escapeAttr(brand)}" />
            <div class="fav-main">
              <button class="fav-open" type="button" data-open>
                <div class="fav-title">${escapeHTML(name)}</div>
                <div class="fav-sub">${escapeHTML(sub)}</div>
              </button>
            </div>
            <div class="fav-price">${escapeHTML(price)}</div>
            <button class="fav-add" type="button" aria-label="Add" data-add>+</button>
          </div>
        `;
      })
      .join("");

    // Set icons with fallback (brand logos only)
    cigarsList.querySelectorAll("img[data-ico]").forEach((img) => {
      const cands = (img.getAttribute("data-cands") || "").split("|").filter(Boolean);
      setImgWithFallback(img, cands);
    });
  }

  function initCigarDelegation() {
    if (!cigarsList) return
