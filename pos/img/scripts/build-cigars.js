// /pos/img/scripts/build-cigars.js
// Builds + filters the Brands grid on /pos/cigars/ from Google Sheets CSV

(function () {
  // IMPORTANT:
  // Use your *published CSV export* URL here.
  // If you already have it working (Loaded 2,952 rows…), keep your exact URL.
  const GOOGLE_SHEETS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/export?format=csv";

  // ---- helpers ----
  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", Date.now().toString());
    return u.toString();
  }

  function getGridEl() {
    return (
      document.getElementById("category-grid") ||
      document.getElementById("brands-grid")
    );
  }

  function parseCSV(text) {
    // CSV parser that handles quotes safely (no dependency)
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
      if (!inQuotes && ch === ",") {
        row.push(cur);
        cur = "";
        continue;
      }
      if (!inQuotes && (ch === "\n" || ch === "\r")) {
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

    if (!rows.length) return { headers: [], data: [] };

    const headers = rows[0].map((h) => (h || "").trim());
    const data = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").toString().trim();
      });
      return obj;
    });

    return { headers, data };
  }

  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function safeSrc(src) {
    if (!src) return "";
    let s = String(src).trim();
    if (!s) return "";
    if (!s.startsWith("/") && !s.startsWith("http")) {
      s = "/" + s.replace(/^\/+/, "");
    }
    return s;
  }

  const BRAND_ICON_OVERRIDES = {
    aturrent: "aturrent",
    aflores: "aflores",
    carlostorano: "torano",
    brundelre: "brundelre",
    diamondcrown: "diamondcrown",
    elreydelmundo: "elreydelmundo",
    fonseca: "fonseca",
  };

  function brandSlug(name) {
    if (!name) return "";
    const canonical = String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();

    if (!canonical) return "";
    if (Object.prototype.hasOwnProperty.call(BRAND_ICON_OVERRIDES, canonical)) {
      return BRAND_ICON_OVERRIDES[canonical];
    }
    return canonical;
  }

  function setBrandImgWithFallback(imgEl, brandName, csvImgPath) {
    const slug = brandSlug(brandName);
    const csvSrc = safeSrc(csvImgPath);

    const candidates = [];
    if (csvSrc) candidates.push(csvSrc);
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        imgEl.style.display = "none";
        return;
      }
      imgEl.src = candidates[idx++];
    }

    imgEl.onerror = tryNext;
    tryNext();
  }

  function buildTile({ brand, brandImg }) {
    const a = document.createElement("a");
    a.className = "category-card";
    a.href = `/pos/cigars/brand.html?brand=${encodeURIComponent(brand)}`;
    a.setAttribute("aria-label", brand);

    const img = document.createElement("img");
    img.alt = brand;
    img.loading = "lazy";
    img.decoding = "async";
    setBrandImgWithFallback(img, brand, brandImg);

    const name = document.createElement("div");
    name.className = "category-name";
    name.textContent = brand;

    a.appendChild(img);
    a.appendChild(name);
    return a;
  }

  // ---------- FILTER STATE ----------
  const FILTER_MAP = {
    manufacturer: { label: "Manufacturer", col: "Manufacturer" },
    brand: { label: "Brand", col: "Brand" },
    shade: { label: "Shade", col: "Wrapper Shade" },
    vitola: { label: "Vitola", col: "Vitola" },
    ring: { label: "Ring", col: "RG" },
    strength: { label: "Strength", col: "Strength" },
    length: { label: "Length", col: "Length" },
    shape: { label: "Shape", col: "Shape" },
  };

  // Toggle filters read these columns as boolean-y
  const FEATURE_MAP = {
    tubo: { label: "Tubo", col: "Tubo" },
    flavored: { label: "Flavored", col: "Flavored" },
    tin: { label: "Tin", col: "Tin" },
    pack: { label: "Pack", col: "Pack" },
    barberpole: { label: "Barberpole", col: "Barber" },      // your sheet uses Barber
    boxpressed: { label: "Box-Pressed", col: "Box-Pressed" } // your sheet uses Box-Pressed
  };

  const selected = {
    // multi-select sets
    manufacturer: new Set(),
    brand: new Set(),
    shade: new Set(),
    vitola: new Set(),
    ring: new Set(),
    strength: new Set(),
    length: new Set(),
    shape: new Set(),
    // toggles
    features: new Set(),
  };

  let allRows = [];

  // ---------- MODAL (existing #filter-modal in index.html) ----------
  const modal = {
    root: null,
    title: null,
    list: null,
    back: null,
    confirm: null,
    search: null,
    backdrop: null,

    currentKey: null,
    currentOptions: [],
    tempSelected: new Set(),
  };

  function modalEls() {
    if (modal.root) return;

    modal.root = document.getElementById("filter-modal");
    modal.title = document.getElementById("filter-modal-title");
    modal.list = document.getElementById("filter-modal-list");
    modal.back = modal.root?.querySelector(".filter-modal-back");
    modal.confirm = document.getElementById("filter-modal-confirm");
    modal.search = document.getElementById("filter-modal-search-input");
    modal.backdrop = modal.root?.querySelector(".filter-modal-backdrop");
  }

  function openModal(key) {
    modalEls();
    if (!modal.root) return;

    const conf = FILTER_MAP[key];
    if (!conf) return;

    modal.currentKey = key;

    // Build options from rows
    const vals = new Set();
    for (const r of allRows) {
      const v = (r[conf.col] || "").toString().trim();
      if (v) vals.add(v);
    }
    modal.currentOptions = Array.from(vals).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    // temp selection starts as current
    modal.tempSelected = new Set(selected[key] || []);

    modal.title.textContent = conf.label;
    modal.search.value = "";
    renderModalOptions();

    modal.root.classList.remove("filter-modal--hidden");
  }

  function closeModal() {
    modalEls();
    if (!modal.root) return;
    modal.root.classList.add("filter-modal--hidden");
    modal.currentKey = null;
    modal.currentOptions = [];
    modal.tempSelected = new Set();
  }

  function renderModalOptions() {
    modalEls();
    if (!modal.list) return;

    const q = (modal.search.value || "").trim().toLowerCase();
    modal.list.innerHTML = "";

    const options = modal.currentOptions.filter((opt) =>
      !q ? true : opt.toLowerCase().includes(q)
    );

    options.forEach((opt) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "filter-modal-row";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.width = "100%";

      const left = document.createElement("div");
      left.textContent = opt;
      left.style.fontWeight = "500";

      const right = document.createElement("div");
      right.textContent = modal.tempSelected.has(opt) ? "✓" : "";
      right.style.color = "#007aff";
      right.style.fontWeight = "700";

      row.addEventListener("click", () => {
        if (modal.tempSelected.has(opt)) modal.tempSelected.delete(opt);
        else modal.tempSelected.add(opt);
        right.textContent = modal.tempSelected.has(opt) ? "✓" : "";
      });

      row.appendChild(left);
      row.appendChild(right);
      modal.list.appendChild(row);
    });
  }

  function applyModalSelection() {
    if (!modal.currentKey) return;
    selected[modal.currentKey] = new Set(modal.tempSelected);

    // active blue state on pill
    const pill = document.querySelector(`.filter-pill[data-filter="${modal.currentKey}"]`);
    if (pill) {
      if (selected[modal.currentKey].size) pill.classList.add("active");
      else pill.classList.remove("active");
    }

    closeModal();
    rebuild();
  }

  // ---------- SEARCH + FILTERING ----------
  function rowMatchesSearch(row, q) {
    if (!q) return true;
    const hay = [
      row["Brand"],
      row["Line"],
      row["Cigar"],
      row["Vitola"],
      row["Wrapper Shade"],
      row["Wrapper"],
      row["Origin"],
      row["Strength"],
      row["Shape"],
      row["Manufacturer"],
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  }

  function rowMatchesSets(row) {
    // normal multi-select filters
    for (const key of Object.keys(FILTER_MAP)) {
      const set = selected[key];
      if (!set || set.size === 0) continue;

      const col = FILTER_MAP[key].col;
      const val = (row[col] || "").toString().trim();
      if (!val || !set.has(val)) return false;
    }

    // feature toggles: require the column to be truthy/non-empty
    for (const feat of selected.features) {
      const conf = FEATURE_MAP[feat];
      if (!conf) continue;
      const v = (row[conf.col] || "").toString().trim();
      if (!v) return false;
    }

    return true;
  }

  function rebuild() {
    const grid = getGridEl();
    if (!grid) return;

    const searchInput = document.getElementById("cigars-search-input");
    const q = (searchInput?.value || "").trim().toLowerCase();

    // filter rows down
    const filteredRows = allRows.filter((r) => rowMatchesSearch(r, q) && rowMatchesSets(r));

    // build unique brands from filtered rows
    const map = new Map();
    for (const row of filteredRows) {
      const brand = pick(row, ["Brand", "brand"]);
      if (!brand) continue;

      const brandImg = pick(row, ["Brand IMG", "Brand Img", "Brand Image", "brandImg"]);
      if (!map.has(brand)) {
        map.set(brand, { brand, brandImg });
      } else {
        // keep first non-empty image
        const existing = map.get(brand);
        if (!existing.brandImg && brandImg) existing.brandImg = brandImg;
      }
    }

    const brands = Array.from(map.values()).sort((a, b) =>
      a.brand.toLowerCase().localeCompare(b.brand.toLowerCase())
    );

    grid.innerHTML = "";

    if (!brands.length) {
      const msg = document.createElement("div");
      msg.style.color = "#6a7586";
      msg.style.fontWeight = "500";
      msg.style.padding = "10px 2px";
      msg.textContent = "No brands found.";
      grid.appendChild(msg);
      return;
    }

    const frag = document.createDocumentFragment();
    brands.forEach((b) => frag.appendChild(buildTile(b)));
    grid.appendChild(frag);
  }

  // ---------- WIRING ----------
  function wireUI() {
    // search
    const search = document.getElementById("cigars-search-input");
    if (search) {
      search.addEventListener("input", rebuild);
    }

    // modal wiring
    modalEls();
    if (modal.back) modal.back.addEventListener("click", closeModal);
    if (modal.backdrop) modal.backdrop.addEventListener("click", closeModal);
    if (modal.search) modal.search.addEventListener("input", renderModalOptions);
    if (modal.confirm) modal.confirm.addEventListener("click", applyModalSelection);

    // filter pills that open modal
    document.querySelectorAll(".filter-pill[data-filter]").forEach((btn) => {
      const key = btn.getAttribute("data-filter");
      if (!key) return;

      // feature toggles handled separately
      if (FEATURE_MAP[key]) return;

      btn.addEventListener("click", () => openModal(key));
    });

    // feature toggles (yellow section)
    Object.keys(FEATURE_MAP).forEach((feat) => {
      const btn = document.querySelector(`.filter-pill[data-filter="${feat}"]`);
      if (!btn) return;

      btn.addEventListener("click", () => {
        if (selected.features.has(feat)) {
          selected.features.delete(feat);
          btn.classList.remove("active");
        } else {
          selected.features.add(feat);
          btn.classList.add("active");
        }
        rebuild();
      });
    });
  }

  async function run() {
    const grid = getGridEl();
    if (!grid) return;

    try {
      const res = await fetch(withNoCache(GOOGLE_SHEETS_CSV_URL));
      if (!res.ok) throw new Error("Google CSV fetch failed: " + res.status);
      const text = await res.text();

      const { data } = parseCSV(text);

      // Keep only rows that have a Brand
      allRows = data.filter((r) => (r["Brand"] || "").trim() !== "");

      // Remove any old debug “Loaded X rows…” (you asked to delete it)
      // (If you had a previous debug node injected, it won’t be added now.)

      wireUI();
      rebuild();
    } catch (err) {
      console.error("[build-cigars] error:", err);
      grid.innerHTML = "";
      const msg = document.createElement("div");
      msg.style.color = "#b00020";
      msg.style.fontWeight = "700";
      msg.style.padding = "10px 2px";
      msg.textContent =
        "Brands failed to load from Google Sheets. (Check published CSV access + URL.)";
      grid.appendChild(msg);
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();
