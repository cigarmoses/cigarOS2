/* /pos/cigars/brand.js
   Brand page controller (BANDS FIX + DEBUG)
*/

(() => {
  // =========================
  // 0) DEBUG BADGE (PROVES JS IS RUNNING)
  // =========================
  const DEBUG = true;

  function debugBadge(text, ok = true) {
    if (!DEBUG) return;
    let b = document.getElementById("brandjs-debug");
    if (!b) {
      b = document.createElement("div");
      b.id = "brandjs-debug";
      b.style.position = "fixed";
      b.style.left = "12px";
      b.style.bottom = "12px";
      b.style.zIndex = "2147483647";
      b.style.padding = "8px 10px";
      b.style.borderRadius = "12px";
      b.style.fontFamily = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
      b.style.fontSize = "12px";
      b.style.fontWeight = "800";
      b.style.backdropFilter = "blur(10px)";
      b.style.border = "1px solid rgba(255,255,255,.18)";
      b.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
      b.style.color = "#fff";
      document.body.appendChild(b);
    }
    b.style.background = ok ? "rgba(52,199,89,.22)" : "rgba(255,59,48,.22)";
    b.textContent = text;
  }

  // Make JS failures visible on-screen
  window.addEventListener("error", (e) => {
    debugBadge(`brand.js ERROR: ${e?.message || "unknown"}`, false);
  });

  // =========================
  // 1) CONFIG
  // =========================
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  const CART_KEY = "cigaros_pos_cart_v1";

  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "/img/icons/padron1926serieband.svg" },
    { key: "1964", label: "1964", img: "/img/icons/padron1964anniversaryband.svg" },
    { key: "Damaso", label: "Damaso", img: "/img/icons/padrondamasoband.svg" },
  ];

  const RECEIPT_ICON_SRC = "/img/icons/pos/receipt.png";

  // =========================
  // 2) HELPERS
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeText(v) {
    return (v == null ? "" : String(v)).trim();
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
      headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
      return obj;
    });
  }

  // =========================
  // 3) STATE + DOM
  // =========================
  const state = {
    brand: safeText(getQueryParam("brand")),
    allRows: [],
    viewRows: [],
    search: "",
    shadeState: "all",
    selectedBands: new Set(),
  };

  const el = {
    title: $(".brand-title"),
    brandIcon: $(".brand-icon"),
    search: $("#brand-search") || $("input[type='search']"),
    list: $(".brand-list") || $("#brand-list") || $(".list"),
    seg: $(".seg"),
  };

  // =========================
  // 4) HEADER
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

  // =========================
  // 5) MODAL (FORCED ON TOP)
  // =========================
  function ensureModalShell(id, titleText) {
    let modal = document.getElementById(id);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = id;

    // Force styles so it ALWAYS appears
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "2147483647";
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

    // Inline styling for children (no dependency on CSS)
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
    card.style.maxHeight = "82vh";
    card.style.overflow = "hidden";
    card.style.borderRadius = "22px";
    card.style.background = "rgba(20,30,55,.94)";
    card.style.border = "1px solid rgba(255,255,255,.10)";
    card.style.boxShadow = "0 24px 70px rgba(0,0,0,.55)";
    card.style.color = "#fff";
    card.style.fontFamily = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";

    const head = $(".modal-head", modal);
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.padding = "16px 16px 12px";
    head.style.borderBottom = "1px solid rgba(255,255,255,.08)";

    const title = $(".modal-title", modal);
    title.style.fontSize = "22px";
    title.style.fontWeight = "900";
    title.style.letterSpacing = "-.01em";

    const x = $(".modal-x", modal);
    x.style.width = "38px";
    x.style.height = "38px";
    x.style.borderRadius = "12px";
    x.style.border = "1px solid rgba(255,255,255,.12)";
    x.style.background = "rgba(255,255,255,.06)";
    x.style.color = "rgba(255,255,255,.9)";
    x.style.fontSize = "18px";

    const body = $(".modal-body", modal);
    body.style.maxHeight = "52vh";
    body.style.overflow = "auto";
    body.style.padding = "14px 16px";

    const foot = $(".modal-foot", modal);
    foot.style.display = "flex";
    foot.style.gap = "10px";
    foot.style.padding = "14px 16px 16px";
    foot.style.borderTop = "1px solid rgba(255,255,255,.08)";

    $$(".modal-btn", modal).forEach((btn) => {
      btn.style.flex = "1";
      btn.style.height = "48px";
      btn.style.borderRadius = "16px";
      btn.style.border = "1px solid rgba(255,255,255,.12)";
      btn.style.fontWeight = "900";
      btn.style.fontSize = "18px";
    });

    const ghost = $(".modal-btn.ghost", modal);
    if (ghost) {
      ghost.style.background = "rgba(255,255,255,.06)";
      ghost.style.color = "rgba(255,255,255,.88)";
    }

    const primary = $(".modal-btn.primary", modal);
    if (primary) {
      primary.style.background = "rgba(15,122,255,.85)";
      primary.style.borderColor = "rgba(15,122,255,.90)";
      primary.style.color = "#fff";
    }

    const close = () => setModalOpen(modal, false);
    scrim.addEventListener("click", close);
    x.addEventListener("click", close);
    $("[data-action='close']", modal).addEventListener("click", close);

    return modal;
  }

  function setModalOpen(modalEl, open) {
    modalEl.style.display = open ? "block" : "none";
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }

  function openBandsModal() {
    debugBadge("Bands click ✅ opening…");

    const modal = ensureModalShell("bands-modal", "Bands");
    const body = $(".modal-body", modal);

    body.innerHTML = `
      <div style="display:grid; gap:14px;">
        ${PADRON_BANDS.map((b) => {
          const checked = state.selectedBands.has(b.key);
          return `
            <label style="
              display:grid; gap:10px; justify-items:center;
              padding:12px;
              border-radius:18px;
              border:1px solid rgba(255,255,255,.10);
              background:rgba(255,255,255,.05);
            ">
              <img src="${b.img}" alt="${b.label}" style="
                width:100%;
                max-width:420px;
                max-height:110px;
                height:auto;
                object-fit:contain;
                border-radius:14px;
                background:rgba(0,0,0,.10);
              "/>
              <div style="font-weight:900; font-size:18px; color:rgba(255,255,255,.92);">${b.label}</div>
              <input type="checkbox" data-band="${b.key}" ${checked ? "checked" : ""} style="transform:scale(1.2);" />
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
      debugBadge("Bands applied ✅");
    };

    setModalOpen(modal, true);
  }

  // =========================
  // 6) CLICK DETECTION (BULLETPROOF)
  // =========================
  function closestTextMatch(node, word) {
    let cur = node;
    for (let i = 0; i < 6 && cur; i++) {
      const txt = safeText(cur.textContent).toLowerCase();
      if (txt === word || txt.includes(word)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function isBandsHit(target) {
    if (!target) return false;

    // ids / attributes / classes
    if (target.closest("#bands-btn")) return true;
    if (target.closest("[data-action='bands']")) return true;
    if (target.closest(".pill-btn.bands")) return true;

    // text match anywhere in the clicked stack
    if (closestTextMatch(target, "bands")) return true;

    return false;
  }

  function initBandsClick() {
    document.addEventListener(
      "click",
      (e) => {
        if (!isBandsHit(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        openBandsModal();
      },
      true // capture phase
    );
  }

  // =========================
  // 7) LIST / FILTERING (minimal)
  // =========================
  function rowBrandValue(r) {
    return safeText(r.Brand || r.BRAND || r["Brand Name"] || r["Brand"] || "");
  }

  function applyAllFilters() {
    let out = state.allRows.slice();
    if (state.brand) {
      out = out.filter((r) => rowBrandValue(r).toLowerCase() === state.brand.toLowerCase());
    }
    state.viewRows = out;
    renderList(state.viewRows);
  }

  function renderList(rows) {
    if (!el.list) return;
    el.list.innerHTML = "";

    const { primary, fallback } = resolveBrandIcon(state.brand);

    rows.forEach((c) => {
      const cigarName = safeText(c.Cigar || c.CIGAR || c.Name || c["Cigar Name"] || "");
      const vitola = safeText(c.Vitola || c.VITOLA || c.Style || "");
      const price = safeText(c.MSRP || c.Price || c["Cigar MSRP"] || c["MSRP ($)"] || "");

      const row = document.createElement("div");
      row.className = "cigar-row";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "12px";
      row.style.padding = "12px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,.10)";

      const img = document.createElement("img");
      img.src = primary;
      img.onerror = () => {
        img.onerror = null;
        img.src = fallback;
      };
      img.style.width = "46px";
      img.style.height = "46px";
      img.style.borderRadius = "12px";
      img.style.objectFit = "cover";
      img.style.background = "rgba(255,255,255,.07)";

      const mid = document.createElement("div");
      mid.style.flex = "1 1 auto";
      mid.style.minWidth = "0";

      const nameEl = document.createElement("div");
      nameEl.textContent = cigarName || "(Unnamed cigar)";
      nameEl.style.fontSize = "15px";
      nameEl.style.fontWeight = "800";

      const subEl = document.createElement("div");
      subEl.textContent = vitola;
      subEl.style.marginTop = "4px";
      subEl.style.fontSize = "12px";
      subEl.style.fontWeight = "700";
      subEl.style.color = "rgba(255,255,255,.55)";

      mid.appendChild(nameEl);
      mid.appendChild(subEl);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const priceEl = document.createElement("div");
      priceEl.textContent = money(price);
      priceEl.style.width = "54px";
      priceEl.style.textAlign = "right";
      priceEl.style.fontSize = "15px";
      priceEl.style.fontWeight = "700";

      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.style.width = "22px";
      plus.style.height = "22px";
      plus.style.borderRadius = "999px";
      plus.style.border = "none";
      plus.style.background = "var(--green, #34c759)";
      plus.style.color = "#fff";
      plus.style.fontSize = "15px";
      plus.addEventListener("click", () => addToCart({ cigar: cigarName, price: Number(price) || 0 }));

      right.appendChild(priceEl);
      right.appendChild(plus);

      row.appendChild(img);
      row.appendChild(mid);
      row.appendChild(right);

      el.list.appendChild(row);
    });
  }

  // =========================
  // 8) CART (minimal for now)
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
    cart.push({ ...item, id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, qty: 1 });
    writeCart(cart);
    debugBadge("Added to bill ✅");
  }

  // =========================
  // 9) BOOT
  // =========================
  async function boot() {
    debugBadge("brand.js loaded ✅");

    initHeader();
    initBandsClick(); // <-- THIS is the important part

    // Load data (not required for bands modal)
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      const txt = await res.text();
      state.allRows = rowsToObjects(parseCSV(txt));
      applyAllFilters();
    } catch (e) {
      console.error(e);
      debugBadge("CSV load failed (but Bands should still work)", false);
    }
  }

  // Ensure DOM exists (especially on Netlify/iOS)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
