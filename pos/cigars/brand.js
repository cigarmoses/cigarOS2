/* /pos/cigars/brand.js
   FINAL STABLE VERSION
*/

(() => {
  /* =========================
     CONFIG
  ========================= */
  const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv&gid=822697742";

  const CART_KEY = "cigaros_pos_cart_v1";
  const RECEIPT_ICON_SRC = "/img/icons/pos/receipt.png";

  const PADRON_BANDS = [
    { key: "1926", label: "1926", img: "/img/icons/padron1926serieband.svg" },
    { key: "1964", label: "1964", img: "/img/icons/padron1964anniversaryband.svg" },
    { key: "Damaso", label: "Damaso", img: "/img/icons/padrondamasoband.svg" },
  ];

  /* =========================
     HELPERS
  ========================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const safe = v => (v == null ? "" : String(v).trim());
  const money = n => (Number(n) || 0).toFixed(2);

  function slugBrand(name) {
    return safe(name).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function parseCSV(text) {
    const rows = [];
    let cur = "", row = [], q = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && q && n === '"') { cur += '"'; i++; continue; }
      if (c === '"') { q = !q; continue; }
      if (c === "," && !q) { row.push(cur); cur = ""; continue; }
      if ((c === "\n" || c === "\r") && !q) {
        if (c === "\r" && n === "\n") i++;
        row.push(cur); rows.push(row);
        row = []; cur = ""; continue;
      }
      cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => safe(c)));
  }

  function rowsToObjects(rows) {
    const h = rows[0];
    return rows.slice(1).map(r => {
      const o = {};
      h.forEach((k, i) => o[k] = r[i] || "");
      return o;
    });
  }

  /* =========================
     STATE
  ========================= */
  const state = {
    brand: new URLSearchParams(location.search).get("brand") || "",
    all: [],
    view: [],
    search: "",
    shade: "all",
    bands: new Set()
  };

  /* =========================
     DOM
  ========================= */
  const el = {
    list: $(".brand-list"),
    search: $("#brand-search"),
    seg: $(".seg"),
    bandsBtn: $(".pill-btn.bands"),
    filtersBtn: $(".pill-btn.filters")
  };

  /* =========================
     LOAD DATA
  ========================= */
  async function load() {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    const txt = await res.text();
    state.all = rowsToObjects(parseCSV(txt));
    apply();
  }

  /* =========================
     FILTER + RENDER
  ========================= */
  function apply() {
    let out = state.all.filter(r =>
      safe(r.Brand).toLowerCase() === state.brand.toLowerCase()
    );

    if (state.search) {
      const q = state.search.toLowerCase();
      out = out.filter(r =>
        safe(r.Cigar).toLowerCase().includes(q)
      );
    }

    if (state.shade !== "all") {
      out = out.filter(r =>
        safe(r["Wrapper Shade"]).toLowerCase().includes(state.shade)
      );
    }

    if (state.bands.size) {
      out = out.filter(r =>
        [...state.bands].some(b =>
          safe(r.Line).toLowerCase().includes(b.toLowerCase())
        )
      );
    }

    state.view = out;
    render();
  }

  function render() {
    el.list.innerHTML = "";
    const slug = slugBrand(state.brand);

    state.view.forEach(r => {
      const row = document.createElement("div");
      row.className = "cigar-row";

      const img = document.createElement("img");
      img.src = `/img/icons/brands/${slug}.svg`;
      img.style.width = "48px";
      img.style.height = "48px";
      img.style.objectFit = "contain";
      img.style.flexShrink = "0";

      const mid = document.createElement("div");
      mid.className = "cigar-mid";
      mid.innerHTML = `
        <div class="cigar-name">${safe(r.Cigar)}</div>
        <div class="cigar-sub">${safe(r.Vitola)}</div>
      `;

      const right = document.createElement("div");
      right.className = "cigar-right";
      right.innerHTML = `
        <div class="cigar-price">${money(r.MSRP)}</div>
        <button class="cigar-plus">+</button>
      `;

      right.querySelector(".cigar-plus").onclick = () => addToCart(r);

      row.append(img, mid, right);
      el.list.appendChild(row);
    });
  }

  /* =========================
     SHADE TOGGLE (FIXED)
  ========================= */
  el.seg?.addEventListener("click", e => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;

    const val = btn.dataset.value;
    state.shade = (state.shade === val) ? "all" : val;
    el.seg.dataset.state = state.shade;
    apply();
  });

  /* =========================
     BANDS MODAL (FIXED)
  ========================= */
  el.bandsBtn?.addEventListener("click", () => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-scrim"></div>
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">Bands</div>
          <button class="modal-x">×</button>
        </div>
        <div class="modal-body bandgrid">
          ${PADRON_BANDS.map(b => `
            <label class="bandtile">
              <img src="${b.img}">
              <div>${b.label}</div>
              <input type="checkbox" data-band="${b.key}">
            </label>
          `).join("")}
        </div>
        <div class="modal-foot">
          <button class="modal-btn close">Close</button>
          <button class="modal-btn confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $(".modal-x", modal).onclick =
    $(".close", modal).onclick = () => modal.remove();

    $(".confirm", modal).onclick = () => {
      state.bands.clear();
      $$("input:checked", modal).forEach(i => state.bands.add(i.dataset.band));
      modal.remove();
      apply();
    };
  });

  /* =========================
     CART + RECEIPT
  ========================= */
  function addToCart(r) {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    cart.push({ cigar: r.Cigar, price: r.MSRP });
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    ensureReceipt();
  }

  function ensureReceipt() {
    if ($("#receipt-fab")) return;

    const btn = document.createElement("button");
    btn.id = "receipt-fab";
    btn.innerHTML = `<img src="${RECEIPT_ICON_SRC}">`;
    document.body.appendChild(btn);
  }

  /* =========================
     SEARCH
  ========================= */
  el.search?.addEventListener("input", e => {
    state.search = e.target.value;
    apply();
  });

  /* =========================
     BOOT
  ========================= */
  load();
})();
