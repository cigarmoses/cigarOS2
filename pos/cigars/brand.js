/* /pos/cigars/brand.js
   Brand POS page controller (Cigars)
   - Loads canonical CSV
   - Renders rows
   - Filters modal UI (visual only)
   - Uses shared /pos/cart.js if available
*/

(() => {
  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  const $ = (sel) => document.querySelector(sel);

  const brandTitleEl = $("#brand-title");
  const brandIconEl = $("#brand-icon-img");
  const listEl = $("#brand-list");

  const backBtn = $("#brand-back");

  // Two possible filters buttons exist in your HTML:
  const topFiltersBtn = $("#brand-filters");
  const controlsFiltersBtn = $("#btn-filters");

  const bandsBtn = $("#btn-bands");

  const filtersModal = $("#filters-modal");
  const filtersGrid = $("#filters-grid");
  const filtersConfirm = $("#filters-confirm");

  const bandsModal = $("#bands-modal");
  const bandsConfirm = $("#bands-confirm");

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

  // CSV parser (handles quoted commas)
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
    return Number.isFinite(n) ? n.toFixed(2) : "";
  };

  // --- Filters UI (visual only) ---
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
    if (!listEl) return;
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

      // Middle text
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

      // Separator
      const sep = document.createElement("div");
      sep.className = "cigar-sep";
      sep.setAttribute("aria-hidden", "true");

      // Right
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

      add.addEventListener("click", () => {
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
        } catch (_) {}
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
    const get = (r, key) => (idx[key] != null ? r[idx[key]] : "");

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

    const title = brandParam || (filtered[0]?.brand ?? "Brand");
    if (brandTitleEl) brandTitleEl.textContent = title;

    const topImg = filtered[0]?.brandImg || filtered[0]?.manufacturerImg || "";
    if (brandIconEl && topImg) brandIconEl.src = topImg;

    render(filtered);
  };

  // --- Events ---
  backBtn?.addEventListener("click", () => history.back());

  const openFilters = () => {
    buildFiltersUI();
    openModal(filtersModal);
  };

  topFiltersBtn?.addEventListener("click", openFilters);
  controlsFiltersBtn?.addEventListener("click", openFilters);

  bandsBtn?.addEventListener("click", () => openModal(bandsModal));

  // Close modal clicks (filters + bands)
  const modalClickClose = (e) => {
    const t = e.target;
    const closeKey = t?.dataset?.close;
    if (!closeKey) return;

    if (closeKey === "filters") closeModal(filtersModal);
    if (closeKey === "bands") closeModal(bandsModal);
  };

  filtersModal?.addEventListener("click", modalClickClose);
  bandsModal?.addEventListener("click", modalClickClose);

  filtersConfirm?.addEventListener("click", () => closeModal(filtersModal));
  bandsConfirm?.addEventListener("click", () => closeModal(bandsModal));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (filtersModal?.classList.contains("is-open")) closeModal(filtersModal);
      if (bandsModal?.classList.contains("is-open")) closeModal(bandsModal);
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
