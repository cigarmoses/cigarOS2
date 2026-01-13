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

  const FAVORITE_CIGARS = [
    { cigar: "La Flor Dominicana Andalusian Bull", brandHint: "la flor dominicana" },
    { cigar: "Padron 60th Anniversary Perfecto", brandHint: "padron" },
  ];

  function brandHref(slug) {
    return `/pos/cigars/brand/?brand=${encodeURIComponent(slug)}`;
  }

  const normD = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const slugTight = (s) =>
    normD(s).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

  const toNum = (v) => {
    const x = Number((v ?? "").toString().replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : 0;
  };

  const money = (n) =>
    window.CigarOSCart?.money ? window.CigarOSCart.money(n) : Number(n || 0).toFixed(2);

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
    return escapeHTML(s).replaceAll("`", "");
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
  }

  const FALLBACK_ICON_SVG = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect x="10" y="10" width="76" height="76" rx="18" fill="rgba(15,26,44,0.06)"/>
      <path d="M38 22h20c8 0 14 6 14 14 0 6-3 10-8 13-5 3-6 5-6 9v2H44v-3c0-9 4-12 9-15 3-2 5-4 5-7 0-4-3-7-7-7H38v-6z"
        fill="rgba(15,26,44,0.55)"/>
      <circle cx="48" cy="72" r="4.2" fill="rgba(15,26,44,0.55)"/>
    </svg>
  `).trim();
  const FALLBACK_ICON = `data:image/svg+xml;charset=utf-8,${FALLBACK_ICON_SVG}`;

  function normalizeIconPath(p) {
    let s = (p || "").toString().trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("img/")) s = "/" + s;
    if (!s.startsWith("/")) s = "/" + s;

    s = s.replace(/^\/img\/icons\/brand\//i, "/img/icons/brands/");
    s = s.replace(/\/{2,}/g, "/");
    return s;
  }

  function loadFirstWorkingImage(imgEl, candidates, fallbackSrc = FALLBACK_ICON) {
    let i = 0;
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];

    const tryNext = () => {
      if (i >= list.length) {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc || FALLBACK_ICON;
        return;
      }
      imgEl.onerror = () => {
        i++;
        tryNext();
      };
      imgEl.src = list[i];
    };

    tryNext();
  }

  function brandIconCandidatesFromSlug(slug) {
    const s = (slug || "").trim().toLowerCase();
    if (!s) return [];
    return [
      `/img/icons/brands/${s}.svg`,
      `/img/icons/brands/${s}.png`,
      `/img/icons/brands/${s}.jpg`,
      `/img/icons/brands/${s}.webp`,
    ];
  }

  function brandSlugCandidatesFromName(brandName) {
    const raw = (brandName || "").toString().trim();
    const b = normD(raw);
    const slugs = new Set();

    const tight = slugTight(raw);
    if (tight) slugs.add(tight);

    const noParen = raw.replace(/\s*$begin:math:text$$begin:math:display$\\\^\\\)$end:math:display$\*$end:math:text$\s*/g, " ").replace(/\s+/g, " ").trim();
    const tightNoParen = slugTight(noParen);
    if (tightNoParen) slugs.add(tightNoParen);

    if (b.startsWith("la ")) {
      const noLa = slugTight(b.replace(/^la\s+/i, ""));
      if (noLa) slugs.add(noLa);
    }
    if (b.startsWith("the ")) {
      const noThe = slugTight(b.replace(/^the\s+/i, ""));
      if (noThe) slugs.add(noThe);
    }

    if (b.includes("la flor dominicana")) {
      slugs.add("laflordominicana");
      slugs.add("lfd");
    }
    if (b.includes("padron")) slugs.add("padron");
    if (b.includes("arturo fuente")) slugs.add("arturofuente");
    if (b.includes("aladino")) slugs.add("aladino");

    return Array.from(slugs);
  }

  function brandIconCandidatesFromRow(row) {
    const candidates = [];

    const rawIcon =
      row["Brand Icon"] ||
      row["Brand IMG"] ||
      row["Brand Image"] ||
      row["Icon"] ||
      "";

    const rawNorm = normalizeIconPath(rawIcon);
    if (rawNorm) candidates.push(rawNorm);

    const brandNamesToTry = [];
    if (row.Brand) brandNamesToTry.push(row.Brand);
    if (row._brandHint) brandNamesToTry.push(row._brandHint);

    brandNamesToTry.forEach((bn) => {
      const slugs = brandSlugCandidatesFromName(bn);
      slugs.forEach((s) => {
        brandIconCandidatesFromSlug(s).forEach((p) => candidates.push(p));
      });
    });

    return Array.from(new Set(candidates.filter(Boolean)));
  }

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
      loadFirstWorkingImage(img, brandIconCandidatesFromSlug(b.slug), FALLBACK_ICON);
    });
  }

  function parseCSV(text) {
    const rows = [];
    let i = 0, field = "", row = [], inQuotes = false;

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQuotes = false; i++; continue; }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ",") { row.push(field); field = ""; i++; continue; }
        if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        if (c === "\r") { i++; continue; }
        field += c; i++;
      }
    }
    row.push(field);
    rows.push(row);

    while (rows.length && rows[rows.length - 1].every((x) => !x || !x.trim())) rows.pop();
    return rows;
  }

  function tableFromCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const header = rows[0].map((h) => (h || "").trim());
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = (rows[r][c] ?? "").trim();
      out.push(obj);
    }
    return out;
  }

  function findRowForFavorite(allRows, fav) {
    const target = normD(fav.cigar);
    const brandHint = normD(fav.brandHint || "");

    let best = null;
    let bestScore = -1;

    for (const r of allRows) {
      const cigar = normD(r.Cigar || "");
      if (!cigar) continue;

      const brand = normD(r.Brand || "");
      let score = 0;

      if (cigar === target) score += 120;
      if (cigar.includes(target) || target.includes(cigar)) score += 70;

      const tA = new Set(target.split(/\s+/g));
      const tB = new Set(cigar.split(/\s+/g));
      let overlap = 0;
      tA.forEach((x) => { if (tB.has(x)) overlap++; });
      score += overlap * 6;

      if (brandHint) {
        if (brand === brandHint) score += 60;
        else if (brand.includes(brandHint) || brandHint.includes(brand)) score += 45;
      }

      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    return best;
  }

  function buildDisplayName(row) {
    const line = (row.Line || "").toString().trim();
    const cigar = (row.Cigar || "").toString().trim();
    if (!line) return cigar;
    if (!cigar) return line;

    const ln = normD(line);
    const cn = normD(cigar);

    if (ln && cn.includes(ln)) return cigar;
    if (ln && cn.startsWith(ln + " ")) return cigar.slice(line.length).trim();

    return `${line} ${cigar}`;
  }

  // ---------------------------
  // Detail modal (uses brand.css styles already on site)
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

  function openDetail(row) {
    ensureDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = row.Brand || row._brandHint || "Brand";
    const cigarName = buildDisplayName(row);
    const brandIconCands = brandIconCandidatesFromRow(row);

    detailSheet.innerHTML = `
      <button type="button" class="cigar-detail-x" aria-label="Close">×</button>
      <div class="cigar-detail-body">
        <div class="cd-headercard">
          <div class="cd-h-left">
            <div class="cd-brand">${escapeHTML(brand)}</div>
            <div class="cd-name">${escapeHTML(cigarName)}</div>
          </div>
          <div class="cd-h-icon">
            <img data-detail-brand-icon alt="${escapeAttr(brand)}">
          </div>
        </div>
      </div>
    `;

    const brandImg = detailSheet.querySelector("img[data-detail-brand-icon]");
    if (brandImg) loadFirstWorkingImage(brandImg, brandIconCands, FALLBACK_ICON);

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeDetail);

    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  // ---------------------------
  // Render cigars list
  // ---------------------------
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

    cigarsList.innerHTML = rows.map((row) => {
      const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}-${row.MSRP || ""}`;
      ROW_BY_ID[id] = row;

      const iconCands = brandIconCandidatesFromRow(row);
      const name = buildDisplayName(row);
      const sub = row.Vitola || "";
      const price = money(toNum(row.MSRP));

      const candsEncoded = encodeURIComponent(JSON.stringify(iconCands));

      return `
        <div class="fav-row" data-id="${escapeAttr(id)}" data-direct-add="1">
          <img class="fav-ico" data-ico data-cands="${candsEncoded}" alt="${escapeAttr(row.Brand || row._brandHint || "")}" />

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
    }).join("");

    cigarsList.querySelectorAll("img[data-ico]").forEach((img) => {
      let cands = [];
      try {
        cands = JSON.parse(decodeURIComponent(img.getAttribute("data-cands") || "%5B%5D"));
      } catch {}
      loadFirstWorkingImage(img, cands, FALLBACK_ICON);
    });
  }

  function initCigarDelegation() {
    if (!cigarsList) return;

    // ✅ CAPTURE PHASE so we beat any global document click interceptors
    cigarsList.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const rowEl = addBtn.closest(".fav-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = ROW_BY_ID[id];
        if (!row) return;

        window.CigarOSCart?.add({
          id: row.key || id,
          name: buildDisplayName(row),
          brand: row.Brand || row._brandHint || "",
          category: "Cigars",
          sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
          price: toNum(row.MSRP),
          img: "",
        });
        return;
      }

      const openBtn = e.target.closest("[data-open]");
      if (openBtn) {
        // ✅ THIS is the key fix: prevent global cart popup hijack
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const rowEl = openBtn.closest(".fav-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = ROW_BY_ID[id];
        if (!row) return;

        openDetail(row);
      }
    }, true);
  }

  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.history.length > 1) return window.history.back();
    window.location.href = "/pos/cigars/";
  });

  async function load() {
    setStatus("Loading…");

    const res = await fetch(`${CSV_URL}&_=${Date.now()}`, { cache: "no-store" });
    const text = await res.text();
    const table = tableFromCSV(text);

    const foundRows = [];
    for (const fav of FAVORITE_CIGARS) {
      const row = findRowForFavorite(table, fav);
      if (row) {
        row._brandHint = fav.brandHint || "";
        foundRows.push(row);
      }
    }

    renderFavoriteBrands();
    renderFavoriteCigars(foundRows);
  }

  function init() {
    renderFavoriteBrands();
    initCigarDelegation();

    load().catch((err) => {
      console.error("favorites.js load error:", err);
      setStatus("Failed to load favorites.");
      renderFavoriteBrands();
      renderFavoriteCigars([]);
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
