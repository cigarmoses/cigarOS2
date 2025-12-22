/* /pos/cigars/brand.js
   Brand page controller (Padron example):
   - Loads cigars for the brand from Google Sheets CSV
   - Renders list (uses Cigar IMG if present; otherwise brand icon)
   - Maduro/Natural toggle (labels + switch all clickable)
   - Bands modal (Padron 1926 / 1964 / Damaso) with Confirm/Close
   - Filters modal (same as main, but excludes Manufacturer + Brand)
   - Add-to-bill (+) works + Receipt FAB bottom-right
*/

(() => {
  // =========================
  // 1) CONFIG
  // =========================
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  const CART_KEY = "cigaros_pos_cart_v1";
  const RECEIPT_ICON_SRC = "/img/icons/pos/receipt.png";

  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "/img/icons/padron1926serieband.svg" },
    { key: "1964", label: "1964", img: "/img/icons/padron1964anniversaryband.svg" },
    { key: "Damaso", label: "Damaso", img: "/img/icons/padrondamasoband.svg" },
  ];

  // =========================
  // 2) HELPERS
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeText(v) {
    return (v == null ? "" : String(v)).trim();
  }

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
    shadeState: "all", // maduro | natural | all
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
  // 4) DOM HOOKS (tolerant)
  // =========================
  const el = {
    title:
      $(".brand-title") ||
      $(".category-title") ||
      $("h1") ||
      null,
    brandIcon: $(".brand-icon") || $(".brand-logo") || null,
    search: $("#brand-search") || $("input[type='search']") || null,
    list: $(".brand-list") || $("#brand-list") || null,

    btnBands: $("#bands-btn") || $(".pill-btn[data-action='bands']") || $(".pill-btn.bands") || null,
    btnFilters: $("#filters-btn") || $(".pill-btn[data-action='filters']") || $(".pill-btn.filters") || null,

    seg: $(".seg") || null,
    segDot: $(".seg .seg-dot") || null,
    segMaduro:
      $(".seg [data-side='maduro']") ||
      $(".seg .seg-btn[data-value='maduro']") ||
      null,
    segNatural:
      $(".seg [data-side='natural']") ||
      $(".seg .seg-btn[data-value='natural']") ||
      null,

    error: $("#brand-error") || $(".brand-error") || null,
  };

  // If labels weren’t found by selectors, find by text content.
  function findSegButtonsByText() {
    if (!el.seg) return;
    const btns = $$("button, .seg-btn", el.seg);
    for (const b of btns) {
      const t = safeText(b.textContent).toLowerCase();
      if (!el.segMaduro && t === "maduro") el.segMaduro = b;
      if (!el.segNatural && t === "natural") el.segNatural = b;
    }
  }

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
      showError("Brand failed to load from Google Sheets. (Missing SHEET_CSV_URL)");
      return [];
    }
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      return rowsToObjects(parseCSV(txt));
    } catch (err) {
      console.error("Sheet load error:", err);
      showError("Brand failed to load from Google Sheets.");
      return [];
    }
  }

  // =========================
  // 7) RENDER LIST
  // =========================
  function pick(obj, keys) {
    for (const k of keys) {
      if (obj[k] != null && String(obj[k]).trim() !== "") return safeText(obj[k]);
    }
    return "";
  }

  function renderList(rows) {
    if (!el.list) return;

    el.list.innerHTML = "";

    rows.forEach(r => {
      const cigarName = pick(r, ["Cigar", "CIGAR", "Name", "Cigar Name"]);
      const vitola = pick(r, ["Vitola", "VITOLA", "Style"]);
      const shade = pick(r, ["Wrapper Shade", "Shade", "WrapperShade"]);
      const sub = vitola || shade || "";

      const priceRaw = pick(r, ["MSRP", "Price", "Cigar MSRP", "MSRP ($)"]);
      const priceNum = Number(priceRaw);
      const price = Number.isFinite(priceNum) ? priceNum : 0;

      // Prefer cigar image column if you have it, otherwise brand icon
      const cigarImg = pick(r, ["Cigar IMG", "Cigar Image", "Image", "IMG", "CigarIMG"]);
      const { primary, fallback } = resolveBrandIcon(state.brand);

      const row = document.createElement("div");
      row.className = "cigar-row";

      const img = document.createElement("img");
      img.className = "cigar-img";
      img.src = cigarImg || primary;
      img.alt = cigarName || state.brand;

      // HARD clamp in JS so it can’t blow up even if CSS breaks
      img.style.width = "46px";
      img.style.height = "46px";
      img.style.borderRadius = "12px";
      img.style.objectFit = "cover";
      img.style.flex = "0 0 auto";
      img.style.background = "rgba(255,255,255,.07)";

      img.onerror = () => {
        img.onerror = null;
        img.src = cigarImg ? primary : fallback;
      };

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
      plus.addEventListener("click", () => {
        addToCart({
          brand: state.brand,
          cigar: cigarName,
          vitola,
          price,
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
  // 8) FILTERS
  // =========================
  function normalizeShade(s) {
    const x = safeText(s).toLowerCase();
    if (!x) return "";
    if (x.includes("maduro")) return "maduro";
    if (x.includes("natural")) return "natural";
    return x;
  }

  function brandMatchesRow(r) {
    // your sheet has Brand in column C (per your earlier note)
    const rowBrand = safeText(r.Brand || r.BRAND || r["Brand Name"] || r.Manufacturer || "");
    if (!state.brand) return true;
    if (!rowBrand) return true;

    // tolerant match:
    const a = rowBrand.toLowerCase();
    const b = state.brand.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  }

  function applyAllFilters() {
    const q = state.search.toLowerCase();

    let out = state.allRows.filter(brandMatchesRow);

    // Search
    if (q) {
      out = out.filter(r => {
        const cigarName = pick(r, ["Cigar", "CIGAR", "Name", "Cigar Name"]);
        const vitola = pick(r, ["Vitola", "VITOLA", "Style"]);
        return (cigarName + " " + vitola).toLowerCase().includes(q);
      });
    }

    // Maduro/Natural toggle
    if (state.shadeState !== "all") {
      out = out.filter(r => {
        const shade = pick(r, ["Wrapper Shade", "Shade", "WrapperShade"]);
        return normalizeShade(shade) === state.shadeState;
      });
    }

    // Bands filter (match Line/Series/Band)
    if (state.selectedBands.size) {
      out = out.filter(r => {
        const line = pick(r, ["Line", "Series", "Band", "Band Art"]);
        const lc = line.toLowerCase();
        for (const k of state.selectedBands) {
          if (lc.includes(String(k).toLowerCase())) return true;
        }
        return false;
      });
    }

    // Chip filters
    const map = [
      ["Shade", ["Wrapper Shade", "Shade", "WrapperShade"]],
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

    for (const [key, cols] of map) {
      const set = state.filters[key];
      if (!set || set.size === 0) continue;

      out = out.filter(r => {
        const val = pick(r, cols);
        if (!val) return false;
        const v = val.toLowerCase();
        for (const wanted of set) {
          const w = String(wanted).toLowerCase();
          if (v === w || v.includes(w)) return true;
        }
        return false;
      });
    }

    state.viewRows = out;
    renderList(out);
  }

  // =========================
  // 9) MADURO / NATURAL TOGGLE
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

    findSegButtonsByText();

    if (!el.seg.dataset.state) el.seg.dataset.state = "all";
    setShadeState(el.seg.dataset.state);

    // Click labels
    el.segMaduro?.addEventListener("click", (e) => {
      e.stopPropagation();
      setShadeState(state.shadeState === "maduro" ? "all" : "maduro");
    });

    el.segNatural?.addEventListener("click", (e) => {
      e.stopPropagation();
      setShadeState(state.shadeState === "natural" ? "all" : "natural");
    });

    // Click dot
    el.segDot?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.shadeState === "all") return setShadeState("natural");
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });

    // Click anywhere on the segmented control (excluding labels/dot) toggles too
    el.seg.addEventListener("click", (e) => {
      if (e.target.closest(".seg-btn")) return;
      if (e.target.closest(".seg-dot")) return;

      if (state.shadeState === "all") return setShadeState("natural");
      setShadeState(state.shadeState === "maduro" ? "natural" : "maduro");
    });
  }

  // =========================
  // 10) MODALS (FORCED OVERLAY STYLES)
  // =========================
  function setModalOpen(modal, open) {
    modal.dataset.open = open ? "1" : "0";
    modal.style.display = open ? "block" : "none";
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }

  function ensureModalShell(id, titleText) {
    let modal = document.getElementById(id);

    // If a broken modal exists (missing expected nodes), wipe it.
    const needsRebuild = (m) => {
      if (!m) return true;
      if (!m.querySelector(".modal-card")) return true;
      if (!m.querySelector("[data-action='confirm']")) return true;
      if (!m.querySelector("[data-action='close']")) return true;
      return false;
    };

    if (!modal || needsRebuild(modal)) {
      if (modal) modal.remove();

      modal = document.createElement("div");
      modal.id = id;

      // Force overlay even if CSS is missing
      modal.style.position = "fixed";
      modal.style.inset = "0";
      modal.style.zIndex = "9999";
      modal.style.display = "none";

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

      // Force scrim/card styling inline so it NEVER renders as page content
      const scrim = $(".modal-scrim", modal);
      scrim.style.position = "absolute";
      scrim.style.inset = "0";
      scrim.style.background = "rgba(0,0,0,.45)";
      scrim.style.backdropFilter = "blur(6px)";

      const card = $(".modal-card", modal);
      card.style.position = "absolute";
      card.style.left = "50%";
      card.style.top = "50%";
      card.style.transform = "translate(-50%,-50%)";
      card.style.width = "min(520px, calc(100vw - 28px))";
      card.style.maxHeight = "min(78vh, 640px)";
      card.style.overflow = "hidden";
      card.style.borderRadius = "22px";
      card.style.background = "rgba(20,30,55,.94)";
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.boxShadow = "0 24px 70px rgba(0,0,0,.55)";

      const head = $(".modal-head", modal);
      head.style.display = "flex";
      head.style.alignItems = "center";
      head.style.justifyContent = "space-between";
      head.style.padding = "16px 16px 12px";
      head.style.borderBottom = "1px solid rgba(255,255,255,.08)";

      const title = $(".modal-title", modal);
      title.style.fontSize = "22px";
      title.style.fontWeight = "900";

      const xBtn = $(".modal-x", modal);
      xBtn.style.width = "38px";
      xBtn.style.height = "38px";
      xBtn.style.borderRadius = "12px";
      xBtn.style.border = "1px solid rgba(255,255,255,.12)";
      xBtn.style.background = "rgba(255,255,255,.06)";
      xBtn.style.color = "rgba(255,255,255,.9)";
      xBtn.style.fontSize = "18px";

      const body = $(".modal-body", modal);
      body.style.padding = "14px 16px";
      body.style.overflow = "auto";
      body.style.maxHeight = "52vh";

      const foot = $(".modal-foot", modal);
      foot.style.display = "flex";
      foot.style.gap = "10px";
      foot.style.padding = "14px 16px 16px";
      foot.style.borderTop = "1px solid rgba(255,255,255,.08)";

      for (const b of $$("button.modal-btn", modal)) {
        b.style.flex = "1";
        b.style.height = "48px";
        b.style.borderRadius = "16px";
        b.style.border = "1px solid rgba(255,255,255,.12)";
        b.style.fontWeight = "900";
        b.style.fontSize = "18px";
      }
      const ghost = $(".modal-btn.ghost", modal);
      ghost.style.background = "rgba(255,255,255,.06)";
      ghost.style.color = "rgba(255,255,255,.88)";

      const primary = $(".modal-btn.primary", modal);
      primary.style.background = "rgba(15,122,255,.85)";
      primary.style.borderColor = "rgba(15,122,255,.90)";
      primary.style.color = "#fff";

      // close handlers
      const close = () => setModalOpen(modal, false);
      scrim.addEventListener("click", close);
      xBtn.addEventListener("click", close);
      $("[data-action='close']", modal).addEventListener("click", close);
    }

    // Update title if needed
    $(".modal-title", modal).textContent = titleText;

    return modal;
  }

  function openBandsModal() {
    const modal = ensureModalShell("bands-modal", "Bands");
    const body = $(".modal-body", modal);

    body.innerHTML = `
      <div style="display:grid; gap:14px;">
        ${PADRON_BANDS.map(b => {
          const checked = state.selectedBands.has(b.key);
          return `
            <label style="
              display:grid; gap:10px;
              padding:12px;
              border-radius:18px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <img src="${b.img}" alt="${b.label}" style="
                width:100%;
                max-height:140px;
                object-fit:contain;
                border-radius:14px;
                background:rgba(0,0,0,.10);
                border:1px solid rgba(255,255,255,.10);
              ">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div style="font-weight:900; font-size:18px; color:rgba(255,255,255,.92);">${b.label}</div>
                <input type="checkbox" data-band="${b.key}" ${checked ? "checked" : ""} style="transform:scale(1.25);">
              </div>
            </label>
          `;
        }).join("")}
      </div>
    `;

    const confirmBtn = $("[data-action='confirm']", modal);
    confirmBtn.textContent = "Confirm";
    confirmBtn.onclick = () => {
      const checks = $$("input[type='checkbox'][data-band]", modal);
      state.selectedBands = new Set(checks.filter(c => c.checked).map(c => c.dataset.band));
      setModalOpen(modal, false);
      applyAllFilters();
    };

    const closeBtn = $("[data-action='close']", modal);
    closeBtn.textContent = "Close";

    setModalOpen(modal, true);
  }

  function openFiltersModal() {
    const modal = ensureModalShell("filters-modal", "Filters");
    const body = $(".modal-body", modal);

    const scoped = state.allRows.filter(brandMatchesRow);

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
      const add = (k, v) => { if (v) optionSets[k].add(v); };

      add("Shade", pick(r, ["Wrapper Shade", "Shade", "WrapperShade"]));
      add("Vitola", pick(r, ["Vitola", "Style"]));
      add("Ring", pick(r, ["RG", "Ring", "Ring Gauge"]));
      add("Strength", pick(r, ["Strength"]));
      add("Length", pick(r, ["Length"]));
      add("Shape", pick(r, ["Shape"]));
      add("Tubo", pick(r, ["Tubo"]));
      add("Flavored", pick(r, ["Flavored"]));
      add("Tin", pick(r, ["Tin"]));
      add("Pack", pick(r, ["Pack"]));
      add("Barberpole", pick(r, ["Barber", "Barberpole"]));
      add("Box-Pressed", pick(r, ["Box-Pressed", "Box Pressed", "BoxPressed"]));
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
      <div>
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

    // chip toggles (event delegation)
    body.onclick = (e) => {
      const btn = e.target.closest("button.chip");
      if (!btn) return;
      const key = btn.dataset.filter;
      const val = decodeURIComponent(btn.dataset.value || "");
      if (!state.filters[key]) state.filters[key] = new Set();
      if (state.filters[key].has(val)) state.filters[key].delete(val);
      else state.filters[key].add(val);
      openFiltersModal(); // re-render to refresh chip highlight
    };

    const confirmBtn = $("[data-action='confirm']", modal);
    confirmBtn.textContent = "Confirm";
    confirmBtn.onclick = () => {
      setModalOpen(modal, false);
      applyAllFilters();
    };

    const closeBtn = $("[data-action='close']", modal);
    closeBtn.textContent = "Close";

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

  function openReceiptModal() {
    const modal = ensureModalShell("receipt-modal", "Receipt");
    const body = $(".modal-body", modal);
    const cart = readCart();

    if (!cart.length) {
      body.innerHTML = `<div style="color:rgba(255,255,255,.65); font-weight:800;">No items yet.</div>`;
    } else {
      const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      body.innerHTML = `
        <div style="display:grid; gap:10px;">
          ${cart.map(it => `
            <div style="
              display:grid; gap:4px;
              padding:12px;
              border-radius:16px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <div style="font-weight:900; color:#fff;">${it.cigar}</div>
              <div style="color:rgba(255,255,255,.60); font-weight:700; font-size:13px;">
                ${it.vitola || ""} ${it.vitola ? "•" : ""} ${it.brand || ""}
              </div>
              <div style="font-weight:900; text-align:right; color:#fff;">$${money(it.price)}</div>
            </div>
          `).join("")}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            <div style="font-weight:900; font-size:18px; color:#fff;">Total</div>
            <div style="font-weight:900; font-size:18px; color:#fff;">$${money(total)}</div>
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
    btn.style.zIndex = "9998";

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

  // =========================
  // 12) EVENTS
  // =========================
  function initControls() {
    el.search?.addEventListener("input", (e) => {
      state.search = e.target.value || "";
      applyAllFilters();
    });

    if (el.btnBands) el.btnBands.addEventListener("click", openBandsModal);
    if (el.btnFilters) el.btnFilters.addEventListener("click", openFiltersModal);
  }

  // =========================
  // 13) BOOT
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
