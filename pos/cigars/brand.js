// /pos/cigars/brand.js
(() => {
  // ===== CONFIG =====
  const SHEET_ID = "10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM";
  const SHEET_NAME = ""; // optional: put your tab name if needed

  function googleCsvUrl() {
    if (SHEET_NAME) {
      return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    }
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
  }

  function googleExportUrl() {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  }

  function withNoCache(url) {
    const u = new URL(url);
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  // ===== CSV parser =====
  function parseCSV(text) {
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

  // ===== helpers =====
  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function parseMoney(val) {
    const n = parseFloat(String(val || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function formatMoney(val) {
    const n = parseMoney(val);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
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
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

  function setImgWithFallback(imgEl, brandName, csvBrandImgPath) {
    const slug = brandSlug(brandName);
    const csvSrc = safeSrc(csvBrandImgPath);

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

  function shadeBucket(row) {
    const s = pick(row, ["Wrapper Shade", "Shade", "wrapper shade", "shade"]).toLowerCase();
    if (s.includes("maduro")) return "maduro";
    if (s.includes("natural")) return "natural";
    return "";
  }

  // ===== DOM =====
  const params = new URLSearchParams(location.search);
  const brandParam = (params.get("brand") || "").trim();
  const isPadron = brandParam.toLowerCase() === "padron";

  const brandTitle = document.getElementById("brandTitle");
  const brandCornerIcon = document.getElementById("brandCornerIcon");

  const listEl = document.getElementById("brandList");
  const emptyEl = document.getElementById("brandEmpty");
  const errorEl = document.getElementById("brandError");

  const searchInput = document.getElementById("brandSearchInput");

  const openFiltersBtn = document.getElementById("openFilters");
  const filtersCountEl = document.getElementById("filtersCount");

  const padronToggles = document.getElementById("padronToggles");
  const toggleMaduro = document.getElementById("toggleMaduro");
  const toggleNatural = document.getElementById("toggleNatural");

  const bandArtworkBtn = document.getElementById("toggleBandArtwork");

  // filters modal
  const filtersBackdrop = document.getElementById("filtersBackdrop");
  const filtersModal = document.getElementById("filtersModal");
  const closeFilters = document.getElementById("closeFilters");
  const applyFiltersBtn = document.getElementById("applyFilters");
  const clearFiltersBtn = document.getElementById("clearFilters");
  const filtersGrid = document.getElementById("filtersGrid");

  const modalBandArtwork = document.getElementById("modalBandArtwork");
  const modalArtworkOnly = document.getElementById("modalArtworkOnly");

  // picker modal
  const pickerBackdrop = document.getElementById("pickerBackdrop");
  const pickerModal = document.getElementById("pickerModal");
  const pickerTitle = document.getElementById("pickerTitle");
  const pickerList = document.getElementById("pickerList");
  const pickerSearchInput = document.getElementById("pickerSearchInput");
  const closePicker = document.getElementById("closePicker");
  const pickerCancel = document.getElementById("pickerCancel");
  const pickerConfirm = document.getElementById("pickerConfirm");

  // Back
  const backBtn = document.getElementById("brand-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "/pos/cigars/";
    });
  }

  if (brandTitle) brandTitle.textContent = brandParam || "Brand";

  // show padron toggles only for Padron
  if (padronToggles) padronToggles.hidden = !isPadron;

  // ===== state =====
  let allRows = [];
  let filteredRows = [];

  let useBandArtwork = false;      // show cigar artwork (Cigar IMG) in rows when available
  let artworkOnly = false;         // only show rows with cigar artwork
  let padronMaduro = false;
  let padronNatural = false;

  // brand filters (no manufacturer/brand)
  const FILTER_DEFS = [
    { key: "Vitola", label: "Vitola", type: "multi" },
    { key: "Ring", label: "Ring", type: "multi", aliases: ["RG", "Ring Gauge"] },
    { key: "Strength", label: "Strength", type: "multi" },
    { key: "Shape", label: "Shape", type: "multi" },
    { key: "Tubo", label: "Tubo", type: "bool" },
    { key: "Flavored", label: "Flavored", type: "bool" },
    { key: "Tin", label: "Tin", type: "bool" },
    { key: "Pack", label: "Pack", type: "bool" },
    { key: "Barber", label: "Barberpole", type: "bool", aliases: ["Barberpole", "Barber Pole"] },
    { key: "Box-Pressed", label: "Box-Pressed", type: "bool", aliases: ["Box Pressed", "BoxPressed"] },
  ];

  const active = {}; // multi selects: key -> Set
  FILTER_DEFS.forEach((d) => { if (d.type === "multi") active[d.key] = new Set(); });

  // ===== filtering =====
  function getVal(row, def) {
    const keys = [def.key].concat(def.aliases || []);
    return pick(row, keys);
  }

  function isTruthy(val) {
    const s = String(val || "").trim().toLowerCase();
    if (!s) return false;
    return s === "true" || s === "yes" || s === "y" || s === "1" || s === "x" || s === "checked";
  }

  function rowMatchesSearch(row, q) {
    if (!q) return true;
    const hay = [
      row["Cigar"],
      row["Line"],
      row["Vitola"],
      row["Shape"],
      row["Strength"],
      row["Wrapper Shade"],
      row["Wrapper"],
      row["Origin"],
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function applyAllFilters() {
    const q = (searchInput?.value || "").trim().toLowerCase();

    filteredRows = allRows.filter((row) => {
      // search text
      if (!rowMatchesSearch(row, q)) return false;

      // band artwork only
      if (artworkOnly) {
        const cigarImg = pick(row, ["Cigar IMG", "Cigar Image", "CigarImg", "CigarIMG"]);
        if (!cigarImg) return false;
      }

      // padron only maduro/natural
      if (isPadron) {
        const sb = shadeBucket(row);
        if (padronMaduro && !padronNatural) {
          if (sb !== "maduro") return false;
        }
        if (!padronMaduro && padronNatural) {
          if (sb !== "natural") return false;
        }
        if (padronMaduro && padronNatural) {
          // allow both (no filter)
        }
      }

      // other filters
      for (const def of FILTER_DEFS) {
        if (def.type === "multi") {
          const set = active[def.key];
          if (set && set.size) {
            const v = getVal(row, def);
            if (!v || !set.has(v)) return false;
          }
        } else if (def.type === "bool") {
          const set = active[def.key]; // (not used)
          // bool filters are stored as Set with one item "true" by our UI, or we handle separately:
          // We'll store bool state on def._on in runtime:
          if (def._on) {
            const v = getVal(row, def);
            if (!isTruthy(v)) return false;
          }
        }
      }

      return true;
    });

    // sort: cigar then vitola
    filteredRows.sort((a, b) => {
      const an = (a["Cigar"] || "").toLowerCase();
      const bn = (b["Cigar"] || "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      const av = (a["Vitola"] || "").toLowerCase();
      const bv = (b["Vitola"] || "").toLowerCase();
      return av.localeCompare(bv);
    });

    updateFiltersCount();
    render();
  }

  function updateFiltersCount() {
    let count = 0;

    // multi
    for (const def of FILTER_DEFS) {
      if (def.type === "multi") count += (active[def.key]?.size || 0) ? 1 : 0;
      if (def.type === "bool" && def._on) count += 1;
    }

    // artworkOnly counts as a filter
    if (artworkOnly) count += 1;

    // padron toggles count if only one is active
    if (isPadron) {
      if (padronMaduro && !padronNatural) count += 1;
      if (!padronMaduro && padronNatural) count += 1;
    }

    if (!filtersCountEl) return;
    if (count > 0) {
      filtersCountEl.hidden = false;
      filtersCountEl.textContent = String(count);
    } else {
      filtersCountEl.hidden = true;
      filtersCountEl.textContent = "0";
    }
  }

  // ===== rendering =====
  function setCornerIconFromData(rows) {
    if (!brandCornerIcon) return;
    brandCornerIcon.innerHTML = "";

    // try brand image from first matching row
    const brandImg = pick(rows[0] || {}, ["Brand IMG", "Brand Image", "BrandIMG"]);
    const img = document.createElement("img");
    img.alt = brandParam || "Brand";
    img.loading = "lazy";
    img.decoding = "async";
    setImgWithFallback(img, brandParam, brandImg);
    brandCornerIcon.appendChild(img);
  }

  function buildRow(row) {
    const cigar = (row["Cigar"] || "").trim();
    const vitola = (row["Vitola"] || "").trim();

    // price ALWAYS MSRP
    const price = formatMoney(row["MSRP"]);

    const wrapperShade = pick(row, ["Wrapper Shade", "Shade"]).trim();
    const shapeOrVitola = vitola || pick(row, ["Shape"]).trim();

    const brandImg = pick(row, ["Brand IMG", "Brand Image", "BrandIMG"]);
    const cigarImg = pick(row, ["Cigar IMG", "Cigar Image", "CigarIMG"]);

    const wrap = document.createElement("div");
    wrap.className = "cigar-row";

    const icon = document.createElement("div");
    icon.className = "cigar-icon";

    const img = document.createElement("img");
    img.alt = brandParam;

    // Band artwork mode: prefer cigar image; else fallback to brand icon
    if (useBandArtwork && cigarImg) {
      img.src = safeSrc(cigarImg);
      img.onerror = () => setImgWithFallback(img, brandParam, brandImg);
    } else {
      setImgWithFallback(img, brandParam, brandImg);
    }

    icon.appendChild(img);

    const main = document.createElement("div");
    main.className = "cigar-main";

    const name = document.createElement("div");
    name.className = "cigar-name";
    name.textContent = cigar || "(Unnamed cigar)";

    const sub = document.createElement("div");
    sub.className = "cigar-sub";

    // show "Natural - Torpedo" style
    const parts = [];
    if (wrapperShade) parts.push(wrapperShade);
    if (shapeOrVitola) parts.push(shapeOrVitola);
    sub.textContent = parts.join(" - ");

    main.appendChild(name);
    main.appendChild(sub);

    const meta = document.createElement("div");
    meta.className = "cigar-meta";

    const metaBlock = document.createElement("div");
    metaBlock.className = "cigar-meta-block";

    const priceEl = document.createElement("div");
    priceEl.className = "cigar-price";
    priceEl.textContent = price || "";

    const vitolaEl = document.createElement("div");
    vitolaEl.className = "cigar-vitola";
    vitolaEl.textContent = shapeOrVitola || "";

    metaBlock.appendChild(priceEl);
    metaBlock.appendChild(vitolaEl);

    const addBtn = document.createElement("button");
    addBtn.className = "cigar-add";
    addBtn.type = "button";
    addBtn.setAttribute("aria-label", "Add to bill");
    addBtn.innerHTML = "<span>+</span>";

    addBtn.addEventListener("click", () => {
      const payload = {
        brand: brandParam,
        cigar,
        vitola,
        msrp: row["MSRP"] || "",
        row
      };

      if (typeof window.addToBill === "function") {
        window.addToBill(payload);
        return;
      }
      window.dispatchEvent(new CustomEvent("pos:add", { detail: payload }));
    });

    meta.appendChild(metaBlock);
    meta.appendChild(addBtn);

    wrap.appendChild(icon);
    wrap.appendChild(main);
    wrap.appendChild(meta);

    return wrap;
  }

  function render() {
    listEl.innerHTML = "";
    emptyEl.hidden = true;
    errorEl.hidden = true;

    if (!filteredRows.length) {
      emptyEl.hidden = false;
      return;
    }

    const frag = document.createDocumentFragment();
    filteredRows.forEach((row) => frag.appendChild(buildRow(row)));
    listEl.appendChild(frag);
  }

  // ===== modal helpers =====
  function openModal(backdropEl, modalEl) {
    backdropEl.hidden = false;
    modalEl.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal(backdropEl, modalEl) {
    backdropEl.hidden = true;
    modalEl.hidden = true;
    document.body.style.overflow = "";
  }

  function buildFiltersGrid() {
    filtersGrid.innerHTML = "";

    FILTER_DEFS.forEach((def) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      chip.dataset.key = def.key;

      const left = document.createElement("strong");
      left.textContent = def.label;

      const right = document.createElement("span");
      right.textContent = "Any";

      // set initial state text
      if (def.type === "multi") {
        const set = active[def.key];
        if (set && set.size) {
          chip.classList.add("active");
          right.textContent = `${set.size} selected`;
        }
      } else if (def.type === "bool") {
        if (def._on) {
          chip.classList.add("active");
          right.textContent = "On";
        } else {
          right.textContent = "Off";
        }
      }

      chip.appendChild(left);
      chip.appendChild(right);

      chip.addEventListener("click", () => {
        if (def.type === "bool") {
          def._on = !def._on;
          buildFiltersGrid();
          return;
        }
        openPicker(def);
      });

      filtersGrid.appendChild(chip);
    });
  }

  // ===== picker =====
  let pickerDef = null;
  let pickerSelected = new Set();
  let pickerOptions = [];

  function uniqueOptions(def) {
    const map = new Map();
    allRows.forEach((row) => {
      const v = getVal(row, def);
      if (!v) return;
      if (!map.has(v)) map.set(v, 1);
      else map.set(v, map.get(v) + 1);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
      .map(([val, count]) => ({ val, count }));
  }

  function renderPickerList(query = "") {
    const q = query.trim().toLowerCase();
    pickerList.innerHTML = "";

    const list = pickerOptions.filter((o) => !q || o.val.toLowerCase().includes(q));

    const frag = document.createDocumentFragment();
    list.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "picker-item";
      if (pickerSelected.has(opt.val)) item.classList.add("selected");

      const box = document.createElement("div");
      box.className = "picker-box";

      const label = document.createElement("div");
      label.className = "picker-label";
      label.textContent = opt.val;

      item.appendChild(box);
      item.appendChild(label);

      item.addEventListener("click", () => {
        if (pickerSelected.has(opt.val)) pickerSelected.delete(opt.val);
        else pickerSelected.add(opt.val);
        item.classList.toggle("selected");
      });

      frag.appendChild(item);
    });

    pickerList.appendChild(frag);
  }

  function openPicker(def) {
    pickerDef = def;
    pickerTitle.textContent = def.label;

    pickerSelected = new Set(active[def.key] || []);
    pickerOptions = uniqueOptions(def);

    pickerSearchInput.value = "";
    renderPickerList("");

    openModal(pickerBackdrop, pickerModal);
    pickerSearchInput.focus();
  }

  function closePickerModal() {
    closeModal(pickerBackdrop, pickerModal);
    pickerDef = null;
  }

  // ===== events =====
  searchInput.addEventListener("input", applyAllFilters);

  // band artwork quick button (outside modal)
  bandArtworkBtn.addEventListener("click", () => {
    useBandArtwork = !useBandArtwork;
    bandArtworkBtn.setAttribute("aria-pressed", useBandArtwork ? "true" : "false");

    // keep modal toggle in sync
    modalBandArtwork.checked = useBandArtwork;

    applyAllFilters();
  });

  // padron toggles (outside modal)
  if (isPadron) {
    toggleMaduro.addEventListener("change", () => {
      padronMaduro = !!toggleMaduro.checked;
      applyAllFilters();
    });

    toggleNatural.addEventListener("change", () => {
      padronNatural = !!toggleNatural.checked;
      applyAllFilters();
    });
  }

  // open filters modal
  openFiltersBtn.addEventListener("click", () => {
    // sync modal toggles
    modalBandArtwork.checked = useBandArtwork;
    modalArtworkOnly.checked = artworkOnly;

    buildFiltersGrid();
    openModal(filtersBackdrop, filtersModal);
  });

  closeFilters.addEventListener("click", () => closeModal(filtersBackdrop, filtersModal));
  filtersBackdrop.addEventListener("click", () => closeModal(filtersBackdrop, filtersModal));

  // apply in modal
  applyFiltersBtn.addEventListener("click", () => {
    useBandArtwork = !!modalBandArtwork.checked;
    artworkOnly = !!modalArtworkOnly.checked;

    bandArtworkBtn.setAttribute("aria-pressed", useBandArtwork ? "true" : "false");

    closeModal(filtersBackdrop, filtersModal);
    applyAllFilters();
  });

  clearFiltersBtn.addEventListener("click", () => {
    // clear all multi selects
    FILTER_DEFS.forEach((d) => {
      if (d.type === "multi") active[d.key].clear();
      if (d.type === "bool") d._on = false;
    });

    artworkOnly = false;
    modalArtworkOnly.checked = false;

    // do NOT force band artwork off; leave it as user set with the button
    buildFiltersGrid();
    applyAllFilters();
  });

  // picker events
  closePicker.addEventListener("click", closePickerModal);
  pickerBackdrop.addEventListener("click", closePickerModal);
  pickerCancel.addEventListener("click", closePickerModal);

  pickerSearchInput.addEventListener("input", () => {
    renderPickerList(pickerSearchInput.value);
  });

  pickerConfirm.addEventListener("click", () => {
    if (pickerDef && pickerDef.type === "multi") {
      active[pickerDef.key] = new Set(pickerSelected);
    }
    closePickerModal();
    buildFiltersGrid();
  });

  // ===== load data =====
  async function fetchSheetCSV() {
    let res = await fetch(withNoCache(googleCsvUrl()), { cache: "no-store" });
    if (!res.ok) res = await fetch(withNoCache(googleExportUrl()), { cache: "no-store" });
    if (!res.ok) throw new Error("CSV fetch failed");
    return await res.text();
  }

  async function load() {
    try {
      const text = await fetchSheetCSV();
      const { data } = parseCSV(text);

      // only this brand
      allRows = data.filter((r) => {
        const b = (r["Brand"] || "").trim();
        const c = (r["Cigar"] || "").trim();
        return c && b === brandParam;
      });

      setCornerIconFromData(allRows);

      // defaults for padron: allow both (no filtering unless user checks one)
      padronMaduro = false;
      padronNatural = false;

      // initial render
      applyAllFilters();
    } catch (e) {
      console.error("[brand] load error:", e);
      errorEl.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();
