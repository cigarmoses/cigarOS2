/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows (name wraps; no ellipsis)
   - Filters modal UI matches Cigars page style
   - Confirm button uses .btn-confirm styling
   - Uses shared /pos/cart.js for receipt + badge + persistence (unchanged)
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);

  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon-img");
  const listEl = $("#brand-list");

  const backBtn = $("#brand-back");
  const filtersBtn = $("#brand-filters");

  const filtersModal = $("#filters-modal");
  const filtersGrid = $("#filters-grid");
  const filtersConfirm = $("#filters-confirm");

  // --- helpers ---
  const qp = new URLSearchParams(location.search);
  const brandParam = (qp.get("brand") || "").trim();

  const openModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.classList.add("is-open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  // Very small CSV parser (handles quoted commas)
  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

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
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    return rows;
  };

  const indexByHeader = (headers) => {
    const map = {};
    headers.forEach((h, idx) => {
      map[(h || "").trim()] = idx;
    });
    return map;
  };

  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  };

  // --- Filters UI (visual only; wire logic later if you want) ---
  // Order copied from your mockups / Cigars page style intent
  const FILTER_BUTTONS = [
    "Ring",
    "Wrapper Shade",
    "Vitolas",
    "Flavored",
    "Box-Pressed",
    "Strength",
    "Length",
    "Shape",
    "Tin",
    "Packs",
    "Barberpole",
  ];

  const buildFiltersUI = () => {
    if (!filtersGrid) return;
    filtersGrid.innerHTML = "";

    FILTER_BUTTONS.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip";
      btn.textContent = label;

      btn.addEventListener("click", () => {
        btn.classList.toggle("is-active");
      });

      filtersGrid.appendChild(btn);
    });
  };

  // --- Rendering ---
  const render = (items) => {
    listEl.innerHTML = "";

    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = "cigar-row";

      // Left icon
      const left = document.createElement("div");
      left.className = "cigar-left";

      const img = document.createElement("img");
      img.className = "cigar-brand-icon";
      img.alt = "";
      img.loading = "lazy";
      img.src = it.brandImg || it.manufacturerImg || "";
      left.appendChild(img);

      // Middle text (name wraps; vitola below)
      const main = document.createElement("div");
      main.className = "cigar-main";

      const name = document.createElement("div");
      name.className = "cigar-name";
      name.textContent = it.cigar || "";

      const vitola = document.createElement("div");
      vitola.className = "cigar-vitola";
      vitola.textContent = it.vitola || "";

      main.appendChild(name);
      main.appendChild(vitola);

      // Separator (shorter height handled by CSS)
      const sep = document.createElement("div");
      sep.className = "cigar-sep";
      sep.setAttribute("aria-hidden", "true");

      // Right (price + add)
      const right = document.createElement("div");
      right.className = "cigar-right";

      const price = document.createElement("div");
      price.className = "cigar-price";
      price.textContent = money(it.price);

      const add = document.createElement("button");
      add.type = "button";
      add.className = "cigar-add";
      add.textContent = "+";
      add.setAttribute("aria-label", "Add to receipt");

      // Hook into your existing cart.js if it exposes a handler
      add.addEventListener("click", () => {
        // If your cart.js defines window.POS_CART.addItem, this will work.
        // Otherwise it safely no-ops.
        try {
          if (window.POS_CART && typeof window.POS_CART.addItem === "function") {
            window.POS_CART.addItem({
              name: it.cigar,
              detail: it.vitola,
              price: Number(it.price) || 0,
              sku: it.key || it.productNumber || "",
              meta: it,
            });
          }
        } catch (e) {}
      });

      right.appendChild(price);
      right.appendChild(add);

      li.appendChild(left);
      li.appendChild(main);
      li.appendChild(sep);
      li.appendChild(right);

      listEl.appendChild(li);
    });
  };

  // --- Data load ---
  const load = async () => {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load CSV");
    const text = await res.text();

    const rows = parseCSV(text);
    const headers = rows[0] || [];
    const idx = indexByHeader(headers);

    // Expected headers from your canonical sheet (best-effort)
    const get = (r, key) => r[idx[key]] ?? "";

    const all = rows.slice(1).map((r) => ({
      manufacturer: get(r, "Manufacturer"),
      manufacturerImg: get(r, "Manufacturer IMG"),
      brand: get(r, "Brand"),
      brandImg: get(r, "Brand IMG"),
      line: get(r, "Line"),
      cigar: get(r, "Cigar"),
      cigarImg: get(r, "Cigar IMG"),
      vitola: get(r, "Vitola"),
      price: get(r, "MSRP") || get(r, "Price") || get(r, "Cigar Cost"),
      key: get(r, "key") || get(r, "Key") || "",
      productNumber: get(r, "Product #") || "",
    }));

    const filtered = brandParam
      ? all.filter((x) => (x.brand || "").toLowerCase() === brandParam.toLowerCase())
      : all;

    // Topbar
    const title = brandParam || (filtered[0]?.brand ?? "Brand");
    brandTitleEl.textContent = title;

    // Brand icon (top-right) – uses first row’s Brand IMG if present
    const topImg = filtered[0]?.brandImg || filtered[0]?.manufacturerImg || "";
    if (topImg) brandIconEl.src = topImg;

    render(filtered);
  };

  // --- Events ---
  backBtn?.addEventListener("click", () => history.back());

  filtersBtn?.addEventListener("click", () => {
    buildFiltersUI();
    openModal(filtersModal);
  });

  // Close modal clicks
  filtersModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close === "filters") {
      closeModal(filtersModal);
    }
  });

  filtersConfirm?.addEventListener("click", () => {
    // Visual confirm closes modal (wire filtering later if desired)
    closeModal(filtersModal);
  });

  // ESC closes
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && filtersModal?.classList.contains("is-open")) {
      closeModal(filtersModal);
    }
  });

  // Init
  load().catch((err) => {
    console.error(err);
    if (brandTitleEl) brandTitleEl.textContent = "Brand";
    if (listEl) {
      listEl.innerHTML =
        '<li style="padding:16px;color:rgba(255,255,255,.8)">Failed to load cigars.</li>';
    }
  });
})();
