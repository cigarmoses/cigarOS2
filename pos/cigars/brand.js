/* /pos/cigars/brand.js
   Brand POS page controller (FINAL)
   Fixes:
   - Stable DOM boot (waits for DOMContentLoaded)
   - Robust Google Sheets CSV fetch (detects HTML login response)
   - Brand matching (Brand column vs Manufacturer column confusion)
   - Proper row layout (forces flex layout if CSS missing)
   - Bands modal: works + images fit + Close + Confirm (no null errors)
   - Filters modal: populates like main POS page (minus Manufacturer/Brand)
   - Maduro/Natural toggle: words + middle switch all clickable
   - Add-to-bill works + Receipt FAB bottom-right
*/

(() => {
  // =========================
  // 1) CONFIG (SET THIS)
  // =========================
  // Use the SAME CSV export URL as your main cigars page.
  // IMPORTANT: Use a CSV endpoint, NOT the /edit link.
  //
  // Recommended formats:
  // 1) https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
  // 2) https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=<GID>
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  const CART_KEY = "cigaros_pos_cart_v1";

  // Padron band art assets
  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "/img/icons/padron1926serieband.svg" },
    { key: "1964", label: "1964", img: "/img/icons/padron1964anniversaryband.svg" },
    { key: "Damaso", label: "Damaso", img: "/img/icons/padrondamasoband.svg" },
  ];

  // Receipt icon
  const RECEIPT_ICON_SRC = "/img/icons/pos/receipt.png";

  // =========================
  // 2) HELPERS
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeText = (v) => (v == null ? "" : String(v)).trim();

  function money(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return "0.00";
    return x.toFixed(2);
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  }

  function slugBrand(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['".]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function resolveBrandIcon(brandName) {
    const slug = slugBrand(brandName);
    return {
      primary: `/img/icons/brands/${slug}.svg`,
      fallback: `/img/icons/brand/${slug}.svg`,
    };
  }

  // Normalize header keys so we can match columns even if naming varies
  function normKey(k) {
    return String(k || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function getField(obj, keys) {
    // keys = array of possible header names (raw); we match by normalized header
    if (!obj) return "";
    const map = obj.__keymap || null;
    if (!map) {
      // build on-demand
      const km = {};
      Object.keys(obj).forEach((k) => (km[normKey(k)] = k));
      obj.__keymap = km;
    }
    for (const k of keys) {
      const nk = normKey(k);
      const real = obj.__keymap[nk];
      if (real && safeText(obj[real])) return safeText(obj[real]);
    }
    return "";
  }

  // Robust CSV parse
  function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];

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
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      cur += ch;
    }

    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    return rows.filter((r) => r.some((c) => String(c || "").trim() !== ""));
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => safeText(h));
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
  }

  // =========================
  // 3) STATE
  // =========================
  const state = {
    brand: safeText(getQueryParam("brand")),
    allRows: [],
    viewRows: [],
    search: "",
    shadeState: "all", // "maduro" | "natural" | "all"
    selectedBands: new Set(),
    filters: {
      Shade: new Set(),
      Vitola: new Set(),
      Ring: new Set(),
      Strength: new Set(),
      Length: new Set(),
      Shape: new Set(),
      Tubo: new Set(),
      Flavored: new Set(),
      Tin: new Set(),
      Pack: new Set(),
      Barberpole: new Set(),
      "Box-Pressed": new Set(),
    },
  };

  // =========================
  // 4) DOM (with strong fallbacks)
  // =========================
  function findButtonByText(rx) {
    const btns = $$("button");
    return btns.find((b) => rx.test((b.textContent || "").trim()));
  }

  function refreshEls() {
    return {
      title: $(".brand-title"),
      brandIcon: $(".brand-icon"),
      search: $("#brand-search") || $("input[type='search']"),
      list: $(".brand-list") || $("#brand-list") || $("main") || document.body,

      // Controls (fallback: match by text)
      btnBands:
        $("#bands-btn") ||
        $(".pill-btn[data-action='bands']") ||
        $(".pill-btn.bands") ||
        findButtonByText(/^bands$/i),

      btnFilters:
        $("#filters-btn") ||
        $(".pill-btn[data-action='filters']") ||
        $(".pill-btn.filters") ||
        findButtonByText(/^filters$/i),

      seg: $(".seg"),
      segDot: $(".seg .seg-dot"),
      segMaduro:
        $(".seg [data-side='maduro']") ||
        $(".seg .seg-btn[data-value='maduro']") ||
        $(".seg .seg-btn.maduro") ||
        (() => {
          const s = $(".seg");
          if (!s) return null;
          const btns = $$("button", s).filter((b) => !b.classList.contains("seg-dot"));
          return btns[0] || null;
        })(),
      segNatural:
        $(".seg [data-side='natural']") ||
        $(".seg .seg-btn[data-value='natural']") ||
        $(".seg .seg-btn.natural") ||
        (() => {
          const s = $(".seg");
          if (!s) return null;
          const btns = $$("button", s).filter((b) => !b.classList.contains("seg-dot"));
          return btns[btns.length - 1] || null;
        })(),

      error: $("#brand-error") || $(".brand-error"),
    };
  }

  let el = null;

  // =========================
  // 5) HEADER
  // =========================
  function initHeader() {
    if (el.title) el.title.textContent = state.brand || "Brand";

    if (el.brandIcon) {
      const { primary, fallback } = resolveBrandIcon(state.brand);
      el.brandIcon.src = primary;
      el.brandIcon.onerror = () => {
        el.brandIcon.onerror = null;
        el.brandIcon.src = fallback;
      };
      el.brandIcon.alt = state.brand || "Brand";
    }
  }

  function showError(msg) {
    if (el.error) {
      el.error.textContent = msg;
      el.error.style.display = "block";
      return;
    }
    const p = document.createElement("p");
    p.id = "brand-error";
    p.style.margin = "18px 14px 0";
    p.style.color = "rgba(255,120,120,.95)";
    p.style.fontWeight = "800";
    p.textContent = msg;
    document.body.appendChild(p);
  }

  // =========================
  // 6) LOAD SHEET
  // =========================
  async function loadSheet() {
    if (!SHEET_CSV_URL) {
      showError("Missing SHEET_CSV_URL.");
      return [];
    }

    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();

      // If Google returns an HTML page (not CSV), your sheet isn’t published / accessible.
      const head = txt.slice(0, 300).toLowerCase();
      if (head.includes("<!doctype html") || head.includes("<html")) {
        throw new Error("Google returned HTML (not CSV). Publish the sheet or use export?format=csv.");
      }

      const rows = parseCSV(txt);
      return rowsToObjects(rows);
    } catch (err) {
      console.error("Sheet load error:", err);
      showError("Brand failed to load from Google Sheets CSV. (Sheet may not be published / CORS / wrong URL)");
      return [];
    }
  }

  // =========================
  // 7) ROW RENDER (forces layout)
  // =========================
  function forceRowStyles(row, img, mid, right, priceEl, plus, divider) {
    // If your brand.css loads, it will override these. If it doesn't, the page still looks correct.
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "12px";
    row.style.padding = "12px 14px";
    row.style.borderBottom = "1px solid rgba(255,255,255,.10)";

    img.style.width = "46px";
    img.style.height = "46px";
    img.style.borderRadius = "12px";
    img.style.objectFit = "cover";
    img.style.flex = "0 0 auto";
    img.style.background = "rgba(255,255,255,.07)";

    mid.style.flex = "1 1 auto";
    mid.style.minWidth = "0";

    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";
    right.style.flex = "0 0 auto";

    divider.style.width = "1px";
    divider.style.height = "38px";
    divider.style.background = "rgba(255,255,255,.14)";

    priceEl.style.width = "60px";
    priceEl.style.textAlign = "right";
    priceEl.style.fontWeight = "700";

    plus.style.width = "28px";
    plus.style.height = "28px";
    plus.style.borderRadius = "999px";
    plus.style.border = "none";
    plus.style.background = "#34c759";
    plus.style.color = "#fff";
    plus.style.fontWeight = "900";
    plus.style.display = "grid";
    plus.style.placeItems = "center";
  }

  function renderList(rows) {
    if (!el.list) return;

    // Ensure list container exists and isn’t polluted by modal HTML
    // If the page has .brand-list, use it. Otherwise, create one after the controls.
    let listRoot = $(".brand-list");
    if (!listRoot) {
      const main = $(".brand-main") || $("main") || document.body;
      listRoot = document.createElement("div");
      listRoot.className = "brand-list";
      listRoot.style.marginTop = "14px";
      listRoot.style.borderTop = "1px solid rgba(255,255,255,.10)";
      main.appendChild(listRoot);
    }
    el.list = listRoot;

    el.list.innerHTML = "";

    rows.forEach((c) => {
      const cigarName =
        getField(c, ["Cigar", "Cigar Name", "Name"]) ||
        "(Unnamed cigar)";

      const vitola = getField(c, ["Vitola", "Style"]);
      const shade = getField(c, ["Wrapper Shade", "Shade"]);
      const sub = vitola || shade || "";

      const priceRaw = getField(c, ["MSRP", "Price", "Cigar MSRP", "MSRP ($)"]);
      const priceNum = Number(priceRaw) || 0;

      const row = document.createElement("div");
      row.className = "cigar-row";

      const img = document.createElement("img");
      img.className = "cigar-img";
      const { primary, fallback } = resolveBrandIcon(state.brand);
      img.src = primary;
      img.onerror = () => {
        img.onerror = null;
        img.src = fallback;
      };
      img.alt = state.brand;

      const mid = document.createElement("div");
      mid.className = "cigar-mid";

      const nameEl = document.createElement("div");
      nameEl.className = "cigar-name";
      nameEl.textContent = cigarName;

      const subEl = document.createElement("div");
      subEl.className = "cigar-sub";
      subEl.textContent = sub;

      // minimal text styling fallback
      nameEl.style.fontWeight = "800";
      nameEl.style.letterSpacing = "-0.01em";
      subEl.style.marginTop = "4px";
      subEl.style.opacity = "0.70";
      subEl.style.fontWeight = "700";
      subEl.style.fontSize = "12px";
      nameEl.style.fontSize = "15px";

      mid.appendChild(nameEl);
      mid.appendChild(subEl);

      const right = document.createElement("div");
      right.className = "cigar-right";

      const divider = document.createElement("div");
      divider.className = "cigar-divider";

      const priceEl = document.createElement("div");
      priceEl.className = "cigar-price";
      priceEl.textContent = money(priceNum);

      const plus = document.createElement("button");
      plus.className = "cigar-plus";
      plus.type = "button";
      plus.textContent = "+";
      plus.addEventListener("click", () => {
        addToCart({
          brand: state.brand,
          cigar: cigarName,
          vitola,
          price: priceNum,
        });
      });

      right.appendChild(divider);
      right.appendChild(priceEl);
      right.appendChild(plus);

      row.appendChild(img);
      row.appendChild(mid);
      row.appendChild(right);

      // force layout so we always get “rows back”
      forceRowStyles(row, img, mid, right, priceEl, plus, divider);

      el.list.appendChild(row);
    });
  }

  // =========================
  // 8) FILTER LOGIC
  // =========================
  function normalizeShade(s) {
    const x = safeText(s).toLowerCase();
    if (!x) return "";
    if (x.includes("maduro")) return "maduro";
    if (x.includes("natural")) return "natural";
    return x;
  }

  function rowBrandValue(r) {
    // Your sheet: Brand is column C; Manufacturer is column A.
    // We prioritize Brand matches first.
    return (
      getField(r, ["Brand"]) ||
      getField(r, ["Brand Name"]) ||
      getField(r, ["Manufacturer"]) ||
      safeText(state.brand)
    );
  }

  function applyAllFilters() {
    const q = state.search.toLowerCase();
    const shadeState = state.shadeState;

    let out = state.allRows.slice();

    // Brand filter (strict against Brand column)
    out = out.filter((r) => {
      const b = rowBrandValue(r).toLowerCase();
      return !state.brand || b === state.brand.toLowerCase();
    });

    // Search
    if (q) {
      out = out.filter((r) => {
        const cigarName = (getField(r, ["Cigar", "Cigar Name", "Name"]) || "").toLowerCase();
        const vitola = (getField(r, ["Vitola", "Style"]) || "").toLowerCase();
        return (cigarName + " " + vitola).includes(q);
      });
    }

    // Maduro/Natural tri-state
    if (shadeState !== "all") {
      out = out.filter((r) => {
        const shade = getField(r, ["Wrapper Shade", "Shade"]);
        return normalizeShade(shade) === shadeState;
      });
    }

    // Bands filter (matches Line/Series columns)
    if (state.selectedBands.size) {
      out = out.filter((r) => {
        const line = (
          getField(r, ["Line"]) ||
          getField(r, ["Series"]) ||
          getField(r, ["Band"]) ||
          getField(r, ["Band Art"]) ||
          ""
        ).toLowerCase();

        for (const k of state.selectedBands) {
          if (line.includes(String(k).toLowerCase())) return true;
        }
        return false;
      });
    }

    // Chips filter map
    const filterMap = [
      ["Shade", ["Wrapper Shade", "Shade"]],
      ["Vitola", ["Vitola", "Style"]],
      ["Ring", ["RG", "Ring", "Ring Gauge"]],
      ["Strength", ["Strength"]],
      ["Length", ["Length"]],
      ["Shape", ["Shape"]],
      ["Tubo", ["Tubo"]],
      ["Flavored", ["Flavored"]],
      ["Tin", ["Tin"]],
      ["Pack", ["Pack"]],
      ["Barberpole", ["Barber", "Barberpole"]],
      ["Box-Pressed", ["Box-Pressed", "Box Pressed", "BoxPressed"]],
    ];

    for (const [filterKey, cols] of filterMap) {
      const set = state.filters[filterKey];
      if (!set || set.size === 0) continue;

      out = out.filter((r) => {
        const val = getField(r, cols) || "";
        if (!val) return false;

        const v = val.toLowerCase();
        for (const wanted of set) {
          const w = String(wanted).toLowerCase();
          if (v === w) return true;
          if (v.includes(w)) return true;
        }
        return false;
      });
    }

    state.viewRows = out;
    renderList(out);
  }

  // =========================
  // 9) TOGGLE (tri-state) — words + pill clickable
  // =========================
  function setShadeState(next) {
    state.shadeState = next;
    if (el.seg) el.seg.dataset.state = next;

    // aria states (if markup supports it)
    if (el.segMaduro) el.segMaduro.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    if (el.segNatural) el.segNatural.setAttribute("aria-pressed", next === "natural" ? "true" : "false");

    applyAllFilters();
  }

  function initShadeToggle() {
    if (!el.seg) return;

    if (!el.seg.dataset.state) el.seg.dataset.state = "all";
    setShadeState(el.seg.dataset.state);

    // Click "Maduro" word
    el.segMaduro?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setShadeState(state.shadeState === "maduro" ? "all" : "maduro");
    });

    // Click "Natural" word
    el.segNatural?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setShadeState(state.shadeState === "natural" ? "all" : "natural");
    });

    // Click the switch itself (dot)
    el.segDot?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.shadeState === "all") return setShadeState("natural");
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });

    // Click anywhere on the segmented control (except label buttons)
    el.seg.addEventListener("click", (e) => {
      if (e.target.closest(".seg-btn")) return; // labels already handled
      if (e.target.closest(".seg-dot")) return; // handled above
      if (state.shadeState === "all") return setShadeState("natural");
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });
  }

  // =========================
  // 10) MODALS (guaranteed hidden even if CSS fails)
  // =========================
  function ensureModalShell(id, titleText) {
    let modal = document.getElementById(id);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = id;

    // HARD hide by default (prevents the “stacked Receipt/Bands/Filters on page” problem)
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "9999";
    modal.style.display = "none";

    modal.innerHTML = `
      <div class="modal-scrim" style="
        position:absolute; inset:0;
        background: rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
      "></div>

      <div class="modal-card" style="
        position:absolute;
        left:50%; top:50%;
        transform: translate(-50%, -50%);
        width: min(520px, calc(100vw - 28px));
        max-height: min(72vh, 640px);
        border-radius: 22px;
        background: rgba(20,30,55,.94);
        border: 1px solid rgba(255,255,255,.10);
        overflow: hidden;
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        display:flex;
        flex-direction:column;
      ">
        <div class="modal-head" style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        ">
          <div class="modal-title" style="font-size:22px; font-weight:900; letter-spacing:-.01em;">
            ${titleText}
          </div>
          <button class="modal-x" type="button" aria-label="Close" style="
            width:38px; height:38px;
            border-radius:12px;
            border:1px solid rgba(255,255,255,.12);
            background: rgba(255,255,255,.06);
            color: rgba(255,255,255,.9);
            font-size:18px;
          ">×</button>
        </div>

        <div class="modal-body" style="
          padding: 14px 16px;
          overflow:auto;
          -webkit-overflow-scrolling: touch;
          flex: 1 1 auto;
        "></div>

        <div class="modal-foot" style="
          display:flex;
          gap:10px;
          padding: 14px 16px 16px;
          border-top: 1px solid rgba(255,255,255,.08);
        ">
          <button class="modal-btn ghost" type="button" data-action="close" style="
            flex:1; height:48px;
            border-radius:16px;
            border:1px solid rgba(255,255,255,.12);
            background: rgba(255,255,255,.06);
            color: rgba(255,255,255,.88);
            font-weight:900; font-size:18px;
          ">Close</button>

          <button class="modal-btn primary" type="button" data-action="confirm" style="
            flex:1; height:48px;
            border-radius:16px;
            border:1px solid rgba(15,122,255,.90);
            background: rgba(15,122,255,.85);
            color:#fff;
            font-weight:900; font-size:18px;
          ">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => setModalOpen(modal, false);
    $(".modal-scrim", modal).addEventListener("click", close);
    $(".modal-x", modal).addEventListener("click", close);
    $("[data-action='close']", modal).addEventListener("click", close);

    return modal;
  }

  function setModalOpen(modalEl, open) {
    modalEl.style.display = open ? "block" : "none";
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }

  // Bands modal
  function openBandsModal() {
    const modal = ensureModalShell("bands-modal", "Bands");
    const body = $(".modal-body", modal);

    body.innerHTML = `
      <div style="display:grid; gap:14px;">
        ${PADRON_BANDS.map((b) => {
          const checked = state.selectedBands.has(b.key);
          return `
            <label style="
              display:grid; gap:10px;
              padding:12px;
              border-radius:18px;
              border:1px solid rgba(255,255,255,.10);
              background: rgba(255,255,255,.05);
            ">
              <img src="${b.img}" alt="${b.label}" style="
                width: 100%;
                height: auto;
                max-height: 140px;
                object-fit: contain;
                border-radius: 16px;
                background: rgba(0,0,0,.10);
                border:1px solid rgba(255,255,255,.10);
              " />
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <div style="font-weight:900; font-size:18px;">${b.label}</div>
                <input type="checkbox" data-band="${b.key}" ${checked ? "checked" : ""} style="transform:scale(1.25);" />
              </div>
            </label>
          `;
        }).join("")}
      </div>
    `;

    const closeBtn = $("[data-action='close']", modal);
    const confirmBtn = $("[data-action='confirm']", modal);

    closeBtn.textContent = "Close";
    confirmBtn.textContent = "Confirm";

    confirmBtn.onclick = () => {
      const checks = $$("input[type='checkbox'][data-band]", modal);
      state.selectedBands = new Set(checks.filter((c) => c.checked).map((c) => c.dataset.band));
      setModalOpen(modal, false);
      applyAllFilters();
    };

    setModalOpen(modal, true);
  }

  // Filters modal
  function openFiltersModal() {
    const modal = ensureModalShell("filters-modal", "Filters");
    const body = $(".modal-body", modal);

    const scoped = state.allRows.filter((r) => rowBrandValue(r).toLowerCase() === state.brand.toLowerCase());

    const optionSets = {
      Shade: new Set(),
      Vitola: new Set(),
      Ring: new Set(),
      Strength: new Set(),
      Length: new Set(),
      Shape: new Set(),
      Tubo: new Set(),
      Flavored: new Set(),
      Tin: new Set(),
      Pack: new Set(),
      Barberpole: new Set(),
      "Box-Pressed": new Set(),
    };

    for (const r of scoped) {
      const add = (k, v) => {
        const t = safeText(v);
        if (t) optionSets[k].add(t);
      };

      add("Shade", getField(r, ["Wrapper Shade", "Shade"]));
      add("Vitola", getField(r, ["Vitola", "Style"]));
      add("Ring", getField(r, ["RG", "Ring", "Ring Gauge"]));
      add("Strength", getField(r, ["Strength"]));
      add("Length", getField(r, ["Length"]));
      add("Shape", getField(r, ["Shape"]));
      add("Tubo", getField(r, ["Tubo"]));
      add("Flavored", getField(r, ["Flavored"]));
      add("Tin", getField(r, ["Tin"]));
      add("Pack", getField(r, ["Pack"]));
      add("Barberpole", getField(r, ["Barber", "Barberpole"]));
      add("Box-Pressed", getField(r, ["Box-Pressed", "Box Pressed", "BoxPressed"]));
    }

    function chipGroup(title, key) {
      const opts = Array.from(optionSets[key]).sort((a, b) => String(a).localeCompare(String(b)));
      if (!opts.length) return "";

      const selected = state.filters[key];

      return `
        <div style="margin:0 0 16px;">
          <div style="font-weight:900; font-size:16px; color:rgba(255,255,255,.85); margin:0 0 8px;">
            ${title}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${opts.map((v) => {
              const on = selected.has(v);
              return `
                <button type="button"
                  data-filter="${key}"
                  data-value="${encodeURIComponent(v)}"
                  style="
                    height:36px;
                    padding:0 12px;
                    border-radius:999px;
                    border:1px solid rgba(255,255,255,.12);
                    background:${on ? "rgba(15,122,255,.20)" : "rgba(255,255,255,.06)"};
                    color:${on ? "rgba(15,122,255,.95)" : "rgba(255,255,255,.86)"};
                    font-weight:${on ? "900" : "750"};
                    font-size:13px;
                  ">
                  ${v}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      ${chipGroup("Shade", "Shade")}
      ${chipGroup("Vitola", "Vitola")}
      ${chipGroup("Ring", "Ring")}
      ${chipGroup("Strength", "Strength")}
      ${chipGroup("Length", "Length")}
      ${chipGroup("Shape", "Shape")}
      ${chipGroup("Tubo", "Tubo")}
      ${chipGroup("Flavored", "Flavored")}
      ${chipGroup("Tin", "Tin")}
      ${chipGroup("Pack", "Pack")}
      ${chipGroup("Barberpole", "Barberpole")}
      ${chipGroup("Box-Pressed", "Box-Pressed")}
    `;

    // chip toggle (event delegation)
    body.onclick = (e) => {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      const key = btn.dataset.filter;
      const val = decodeURIComponent(btn.dataset.value || "");
      if (!state.filters[key]) state.filters[key] = new Set();
      if (state.filters[key].has(val)) state.filters[key].delete(val);
      else state.filters[key].add(val);

      // refresh UI in-place
      openFiltersModal();
    };

    const closeBtn = $("[data-action='close']", modal);
    const confirmBtn = $("[data-action='confirm']", modal);

    closeBtn.textContent = "Close";
    confirmBtn.textContent = "Confirm";

    confirmBtn.onclick = () => {
      setModalOpen(modal, false);
      applyAllFilters();
    };

    setModalOpen(modal, true);
  }

  // =========================
  // 11) CART + RECEIPT
  // =========================
  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function addToCart(item) {
    const cart = readCart();
    cart.push({
      ...item,
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      qty: 1,
    });
    writeCart(cart);
    bumpReceiptCount();
  }

  function ensureReceiptButton() {
    let btn = $("#receipt-fab");
    if (btn) return btn;

    btn = document.createElement("button");
    btn.id = "receipt-fab";
    btn.type = "button";
    btn.setAttribute("aria-label", "Receipt");
    btn.style.position = "fixed";
    btn.style.right = "14px";
    btn.style.bottom = "16px";
    btn.style.width = "58px";
    btn.style.height = "58px";
    btn.style.borderRadius = "18px";
    btn.style.border = "1px solid rgba(255,255,255,.14)";
    btn.style.background = "rgba(255,255,255,.10)";
    btn.style.backdropFilter = "blur(10px)";
    btn.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
    btn.style.display = "grid";
    btn.style.placeItems = "center";
    btn.style.zIndex = "60";

    const img = document.createElement("img");
    img.src = RECEIPT_ICON_SRC;
    img.alt = "";
    img.style.width = "28px";
    img.style.height = "28px";
    img.style.opacity = "0.95";
    img.onerror = () => {
      img.style.display = "none";
      btn.textContent = "🧾";
      btn.style.fontSize = "22px";
    };

    const badge = document.createElement("div");
    badge.id = "receipt-badge";
    badge.style.position = "absolute";
    badge.style.top = "8px";
    badge.style.right = "8px";
    badge.style.minWidth = "18px";
    badge.style.height = "18px";
    badge.style.padding = "0 6px";
    badge.style.borderRadius = "999px";
    badge.style.background = "rgba(52,199,89,.95)";
    badge.style.color = "#fff";
    badge.style.fontWeight = "900";
    badge.style.fontSize = "12px";
    badge.style.display = "none";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";

    btn.appendChild(img);
    btn.appendChild(badge);
    document.body.appendChild(btn);

    btn.addEventListener("click", openReceiptModal);
    bumpReceiptCount();

    return btn;
  }

  function bumpReceiptCount() {
    const cart = readCart();
    const badge = $("#receipt-badge");
    if (!badge) return;
    if (!cart.length) {
      badge.style.display = "none";
      badge.textContent = "";
      return;
    }
    badge.style.display = "flex";
    badge.textContent = String(cart.length);
  }

  function openReceiptModal() {
    const modal = ensureModalShell("receipt-modal", "Receipt");
    const body = $(".modal-body", modal);
    const cart = readCart();

    if (!cart.length) {
      body.innerHTML = `<div style="opacity:.70; font-weight:900;">No items yet.</div>`;
    } else {
      const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      body.innerHTML = `
        <div style="display:grid; gap:10px;">
          ${cart.map((it) => `
            <div style="
              display:grid; gap:4px;
              padding:12px;
              border-radius:16px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <div style="font-weight:900;">${it.cigar}</div>
              <div style="opacity:.70; font-weight:800; font-size:13px;">
                ${it.vitola || ""} ${it.vitola ? "•" : ""} ${it.brand || ""}
              </div>
              <div style="font-weight:900; text-align:right;">$${money(it.price)}</div>
            </div>
          `).join("")}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            <div style="font-weight:900; font-size:18px;">Total</div>
            <div style="font-weight:900; font-size:18px;">$${money(total)}</div>
          </div>
        </div>
      `;
    }

    const closeBtn = $("[data-action='close']", modal);
    const confirmBtn = $("[data-action='confirm']", modal);

    closeBtn.textContent = "Clear";
    closeBtn.onclick = () => {
      writeCart([]);
      bumpReceiptCount();
      setModalOpen(modal, false);
    };

    confirmBtn.textContent = "Close";
    confirmBtn.onclick = () => setModalOpen(modal, false);

    setModalOpen(modal, true);
  }

  // =========================
  // 12) EVENTS
  // =========================
  function initControls() {
    // Search
    el.search?.addEventListener("input", (e) => {
      state.search = e.target.value || "";
      applyAllFilters();
    });

    // Bands
    if (el.btnBands) {
      el.btnBands.addEventListener("click", (e) => {
        e.preventDefault();
        openBandsModal();
      });
    }

    // Filters
    if (el.btnFilters) {
      el.btnFilters.addEventListener("click", (e) => {
        e.preventDefault();
        openFiltersModal();
      });
    }
  }

  // =========================
  // 13) BOOT
  // =========================
  async function boot() {
    el = refreshEls();
    initHeader();
    initShadeToggle();
    initControls();
    ensureReceiptButton();

    const rows = await loadSheet();
    state.allRows = rows;

    if (!rows.length) return;

    applyAllFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
