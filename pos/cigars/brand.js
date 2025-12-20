/* /pos/cigars/brand.js
   Brand page (Google Sheets CSV)
   Requirements:
   - Search bar filters rows live
   - Controls row: Filters modal, Band Art modal, Maduro toggle, Natural toggle
   - Maduro/Natural ONLY shown for Padron (otherwise hidden)
   - Subtitle: Wrapper SHADE – Vitola (NOT wrapper type)
   - MSRP comes from column header "MSRP"
*/

(function () {
  // ✅ Use the SAME sheet ID you already use elsewhere
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";

  // ✅ If you know the gid for your main hub tab, set it here.
  // If you don't, leave null and we'll use the "first sheet" export endpoint.
  // (Recommended: set to your cigars data gid once confirmed.)
  const SHEET_GID = null; // e.g. "822697742"

  function csvUrl() {
    if (SHEET_GID) {
      return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
    }
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  }

  // --- helpers ---
  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  function parseCSV(text) {
    // RFC-ish CSV parser (handles quotes, commas, newlines)
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }

      if (!inQuotes && ch === ",") { row.push(cur); cur = ""; continue; }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur); cur = "";
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

  function money(val) {
    const s = String(val || "").replace(/[^\d.]/g, "");
    if (!s) return "";
    const n = Number(s);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  // brand icon slug logic (matches your brands icons folder patterns)
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

  function safeSrc(src) {
    if (!src) return "";
    let s = String(src).trim();
    if (!s) return "";
    if (!s.startsWith("/") && !s.startsWith("http")) s = "/" + s.replace(/^\/+/, "");
    return s;
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

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  }

  // --- UI refs ---
  const backBtn = document.getElementById("brand-back");
  const titleEl = document.getElementById("brand-title");
  const brandIconEl = document.getElementById("brand-icon");
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");

  const searchInput = document.getElementById("search-input");

  const btnFilters = document.getElementById("btn-filters");
  const btnBandArt = document.getElementById("btn-bandart");
  const toggleMaduro = document.getElementById("toggle-maduro");
  const toggleNatural = document.getElementById("toggle-natural");

  const filtersModal = document.getElementById("filters-modal");
  const bandartModal = document.getElementById("bandart-modal");

  const filtersSearch = document.getElementById("filters-search");
  const filtersList = document.getElementById("filters-list");
  const filtersConfirm = document.getElementById("filters-confirm");

  const bandartList = document.getElementById("bandart-list");
  const bandartConfirm = document.getElementById("bandart-confirm");

  // --- state ---
  let ALL_ROWS = [];
  let BRAND_ROWS = [];
  let VIEW_ROWS = [];

  const state = {
    q: "",
    // filters modal selections (multi-select)
    activeFilterType: "Vitola",
    selected: {
      Vitola: new Set(),
      "Wrapper Shade": new Set(),
      Shape: new Set(),
      Strength: new Set(),
      RG: new Set(),
      Length: new Set(),
    },
    // Band art (single select)
    bandArt: "", // "1964 Anniversary Series" | "1926 Serie" | "Damaso"
    // Padron toggles
    maduro: false,
    natural: false,
  };

  // --- modal helpers ---
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function wireModalClose() {
    document.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => closeModal(el.getAttribute("data-close")));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (filtersModal.getAttribute("aria-hidden") === "false") closeModal("filters-modal");
        if (bandartModal.getAttribute("aria-hidden") === "false") closeModal("bandart-modal");
      }
    });
  }

  // --- build list row ---
  function buildRow(row, brandName) {
    const cigarName = pick(row, ["Cigar", "Cigar Name", "Name"]);
    const wrapperShade = pick(row, ["Wrapper Shade", "Wrapper shade", "Shade"]);
    const vitola = pick(row, ["Vitola", "Style"]);
    const msrp = money(pick(row, ["MSRP"])); // ✅ user requirement
    const cigarImg = pick(row, ["Cigar IMG", "Cigar Image", "CigarIMG", "Image", "IMG"]);
    const brandImg = pick(row, ["Brand IMG", "Brand Image", "BrandIMG", "brand_img"]);

    const card = document.createElement("div");
    card.className = "cigar-row";

    const img = document.createElement("img");
    img.className = "row-icon";
    img.alt = brandName;
    // Prefer cigar image; fallback to brand image; then brand icon slug svg
    const candidates = [];
    if (cigarImg) candidates.push(safeSrc(cigarImg));
    if (brandImg) candidates.push(safeSrc(brandImg));
    const slug = brandSlug(brandName);
    if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
    if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);

    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        img.style.display = "none";
        return;
      }
      img.src = candidates[i++];
    };
    img.onerror = tryNext;
    tryNext();

    const main = document.createElement("div");
    main.className = "row-main";

    const nm = document.createElement("div");
    nm.className = "row-name";
    nm.textContent = cigarName || "(Unnamed)";

    // ✅ Subtitle: Wrapper SHADE – Vitola (NOT wrapper type)
    const sub = document.createElement("div");
    sub.className = "row-sub";
    const shade = wrapperShade || "";
    const vito = vitola || "";
    sub.textContent = [shade, vito].filter(Boolean).join(" – ");

    main.appendChild(nm);
    main.appendChild(sub);

    const price = document.createElement("div");
    price.className = "row-price";
    const ms = document.createElement("div");
    ms.className = "row-msrp" + (msrp ? "" : " muted");
    ms.textContent = msrp ? msrp : "0.00";
    price.appendChild(ms);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "row-add";
    add.textContent = "+";
    add.setAttribute("aria-label", "Add to bill");

    // If/when you wire billing later, listen for this event:
    // window.addEventListener("pos:addItem", (e)=>console.log(e.detail))
    add.addEventListener("click", () => {
      const payload = {
        brand: brandName,
        cigar: cigarName,
        msrp: msrp ? Number(msrp) : 0,
        vitola,
        wrapperShade,
        row
      };
      window.dispatchEvent(new CustomEvent("pos:addItem", { detail: payload }));
    });

    card.appendChild(img);
    card.appendChild(main);
    card.appendChild(price);
    card.appendChild(add);

    return card;
  }

  // --- apply all filtering + render ---
  function matchesSearch(row, q) {
    if (!q) return true;
    const hay = [
      pick(row, ["Cigar", "Cigar Name", "Name"]),
      pick(row, ["Vitola", "Style"]),
      pick(row, ["Wrapper Shade", "Shade"]),
      pick(row, ["Line"]),
      pick(row, ["Shape"]),
      pick(row, ["Strength"]),
    ].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function matchesPadronToggles(row, isPadron) {
    if (!isPadron) return true;

    const shade = pick(row, ["Wrapper Shade", "Shade"]).toLowerCase();

    const mad = state.maduro;
    const nat = state.natural;

    // If neither selected: show all
    if (!mad && !nat) return true;

    // If both selected: show union (effectively all shade rows)
    if (mad && nat) return true;

    if (mad) return shade.includes("maduro");
    if (nat) return shade.includes("natural");
    return true;
  }

  function matchesBandArt(row, isPadron) {
    if (!isPadron) return true;
    if (!state.bandArt) return true;

    const line = pick(row, ["Line", "Series", "Collection"]).toLowerCase();
    const cigar = pick(row, ["Cigar", "Cigar Name", "Name"]).toLowerCase();

    const needle = state.bandArt.toLowerCase();

    // robust matching by keywords too
    if (needle.includes("1964")) return line.includes("1964") || cigar.includes("1964");
    if (needle.includes("1926")) return line.includes("1926") || cigar.includes("1926");
    if (needle.includes("damaso")) return line.includes("damaso") || cigar.includes("damaso");

    // fallback exact-ish
    return line.includes(needle) || cigar.includes(needle);
  }

  function matchesSelections(row) {
    // Apply multi-select only if there are selected values for that filter type
    for (const [type, set] of Object.entries(state.selected)) {
      if (!set.size) continue;

      let val = "";
      if (type === "RG") val = pick(row, ["RG", "Ring", "Ring Gauge"]);
      else if (type === "Length") val = pick(row, ["Length"]);
      else if (type === "Wrapper Shade") val = pick(row, ["Wrapper Shade", "Shade"]);
      else val = pick(row, [type]);

      if (!val) return false;

      // exact match in set (case-insensitive)
      const lower = val.toLowerCase();
      const ok = Array.from(set).some((s) => s.toLowerCase() === lower);
      if (!ok) return false;
    }
    return true;
  }

  function applyAndRender(brandName) {
    const isPadron = brandName.trim().toLowerCase() === "padron";

    VIEW_ROWS = BRAND_ROWS
      .filter((r) => matchesSearch(r, state.q))
      .filter((r) => matchesSelections(r))
      .filter((r) => matchesBandArt(r, isPadron))
      .filter((r) => matchesPadronToggles(r, isPadron));

    listEl.innerHTML = "";

    if (!VIEW_ROWS.length) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    const frag = document.createDocumentFragment();
    VIEW_ROWS.forEach((row) => frag.appendChild(buildRow(row, brandName)));
    listEl.appendChild(frag);
  }

  // --- Filters modal build ---
  function uniqueValues(rows, field) {
    const set = new Set();
    rows.forEach((r) => {
      let v = "";
      if (field === "RG") v = pick(r, ["RG", "Ring", "Ring Gauge"]);
      else if (field === "Length") v = pick(r, ["Length"]);
      else if (field === "Wrapper Shade") v = pick(r, ["Wrapper Shade", "Shade"]);
      else v = pick(r, [field]);

      if (v) set.add(v.trim());
    });

    // Sort numeric fields numerically
    const arr = Array.from(set);
    if (field === "RG" || field === "Length") {
      arr.sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
    } else {
      arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }
    return arr;
  }

  function buildPickList(container, values, selectedSet, searchTerm = "") {
    container.innerHTML = "";
    const q = (searchTerm || "").toLowerCase();

    const frag = document.createDocumentFragment();

    values
      .filter((v) => !q || v.toLowerCase().includes(q))
      .forEach((v) => {
        const row = document.createElement("div");
        row.className = "pickrow" + (selectedSet.has(v) ? " is-on" : "");

        const box = document.createElement("div");
        box.className = "pickbox";

        const label = document.createElement("div");
        label.className = "picklabel";
        label.textContent = v;

        const meta = document.createElement("div");
        meta.className = "pickmeta";
        meta.textContent = selectedSet.has(v) ? "✓" : "";

        row.appendChild(box);
        row.appendChild(label);
        row.appendChild(meta);

        row.addEventListener("click", () => {
          if (selectedSet.has(v)) selectedSet.delete(v);
          else selectedSet.add(v);
          buildPickList(container, values, selectedSet, filtersSearch.value || "");
        });

        frag.appendChild(row);
      });

    container.appendChild(frag);
  }

  function wireFilterTabs(brandName) {
    const tabBtns = document.querySelectorAll(".seg-btn");
    tabBtns.forEach((b) => {
      b.addEventListener("click", () => {
        tabBtns.forEach((x) => {
          x.classList.remove("is-on");
          x.setAttribute("aria-selected", "false");
        });
        b.classList.add("is-on");
        b.setAttribute("aria-selected", "true");
        state.activeFilterType = b.getAttribute("data-filter-type") || "Vitola";
        rebuildFiltersList(brandName);
      });
    });
  }

  function rebuildFiltersList(brandName) {
    const type = state.activeFilterType;
    const values = uniqueValues(BRAND_ROWS, type);
    const set = state.selected[type] || new Set();

    buildPickList(filtersList, values, set, filtersSearch.value || "");
  }

  function wireFiltersModal(brandName) {
    wireFilterTabs(brandName);

    filtersSearch.addEventListener("input", () => rebuildFiltersList(brandName));

    filtersConfirm.addEventListener("click", () => {
      closeModal("filters-modal");
      applyAndRender(brandName);
    });
  }

  // --- Band Art modal (Padron only) ---
  const PADRON_BAND_OPTIONS = [
    "1964 Anniversary Series",
    "1926 Serie",
    "Damaso"
  ];

  function buildBandArtList() {
    bandartList.innerHTML = "";
    const frag = document.createDocumentFragment();

    PADRON_BAND_OPTIONS.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "pickrow" + (state.bandArt === opt ? " is-on" : "");

      const box = document.createElement("div");
      box.className = "pickbox";

      const label = document.createElement("div");
      label.className = "picklabel";
      label.textContent = opt;

      const meta = document.createElement("div");
      meta.className = "pickmeta";
      meta.textContent = state.bandArt === opt ? "✓" : "";

      row.appendChild(box);
      row.appendChild(label);
      row.appendChild(meta);

      row.addEventListener("click", () => {
        // single select (toggle off if clicking same)
        state.bandArt = (state.bandArt === opt) ? "" : opt;
        buildBandArtList();
      });

      frag.appendChild(row);
    });

    bandartList.appendChild(frag);
  }

  function wireBandArtModal(brandName) {
    buildBandArtList();

    bandartConfirm.addEventListener("click", () => {
      closeModal("bandart-modal");
      applyAndRender(brandName);
    });
  }

  // --- toggles ---
  function setPressed(btn, on) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function wireToggles(brandName) {
    const isPadron = brandName.trim().toLowerCase() === "padron";

    // show/hide toggles + band art button
    toggleMaduro.style.display = isPadron ? "" : "none";
    toggleNatural.style.display = isPadron ? "" : "none";
    btnBandArt.style.display = isPadron ? "" : "none";

    // If not Padron, also clear Padron-only state
    if (!isPadron) {
      state.maduro = false;
      state.natural = false;
      state.bandArt = "";
      setPressed(toggleMaduro, false);
      setPressed(toggleNatural, false);
    }

    toggleMaduro.addEventListener("click", () => {
      state.maduro = !state.maduro;
      setPressed(toggleMaduro, state.maduro);
      applyAndRender(brandName);
    });

    toggleNatural.addEventListener("click", () => {
      state.natural = !state.natural;
      setPressed(toggleNatural, state.natural);
      applyAndRender(brandName);
    });
  }

  // --- main ---
  async function init() {
    const brandName = getParam("brand") || "Brand";
    titleEl.textContent = brandName;

    // back
    backBtn?.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/pos/cigars/";
    });

    // brand icon (top right)
    setBrandImgWithFallback(brandIconEl, brandName, "");

    wireModalClose();

    // fetch sheet csv
    try {
      const res = await fetch(withNoCache(csvUrl()), { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
      const text = await res.text();
      const { data } = parseCSV(text);

      ALL_ROWS = data;

      // Filter to this brand from the sheet
      BRAND_ROWS = ALL_ROWS.filter((r) => {
        const b = pick(r, ["Brand", "brand"]);
        return b && b.toLowerCase() === brandName.toLowerCase();
      });

      // Wire search
      searchInput.addEventListener("input", () => {
        state.q = searchInput.value || "";
        applyAndRender(brandName);
      });

      // Wire controls
      btnFilters.addEventListener("click", () => {
        // build list for current type before opening
        filtersSearch.value = "";
        rebuildFiltersList(brandName);
        openModal("filters-modal");
      });

      btnBandArt.addEventListener("click", () => {
        buildBandArtList();
        openModal("bandart-modal");
      });

      wireToggles(brandName);
      wireFiltersModal(brandName);
      wireBandArtModal(brandName);

      // Initial render
      applyAndRender(brandName);

    } catch (err) {
      console.error("[brand] error:", err);
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.textContent = "Failed to load brand cigars.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
