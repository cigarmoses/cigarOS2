// /pos/cigars/cigars.js
(function () {
  const state = () => window.__CIGAR_FILTER_STATE__;
  const rows = () => window.__CIGAR_SHEET_ROWS__ || [];

  // ---------- helpers ----------
  function pick(row, keys) {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    }
    return "";
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

  function buildIconCandidates(kind, label, csvImg) {
    const candidates = [];
    const csv = safeSrc(csvImg);
    if (csv) candidates.push(csv);

    if (kind === "brand") {
      const slug = brandSlug(label);
      if (slug) candidates.push(`/img/icons/brands/${slug}.svg`);
      if (slug) candidates.push(`/img/icons/brand/${slug}.svg`);
    }

    // manufacturer icons are optional; if you later add a folder, this starts working automatically
    if (kind === "manufacturer") {
      const slug = brandSlug(label);
      if (slug) candidates.push(`/img/icons/manufacturers/${slug}.svg`);
      if (slug) candidates.push(`/img/icons/manufacturer/${slug}.svg`);
    }

    return candidates;
  }

  function setImgFallback(imgEl, candidates) {
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

  function uniqueOptionsForFilter(filterKey) {
    const data = rows();
    const set = new Set();

    const colMap = {
      manufacturer: ["Manufacturer"],
      brand: ["Brand"],
      shade: ["Wrapper Shade", "Shade"],
      vitola: ["Vitola"],
      length: ["Length"],
      ring: ["RG", "Ring"],
      shape: ["Shape"],
      strength: ["Strength"],
    };

    const keys = colMap[filterKey] || [];
    for (const r of data) {
      const v = pick(r, keys).toString().trim();
      if (v) set.add(v);
    }

    return Array.from(set).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  function firstImgForLabel(filterKey, label) {
    const data = rows();
    if (!label) return "";

    if (filterKey === "brand") {
      for (const r of data) {
        if ((r["Brand"] || "").trim() === label) {
          const img = (r["Brand IMG"] || r["Brand Img"] || "").trim();
          if (img) return img;
        }
      }
    }

    if (filterKey === "manufacturer") {
      for (const r of data) {
        if ((r["Manufacturer"] || "").trim() === label) {
          const img = (r["Manufacturer IMG"] || r["Manufacturer Img"] || "").trim();
          if (img) return img;
        }
      }
    }

    return "";
  }

  // ---------- modal ----------
  const modal = () => document.getElementById("filter-modal");
  const modalTitle = () => document.getElementById("fm-title");
  const modalSearch = () => document.getElementById("fm-search-input");
  const modalList = () => document.getElementById("fm-list");
  const modalConfirm = () => document.getElementById("fm-confirm");

  let currentFilter = null;
  let workingSet = new Set();

  function openModal(filterKey) {
    currentFilter = filterKey;

    const labelMap = {
      manufacturer: "Manufacturers",
      brand: "Brands",
      shade: "Shade",
      vitola: "Vitolas",
      length: "Length",
      ring: "Ring",
      shape: "Shapes",
      strength: "Strength",
    };

    modalTitle().textContent = labelMap[filterKey] || "Filter";
    modalSearch().value = "";
    workingSet = new Set(state().filters[filterKey] || []);

    renderModalList();
    modal().classList.remove("fm--hidden");
    modal().setAttribute("aria-hidden", "false");
    setTimeout(() => modalSearch().focus(), 50);
  }

  function closeModal() {
    modal().classList.add("fm--hidden");
    modal().setAttribute("aria-hidden", "true");
    currentFilter = null;
    workingSet = new Set();
  }

  function renderModalList() {
    const q = modalSearch().value.trim().toLowerCase();
    const options = uniqueOptionsForFilter(currentFilter).filter((o) =>
      !q ? true : o.toLowerCase().includes(q)
    );

    modalList().innerHTML = "";
    const frag = document.createDocumentFragment();

    options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "fm-row" + (workingSet.has(opt) ? " is-selected" : "");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", workingSet.has(opt) ? "true" : "false");

      const icon = document.createElement("div");
      icon.className = "fm-icon";

      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";

      const csvImg = firstImgForLabel(currentFilter, opt);
      const candidates = buildIconCandidates(currentFilter, opt, csvImg);

      if (candidates.length) setImgFallback(img, candidates);
      else img.style.display = "none";

      icon.appendChild(img);

      const label = document.createElement("div");
      label.className = "fm-label";
      label.textContent = opt;

      const check = document.createElement("div");
      check.className = "fm-check";

      row.appendChild(icon);
      row.appendChild(label);
      row.appendChild(check);

      row.addEventListener("click", () => {
        if (workingSet.has(opt)) workingSet.delete(opt);
        else workingSet.add(opt);
        row.classList.toggle("is-selected");
      });

      frag.appendChild(row);
    });

    modalList().appendChild(frag);
  }

  function applyModal() {
    if (!currentFilter) return;

    state().filters[currentFilter] = new Set(workingSet);

    // update pill blue state
    document.querySelectorAll(`.filter-pill[data-filter="${currentFilter}"]`)
      .forEach((btn) => {
        btn.classList.toggle("is-active", state().filters[currentFilter].size > 0);
      });

    closeModal();
    if (typeof window.buildCigarsRender === "function") window.buildCigarsRender();
  }

  // ---------- UI wiring ----------
  function initBack() {
    const back = document.getElementById("cigars-back");
    if (!back) return;

    back.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/pos/";
    });
  }

  function initSearch() {
    const input = document.getElementById("cigars-search-input");
    if (!input) return;

    input.addEventListener("input", () => {
      state().q = input.value || "";
      if (typeof window.buildCigarsRender === "function") window.buildCigarsRender();
    });
  }

  function initFilterPills() {
    document.querySelectorAll(".filter-pill[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-filter");
        openModal(key);
      });
    });
  }

  function initTogglePills() {
    document.querySelectorAll(".filter-pill[data-toggle]").forEach((btn) => {
      const key = btn.getAttribute("data-toggle");

      btn.addEventListener("click", () => {
        state().toggles[key] = !state().toggles[key];
        btn.classList.toggle("is-active", state().toggles[key]);

        if (typeof window.buildCigarsRender === "function") window.buildCigarsRender();
      });
    });
  }

  function initViewAll() {
    const btn = document.getElementById("filters-view-all");
    const expanded = document.getElementById("filters-expanded");
    if (!btn || !expanded) return;

    btn.addEventListener("click", () => {
      const isHidden = expanded.hasAttribute("hidden");
      if (isHidden) {
        expanded.removeAttribute("hidden");
        btn.textContent = "hide";
      } else {
        expanded.setAttribute("hidden", "");
        btn.textContent = "view all";
      }
    });
  }

  function initModalEvents() {
    // close on backdrop click
    document.querySelectorAll("[data-fm-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    // search inside modal
    modalSearch().addEventListener("input", renderModalList);

    // confirm
    modalConfirm().addEventListener("click", applyModal);

    // escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal().classList.contains("fm--hidden")) {
        closeModal();
      }
    });
  }

  function bootWhenDataReady() {
    // build-cigars loads async; wait until rows exist
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (rows().length) {
        clearInterval(t);

        initBack();
        initSearch();
        initFilterPills();
        initTogglePills();
        initViewAll();
        initModalEvents();

        // paint pill active states if any persisted
        const s = state();
        for (const k of Object.keys(s.filters)) {
          const on = s.filters[k] && s.filters[k].size > 0;
          document.querySelectorAll(`.filter-pill[data-filter="${k}"]`)
            .forEach((btn) => btn.classList.toggle("is-active", on));
        }
      }
      if (tries > 80) clearInterval(t);
    }, 50);
  }

  document.addEventListener("DOMContentLoaded", bootWhenDataReady);
})();
