/* /pos/cigars/brand.js
   Full brand page controller:
   - Loads cigars for the brand from Google Sheets (CSV)
   - Fixes initial brand icon rendering
   - Adds working Maduro/Natural tri-state toggle (maduro / all / natural)
   - Adds Bands modal with image tiles + multi-select + X close + Confirm (mobile-safe)
   - Adds Filters modal (same concept as main POS, excluding Manufacturer/Brand)
   - Adds working + (add to bill) and a receipt icon bottom-right
*/

(() => {
  // =========================
  // 1) CONFIG (SET THIS)
  // =========================
  // ✅ MUST be the *CSV export* URL (not the /edit link)
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  // Storage keys
  const CART_KEY = "cigaros_pos_cart_v1";

  // Brand band art assets (Padron example)
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

  function money(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return "0.00";
    return x.toFixed(2);
  }

  function slugBrand(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/&/g, "and")
      .replace(/['".]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeBrandCompare(s) {
    return safeText(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
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

    return rows.filter(r => r.some(c => String(c || "").trim() !== ""));
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map(h => safeText(h));
    return rows.slice(1).map(r => {
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
    search: $("#brand-search"),
    list: $(".brand-list"),

    btnBands: $("#bands-btn") || $(".pill-btn[data-action='bands']") || $(".pill-btn.bands"),
    btnFilters: $("#filters-btn") || $(".pill-btn[data-action='filters']") || $(".pill-btn.filters"),

    seg: $(".seg"),
    segMaduro:
      $(".seg [data-side='maduro']") ||
      $(".seg .seg-btn[data-value='maduro']") ||
      $(".seg .seg-btn.maduro"),
    segNatural:
      $(".seg [data-side='natural']") ||
      $(".seg .seg-btn[data-value='natural']") ||
      $(".seg .seg-btn.natural"),
    segDot: $(".seg .seg-dot"),

    error: $("#brand-error") || $(".brand-error"),
  };

  // =========================
  // 5) BASIC PAGE BOOT
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
    $(".brand-main")?.appendChild(p);
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
  // 7) RENDER
  // =========================
  function renderList(rows) {
    if (!el.list) return;
    el.list.innerHTML = "";

    const { primary, fallback } = resolveBrandIcon(state.brand);

    rows.forEach(c => {
      const cigarName = safeText(c.Cigar || c.CIGAR || c.Name || c["Cigar Name"] || "");
      const vitola = safeText(c.Vitola || c.VITOLA || c.Style || "");
      const shade = safeText(c["Wrapper Shade"] || c.Shade || c.WrapperShade || "");
      const sub = vitola ? vitola : shade ? shade : "";
      const price = safeText(c.MSRP || c.Price || c["Cigar MSRP"] || c["MSRP ($)"] || "");

      const row = document.createElement("div");
      row.className = "cigar-row";

      const img = document.createElement("img");
      img.className = "cigar-img";
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
      nameEl.textContent = cigarName || "(Unnamed cigar)";

      const subEl = document.createElement("div");
      subEl.className = "cigar-sub";
      subEl.textContent = sub;

      mid.appendChild(nameEl);
      mid.appendChild(subEl);

      const right = document.createElement("div");
      right.className = "cigar-right";

      const divider = document.createElement("div");
      divider.className = "cigar-divider";

      const priceEl = document.createElement("div");
      priceEl.className = "cigar-price";
      priceEl.textContent = money(price);

      const plus = document.createElement("button");
      plus.className = "cigar-plus";
      plus.type = "button";
      plus.textContent = "+";
      plus.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
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

  function getRowBrand(r) {
    // be forgiving: different headers across versions
    return safeText(
      r.Brand ||
      r.BRAND ||
      r["Brand Name"] ||
      r["brand"] ||
      r.Manufacturer || // last resort if sheet was mapped strangely
      ""
    );
  }

  function applyAllFilters() {
    const q = state.search.toLowerCase();
    const shadeState = state.shadeState;

    let out = state.allRows.slice();

    // Brand filter (hard, but tolerant)
    if (state.brand) {
      const want = normalizeBrandCompare(state.brand);
      out = out.filter(r => {
        const have = normalizeBrandCompare(getRowBrand(r));
        return have === want; // strict equality once normalized
      });
    }

    // Search
    if (q) {
      out = out.filter(r => {
        const cigarName = safeText(r.Cigar || r.CIGAR || r.Name || r["Cigar Name"] || "");
        const vitola = safeText(r.Vitola || r.VITOLA || r.Style || "");
        return (cigarName + " " + vitola).toLowerCase().includes(q);
      });
    }

    // Maduro/Natural toggle
    if (shadeState !== "all") {
      out = out.filter(r => {
        const shade = safeText(r["Wrapper Shade"] || r.Shade || r.WrapperShade || "");
        return normalizeShade(shade) === shadeState;
      });
    }

    // Bands filter
    if (state.selectedBands.size) {
      out = out.filter(r => {
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

      out = out.filter(r => {
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
  // 9) MADURO/NATURAL TOGGLE
  // =========================
  function setShadeState(next) {
    state.shadeState = next;
    if (el.seg) el.seg.dataset.state = next;

    if (el.segMaduro) el.segMaduro.setAttribute("aria-pressed", next === "maduro" ? "true" : "false");
    if (el.segNatural) el.segNatural.setAttribute("aria-pressed", next === "natural" ? "true" : "false");

    applyAllFilters();
  }

  function initShadeToggle() {
    if (!el.seg) return;

    if (!el.seg.dataset.state) el.seg.dataset.state = "all";
    setShadeState(el.seg.dataset.state);

    // labels
    el.segMaduro?.addEventListener("click", () => {
      if (state.shadeState === "maduro") setShadeState("all");
      else setShadeState("maduro");
    });

    el.segNatural?.addEventListener("click", () => {
      if (state.shadeState === "natural") setShadeState("all");
      else setShadeState("natural");
    });

    // ✅ center dot (kept)
    el.segDot?.addEventListener("click", () => {
      if (state.shadeState === "all") {
        setShadeState("natural");
        return;
      }
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });

    // ✅ NEW: tapping anywhere on the segmented control toggles (except labels)
    el.seg.addEventListener("click", (e) => {
      if (e.target.closest(".seg-btn")) return; // ignore label clicks
      if (e.target.closest(".seg-dot")) return; // dot already handled

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

    // ✅ enforce mobile-safe sizing without needing extra CSS edits
    const card = $(".modal-card", modal);
    const body = $(".modal-body", modal);
    if (card) {
      card.style.maxHeight = "78vh";
      card.style.width = "min(520px, calc(100vw - 28px))";
    }
    if (body) {
      body.style.maxHeight = "52vh";
      body.style.overflow = "auto";
      body.style.webkitOverflowScrolling = "touch";
    }

    const close = () => setModalOpen(modal, false);
    $(".modal-scrim", modal).addEventListener("click", close);
    $(".modal-x", modal).addEventListener("click", close);
    $("[data-action='close']", modal).addEventListener("click", close);

    return modal;
  }

  function setModalOpen(modalEl, open) {
    modalEl.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }

  function openBandsModal() {
    const modal = ensureModalShell("bands-modal", "Bands");
    const body = $(".modal-body", modal);

    // ✅ smaller tiles + scroll body
    body.innerHTML = `
      <div style="display:grid; gap:12px;">
        ${PADRON_BANDS.map(b => {
          const checked = state.selectedBands.has(b.key);
          return `
            <label style="
              display:grid; gap:8px; justify-items:center;
              padding:10px;
              border-radius:18px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <img src="${b.img}" alt="${b.label}" style="
                width:100%;
                max-width:420px;
                max-height:96px;
                object-fit:contain;
                border-radius:14px;
                background:rgba(0,0,0,.10);
                border:1px solid rgba(255,255,255,.10);
              "/>
              <div style="font-weight:900; font-size:16px;">${b.label}</div>
              <input type="checkbox" data-band="${b.key}" ${checked ? "checked" : ""} style="transform:scale(1.15);" />
            </label>
          `;
        }).join("")}
      </div>
    `;

    const confirmBtn = $("[data-action='confirm']", modal);
    confirmBtn.onclick = () => {
      const checks = $$("input[type='checkbox'][data-band]", modal);
      state.selectedBands = new Set(checks.filter(c => c.checked).map(c => c.dataset.band));
      setModalOpen(modal, false);
      applyAllFilters();
    };

    setModalOpen(modal, true);
  }

  function openFiltersModal() {
    const modal = ensureModalShell("filters-modal", "Filters");
    const body = $(".modal-body", modal);

    const scoped = state.brand
      ? state.allRows.filter(r => normalizeBrandCompare(getRowBrand(r)) === normalizeBrandCompare(state.brand))
      : state.allRows.slice();

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
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${opts.map(v => {
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
            }).join("")}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div style="display:block;">
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

    // chip toggle handler
    body.onclick = (e) => {
      const btn = e.target.closest("button.chip");
      if (!btn) return;
      const key = btn.dataset.filter;
      const val = decodeURIComponent(btn.dataset.value || "");
      if (!state.filters[key]) state.filters[key] = new Set();
      if (state.filters[key].has(val)) state.filters[key].delete(val);
      else state.filters[key].add(val);
      openFiltersModal(); // refresh
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
      const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      body.innerHTML = `
        <div style="display:grid; gap:10px;">
          ${cart.map(it => `
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
          `).join("")}
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
    el.search?.addEventListener("input", (e) => {
      state.search = e.target.value || "";
      applyAllFilters();
    });

    el.btnBands?.addEventListener("click", openBandsModal);
    el.btnFilters?.addEventListener("click", openFiltersModal);
  }

  // =========================
  // 13) BOOTSTRAP
  // =========================
  async function boot() {
    initHeader();
    initShadeToggle();
    initControls();
    ensureReceiptButton();

    const rows = await loadSheet();
    state.allRows = rows;

    if (!rows.length) return;

    applyAllFilters();
  }

  boot();
})();
