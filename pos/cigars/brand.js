/* /pos/cigars/brand.js
   Brand page controller (FINAL):
   - Loads cigars for the brand from Google Sheets (CSV)
   - Renders correct small brand SVGs on initial load (and stays small)
   - Maduro/Natural toggle works when clicking the WORDS or the center switch
   - Bands modal works + fits mobile + Close + Confirm
   - Filters modal populates (same as main POS, excluding Manufacturer + Brand)
   - + (add to bill) works + receipt icon bottom-right with count + receipt modal
*/

(() => {
  // =========================
  // 1) CONFIG (SET THIS)
  // =========================
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  const CART_KEY = "cigaros_pos_cart_v1";

  // Padron band art assets (example)
  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "/img/icons/padron1926serieband.svg" },
    { key: "1964", label: "1964", img: "/img/icons/padron1964anniversaryband.svg" },
    { key: "Damaso", label: "Damaso", img: "/img/icons/padrondamasoband.svg" },
  ];

  // Receipt icon path
  const RECEIPT_ICON_SRC = "/img/icons/pos/receipt.png";

  // =========================
  // 2) HELPERS
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  }

  function safeText(v) {
    return (v == null ? "" : String(v)).trim();
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

  function money(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return "0.00";
    return x.toFixed(2);
  }

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
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
      return obj;
    });
  }

  function resolveBrandIcon(brandName) {
    const slug = slugBrand(brandName);
    return {
      primary: `/img/icons/brands/${slug}.svg`,
      fallback: `/img/icons/brand/${slug}.svg`,
    };
  }

  function findButtonByText(text) {
    const t = String(text || "").toLowerCase();
    const candidates = [
      ...$$("button"),
      ...$$("[role='button']"),
      ...$$(".pill-btn"),
    ];
    return (
      candidates.find((b) =>
        safeText(b.textContent).toLowerCase().includes(t)
      ) || null
    );
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
      Shade: new Set(),
    },
  };

  // =========================
  // 4) DOM HOOKS
  // =========================
  const el = {
    title: $(".brand-title"),
    brandIcon: $(".brand-icon"),
    search: $("#brand-search") || $("input[type='search']"),
    list: $(".brand-list") || $("#brand-list") || $(".list"),
    seg: $(".seg"),
    segDot: $(".seg .seg-dot"),
    error: $("#brand-error") || $(".brand-error"),
    main: $(".brand-main") || $("main") || document.body,
  };

  function refreshControlHooks() {
    // these sometimes load after initial DOM paint
    el.btnBands =
      $("#bands-btn") ||
      $(".pill-btn[data-action='bands']") ||
      $(".pill-btn.bands") ||
      findButtonByText("bands");

    el.btnFilters =
      $("#filters-btn") ||
      $(".pill-btn[data-action='filters']") ||
      $(".pill-btn.filters") ||
      findButtonByText("filters");

    el.seg =
      el.seg ||
      $(".seg") ||
      $(".segmented") ||
      $(".seg-toggle") ||
      null;

    el.segDot = $(".seg .seg-dot") || el.segDot;

    el.list = el.list || $(".brand-list") || $("#brand-list") || $(".list");
  }

  // =========================
  // 5) HEADER + ERRORS
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
      el.brandIcon.alt = state.brand;
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
    p.style.margin = "18px 0 0";
    p.style.color = "rgba(255,120,120,.95)";
    p.style.fontWeight = "800";
    p.textContent = msg;
    el.main?.appendChild(p);
  }

  // =========================
  // 6) DATA LOADING
  // =========================
  async function loadSheet() {
    if (!SHEET_CSV_URL) {
      showError("Brand failed to load from Google Sheets. (Missing SHEET_CSV_URL)");
      return [];
    }
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      const rows = parseCSV(txt);
      return rowsToObjects(rows);
    } catch (err) {
      console.error("Sheet load error:", err);
      showError("Brand failed to load from Google Sheets.");
      return [];
    }
  }

  // =========================
  // 7) RENDER (with CSS-FALLBACK inline styles so icons never blow up)
  // =========================
  function renderList(rows) {
    refreshControlHooks();
    if (!el.list) return;

    el.list.innerHTML = "";

    const { primary, fallback } = resolveBrandIcon(state.brand);

    rows.forEach((c) => {
      const cigarName = safeText(c.Cigar || c.CIGAR || c.Name || c["Cigar Name"] || "");
      const vitola = safeText(c.Vitola || c.VITOLA || c.Style || "");
      const shade = safeText(c["Wrapper Shade"] || c.Shade || c.WrapperShade || "");
      const sub = vitola ? vitola : shade ? shade : "";
      const price = safeText(c.MSRP || c.Price || c["Cigar MSRP"] || c["MSRP ($)"] || "");

      // Row wrapper
      const row = document.createElement("div");
      row.className = "cigar-row";
      // inline fallback (prevents "massive SVG" layout if CSS missing/overridden)
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "12px";
      row.style.padding = "12px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,.10)";

      // Small brand icon (NEVER large)
      const img = document.createElement("img");
      img.className = "cigar-img";
      img.src = primary;
      img.onerror = () => {
        img.onerror = null;
        img.src = fallback;
      };
      img.alt = state.brand;

      // hard clamp size
      img.style.width = "46px";
      img.style.height = "46px";
      img.style.borderRadius = "12px";
      img.style.objectFit = "cover";
      img.style.flex = "0 0 auto";
      img.style.background = "rgba(255,255,255,.07)";

      // Middle text
      const mid = document.createElement("div");
      mid.className = "cigar-mid";
      mid.style.minWidth = "0";
      mid.style.flex = "1 1 auto";

      const nameEl = document.createElement("div");
      nameEl.className = "cigar-name";
      nameEl.textContent = cigarName || "(Unnamed cigar)";
      nameEl.style.fontSize = "15px";
      nameEl.style.fontWeight = "800";
      nameEl.style.lineHeight = "1.2";
      nameEl.style.letterSpacing = "-.005em";
      nameEl.style.display = "-webkit-box";
      nameEl.style.webkitLineClamp = "2";
      nameEl.style.webkitBoxOrient = "vertical";
      nameEl.style.overflow = "hidden";

      const subEl = document.createElement("div");
      subEl.className = "cigar-sub";
      subEl.textContent = sub;
      subEl.style.marginTop = "4px";
      subEl.style.fontSize = "12px";
      subEl.style.fontWeight = "700";
      subEl.style.color = "rgba(255,255,255,.55)";
      subEl.style.whiteSpace = "nowrap";
      subEl.style.overflow = "hidden";
      subEl.style.textOverflow = "ellipsis";

      mid.appendChild(nameEl);
      mid.appendChild(subEl);

      // Right side (price + plus)
      const right = document.createElement("div");
      right.className = "cigar-right";
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";
      right.style.flex = "0 0 auto";

      const divider = document.createElement("div");
      divider.className = "cigar-divider";
      divider.style.width = "1px";
      divider.style.height = "38px";
      divider.style.background = "rgba(255,255,255,.14)";

      const priceEl = document.createElement("div");
      priceEl.className = "cigar-price";
      priceEl.textContent = money(price);
      priceEl.style.width = "54px";
      priceEl.style.textAlign = "right";
      priceEl.style.fontSize = "15px";
      priceEl.style.fontWeight = "700";

      const plus = document.createElement("button");
      plus.className = "cigar-plus";
      plus.type = "button";
      plus.textContent = "+";
      plus.style.width = "22px";
      plus.style.height = "22px";
      plus.style.borderRadius = "999px";
      plus.style.border = "none";
      plus.style.background = "var(--green, #34c759)";
      plus.style.color = "#fff";
      plus.style.fontSize = "15px";
      plus.style.lineHeight = "0";
      plus.style.display = "grid";
      plus.style.placeItems = "center";
      plus.style.boxShadow = "0 10px 18px rgba(0,0,0,.25)";

      plus.addEventListener("click", () => {
        addToCart({
          brand: state.brand,
          cigar: cigarName,
          vitola: vitola,
          price: Number(price) || 0,
        });
      });

      right.appendChild(divider);
      right.appendChild(priceEl);
      right.appendChild(plus);

      row.appendChild(img);
      row.appendChild(mid);
      row.appendChild(right);

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
    // Your sheet uses Brand in column C; keep this tolerant
    return safeText(
      r.Brand ||
        r.BRAND ||
        r["Brand Name"] ||
        r["Brand"] ||
        r["brand"] ||
        ""
    );
  }

  function applyAllFilters() {
    const q = state.search.toLowerCase();
    const shadeState = state.shadeState;

    let out = state.allRows.slice();

    // Brand filter
    if (state.brand) {
      out = out.filter((r) => rowBrandValue(r).toLowerCase() === state.brand.toLowerCase());
    }

    // Search
    if (q) {
      out = out.filter((r) => {
        const cigarName = safeText(r.Cigar || r.CIGAR || r.Name || r["Cigar Name"] || "");
        const vitola = safeText(r.Vitola || r.VITOLA || r.Style || "");
        return (cigarName + " " + vitola).toLowerCase().includes(q);
      });
    }

    // Maduro/Natural tri-state
    if (shadeState !== "all") {
      out = out.filter((r) => {
        const shade = safeText(r["Wrapper Shade"] || r.Shade || r.WrapperShade || "");
        return normalizeShade(shade) === shadeState;
      });
    }

    // Bands filter
    if (state.selectedBands.size) {
      out = out.filter((r) => {
        const line = safeText(r.Line || r.Band || r.Series || r["Band Art"] || "");
        for (const k of state.selectedBands) {
          if (line.toLowerCase().includes(String(k).toLowerCase())) return true;
        }
        return false;
      });
    }

    // Chip filters
    const map = [
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
      ["Shade", ["Wrapper Shade", "Shade", "WrapperShade"]],
    ];

    for (const [filterKey, possibleCols] of map) {
      const set = state.filters[filterKey];
      if (!set || set.size === 0) continue;

      out = out.filter((r) => {
        let val = "";
        for (const col of possibleCols) {
          if (r[col] != null && String(r[col]).trim() !== "") {
            val = safeText(r[col]);
            break;
          }
        }
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
    renderList(state.viewRows);
  }

  // =========================
  // 9) MADURO/NATURAL TOGGLE (click WORDS or SWITCH)
  // =========================
  function setShadeState(next) {
    state.shadeState = next;
    refreshControlHooks();

    // keep your CSS-driven thumb positioning if present
    if (el.seg) el.seg.dataset.state = next;

    // If your labels have aria-pressed, keep them in sync
    const mad = $(".seg [data-side='maduro'], .seg .seg-btn[data-value='maduro'], .seg .seg-btn.maduro");
    const nat = $(".seg [data-side='natural'], .seg .seg-btn[data-value='natural'], .seg .seg-btn.natural");
    mad?.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    nat?.setAttribute("aria-pressed", next === "natural" ? "true" : "false");

    applyAllFilters();
  }

  function initShadeToggle() {
    refreshControlHooks();
    if (!el.seg) return;

    // Default = ALL (center)
    if (!el.seg.dataset.state) el.seg.dataset.state = "all";
    setShadeState(el.seg.dataset.state);

    // Make entire segmented control clickable:
    // left third => maduro (toggle to all if already)
    // right third => natural (toggle to all if already)
    // middle third => switch behavior (all -> natural, else toggle)
    el.seg.addEventListener("click", (e) => {
      const rect = el.seg.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - rect.left;
      const pct = rect.width ? x / rect.width : 0.5;

      if (pct < 0.33) {
        // click Maduro side
        if (state.shadeState === "maduro") setShadeState("all");
        else setShadeState("maduro");
        return;
      }
      if (pct > 0.67) {
        // click Natural side
        if (state.shadeState === "natural") setShadeState("all");
        else setShadeState("natural");
        return;
      }

      // click middle (switch)
      if (state.shadeState === "all") return setShadeState("natural");
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });
  }

  // =========================
  // 10) MODALS
  // =========================
  function ensureModalShell(id, titleText) {
    let modal = document.getElementById(id);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal";
    modal.id = id;
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal-scrim"></div>
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">${titleText}</div>
          <button class="modal-x" type="button" aria-label="Close">×</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-foot">
          <button class="modal-btn ghost" type="button" data-action="close">Close</button>
          <button class="modal-btn primary" type="button" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // close handlers
    const close = () => setModalOpen(modal, false);
    $(".modal-scrim", modal).addEventListener("click", close);
    $(".modal-x", modal).addEventListener("click", close);
    $("[data-action='close']", modal).addEventListener("click", close);

    // mobile sizing safety (even if CSS misses)
    const card = $(".modal-card", modal);
    if (card) {
      card.style.maxHeight = "82vh";
      card.style.overflow = "hidden";
    }
    const body = $(".modal-body", modal);
    if (body) {
      body.style.maxHeight = "52vh";
      body.style.overflow = "auto";
    }

    return modal;
  }

  function setModalOpen(modalEl, open) {
    modalEl.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }

  // Bands modal
  function openBandsModal() {
    const modal = ensureModalShell("bands-modal", "Bands");
    const body = $(".modal-body", modal);

    body.innerHTML = `
      <div class="bandgrid" style="display:grid; gap:14px;">
        ${PADRON_BANDS.map((b) => {
          const checked = state.selectedBands.has(b.key);
          return `
            <label class="bandtile" style="
              display:grid; gap:8px; justify-items:center;
              padding:10px 10px;
              border-radius:18px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <img src="${b.img}" alt="${b.label}" style="
                width:100%;
                max-width:420px;
                height:auto;
                max-height:92px;
                object-fit:contain;
                border-radius:14px;
                background:rgba(0,0,0,.10);
              "/>
              <div style="font-weight:900; font-size:18px;">${b.label}</div>
              <input type="checkbox" data-band="${b.key}" ${
                checked ? "checked" : ""
              } style="transform:scale(1.2);" />
            </label>
          `;
        }).join("")}
      </div>
    `;

    const confirmBtn = $("[data-action='confirm']", modal);
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

    // brand-scoped
    const scoped = state.allRows.filter((r) => {
      const b = rowBrandValue(r);
      return !state.brand || b.toLowerCase() === state.brand.toLowerCase();
    });

    const optionSets = {
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
      Shade: new Set(),
    };

    for (const r of scoped) {
      const vit = safeText(r.Vitola || r.Style || "");
      const rg = safeText(r.RG || r.Ring || r["Ring Gauge"] || "");
      const str = safeText(r.Strength || "");
      const len = safeText(r.Length || "");
      const shp = safeText(r.Shape || "");
      const tubo = safeText(r.Tubo || "");
      const flav = safeText(r.Flavored || "");
      const tin = safeText(r.Tin || "");
      const pack = safeText(r.Pack || "");
      const barb = safeText(r.Barber || r.Barberpole || "");
      const boxp = safeText(r["Box-Pressed"] || r.BoxPressed || r["Box Pressed"] || "");
      const shade = safeText(r["Wrapper Shade"] || r.Shade || "");

      if (vit) optionSets.Vitola.add(vit);
      if (rg) optionSets.Ring.add(rg);
      if (str) optionSets.Strength.add(str);
      if (len) optionSets.Length.add(len);
      if (shp) optionSets.Shape.add(shp);
      if (tubo) optionSets.Tubo.add(tubo);
      if (flav) optionSets.Flavored.add(flav);
      if (tin) optionSets.Tin.add(tin);
      if (pack) optionSets.Pack.add(pack);
      if (barb) optionSets.Barberpole.add(barb);
      if (boxp) optionSets["Box-Pressed"].add(boxp);
      if (shade) optionSets.Shade.add(shade);
    }

    function chipGroup(title, key) {
      const opts = Array.from(optionSets[key]).sort((a, b) => String(a).localeCompare(String(b)));
      if (!opts.length) return "";

      const selected = state.filters[key];

      return `
        <div style="margin:0 0 14px;">
          <div style="font-weight:900; font-size:16px; color:rgba(255,255,255,.85); margin:0 0 8px;">
            ${title}
          </div>
          <div class="chipwrap" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${opts
              .map((v) => {
                const on = selected.has(v);
                return `
                  <button type="button"
                    class="chip"
                    data-filter="${key}"
                    data-value="${encodeURIComponent(v)}"
                    style="
                      height:36px;
                      padding:0 12px;
                      border-radius:999px;
                      border:1px solid rgba(255,255,255,.12);
                      background:${on ? "rgba(15,122,255,.20)" : "rgba(255,255,255,.06)"};
                      color:${on ? "rgba(15,122,255,.95)" : "rgba(255,255,255,.80)"};
                      font-weight:${on ? "900" : "700"};
                      font-size:13px;
                    ">
                    ${v}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div style="padding-right:2px;">
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
      </div>
    `;

    // chip toggles (single handler, no recursion)
    body.onclick = (e) => {
      const btn = e.target.closest("button.chip");
      if (!btn) return;

      const key = btn.dataset.filter;
      const val = decodeURIComponent(btn.dataset.value || "");
      if (!state.filters[key]) state.filters[key] = new Set();
      if (state.filters[key].has(val)) state.filters[key].delete(val);
      else state.filters[key].add(val);

      // re-render the modal body to reflect selection
      openFiltersModal();
    };

    const confirmBtn = $("[data-action='confirm']", modal);
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
      body.innerHTML = `<div class="modal-empty">No items yet.</div>`;
    } else {
      const total = cart.reduce(
        (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1),
        0
      );
      body.innerHTML = `
        <div style="display:grid; gap:10px;">
          ${cart
            .map(
              (it) => `
            <div style="
              display:grid; gap:4px;
              padding:12px 12px;
              border-radius:16px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <div style="font-weight:900;">${it.cigar}</div>
              <div style="color:rgba(255,255,255,.60); font-weight:700; font-size:13px;">
                ${it.vitola || ""} ${it.vitola ? "•" : ""} ${it.brand || ""}
              </div>
              <div style="font-weight:900; text-align:right;">$${money(it.price)}</div>
            </div>
          `
            )
            .join("")}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            <div style="font-weight:900; font-size:18px;">Total</div>
            <div style="font-weight:900; font-size:18px;">$${money(total)}</div>
          </div>
        </div>
      `;
    }

    const closeBtn = $("[data-action='close']", modal);
    closeBtn.textContent = "Clear";
    closeBtn.onclick = () => {
      writeCart([]);
      bumpReceiptCount();
      setModalOpen(modal, false);
    };

    const confirmBtn = $("[data-action='confirm']", modal);
    confirmBtn.textContent = "Close";
    confirmBtn.onclick = () => setModalOpen(modal, false);

    setModalOpen(modal, true);
  }

  // =========================
  // 12) EVENTS
  // =========================
  function initControls() {
    refreshControlHooks();

    // Search
    el.search?.addEventListener("input", (e) => {
      state.search = e.target.value || "";
      applyAllFilters();
    });

    // Bands
    if (el.btnBands) {
      el.btnBands.addEventListener("click", openBandsModal);
    }

    // Filters
    if (el.btnFilters) {
      el.btnFilters.addEventListener("click", openFiltersModal);
    }
  }

  // =========================
  // 13) BOOT
  // =========================
  async function boot() {
    refreshControlHooks();
    initHeader();
    initShadeToggle();
    initControls();
    ensureReceiptButton();

    const rows = await loadSheet();
    state.allRows = rows;

    if (!rows.length) return;

    // initial render
    applyAllFilters();
  }

  boot();
})();
