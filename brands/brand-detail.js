const DEFAULT_BRAND_DATA = {
  padron: {
    name: "Padron",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/padron.svg",
    website: "https://padron.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Padrón is one of the most respected premium cigar brands in the world, known for box-pressed cigars, Nicaraguan tobacco, and exceptional consistency.",
      "This public brand page mirrors the shop page structure, but is focused specifically on the cigar brand itself."
    ],
    newReleases: [],
    updates: []
  },

  arturofuente: {
    name: "Arturo Fuente",
    subtitle: "Santiago, Dominican Republic",
    mapKey: "dominican-santiago",
    icon: "/img/icons/brands/arturofuente.svg",
    website: "https://arturofuente.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Arturo Fuente is one of the most iconic family-owned premium cigar companies, known for Fuente Fuente OpusX, Don Carlos, Hemingway, and a long Dominican cigar legacy."
    ],
    newReleases: [],
    updates: []
  },

  davidoff: {
    name: "Davidoff",
    subtitle: "Santiago, Dominican Republic",
    mapKey: "dominican-santiago",
    icon: "/img/icons/brands/davidoff.svg",
    website: "https://www.davidoffgeneva.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Davidoff is a globally recognized luxury cigar brand known for refined blending, elegant presentation, and a strong Dominican portfolio."
    ],
    newReleases: [],
    updates: []
  },

  myfather: {
    name: "My Father",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/myfather.svg",
    website: "https://myfathercigars.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "My Father Cigars is known for bold Nicaraguan blending and the García family’s major influence on the premium cigar industry."
    ],
    newReleases: [],
    updates: []
  },

  oliva: {
    name: "Oliva",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/oliva.svg",
    website: "https://olivacigar.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Oliva is widely respected for delivering strong value and consistency across core lines such as Serie V, Serie O, and Serie G."
    ],
    newReleases: [],
    updates: []
  },

  romeoyjulieta: {
    name: "Romeo y Julieta",
    subtitle: "Dominican Republic",
    mapKey: "dominican-republic",
    icon: "/img/icons/brands/romeoyjulieta.svg",
    website: "https://www.altadisusa.com/brands/romeo-y-julieta/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Romeo y Julieta is one of the most recognized names in premium cigars, offering a broad portfolio with long-standing popularity."
    ],
    newReleases: [],
    updates: []
  },

  montecristo: {
    name: "Montecristo",
    subtitle: "Dominican Republic",
    mapKey: "dominican-republic",
    icon: "/img/icons/brands/montecristo.svg",
    website: "https://www.altadisusa.com/brands/montecristo/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Montecristo is one of the most historic and recognizable cigar brands in the world, with both classic heritage and modern portfolio depth."
    ],
    newReleases: [],
    updates: []
  },

  perdomo: {
    name: "Perdomo",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/perdomo.svg",
    website: "https://perdomocigars.com/",
    instagram: "",
    quickLinks: ["Band Art", "Portfolio", "Accolades"],
    about: [
      "Perdomo is known for vertically integrated tobacco production, Nicaraguan craftsmanship, and a wide portfolio of box-pressed and traditional cigars."
    ],
    newReleases: [],
    updates: []
  }
};

function renderMapShell(svg, title, text) {
  return `
    <div class="map-modal-body">
      <div class="map-card">
        ${svg}
        <div class="map-caption">
          <div class="map-caption-title">${title}</div>
          <div class="map-caption-text">${text}</div>
        </div>
      </div>
    </div>
  `;
}

function nicaraguaMapSvg() {
  return `
    <svg class="map-svg" viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="waterGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#dbeeff"/>
          <stop offset="100%" stop-color="#c8def7"/>
        </linearGradient>
        <filter id="shadowSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,.14)"/>
        </filter>
      </defs>

      <rect width="900" height="620" fill="url(#waterGrad)"/>

      <g filter="url(#shadowSoft)">
        <path d="M80 180 L185 145 L280 165 L330 210 L305 280 L240 315 L155 300 L105 250 Z" fill="#d9ddd2"/>
        <path d="M238 300 L265 290 L278 335 L250 368 L232 350 Z" fill="#d9ddd2"/>
        <path d="M170 325 L238 300 L232 350 L175 378 L145 350 Z" fill="#d9ddd2"/>
        <path d="M290 330 L412 302 L482 320 L456 372 L334 388 L278 360 Z" fill="#d9ddd2"/>
        <path d="M220 392 L282 384 L292 402 L240 418 L208 410 Z" fill="#d9ddd2"/>
        <path d="M470 455 L555 435 L592 462 L565 520 L498 532 L452 495 Z" fill="#d9ddd2"/>
        <path d="M590 474 L690 455 L760 472 L734 502 L635 510 L570 498 Z" fill="#d9ddd2"/>
        <path d="M510 138 L655 112 L750 124 L742 146 L612 160 L520 154 Z" fill="#d9ddd2"/>
        <path d="M610 252 L690 248 L700 266 L620 272 Z" fill="#d9ddd2"/>
        <path d="M338 378 L406 364 L462 372 L496 410 L485 470 L452 498 L395 506 L350 482 L320 438 L326 396 Z" fill="#3f8f6b"/>
      </g>

      <g font-weight="700" fill="#6f7783">
        <text x="120" y="160" font-size="28">Mexico</text>
        <text x="228" y="342" font-size="20">Belize</text>
        <text x="150" y="410" font-size="24">Guatemala</text>
        <text x="306" y="292" font-size="26">Honduras</text>
        <text x="198" y="448" font-size="20">El Salvador</text>
        <text x="454" y="555" font-size="24">Costa Rica</text>
        <text x="628" y="535" font-size="24">Panama</text>
        <text x="602" y="102" font-size="22">Cuba</text>
        <text x="622" y="238" font-size="18">Jamaica</text>
      </g>

      <text x="342" y="548" font-size="34" font-weight="800" fill="#205d46">Nicaragua</text>

      <g transform="translate(392 395)">
        <path d="M0 -26 C14 -26 25 -15 25 -1 C25 18 0 42 0 42 C0 42 -25 18 -25 -1 C-25 -15 -14 -26 0 -26 Z" fill="#0b6bff"/>
        <circle cx="0" cy="-2" r="9" fill="#ffffff"/>
      </g>

      <text x="425" y="392" font-size="28" font-weight="800" fill="#0b6bff">Estelí</text>
    </svg>
  `;
}

function dominicanMapBaseSvg(includeSantiagoPin = false) {
  return `
    <svg class="map-svg" viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${includeSantiagoPin ? "waterGradDR" : "waterGradDR2"}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#dbeeff"/>
          <stop offset="100%" stop-color="#c8def7"/>
        </linearGradient>
        <filter id="${includeSantiagoPin ? "shadowSoftDR" : "shadowSoftDR2"}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,.14)"/>
        </filter>
      </defs>

      <rect width="900" height="620" fill="url(#${includeSantiagoPin ? "waterGradDR" : "waterGradDR2"})"/>

      <g filter="url(#${includeSantiagoPin ? "shadowSoftDR" : "shadowSoftDR2"})">
        <path d="M130 160 L330 128 L470 136 L456 170 L255 184 L150 178 Z" fill="#d9ddd2"/>
        <path d="M210 355 L310 350 L320 372 L220 378 Z" fill="#d9ddd2"/>
        <path d="M668 286 L790 280 L800 305 L678 312 Z" fill="#d9ddd2"/>
        <path d="M350 235 L452 206 L520 214 L528 270 L465 298 L382 288 Z" fill="#d9ddd2"/>
        <path d="M518 214 L642 215 L716 240 L700 298 L602 320 L522 270 Z" fill="#3f8f6b"/>
      </g>

      <g font-weight="700" fill="#6f7783">
        <text x="238" y="110" font-size="24">Cuba</text>
        <text x="218" y="338" font-size="20">Jamaica</text>
        <text x="688" y="265" font-size="20">Puerto Rico</text>
        <text x="386" y="196" font-size="20">Haiti</text>
      </g>

      <text x="498" y="366" font-size="30" font-weight="800" fill="#205d46">Dominican Republic</text>

      ${includeSantiagoPin ? `
        <g transform="translate(584 232)">
          <path d="M0 -24 C13 -24 23 -14 23 -1 C23 16 0 38 0 38 C0 38 -23 16 -23 -1 C-23 -14 -13 -24 0 -24 Z" fill="#0b6bff"/>
          <circle cx="0" cy="-2" r="8" fill="#ffffff"/>
        </g>
        <text x="608" y="228" font-size="26" font-weight="800" fill="#0b6bff">Santiago</text>
      ` : ""}
    </svg>
  `;
}

const MAP_ART = {
  "nicaragua-esteli": renderMapShell(
    nicaraguaMapSvg(),
    "Estelí, Nicaragua",
    "Nicaragua is highlighted, with Estelí marked in the north-central part of the country."
  ),

  "dominican-santiago": renderMapShell(
    dominicanMapBaseSvg(true),
    "Santiago, Dominican Republic",
    "The Dominican Republic is highlighted, with Santiago marked in the northern interior."
  ),

  "dominican-republic": renderMapShell(
    dominicanMapBaseSvg(false),
    "Dominican Republic",
    "The country is highlighted against the surrounding Caribbean region."
  )
};

const EDITABLE_FIELDS = {
  icon: { label: "Brand Icon URL", type: "text" },
  name: { label: "Brand Name", type: "text" },
  subtitle: { label: "Location", type: "text" },
  website: { label: "Website URL", type: "text" },
  quickLinks: { label: "Hero Quick Links", type: "list-simple" },
  about: { label: "About", type: "list-paragraphs" },
  newReleases: { label: "New Releases", type: "list-paragraphs" },
  updates: { label: "Updates", type: "updates-list" }
};

function getBrandSlug() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "brands" && pathParts[1] && pathParts[1] !== "detail.html") {
    return pathParts[1].toLowerCase();
  }

  const params = new URLSearchParams(window.location.search);
  return (params.get("brand") || "padron").toLowerCase();
}

function isAdminMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1";
}

function storageKey(slug) {
  return `brand_editor_${slug}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getBrandData(slug) {
  const base = DEFAULT_BRAND_DATA[slug];
  if (!base) return null;
  const saved = localStorage.getItem(storageKey(slug));
  if (!saved) return deepClone(base);

  try {
    return { ...deepClone(base), ...JSON.parse(saved) };
  } catch {
    return deepClone(base);
  }
}

function setTempState(slug, data) {
  window.__brandTempState = window.__brandTempState || {};
  window.__brandTempState[slug] = deepClone(data);
}

function getTempState(slug) {
  return window.__brandTempState?.[slug] ? deepClone(window.__brandTempState[slug]) : null;
}

function currentBrandState(slug) {
  return getTempState(slug) || getBrandData(slug);
}

function saveBrandData(slug, data) {
  localStorage.setItem(storageKey(slug), JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function editorButton(fieldKey, label = "Edit") {
  if (!isAdminMode()) return "";
  return `
    <button
      class="edit-pencil"
      type="button"
      data-edit-field="${fieldKey}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
    >✎</button>
  `;
}

function renderQuickLinks(brand) {
  const items = Array.isArray(brand.quickLinks) ? brand.quickLinks : [];
  const firstThree = items.slice(0, 3);

  const websiteTile = brand.website ? `
    <a class="quick-link quick-link--icon" href="${escapeHtml(brand.website)}" target="_blank" rel="noopener noreferrer" aria-label="Website">
      <span class="icon-tile icon-tile--lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3 12h18"></path>
          <path d="M12 3a15 15 0 0 1 0 18"></path>
          <path d="M12 3a15 15 0 0 0 0 18"></path>
        </svg>
      </span>
    </a>
  ` : "";

  return `
    <div class="quick-links editable-zone ${isAdminMode() ? "editable-outline" : ""}">
      ${editorButton("quickLinks", "Edit hero quick links")}
      ${firstThree.map(item => `
        <div class="quick-link">
          <div class="quick-link-label">${escapeHtml(item)}</div>
        </div>
      `).join("")}
      ${websiteTile}
    </div>
  `;
}

function renderParagraphs(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return ``;
  }
  return list.map(p => `<p>${escapeHtml(p)}</p>`).join("");
}

function renderUpdates(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return ``;
  }
  return list.map(item => `
    <article class="content-item">
      <div class="content-item-title">${escapeHtml(item.date || "")}</div>
      <div class="content-item-copy">${escapeHtml(item.text || "")}</div>
    </article>
  `).join("");
}

function hasRealNewReleases(brand) {
  return Array.isArray(brand.newReleases) && brand.newReleases.length > 0;
}

function hasRealUpdates(brand) {
  return Array.isArray(brand.updates) && brand.updates.length > 0;
}

function renderAdminBar() {
  if (!isAdminMode()) return "";

  return `
    <div class="admin-floating-bar">
      <div class="admin-floating-shell">
        <div class="admin-floating-actions">
          <button class="admin-action-btn" type="button" id="previewModeBtn">Preview</button>
          <button class="admin-action-btn" type="button" id="saveBrandBtn">Save</button>
        </div>
      </div>
    </div>
  `;
}

function renderBrandPage() {
  const slug = getBrandSlug();
  const brand = currentBrandState(slug);

  if (!brand) {
    document.getElementById("app").innerHTML = `
      <main class="page-shell brand-page">
        <section class="surface-card surface-card--hero">
          <button class="glass-pill back-pill universal-back" type="button" id="brandBackBtn" aria-label="Go back">
            <span class="back-chevron">‹</span>
          </button>
          <div class="hero-compact">
            <div class="center-stack">
              <h1 class="hero-title">Brand Not Found</h1>
              <p class="hero-subtitle">This brand page has not been created yet.</p>
            </div>
          </div>
        </section>
      </main>
    `;
    return;
  }

  document.title = `${brand.name} | CigarOS`;

  document.getElementById("app").innerHTML = `
    ${renderAdminBar()}

    <main class="page-shell brand-page">
      <section class="surface-card surface-card--hero fade-in">
        <button class="glass-pill back-pill universal-back" type="button" id="brandBackBtn" aria-label="Go back">
          <span class="back-chevron">‹</span>
        </button>

        <div class="hero-compact">
          <div class="hero-top">
            <div class="hero-icon-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
              ${editorButton("icon", "Edit brand icon")}
              <img class="hero-icon" src="${escapeHtml(brand.icon)}" alt="${escapeHtml(brand.name)} logo">
            </div>

            <div class="hero-copy">
              <div class="hero-title-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
                ${editorButton("name", "Edit brand name")}
                <h1 class="hero-title">${escapeHtml(brand.name)}</h1>
              </div>

              <div class="hero-location-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
                ${editorButton("subtitle", "Edit location")}
                <button class="hero-subtitle hero-location-btn" type="button" data-open-modal="brandMapModal" aria-label="Open location map for ${escapeHtml(brand.subtitle)}">
                  <span class="hero-location-pin">📍</span>
                  <span>${escapeHtml(brand.subtitle)}</span>
                </button>
              </div>
            </div>
          </div>

          ${renderQuickLinks(brand)}
        </div>
      </section>

      <section class="surface-card surface-card--section brand-panels fade-in">
        <div class="segmented three" data-segmented="brand-main">
          <button class="segment-btn active" data-segment-btn="about">About</button>
          <button class="segment-btn ${hasRealNewReleases(brand) ? "" : "is-empty"}" data-segment-btn="new-releases">
            ${hasRealNewReleases(brand) ? "New Releases" : ""}
          </button>
          <button class="segment-btn ${hasRealUpdates(brand) ? "" : "is-empty"}" data-segment-btn="updates">
            ${hasRealUpdates(brand) ? "Updates" : ""}
          </button>
        </div>

        <div class="panel-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
          ${editorButton("about", "Edit About")}
          <div class="body-copy active" data-segment-panel="brand-main" data-segment-value="about">
            ${renderParagraphs((brand.about || []).slice(0, 1))}
          </div>
        </div>

        <div class="panel-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
          ${editorButton("newReleases", "Edit New Releases")}
          <div class="body-copy" data-segment-panel="brand-main" data-segment-value="new-releases">
            ${hasRealNewReleases(brand) ? renderParagraphs(brand.newReleases) : ""}
          </div>
        </div>

        <div class="panel-wrap editable-zone ${isAdminMode() ? "editable-outline" : ""}">
          ${editorButton("updates", "Edit Updates")}
          <div class="content-list" data-segment-panel="brand-main" data-segment-value="updates">
            ${hasRealUpdates(brand) ? renderUpdates(brand.updates) : ""}
          </div>
        </div>
      </section>
    </main>

    <div class="modal map-modal" id="brandMapModal" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="Location map">
        <button class="modal-close" type="button" data-close-modal aria-label="Close map">×</button>
        ${MAP_ART[brand.mapKey] || `
          <div class="map-modal-body">
            <div class="map-card">
              <div class="map-caption">
                <div class="map-caption-title">${escapeHtml(brand.subtitle || "Location")}</div>
                <div class="map-caption-text">Map preview unavailable.</div>
              </div>
            </div>
          </div>
        `}
      </div>
    </div>

    <div class="modal editor-modal" id="editorModal" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-label="Edit field">
        <button class="modal-close" type="button" data-close-modal aria-label="Close editor">×</button>
        <div class="editor-modal-head">
          <div class="editor-modal-title" id="editorModalTitle">Edit</div>
        </div>
        <div class="editor-modal-body" id="editorModalBody"></div>
        <div class="editor-modal-actions">
          <button class="editor-btn editor-btn--secondary" type="button" data-close-modal>Cancel</button>
          <button class="editor-btn" type="button" id="editorSaveBtn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  IOS26UI.boot(document);

  document.getElementById("brandBackBtn")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/brands/";
    }
  });

  bindEditor(slug);
  bindAdminActions(slug);
  bindTabs();
}

function bindTabs() {
  const buttons = document.querySelectorAll("[data-segment-btn]");
  const panels = document.querySelectorAll("[data-segment-panel='brand-main']");

  buttons.forEach(button => {
    if (button.classList.contains("is-empty")) return;

    button.addEventListener("click", () => {
      const value = button.getAttribute("data-segment-btn");

      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      panels.forEach(panel => {
        panel.classList.toggle(
          "active",
          panel.getAttribute("data-segment-value") === value
        );
      });
    });
  });
}

function bindAdminActions(slug) {
  if (!isAdminMode()) return;

  document.getElementById("saveBrandBtn")?.addEventListener("click", () => {
    saveBrandData(slug, currentBrandState(slug));
    alert("Changes saved for this brand.");
  });

  document.getElementById("previewModeBtn")?.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("admin");
    window.location.search = params.toString();
  });
}

function bindEditor(slug) {
  if (!isAdminMode()) return;

  const modal = document.getElementById("editorModal");
  const modalTitle = document.getElementById("editorModalTitle");
  const modalBody = document.getElementById("editorModalBody");
  const saveBtn = document.getElementById("editorSaveBtn");
  let activeField = null;

  document.querySelectorAll("[data-edit-field]").forEach(button => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      activeField = button.dataset.editField;
      const brand = currentBrandState(slug);
      const config = EDITABLE_FIELDS[activeField];
      if (!config) return;

      modalTitle.textContent = config.label;
      modalBody.innerHTML = buildEditorMarkup(activeField, brand[activeField], config);
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");
    });
  });

  saveBtn?.addEventListener("click", () => {
    if (!activeField) return;
    const brand = currentBrandState(slug);
    brand[activeField] = readEditorValue(activeField);
    setTempState(slug, brand);
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    renderBrandPage();
  });
}

function buildEditorMarkup(field, value, config) {
  if (config.type === "text") {
    return `
      <label class="field-label" for="editorInput">${escapeHtml(config.label)}</label>
      <input class="input" id="editorInput" type="text" value="${escapeHtml(value || "")}">
    `;
  }

  if (config.type === "list-simple") {
    const text = Array.isArray(value) ? value.join("\n") : "";
    return `
      <label class="field-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">One item per line.</p>
      <textarea class="textarea" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  if (config.type === "list-paragraphs") {
    const text = Array.isArray(value) ? value.join("\n\n") : "";
    return `
      <label class="field-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">Separate paragraphs with a blank line.</p>
      <textarea class="textarea editor-textarea-lg" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  if (config.type === "updates-list") {
    const text = Array.isArray(value)
      ? value.map(item => `${item.date || ""} | ${item.text || ""}`).join("\n")
      : "";
    return `
      <label class="field-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">One update per line. Format: Date | Text</p>
      <textarea class="textarea editor-textarea-lg" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  return `<div>Unsupported field.</div>`;
}

function readEditorValue(field) {
  const config = EDITABLE_FIELDS[field];
  if (!config) return "";

  if (config.type === "text") {
    return document.getElementById("editorInput")?.value.trim() || "";
  }

  const raw = document.getElementById("editorTextarea")?.value || "";

  if (config.type === "list-simple") {
    return raw.split("\n").map(v => v.trim()).filter(Boolean);
  }

  if (config.type === "list-paragraphs") {
    return raw.split(/\n\s*\n/g).map(v => v.trim()).filter(Boolean);
  }

  if (config.type === "updates-list") {
    return raw
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("|");
        return {
          date: (parts[0] || "").trim(),
          text: (parts.slice(1).join("|") || "").trim()
        };
      });
  }

  return raw;
}

renderBrandPage();
