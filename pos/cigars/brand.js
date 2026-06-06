/* /pos/cigars/brand.js */

(() => {
  "use strict";

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const BRANDS_URL = "/data/brands.json";
  const POS_CIGAR_FAVORITES_KEY = "cigaros_pos_favorites_cigars";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brandTitle = $("#brand-title");
  const brandIconImg = $("#brand-icon-img");
  const searchInput = $("#brand-search");
  const btnFilters = $("#btn-filters");
  const btnBands = $("#btn-bands");
  const seg = $("#wrapper-seg");
  const segBtns = $$(".seg-btn", seg || document);
  const listEl = $("#brand-list");
  const backBtn = $("#back-btn");
  const brandSearchBtn = $("#brandSearchBtn");

  const state = {
    brand: "",
    brandQuery: "",
    brandMeta: null,
    brandsAll: [],
    rowsAll: [],
    search: "",
    wrapperMode: "all",
    filters: {
      vitola: new Set(),
      ring: new Set(),
      length: new Set(),
      strength: new Set(),
      shape: new Set(),
      shade: new Set(),
    },
    actionRow: null,
    singleQty: 1,
    boxQty: 0,
  };

  function norm(v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeBrand(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeLoose(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/["'’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return value.startsWith("/") ? value : `/${value}`;
  }

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function parseCSV(text) {
    const rows = [];
    let cur = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") {
          cur.push(field);
          field = "";
        } else if (ch === "\n") {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if (ch !== "\r") {
          field += ch;
        }
      }
    }

    cur.push(field);
    rows.push(cur);
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

  function mapRows(csv) {
    const headers = csv[0] || [];
    const keys = headers.map(normalizeHeader);

    return csv
      .slice(1)
      .filter((r) => r && !r.every((c) => !String(c || "").trim()))
      .map((r) => {
        const obj = {};
        keys.forEach((k, i) => {
          obj[k] = (r[i] ?? "").trim();
        });
        return obj;
      });
  }

  function getField(r, keys) {
    for (const k of keys) {
      if (r && r[k] != null && String(r[k]).trim() !== "") {
        return String(r[k]).trim();
      }
    }
    return "";
  }

  function resolveBrandVal(r) {
    return getField(r, ["brand", "brand_name", "manufacturer_brand", "cigar_brand"]);
  }

  function resolveManufacturerVal(r) {
    return getField(r, ["manufacturer", "maker"]);
  }

  function resolveLine(r) {
    return getField(r, ["line", "series"]);
  }

  function resolveName(r) {
    return getField(r, ["cigar", "name"]);
  }

  function resolveVitola(r) {
    return getField(r, ["vitola", "style", "vitola_name", "size"]);
  }

  function resolveOrigin(r) {
    return getField(r, ["origin", "country_of_origin", "country"]);
  }

  function resolveRing(r) {
    return getField(r, ["ring", "ring_gauge", "rg"]);
  }

  function resolveLength(r) {
    return getField(r, ["length"]);
  }

  function resolveShape(r) {
    return getField(r, ["shape"]);
  }

  function resolveWrapper(r) {
    return getField(r, ["wrapper"]);
  }

  function resolveBinder(r) {
    return getField(r, ["binder"]);
  }

  function resolveFiller(r) {
    return getField(r, ["filler"]);
  }

  function resolveStrength(r) {
    return getField(r, ["strength"]);
  }

  function resolveShade(r) {
    return getField(r, ["wrapper_shade", "wrapper_shade_type", "shade", "wrapper"]);
  }

  function resolveBrandImage(r) {
    return getField(r, ["brand_img", "brand_image", "brandicon", "brand_icon"]);
  }

  function resolveLineImage(r) {
    return getField(r, ["line_img", "line_image", "lineicon", "line_icon", "brand_line_img"]);
  }

  function resolveDetailKey(r) {
    return getField(r, ["key", "cigar_id", "id", "row_id"]);
  }

  function resolvePriceNumber(r) {
    const raw = getField(r, ["msrp", "cigar_msrp", "cigar_retail"]);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function resolvePrice(r) {
    const n = resolvePriceNumber(r);
    return n > 0 ? n.toFixed(2) : "—";
  }

  function resolveBoxCount(r) {
    const raw = getField(r, ["box_count", "box_qty", "box_quantity", "count_per_box"]);
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  function resolveBoxMsrpNumber(r) {
    const raw = getField(r, ["box_msrp", "box_price", "box_retail"]);
    const n = Number(String(raw || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
    return resolvePriceNumber(r) * resolveBoxCount(r);
  }

  function resolveDisplayName(r) {
    const line = resolveLine(r);
    const cigar = resolveName(r);
    return [line, cigar].filter(Boolean).join(" ").trim() || cigar || line || "";
  }

  function resolveFavoriteKey(r) {
    return (
      resolveDetailKey(r) ||
      [resolveBrandVal(r), resolveLine(r), resolveName(r), resolveVitola(r)]
        .filter(Boolean)
        .join("|")
    );
  }

  function readCigarFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(POS_CIGAR_FAVORITES_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function writeCigarFavorites(items) {
    localStorage.setItem(POS_CIGAR_FAVORITES_KEY, JSON.stringify(items));
  }

  function isCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    return readCigarFavorites().some((item) => item && item.key === key);
  }

  function saveCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    if (!key) return false;

    const current = readCigarFavorites();
    const exists = current.some((item) => item && item.key === key);

    if (exists) return false;

    current.push({
      type: "cigar",
      section: "cigars",
      key,
      brand: resolveBrandVal(r) || state.brand,
      line: resolveLine(r),
      cigar: resolveName(r),
      displayName: resolveDisplayName(r),
      vitola: resolveVitola(r),
      price: resolvePriceNumber(r),
      boxPrice: resolveBoxMsrpNumber(r),
      savedAt: Date.now(),
    });

    writeCigarFavorites(current);
    return true;
  }

  function removeCigarFavorite(r) {
    const key = resolveFavoriteKey(r);
    writeCigarFavorites(readCigarFavorites().filter((item) => item && item.key !== key));
  }

  function showToast(message) {
    let toast = document.querySelector(".pos-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pos-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("is-showing");

    window.clearTimeout(toast.__timer);
    toast.__timer = window.setTimeout(() => {
      toast.classList.remove("is-showing");
    }, 1300);
  }

  function resolveIsCuban(r) {
    const explicit = getField(r, ["cuban", "is_cuban"]);

    if (explicit) {
      const v = explicit.toLowerCase().trim();
      if (["x", "yes", "true", "1", "cuban"].includes(v)) return true;
      if (["no", "false", "0", "non-cuban", "non cuban"].includes(v)) return false;
    }

    const manufacturer = resolveManufacturerVal(r).toLowerCase();
    const origin = resolveOrigin(r).toLowerCase();

    return manufacturer.includes("habanos") || origin === "cuba";
  }

  function brandDisplayName() {
    return state.brandMeta?.name || state.brand || state.brandQuery || "Brand";
  }

  function brandSlug() {
    return normalizeBrand(state.brandMeta?.slug || state.brandMeta?.name || state.brand || state.brandQuery);
  }

  function brandIconCandidates() {
    const sheetRow = state.rowsAll.find((r) => normalizeAssetPath(resolveBrandImage(r)));
    const fromSheet = normalizeAssetPath(sheetRow ? resolveBrandImage(sheetRow) : "");

    const metaImage = normalizeAssetPath(
      state.brandMeta?.image ||
        state.brandMeta?.icon ||
        state.brandMeta?.svg ||
        state.brandMeta?.img
    );

    const slug = brandSlug();
    const out = [];

    if (fromSheet) out.push(fromSheet);
    if (metaImage) out.push(metaImage);

    if (slug) {
      out.push(`/img/icons/brands/${slug}.svg`);
      out.push(`/img/icons/brands/${slug}.png`);
    }

    return Array.from(new Set(out.filter(Boolean)));
  }

  function brandIconPath() {
    return brandIconCandidates()[0] || "";
  }

  function rowIconCandidatesForRow(r) {
    const lineImg = normalizeAssetPath(resolveLineImage(r));
    const brandImg = normalizeAssetPath(resolveBrandImage(r));

    return Array.from(new Set([lineImg, brandImg, ...brandIconCandidates()].filter(Boolean)));
  }

  function rowIconPathForRow(r) {
    return rowIconCandidatesForRow(r)[0] || "";
  }

  function bindImageFallback(img, candidates = [], finalBehavior = "hide") {
    if (!img) return;

    const list = Array.from(new Set(candidates.filter(Boolean)));
    if (!list.length) {
      if (finalBehavior === "hide") img.style.visibility = "hidden";
      return;
    }

    let idx = 0;
    img.style.visibility = "";
    img.onerror = () => {
      idx++;
      if (idx < list.length) {
        img.src = list[idx];
      } else {
        img.onerror = null;
        if (finalBehavior === "hide") img.style.visibility = "hidden";
      }
    };

    img.src = list[0];
  }

  function makeDetailHref(r) {
    const detailKey = resolveDetailKey(r);

    if (detailKey) {
      return `/pos/cigars/cigar.html?key=${encodeURIComponent(detailKey)}`;
    }

    const fallbackKey = [state.brand, resolveDisplayName(r), resolveVitola(r)]
      .filter(Boolean)
      .join("|");

    return `/pos/cigars/cigar.html?key=${encodeURIComponent(fallbackKey)}`;
  }

  function buildCartItem(r, type = "stick") {
    const isBox = type === "box";
    const unitPrice = isBox ? resolveBoxMsrpNumber(r) : resolvePriceNumber(r);
    const detailKey = resolveDetailKey(r);

    return {
      key: `${detailKey || `${normalizeBrand(state.brand)}|${resolveDisplayName(r)}|${resolveVitola(r)}`}|${type}`,
      type: "cigar",
      purchaseType: type,
      category: "Cigars",
      id: detailKey || resolveName(r),
      brand: state.brand,
      manufacturer: resolveManufacturerVal(r),
      line: resolveLine(r),
      cigar: resolveName(r),
      name: `${resolveDisplayName(r)}${isBox ? " (Box)" : ""}`,
      displayName: resolveDisplayName(r),
      vitola: resolveVitola(r),
      ring: resolveRing(r),
      length: resolveLength(r),
      shape: resolveShape(r),
      wrapper: resolveWrapper(r),
      binder: resolveBinder(r),
      filler: resolveFiller(r),
      origin: resolveOrigin(r),
      shade: resolveShade(r),
      strength: resolveStrength(r),
      image: brandIconPath(),
      msrp: unitPrice,
      boxCount: resolveBoxCount(r),
      url: makeDetailHref(r),
    };
  }

  function money(n) {
  const num = Number(n || 0);

  return Number.isFinite(num)
    ? num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : "0.00";
}

  function ensureActionSheet() {
    if ($("#pos-action-sheet")) return;

    const sheet = document.createElement("div");
    sheet.id = "pos-action-sheet";
    sheet.className = "pos-action-sheet";
    sheet.hidden = true;

    sheet.innerHTML = `
      <div class="pos-action-backdrop" data-action-close></div>

      <div class="pos-action-card" role="dialog" aria-modal="true" aria-label="Add cigar">
        <div class="pos-action-title" id="pos-action-title">Cigar</div>

        <div class="pos-action-lines">
          <div class="pos-action-line">
            <div class="pos-action-line-top">
              <div class="pos-action-label">Single</div>
              <div class="pos-action-stepper">
                <button type="button" data-qty-minus="single">−</button>
                <span id="singleQty">1</span>
                <button type="button" data-qty-plus="single">+</button>
              </div>
            </div>
            <div class="pos-action-line-bottom">
              <span id="singleUnit">0.00</span>
              <span id="singleTotal">0.00</span>
            </div>
          </div>

          <div class="pos-action-line">
            <div class="pos-action-line-top">
              <div class="pos-action-label">Box</div>
              <div class="pos-action-stepper">
                <button type="button" data-qty-minus="box">−</button>
                <span id="boxQty">0</span>
                <button type="button" data-qty-plus="box">+</button>
              </div>
            </div>
            <div class="pos-action-line-bottom">
              <span id="boxUnit">0.00</span>
              <span id="boxTotal">0.00</span>
            </div>
          </div>
        </div>

        <div class="pos-action-total">
          <span>Total:</span>
          <strong id="actionTotal">$0.00</strong>
        </div>

        <div class="pos-action-buttons">
          <button type="button" class="pos-action-cancel" data-action-close>Cancel</button>
          <button type="button" class="pos-action-add" id="actionAddBtn">Add</button>
        </div>

        <button type="button" class="pos-action-favorite" id="actionFavoriteBtn">
          Save as Favorite
        </button>
      </div>
    `;

    document.body.appendChild(sheet);
  }

  function updateActionSheet() {
    const r = state.actionRow;
    if (!r) return;

    const singlePrice = resolvePriceNumber(r);
    const boxPrice = resolveBoxMsrpNumber(r);

    $("#singleQty").textContent = String(state.singleQty);
    $("#boxQty").textContent = String(state.boxQty);

    $("#singleUnit").textContent = money(singlePrice);
    $("#singleTotal").textContent = money(singlePrice * state.singleQty);

    $("#boxUnit").textContent = money(boxPrice);
    $("#boxTotal").textContent = money(boxPrice * state.boxQty);

    $("#actionTotal").textContent = `$${money(singlePrice * state.singleQty + boxPrice * state.boxQty)}`;

    const favBtn = $("#actionFavoriteBtn");
    if (favBtn) {
      const fav = isCigarFavorite(r);
      favBtn.textContent = fav ? "Saved as Favorite" : "Save as Favorite";
      favBtn.classList.toggle("is-saved", fav);
    }
  }

  function openActionSheet(r) {
    ensureActionSheet();

    state.actionRow = r;
    state.singleQty = 1;
    state.boxQty = 0;

    $("#pos-action-title").textContent = resolveDisplayName(r) || "Cigar";

    updateActionSheet();

    const sheet = $("#pos-action-sheet");
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add("is-open"));

    if (navigator.vibrate) navigator.vibrate(8);
  }

  function closeActionSheet() {
    const sheet = $("#pos-action-sheet");
    if (!sheet) return;

    sheet.classList.remove("is-open");
    window.setTimeout(() => {
      if (!sheet.classList.contains("is-open")) sheet.hidden = true;
    }, 180);
  }

  function addActionItemsToCart() {
    const r = state.actionRow;
    if (!r) return;

    if (state.singleQty > 0) {
      const stickItem = buildCartItem(r, "stick");
      const currentQty = window.cigarOSCart?.getItemQty?.(stickItem) || 0;
      window.cigarOSCart?.setQty?.(stickItem, currentQty + state.singleQty);
    }

    if (state.boxQty > 0) {
      const boxItem = buildCartItem(r, "box");
      const currentQty = window.cigarOSCart?.getItemQty?.(boxItem) || 0;
      window.cigarOSCart?.setQty?.(boxItem, currentQty + state.boxQty);
    }

    if (navigator.vibrate) navigator.vibrate(12);

    showToast("Added to invoice");
    closeActionSheet();
  }

  function openDetail(r) {
    window.location.href = makeDetailHref(r);
  }

  function applySearch(rows) {
    const q = state.search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        resolveDisplayName(r),
        resolveVitola(r),
        resolveRing(r),
        resolveLength(r),
        resolveManufacturerVal(r),
        resolveLine(r),
        resolveOrigin(r),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }

  function applyFilterSets(rows) {
    return rows.filter((r) => {
      if (state.filters.vitola.size && !state.filters.vitola.has(resolveVitola(r))) return false;
      if (state.filters.ring.size && !state.filters.ring.has(resolveRing(r))) return false;
      if (state.filters.length.size && !state.filters.length.has(resolveLength(r))) return false;
      if (state.filters.strength.size && !state.filters.strength.has(resolveStrength(r))) return false;
      if (state.filters.shape.size && !state.filters.shape.has(resolveShape(r))) return false;
      if (state.filters.shade.size && !state.filters.shade.has(resolveShade(r))) return false;
      return true;
    });
  }

  function renderList(rows) {
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      return;
    }

    rows.forEach((r) => {
      const rowIconCandidates = rowIconCandidatesForRow(r);
      const rowIconPath = rowIconPathForRow(r);
      const priceText = resolvePrice(r);
      const isCuban = resolveIsCuban(r);

      const row = document.createElement("article");
      row.className = "brand-row";
      if (isCuban) row.setAttribute("data-cuban", "true");

      row.innerHTML = `
        <img class="row-ico" src="${esc(rowIconPath)}" alt="" loading="lazy" decoding="async" />

        <div class="brand-row-left">
          <div class="brand-row-title-wrap">
            <div class="brand-row-title">${esc(resolveDisplayName(r) || "Unnamed cigar")}</div>
            ${isCuban ? `<div class="brand-row-flag" aria-hidden="true">🇨🇺</div>` : ""}
          </div>
          <div class="brand-row-sub">${esc(resolveVitola(r) || "—")}</div>
        </div>

        <div class="brand-row-right">
          <div class="brand-row-msrp">${esc(priceText)}</div>
          <button class="qty-btn qty-btn--plus" type="button" aria-label="Open add menu">+</button>
        </div>
      `;

      const icon = $(".row-ico", row);
      const left = $(".brand-row-left", row);
      const title = $(".brand-row-title", row);
      const plusBtn = $(".qty-btn--plus", row);

      bindImageFallback(icon, rowIconCandidates, "hide");

      left?.addEventListener("click", () => openDetail(r));
      title?.addEventListener("click", () => openDetail(r));
      icon?.addEventListener("click", () => openDetail(r));

      plusBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        openActionSheet(r);
      });

      listEl.appendChild(row);
    });
  }

  function applyAll() {
    let rows = [...state.rowsAll];
    rows = applyFilterSets(rows);
    rows = applySearch(rows);
    renderList(rows);
    setBrandHeader();
  }

  function ensureBrandManufacturerMeta() {
    const titleBlock = document.querySelector(".brand-title-block");
    if (!titleBlock) return null;

    let meta = titleBlock.querySelector(".brand-manufacturer");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "brand-manufacturer";
      titleBlock.appendChild(meta);
    }

    return meta;
  }

  function setBrandHeader() {
    const displayBrand = brandDisplayName();

    if (brandTitle) brandTitle.textContent = displayBrand || "Brand";

    const manufacturerMeta = ensureBrandManufacturerMeta();
    const firstRow = state.rowsAll[0];
    const manufacturer = firstRow ? resolveManufacturerVal(firstRow) : "";

    if (manufacturerMeta) {
      const show = manufacturer && normalizeBrand(manufacturer) !== normalizeBrand(displayBrand);
      const isCubanBrand = firstRow && resolveIsCuban(firstRow);

      manufacturerMeta.textContent = show ? `${isCubanBrand ? "🇨🇺 " : ""}${manufacturer}` : "";
      manufacturerMeta.style.display = show ? "" : "none";
    }

    if (!brandIconImg) return;

    brandIconImg.alt = displayBrand || "Brand";
    bindImageFallback(brandIconImg, brandIconCandidates(), "hide");
  }

  function findBrandMeta(query, brands) {
    const q = normalizeBrand(query);
    if (!q || !Array.isArray(brands)) return null;

    return (
      brands.find((b) => normalizeBrand(b.slug) === q) ||
      brands.find((b) => normalizeBrand(b.name) === q) ||
      brands.find((b) => {
        const slug = normalizeBrand(b.slug);
        const name = normalizeBrand(b.name);
        return !!slug && (slug.includes(q) || q.includes(slug) || name.includes(q) || q.includes(name));
      }) ||
      null
    );
  }

  async function loadBrandsMeta() {
    try {
      const res = await fetch(`${BRANDS_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`brands.json fetch failed: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function chooseRowsForBrand(rows) {
    const query = normalizeBrand(state.brandQuery);
    const metaSlug = normalizeBrand(state.brandMeta?.slug);
    const metaName = normalizeBrand(state.brandMeta?.name);
    const stateBrand = normalizeBrand(state.brand);

    const needles = Array.from(new Set([query, metaSlug, metaName, stateBrand].filter(Boolean)));

    const CUBAN_CONFLICT_BRANDS = new Set([
      "cohiba",
      "montecristo",
      "hupmann",
      "hoyodemonterrey",
      "saintluisrey",
      "sanchopanza",
      "trinidad",
      "sancristobaldelahabana",
    ]);

    const isConflictBrand = needles.some((n) => CUBAN_CONFLICT_BRANDS.has(n));

    let exact = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return needles.includes(rb);
    });

    if (isConflictBrand) {
      const cubanRows = exact.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (exact.length) return exact;

    const fuzzy = rows.filter((r) => {
      const rb = normalizeBrand(resolveBrandVal(r));
      return rb && needles.some((n) => rb.includes(n) || n.includes(rb));
    });

    if (isConflictBrand) {
      const cubanRows = fuzzy.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (fuzzy.length) return fuzzy;

    const manufacturerFallback = rows.filter((r) => {
      const rm = normalizeBrand(resolveManufacturerVal(r));
      return needles.includes(rm);
    });

    if (isConflictBrand) {
      const cubanRows = manufacturerFallback.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    if (manufacturerFallback.length) return manufacturerFallback;

    const loose = rows.filter((r) => {
      const brand = normalizeLoose(resolveBrandVal(r));
      const q = normalizeLoose(state.brandQuery);
      return brand && q && (brand.includes(q) || q.includes(brand));
    });

    if (isConflictBrand) {
      const cubanRows = loose.filter(resolveIsCuban);
      if (cubanRows.length) return cubanRows;
    }

    return loose;
  }

  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = "/pos/cigars/";
  });

  searchInput?.addEventListener("input", () => {
    state.search = searchInput.value || "";
    applyAll();
  });

  brandSearchBtn?.addEventListener("click", () => {
    window.openGlobalSearch?.();
  });

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-action-close]")) {
      closeActionSheet();
      return;
    }

    const singlePlus = target.closest("[data-qty-plus='single']");
    const singleMinus = target.closest("[data-qty-minus='single']");
    const boxPlus = target.closest("[data-qty-plus='box']");
    const boxMinus = target.closest("[data-qty-minus='box']");

    if (singlePlus) {
      state.singleQty += 1;
      updateActionSheet();
      return;
    }

    if (singleMinus) {
      state.singleQty = Math.max(0, state.singleQty - 1);
      updateActionSheet();
      return;
    }

    if (boxPlus) {
      state.boxQty += 1;
      updateActionSheet();
      return;
    }

    if (boxMinus) {
      state.boxQty = Math.max(0, state.boxQty - 1);
      updateActionSheet();
      return;
    }

    if (target.closest("#actionAddBtn")) {
      addActionItemsToCart();
      return;
    }

    if (target.closest("#actionFavoriteBtn")) {
      if (!state.actionRow) return;

      if (isCigarFavorite(state.actionRow)) {
        removeCigarFavorite(state.actionRow);
        showToast("Removed from Favorites");
      } else {
        saveCigarFavorite(state.actionRow);
        showToast("Saved to Favorites");
      }

      updateActionSheet();

      if (navigator.vibrate) navigator.vibrate(10);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeActionSheet();
  });

  if (btnBands) btnBands.style.display = "none";
  if (seg) seg.style.display = "none";
  segBtns.forEach((b) => b.classList.remove("is-on"));

  async function boot() {
    if (!listEl) return;

    ensureActionSheet();

    state.brandQuery = (getParam("brand") || "Padron").trim();

    state.brandsAll = await loadBrandsMeta();
    state.brandMeta = findBrandMeta(state.brandQuery, state.brandsAll);
    state.brand = state.brandMeta?.name || state.brandQuery;

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const txt = await res.text();
    const rows = mapRows(parseCSV(txt));

    const chosenRows = chooseRowsForBrand(rows);

    state.rowsAll = chosenRows.map((r) => ({
      ...r,
      wrapper_shade: resolveShade(r),
    }));

    if (!state.rowsAll.length) {
      listEl.innerHTML = `<div class="empty">No cigars found for ${esc(brandDisplayName())}</div>`;
      setBrandHeader();
      return;
    }

    applyAll();
  }

  boot().catch((err) => {
    console.error("Brand page boot failed:", err);
    if (listEl) listEl.innerHTML = `<div class="empty">Error loading brand.</div>`;
  });
})();
