/* /pos/cigars/favorites.js
   Favorites shortcut page

   Goals:
   ✅ Brands grid uses SAME DOM/CSS classes as /pos/cigars/ (brands-grid tile style)
   ✅ Cigars list uses SAME row layout as brand pages (icon | title | price separator | MSRP | +)
   ✅ Clicking brand tile -> brand page
   ✅ Clicking cigar name -> detail modal (same behavior style as brand pages)
   ✅ Green + adds to invoice via window.CigarOSCart.add
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (s) => document.querySelector(s);

  const backBtn = $("#fav-back");
  const brandsGrid = $("#fav-brands-grid");
  const cigarsList = $("#fav-cigars-list");
  const statusEl = $("#fav-status");

  // ------------------------------------------------------------
  // HARD-CODED favorites for now
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------
  const normD = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const slugTight = (s) =>
    normD(s)
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");

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

  // ✅ inline SVG fallback so iOS never shows the blue "?"
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

    // ensure plural path for brand icons
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

  // ✅ robust slug candidates for brand icons
  function brandSlugCandidatesFromName(brandName) {
    const raw = (brandName || "").toString().trim();
    const b = normD(raw);
    const slugs = new Set();

    const tight = slugTight(raw);
    if (tight) slugs.add(tight);

    // remove parenthetical: "Name (ABC)"
    const noParen = raw.replace(/\s*$begin:math:text$\[\^\)\]\*$end:math:text$\s*/g, " ").replace(/\s+/g, " ").trim();
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

    // known brand shortcuts
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

    // if the sheet ever includes a brand icon path, prefer it
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

  // ------------------------------------------------------------
  // Brands grid render
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // CSV parsing
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Find favorite cigars from sheet
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // ✅ Display name: Line + Cigar, but NEVER duplicate.
  // If cigar already contains line anywhere, do not prepend line.
  // ------------------------------------------------------------
  function buildDisplayName(row) {
    const line = (row.Line || "").toString().trim();
    const cigar = (row.Cigar || "").toString().trim();
    if (!line) return cigar;
    if (!cigar) return line;

    const ln = normD(line);
    const cn = normD(cigar);

    // if cigar already includes the line anywhere, just use cigar
    if (ln && cn.includes(ln)) return cigar;

    // if cigar starts with the line, strip it (extra safety)
    if (ln && cn.startsWith(ln + " ")) return cigar.slice(line.length).trim();

    return `${line} ${cigar}`;
  }

  // ------------------------------------------------------------
  // Detail modal (same behavior style as brand pages)
  // ------------------------------------------------------------
  let detailOverlay = null;
  let detailSheet = null;

  function cigarPlaceholderSVG() {
    return `
      <svg viewBox="0 0 240 520" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="ph_g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="rgba(15,26,44,0.10)"/>
            <stop offset="1" stop-color="rgba(15,26,44,0.04)"/>
          </linearGradient>
        </defs>
        <rect x="78" y="32" width="84" height="456" rx="42"
              fill="url(#ph_g)" stroke="rgba(15,26,44,0.22)" stroke-width="3"/>
        <rect x="78" y="32" width="84" height="44" rx="22"
              fill="rgba(15,26,44,0.06)" stroke="rgba(15,26,44,0.18)" stroke-width="2"/>
        <rect x="86" y="160" width="68" height="22" rx="11" fill="rgba(15,26,44,0.06)"/>
        <rect x="86" y="192" width="68" height="10" rx="5" fill="rgba(15,26,44,0.05)"/>
        <text x="120" y="275" text-anchor="middle"
              font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
              font-size="14"
              fill="rgba(15,26,44,0.55)"
              letter-spacing="-0.02em">
          image coming soon
        </text>
      </svg>
    `;
  }

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

  function renderKV(k, v) {
    const vv = (v || "").toString().trim() || "—";
    return `
      <div class="cd-kv">
        <div class="k">${escapeHTML(k)}</div>
        <div class="v">${escapeHTML(vv)}</div>
      </div>
    `;
  }

  function resolveCigarImageCandidates(row) {
    const brandSlug = slugTight(row.Brand || "");
    const baseDir = brandSlug ? `/img/cigars/${brandSlug}/` : "/img/cigars/";
    const candidates = [];

    const raw = row["Cigar IMG"] || row["Cigar Image"] || row["Image"] || "";
    const rawNorm = normalizeIconPath(raw);

    if (rawNorm.includes("/img/cigars/")) {
      candidates.push(rawNorm);
    } else if (raw && /\.(png|jpg|jpeg|webp)$/i.test(raw)) {
      candidates.push(`${baseDir}${raw.replace(/^\/+/, "")}`);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function openDetail(row) {
    ensureDetailModal();
    document.body.classList.add("cigar-detail-open");

    const brand = row.Brand || row._brandHint || "Brand";
    const cigarName = buildDisplayName(row);

    const rg = row.RG || row["Ring"] || "";
    const len = row.Length || "";
    const strength = row.Strength || "";
    const vitola = row.Vitola || "";
    const shape = row.Shape || "";
    const wrapper = row.Wrapper || row["Wrapper Type"] || row["Wrapper Country"] || "";
    const binder = row.Binder || row["Binder Type"] || "";
    const filler = row.Filler || row["Filler Type"] || "";
    const origin = row.Origin || row["Country of Origin"] || row["Country"] || "";
    const shade = row["Wrapper Shade"] || row.Shade || "";

    const brandIconCands = brandIconCandidatesFromRow(row);
    const cigarCands = resolveCigarImageCandidates(row);

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

        <div class="cd-main">
          <div class="cd-img">
            <div data-cigar-placeholder style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
              ${cigarPlaceholderSVG()}
            </div>
            <img class="cigar-detail-stick" data-detail-cigar-img alt="" style="display:none;">
          </div>

          <div class="cd-right">
            <div class="cd-grid2">
              <div class="cd-stat">
                <div class="k">RING</div>
                <div class="v">${escapeHTML(String(rg || ""))}</div>
              </div>
              <div class="cd-stat">
                <div class="k">LENGTH</div>
                <div class="v">${escapeHTML(String(len || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">SHAPE</div>
                <div class="v">${escapeHTML(String(shape || ""))}</div>
              </div>
              <div class="cd-stat small">
                <div class="k">VITOLA</div>
                <div class="v">${escapeHTML(String(vitola || ""))}</div>
              </div>
            </div>

            <div class="cd-block">
              ${renderKV("WRAPPER", wrapper)}
              ${renderKV("BINDER", binder)}
              ${renderKV("FILLER", filler)}
              ${renderKV("ORIGIN", origin)}
            </div>

            <div class="cd-block single">
              ${renderKV("STRENGTH", strength)}
            </div>

            <div class="cd-block single">
              ${renderKV("WRAPPER SHADE", shade)}
            </div>

            <div class="cd-actions">
              <button type="button" class="cd-btn" disabled>COMPARE TO</button>
              <button type="button" class="cd-btn is-live" data-cd-action="add">ADD TO BILL</button>
              <button type="button" class="cd-btn" disabled>EDIT IN HUB</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // ✅ always attempt to load a brand icon into the header
    const brandImg = detailSheet.querySelector("img[data-detail-brand-icon]");
    if (brandImg) loadFirstWorkingImage(brandImg, brandIconCands, FALLBACK_ICON);

    const ph = detailSheet.querySelector("[data-cigar-placeholder]");
    const cigarImg = detailSheet.querySelector("img[data-detail-cigar-img]");
    if (cigarImg) {
      const showPlaceholder = () => {
        if (ph) ph.style.display = "flex";
        cigarImg.style.display = "none";
      };
      const showImage = () => {
        if (ph) ph.style.display = "none";
        cigarImg.style.display = "block";
      };

      if (!cigarCands.length) {
        showPlaceholder();
      } else {
        let idx = 0;
        const tryNext = () => {
          if (idx >= cigarCands.length) {
            showPlaceholder();
            return;
          }
          cigarImg.onerror = () => {
            idx++;
            tryNext();
          };
          cigarImg.onload = () => showImage();
          cigarImg.src = cigarCands[idx];
        };
        tryNext();
      }
    }

    detailSheet.querySelector(".cigar-detail-x")?.addEventListener("click", closeDetail);

    detailSheet.querySelector('[data-cd-action="add"]')?.addEventListener("click", () => {
      window.CigarOSCart?.add({
        id: row.key || `${row.Brand || row._brandHint || ""}-${row.Cigar || ""}-${row.Vitola || ""}`,
        name: buildDisplayName(row),
        brand: row.Brand || row._brandHint || "",
        category: "Cigars",
        sub: row.Vitola ? `${row.Vitola} • ${row.Length} × ${row.RG}`.trim() : "",
        price: toNum(row.MSRP),
        img: "",
      });
      closeDetail();
    });

    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cigar-detail-open");
  }

  // ------------------------------------------------------------
  // Render favorite cigars list
  // ------------------------------------------------------------
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
      .map((row) => {
        const id = row.key || `${row.Brand || ""}-${row.Cigar || ""}-${row.Vitola || ""}-${row.MSRP || ""}`;
        ROW_BY_ID[id] = row;

        const iconCands = brandIconCandidatesFromRow(row);
        const name = buildDisplayName(row);
        const sub = row.Vitola || "";
        const price = money(toNum(row.MSRP));

        return `
        <div class="fav-row" data-id="${escapeAttr(id)}">
          <img class="fav-ico" data-ico alt="${escapeAttr(row.Brand || row._brandHint || "")}" />

          <div class="fav-main">
            <button class="fav-open" type="button" data-open>
              <div class="fav-title">${escapeHTML(name)}</div>
              <div class="fav-sub">${escapeHTML(sub)}</div>
            </button>
          </div>

          <div class="fav-price">${escapeHTML(price)}</div>

          <button class="fav-add" type="button" aria-label="Add" data-add>+</button>

          <template data-ico-cands>${escapeHTML(JSON.stringify(iconCands))}</template>
        </div>
      `;
      })
      .join("");

    cigarsList.querySelectorAll(".fav-row").forEach((rowEl) => {
      const img = rowEl.querySelector("img[data-ico]");
      const t = rowEl.querySelector("template[data-ico-cands]");
      if (!img || !t) return;
      let cands = [];
      try { cands = JSON.parse(t.textContent || "[]"); } catch {}
      loadFirstWorkingImage(img, cands, FALLBACK_ICON);
    });
  }

  function initCigarDelegation() {
    if (!cigarsList) return;

    cigarsList.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
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
        const rowEl = openBtn.closest(".fav-row");
        const id = rowEl?.getAttribute("data-id") || "";
        const row = ROW_BY_ID[id];
        if (!row) return;
        openDetail(row);
      }
    });
  }

  // ------------------------------------------------------------
  // init
  // ------------------------------------------------------------
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

    // ✅ FIXED: correct function name so clicks work
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
