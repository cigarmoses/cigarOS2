(() => {
  "use strict";

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";
  const FAVORITES_KEY = "cigaros_favorite_keys";
  const WISHLIST_KEY = "cigaros_wishlist_keys";
  const COMPARE_KEY = "cigaros_compare_keys";
  const THEME_KEYS = ["cigaros_theme", "theme"];

  const $ = (sel, root = document) => root.querySelector(sel);

  const shell = $("#cdCard");
  const loading = $("#cdLoading");
  const backBtn = $("#cdBack");
  const themeToggle = $("#theme-toggle");
  const htmlEl = document.documentElement;

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  function readTheme() {
    for (const key of THEME_KEYS) {
      const value = localStorage.getItem(key);
      if (value === "light" || value === "dark") return value;
    }
    return htmlEl.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function writeTheme(theme) {
    htmlEl.setAttribute("data-theme", theme);
    themeToggle?.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    THEME_KEYS.forEach((key) => {
      try {
        localStorage.setItem(key, theme);
      } catch {}
    });
  }

  themeToggle?.addEventListener("click", () => {
    writeTheme(readTheme() === "dark" ? "light" : "dark");
  });

  writeTheme(readTheme());

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === ",") {
        row.push(field);
        field = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(field);
        if (row.some((cell) => String(cell || "").trim() !== "")) rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += ch;
    }

    if (field.length || row.length) {
      row.push(field);
      if (row.some((cell) => String(cell || "").trim() !== "")) rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ /g, "_");
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => String(h || "").trim());
    const normalized = headers.map(normalizeHeader);

    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
        obj[normalized[i]] = (r[i] ?? "").trim();
      });
      return obj;
    });
  }

  function getField(rec, keys) {
    for (const key of keys) {
      if (rec && rec[key] != null && String(rec[key]).trim() !== "") {
        return String(rec[key]).trim();
      }
    }
    return "";
  }

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function normalizeText(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugify(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getKey(rec) {
    return getField(rec, ["Key", "key", "cigar_id", "id", "row_id", "slug"]);
  }

  function getBrand(rec) {
    return getField(rec, ["Brand", "brand", "brand_aka", "Brand aka"]);
  }

  function getLine(rec) {
    return getField(rec, ["Line", "line"]);
  }

  function getName(rec) {
    return getField(rec, ["Cigar", "cigar", "Name", "name", "Cigar Name", "cigar_name"]);
  }

  function getVitola(rec) {
    return getField(rec, ["Vitola", "vitola", "Style", "style"]);
  }

  function getShape(rec) {
    return getField(rec, ["Shape", "shape"]);
  }

  function getStrength(rec) {
    return getField(rec, ["Strength", "strength"]);
  }

  function getWrapper(rec) {
    return getField(rec, ["Wrapper", "wrapper", "wrapper_type"]);
  }

  function getBinder(rec) {
    return getField(rec, ["Binder", "binder"]);
  }

  function getFiller(rec) {
    return getField(rec, ["Filler", "filler"]);
  }

  function getOrigin(rec) {
    return getField(rec, ["Origin", "origin", "country", "country_of_origin"]);
  }

  function getShade(rec) {
    return getField(rec, ["Wrapper Shade", "wrapper_shade", "shade"]);
  }

  function getCigarImg(rec) {
    return getField(rec, ["Cigar IMG", "cigar_img", "image", "img", "photo", "cigar_image"]);
  }

  function getBrandImg(rec) {
    const direct = getField(rec, ["Brand IMG", "brand_img", "brand_image"]);
    if (direct) return direct;
    const brand = getBrand(rec);
    return brand ? `/img/icons/brands/${normalizeBrand(brand)}.svg` : "";
  }

  function displayBrand(rec) {
    return getBrand(rec) || getField(rec, ["Manufacturer", "manufacturer"]) || "Cigar";
  }

  function displayName(rec) {
    const line = getLine(rec);
    const cigar = getName(rec);
    const combined = [line, cigar].filter(Boolean).join(" ").trim();
    return combined || cigar || line || "Cigar";
  }

  function makeSlug(rec) {
    const parts = [displayBrand(rec), getLine(rec), getName(rec), getVitola(rec), getKey(rec)].filter(Boolean);
    return slugify(parts.join(" "));
  }

  function buildLegacyId(rec) {
    return [
      normalizeText(getBrand(rec)),
      normalizeText(displayName(rec)),
      normalizeText(getVitola(rec))
    ].join("|");
  }

  function readSet(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  }

  function writeSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch {}
  }

  function flagForCountry(country) {
    const c = String(country || "").trim().toLowerCase();
    if (c === "cuba") return "🇨🇺";
    if (c === "nicaragua") return "🇳🇮";
    if (c === "dominican republic") return "🇩🇴";
    if (c === "honduras") return "🇭🇳";
    if (c === "mexico") return "🇲🇽";
    if (c === "ecuador") return "🇪🇨";
    if (c === "usa" || c === "united states") return "🇺🇸";
    return "";
  }

  function extractSizeParts(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalized = raw
      .replace(/×/g, "x")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    const match = normalized.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
    if (!match) return null;

    return {
      length: match[1],
      ring: match[2]
    };
  }

  function cleanRing(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const size = extractSizeParts(raw);
    if (size?.ring) return size.ring;

    const match = raw.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : raw;
  }

  function cleanLength(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const size = extractSizeParts(raw);
    if (size?.length) return size.length;

    const match = raw.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : raw;
  }

  function getRing(rec) {
    const direct = getField(rec, [
      "RG", "rg",
      "Ring", "ring",
      "Ring Gauge", "ring_gauge",
      "Ring Size", "ring_size"
    ]);
    if (direct) return cleanRing(direct);

    const fromSize = getField(rec, [
      "Size", "size",
      "Dimensions", "dimensions",
      "Length/Ring", "lengthring",
      "Length x Ring", "length_x_ring"
    ]);
    const parsed = extractSizeParts(fromSize);
    return parsed?.ring || "";
  }

  function getLength(rec) {
    const direct = getField(rec, [
      "Length", "length",
      "Length Inches", "length_inches",
      "Inches", "inches"
    ]);
    if (direct) return cleanLength(direct);

    const fromSize = getField(rec, [
      "Size", "size",
      "Dimensions", "dimensions",
      "Length/Ring", "lengthring",
      "Length x Ring", "length_x_ring"
    ]);
    const parsed = extractSizeParts(fromSize);
    return parsed?.length || "";
  }

  function collectAccolades(records, rec) {
    const key = getKey(rec);
    const brand = getBrand(rec);
    const cigar = getName(rec);
    const vitola = getVitola(rec);

    const matches = records.filter((row) => {
      if (key && getKey(row) === key) return true;
      return getBrand(row) === brand && getName(row) === cigar && getVitola(row) === vitola;
    });

    const seen = new Set();
    const out = [];

    matches.forEach((row) => {
      const media = getField(row, ["Media", "media"]);
      const year = getField(row, ["Year", "year"]);
      const rank = getField(row, ["Rank", "rank"]);
      if (!media && !year && !rank) return;

      const sig = [media, year, rank].join("|");
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push({ media, year, rank });
    });

    return out.slice(0, 6);
  }

  function renderAccolades(accolades) {
    if (!accolades.length) return `<div class="cd-accolade-line cd-accolade-line--empty">—</div>`;

    return accolades.map((item) => {
      const line = [item.rank ? `#${item.rank}` : "", item.year ? `of ${item.year}` : "", item.media || ""]
        .filter(Boolean)
        .join(" - ")
        .replace(" - of ", " of ");
      return `<div class="cd-accolade-line">${escapeHTML(line || "—")}</div>`;
    }).join("");
  }

  function render(rec, accolades) {
    const key = getKey(rec);
    const brand = displayBrand(rec);
    const name = displayName(rec);
    const ring = getRing(rec) || "—";
    const length = getLength(rec) || "—";
    const strength = getStrength(rec) || "—";
    const vitola = getVitola(rec) || "—";
    const shape = getShape(rec) || "—";
    const wrapper = getWrapper(rec) || "—";
    const binder = getBinder(rec) || "—";
    const filler = getFiller(rec) || "—";
    const origin = getOrigin(rec) || "—";
    const shade = getShade(rec) || "—";
    const cigarImg = getCigarImg(rec);
    const brandImg = getBrandImg(rec);
    const flag = flagForCountry(origin);
    const refLink = getField(rec, ["Reference link", "reference_link", "url", "link", "href"]);

    document.title = `${brand} ${name}`.trim();

    shell.innerHTML = `
      <div class="cd-head">
        <div class="cd-head-copy">
          <div class="cd-brand">${escapeHTML(brand)}</div>
          <div class="cd-name">${escapeHTML(name)}</div>
        </div>
        ${brandImg
          ? `<img class="cd-badge" src="${escapeAttr(brandImg)}" alt="${escapeAttr(brand)}" loading="lazy" decoding="async">`
          : `<div class="cd-badge-placeholder">Brand</div>`}
      </div>

      <div class="cd-grid">
        <div class="cd-left">
          ${cigarImg
            ? `<img class="cd-stick" src="${escapeAttr(cigarImg)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async">`
            : `<div class="cd-stick-placeholder">No cigar image</div>`}
        </div>

        <div class="cd-right">
          <div class="cd-stat-grid">
            <div class="cd-card cd-stat">
              <div class="cd-card-label">Ring</div>
              <div class="cd-stat-value">${escapeHTML(ring)}</div>
            </div>
            <div class="cd-card cd-stat">
              <div class="cd-card-label">Length</div>
              <div class="cd-stat-value">${escapeHTML(length)}</div>
            </div>
          </div>

          <div class="cd-mini-grid">
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Vitola</div>
              <div class="cd-mini-value">${escapeHTML(vitola)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Wrapper Shade</div>
              <div class="cd-mini-value">${escapeHTML(shade)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Strength</div>
              <div class="cd-mini-value">${escapeHTML(strength)}</div>
            </div>
            <div class="cd-card cd-mini">
              <div class="cd-card-label">Shape</div>
              <div class="cd-mini-value">${escapeHTML(shape)}</div>
            </div>
          </div>

          <div class="cd-card cd-tobaccos">
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Wrapper</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(wrapper)}</div>
            </div>
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Binder</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(binder)}</div>
            </div>
            <div class="cd-tobacco-row">
              <div class="cd-card-label">Filler</div>
              <div class="cd-tobacco-value wrap-text">${escapeHTML(filler)}</div>
            </div>

            <div class="cd-origin-inline">
              <span class="cd-origin-inline-text">Rolled in ${escapeHTML(origin)}</span>
              ${flag ? `<span class="cd-flag" aria-hidden="true">${flag}</span>` : ``}
            </div>
          </div>

          <div class="cd-accolades-inline">
            ${renderAccolades(accolades)}
          </div>
        </div>
      </div>

      <div class="cd-actions">
        <button class="cd-action" type="button" id="btnCompare">Compare</button>
        <button class="cd-action" type="button" id="btnFavorite">Favorite</button>
        <button class="cd-action" type="button" id="btnWishlist">Wishlist</button>
        <button class="cd-action cd-action--primary" type="button" id="btnConnect">Edit</button>
      </div>
    `;

    const favoriteSet = readSet(FAVORITES_KEY);
    const wishlistSet = readSet(WISHLIST_KEY);
    const compareSet = readSet(COMPARE_KEY);

    const favoriteBtn = $("#btnFavorite", shell);
    const wishlistBtn = $("#btnWishlist", shell);
    const compareBtn = $("#btnCompare", shell);
    const connectBtn = $("#btnConnect", shell);

    function syncButtonState() {
      favoriteBtn?.classList.toggle("is-on", !!key && favoriteSet.has(key));
      wishlistBtn?.classList.toggle("is-on", !!key && wishlistSet.has(key));
      compareBtn?.classList.toggle("is-on", !!key && compareSet.has(key));
    }

    favoriteBtn?.addEventListener("click", () => {
      if (!key) return;
      favoriteSet.has(key) ? favoriteSet.delete(key) : favoriteSet.add(key);
      writeSet(FAVORITES_KEY, favoriteSet);
      syncButtonState();
    });

    wishlistBtn?.addEventListener("click", () => {
      if (!key) return;
      wishlistSet.has(key) ? wishlistSet.delete(key) : wishlistSet.add(key);
      writeSet(WISHLIST_KEY, wishlistSet);
      syncButtonState();
    });

    compareBtn?.addEventListener("click", () => {
      if (!key) return;
      compareSet.has(key) ? compareSet.delete(key) : compareSet.add(key);
      writeSet(COMPARE_KEY, compareSet);
      syncButtonState();
    });

    connectBtn?.addEventListener("click", () => {
      if (refLink) window.open(refLink, "_blank", "noopener,noreferrer");
    });

    syncButtonState();
  }

  function showNotFound() {
    shell.innerHTML = `<div class="cd-loading">Cigar not found.</div>`;
  }

  function findRecord(records, wantedKey, wantedSlug) {
    let rec = null;

    if (wantedKey) {
      rec = records.find((row) => getKey(row) === wantedKey) || null;
    }

    if (!rec && wantedSlug) {
      rec = records.find((row) => makeSlug(row) === wantedSlug) || null;
    }

    if (!rec && wantedKey && wantedKey.includes("|")) {
      const normalizedWanted = normalizeText(wantedKey);
      rec = records.find((row) => normalizeText(buildLegacyId(row)) === normalizedWanted) || null;
    }

    return rec;
  }

  async function boot() {
    const wantedKey = getParam("key") || getParam("id");
    const wantedSlug = getParam("slug");

    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const text = await res.text();
      const records = rowsToObjects(parseCSV(text));
      const rec = findRecord(records, wantedKey, wantedSlug);

      if (!rec) {
        showNotFound();
      } else {
        render(rec, collectAccolades(records, rec));
      }
    } catch (err) {
      console.warn("[cigar detail]", err);
      shell.innerHTML = `<div class="cd-loading">Error loading cigar.</div>`;
    } finally {
      loading?.remove();
    }
  }

  boot();
})();
