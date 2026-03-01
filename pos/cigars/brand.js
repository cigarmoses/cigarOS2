/* /pos/cigars/brand.js — FULL REPLACEMENT
   Fixes:
   - Standalone SVG logos (no backgrounds via CSS)
   - Maduro/Natural toggle works
   - Theme pill is horizontal + visible
   - Add-to-invoice works (localStorage invoice)
   - Clicking cigar name routes to detail page + populates
   - Bands sheet: big bands + proper label/checkbox layout
*/

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  // --------- Theme ----------
  const THEME_KEY = "cigaros_theme";
  function getTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }
  function setTheme(next) {
    localStorage.setItem(THEME_KEY, next);
    document.body.classList.toggle("dark", next === "dark");
  }

  // --------- Invoice ----------
  const INVOICE_KEY = "cigaros_invoice_items";
  function readInvoice() {
    try {
      const raw = localStorage.getItem(INVOICE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function writeInvoice(items) {
    localStorage.setItem(INVOICE_KEY, JSON.stringify(items));
  }
  function addToInvoice(item) {
    const items = readInvoice();
    // Use id if present, else name+vitola as a stable-ish key
    const key = item.id || `${item.name || ""}__${item.vitola || ""}`;
    const found = items.find(x => (x.key === key));
    if (found) found.qty = (found.qty || 1) + 1;
    else items.push({ key, qty: 1, item });
    writeInvoice(items);
    refreshCartBadge();
  }
  function refreshCartBadge() {
    const items = readInvoice();
    const count = items.reduce((a, x) => a + (Number(x.qty) || 0), 0);
    const badge = $("#cartBadge");
    const cartBtn = $("#cartBtn");
    if (!badge || !cartBtn) return;

    if (count > 0) {
      badge.hidden = false;
      badge.textContent = String(count);
      cartBtn.classList.add("has-items");
    } else {
      badge.hidden = true;
      badge.textContent = "0";
      cartBtn.classList.remove("has-items");
    }
  }

  // --------- Data loading ----------
  function getBrandFromURL() {
    const u = new URL(location.href);
    return (u.searchParams.get("brand") || u.pathname.split("/").filter(Boolean).pop() || "brand").toLowerCase();
  }

  async function fetchBrandData(brand) {
    // Try a few common paths (so this works with your current deployment structure)
    const candidates = [
      `/data/cigars/${brand}.json`,
      `/pos/data/cigars/${brand}.json`,
      `/data/brands/${brand}.json`,
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        if (json) return json;
      } catch {}
    }

    // If you already have global data loader elsewhere, you can set window.__BRAND_DATA__ in HTML before this script.
    if (window.__BRAND_DATA__) return window.__BRAND_DATA__;

    // Fallback empty
    return { brand, logo: "", cigars: [], bands: [] };
  }

  // --------- UI state ----------
  const state = {
    brand: "",
    wrapper: "maduro",
    search: "",
    selectedBands: new Set(),
    cigars: [],
    bands: [],
    logo: ""
  };

  // --------- Rendering ----------
  function money(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    return x.toFixed(2);
  }

  function normalizeWrapper(v) {
    const s = String(v || "").toLowerCase();
    if (s.includes("maduro")) return "maduro";
    if (s.includes("natural") || s.includes("claro")) return "natural";
    return "";
  }

  function applyFilters(list) {
    const q = state.search.trim().toLowerCase();
    return list.filter(c => {
      const w = normalizeWrapper(c.wrapperShade || c.wrapper || c.shade);
      if (state.wrapper && w && w !== state.wrapper) return false;

      if (state.selectedBands.size > 0) {
        // allow multiple possible fields
        const band = String(c.band || c.series || c.line || c.collection || "").toLowerCase();
        if (!state.selectedBands.has(band)) return false;
      }

      if (q) {
        const hay = [
          c.name, c.vitola, c.shape, c.series, c.line, c.band, c.wrapperShade
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }

  function renderList() {
    const root = $("#list");
    if (!root) return;

    const filtered = applyFilters(state.cigars);

    root.innerHTML = filtered.map((c, idx) => {
      const id = c.id || c.slug || `${idx}`;
      const name = c.name || "Cigar";
      const vitola = c.vitola || c.shape || "";
      const price = money(c.price ?? c.unitPrice ?? c.msrp);

      const icon = c.brandIcon || state.logo || "";

      return `
        <article class="row" data-id="${encodeURIComponent(String(id))}">
          ${icon ? `<img class="icon" src="${icon}" alt="" />` : `<div class="icon" aria-hidden="true"></div>`}

          <div class="meta">
            <h3 class="name" data-action="open">${escapeHTML(name)}</h3>
            <div class="sub">${escapeHTML(vitola)}</div>
          </div>

          <div class="price">${price}</div>

          <button class="add" type="button" data-action="add" aria-label="Add to invoice">+</button>
        </article>
      `;
    }).join("");
  }

  function renderBandsSheet() {
    const body = $("#bandsBody");
    if (!body) return;

    body.innerHTML = state.bands.map((b, i) => {
      const id = `band_${i}`;
      const key = String(b.key || b.name || b.title || "").toLowerCase().trim();
      const label = b.label || b.name || b.title || "Band";
      const img = b.image || b.img || b.src || "";
      const checked = state.selectedBands.has(key);

      return `
        <div class="band-row">
          <div class="band-left">
            ${img ? `<img class="band-img" src="${img}" alt="" />` : ""}
            <div class="band-label">
              <div class="band-text">${escapeHTML(label)}</div>
              <input class="band-check" type="checkbox" id="${id}" data-band="${escapeAttr(key)}" ${checked ? "checked" : ""} />
            </div>
          </div>
        </div>
      `;
    }).join("");

    // checkbox handler
    body.querySelectorAll(".band-check").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const el = e.currentTarget;
        const key = String(el.getAttribute("data-band") || "").toLowerCase().trim();
        if (!key) return;
        if (el.checked) state.selectedBands.add(key);
        else state.selectedBands.delete(key);
      });
    });
  }

  function setBrandHeader() {
    $("#brandTitle").textContent = titleCase(state.brand);
    const logo = $("#brandLogo");
    if (logo) {
      logo.src = state.logo || "";
      logo.style.display = state.logo ? "block" : "none";
    }
  }

  // --------- Sheets ----------
  function openSheet(which) {
    if (which === "bands") {
      $("#bandsBackdrop").hidden = false;
      $("#bandsSheet").classList.add("is-open");
      $("#bandsSheet").setAttribute("aria-hidden", "false");
    } else {
      $("#filtersBackdrop").hidden = false;
      $("#filtersSheet").classList.add("is-open");
      $("#filtersSheet").setAttribute("aria-hidden", "false");
    }
  }
  function closeSheet(which) {
    if (which === "bands") {
      $("#bandsBackdrop").hidden = true;
      $("#bandsSheet").classList.remove("is-open");
      $("#bandsSheet").setAttribute("aria-hidden", "true");
    } else {
      $("#filtersBackdrop").hidden = true;
      $("#filtersSheet").classList.remove("is-open");
      $("#filtersSheet").setAttribute("aria-hidden", "true");
    }
  }

  // --------- Routing ----------
  function openDetail(cigar) {
    // Put cigar into sessionStorage so detail page always populates even if URL is minimal
    try {
      sessionStorage.setItem("cigaros_detail", JSON.stringify(cigar));
    } catch {}

    // Also pass id for future-proofing
    const id = cigar.id || cigar.slug || "";
    const u = new URL("/pos/cigars/detail.html", location.origin);
    u.searchParams.set("brand", state.brand);
    if (id) u.searchParams.set("id", String(id));
    location.href = u.toString();
  }

  // --------- Controls ----------
  function setWrapper(next) {
    state.wrapper = next;
    const seg = $(".segmented");
    const mad = $("#maduroBtn");
    const nat = $("#naturalBtn");

    if (next === "natural") seg.classList.add("is-natural");
    else seg.classList.remove("is-natural");

    mad.classList.toggle("is-active", next === "maduro");
    nat.classList.toggle("is-active", next === "natural");
    mad.setAttribute("aria-selected", String(next === "maduro"));
    nat.setAttribute("aria-selected", String(next === "natural"));

    renderList();
  }

  // --------- Helpers ----------
  function titleCase(s) {
    return String(s || "")
      .split(/[-_ ]+/g)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return escapeHTML(str).replaceAll("`", "");
  }

  // --------- Init ----------
  async function init() {
    // theme
    setTheme(getTheme());

    // brand + data
    state.brand = getBrandFromURL();
    const data = await fetchBrandData(state.brand);

    state.logo = data.logo || data.brandLogo || data.icon || "";
    state.cigars = Array.isArray(data.cigars) ? data.cigars : [];
    state.bands = Array.isArray(data.bands) ? data.bands : [];

    // If no bands array, try to build a bands list from cigars
    if (state.bands.length === 0 && state.cigars.length > 0) {
      const map = new Map();
      state.cigars.forEach(c => {
        const key = String(c.band || c.series || c.line || "").toLowerCase().trim();
        if (!key) return;
        if (!map.has(key)) map.set(key, { key, label: titleCase(key), image: c.bandImage || c.bandImg || "" });
      });
      state.bands = [...map.values()];
    }

    setBrandHeader();
    renderBandsSheet();
    renderList();
    refreshCartBadge();

    // Back
    $("#backBtn").addEventListener("click", () => history.back());

    // Theme pill
    $("#themePill").addEventListener("click", () => {
      setTheme(document.body.classList.contains("dark") ? "light" : "dark");
    });

    // Cart
    $("#cartBtn").addEventListener("click", () => {
      // route to invoice page (adjust if your invoice path differs)
      location.href = "/pos/invoice/";
    });

    // Search
    $("#searchInput").addEventListener("input", (e) => {
      state.search = e.target.value || "";
      renderList();
    });

    // Wrapper toggle
    $("#maduroBtn").addEventListener("click", () => setWrapper("maduro"));
    $("#naturalBtn").addEventListener("click", () => setWrapper("natural"));

    // Bands sheet open/close
    $("#bandsBtn").addEventListener("click", () => openSheet("bands"));
    $("#bandsClose").addEventListener("click", () => closeSheet("bands"));
    $("#bandsBackdrop").addEventListener("click", () => closeSheet("bands"));
    $("#bandsConfirm").addEventListener("click", () => {
      closeSheet("bands");
      renderList();
    });

    // Filters sheet open/close (placeholder container)
    $("#filtersBtn").addEventListener("click", () => openSheet("filters"));
    $("#filtersClose").addEventListener("click", () => closeSheet("filters"));
    $("#filtersBackdrop").addEventListener("click", () => closeSheet("filters"));
    $("#filtersConfirm").addEventListener("click", () => closeSheet("filters"));

    // Row interactions (event delegation)
    $("#list").addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");
      const row = e.target.closest(".row");
      if (!row) return;

      const id = decodeURIComponent(row.getAttribute("data-id") || "");
      const cigar = state.cigars.find((c, idx) => String(c.id || c.slug || idx) === id) || null;
      if (!cigar) return;

      if (actionEl?.getAttribute("data-action") === "add") {
        addToInvoice(cigar);
        return;
      }

      // clicking name (or row meta area) opens detail
      if (e.target.closest(".name") || e.target.closest(".meta") || e.target === row) {
        openDetail(cigar);
      }
    });
  }

  init();
})();
