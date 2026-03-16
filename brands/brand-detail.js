const DEFAULT_BRAND_DATA = {
  "padron": {
    name: "Padron",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/padron.svg",
    website: "https://padron.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Padrón is one of the most respected premium cigar brands in the world, known for box-pressed cigars, Nicaraguan tobacco, and exceptional consistency.",
      "This public brand page mirrors the shop page structure, but is focused specifically on the cigar brand itself."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "arturofuente": {
    name: "Arturo Fuente",
    subtitle: "Santiago, Dominican Republic",
    mapKey: "dominican-santiago",
    icon: "/img/icons/brands/arturofuente.svg",
    website: "https://arturofuente.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Arturo Fuente is one of the most iconic family-owned premium cigar companies, known for Fuente Fuente OpusX, Don Carlos, Hemingway, and a long Dominican cigar legacy."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "davidoff": {
    name: "Davidoff",
    subtitle: "Santiago, Dominican Republic",
    mapKey: "dominican-santiago",
    icon: "/img/icons/brands/davidoff.svg",
    website: "https://www.davidoffgeneva.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Davidoff is a globally recognized luxury cigar brand known for refined blending, elegant presentation, and a strong Dominican portfolio."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "myfather": {
    name: "My Father",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/myfather.svg",
    website: "https://myfathercigars.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "My Father Cigars is known for bold Nicaraguan blending and the García family’s major influence on the premium cigar industry."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "oliva": {
    name: "Oliva",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/oliva.svg",
    website: "https://olivacigar.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Oliva is widely respected for delivering strong value and consistency across core lines such as Serie V, Serie O, and Serie G."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "romeoyjulieta": {
    name: "Romeo y Julieta",
    subtitle: "Dominican Republic",
    mapKey: "dominican-republic",
    icon: "/img/icons/brands/romeoyjulieta.svg",
    website: "https://www.altadisusa.com/brands/romeo-y-julieta/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Romeo y Julieta is one of the most recognized names in premium cigars, offering a broad portfolio with long-standing popularity."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "montecristo": {
    name: "Montecristo",
    subtitle: "Dominican Republic",
    mapKey: "dominican-republic",
    icon: "/img/icons/brands/montecristo.svg",
    website: "https://www.altadisusa.com/brands/montecristo/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Montecristo is one of the most historic and recognizable cigar brands in the world, with both classic heritage and modern portfolio depth."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  },

  "perdomo": {
    name: "Perdomo",
    subtitle: "Estelí, Nicaragua",
    mapKey: "nicaragua-esteli",
    icon: "/img/icons/brands/perdomo.svg",
    website: "https://perdomocigars.com/",
    instagram: "",
    quickLinks: ["Band Artwork", "Portfolio", "Accolades"],
    about: [
      "Perdomo is known for vertically integrated tobacco production, Nicaraguan craftsmanship, and a wide portfolio of box-pressed and traditional cigars."
    ],
    newReleases: [
      "No new releases have been added yet."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  }
};

const MAP_ART = {
  "nicaragua-esteli": `
    <div class="map-modal-body">
      <div class="map-card map-card--regional">
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

            <path d="M338 378
                     L406 364
                     L462 372
                     L496 410
                     L485 470
                     L452 498
                     L395 506
                     L350 482
                     L320 438
                     L326 396 Z" fill="#3f8f6b"/>
          </g>

          <g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#6f7783">
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

          <text x="342" y="548" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#205d46">Nicaragua</text>

          <g transform="translate(392 395)">
            <path d="M0 -26 C14 -26 25 -15 25 -1 C25 18 0 42 0 42 C0 42 -25 18 -25 -1 C-25 -15 -14 -26 0 -26 Z" fill="#0b6bff"/>
            <circle cx="0" cy="-2" r="9" fill="#ffffff"/>
          </g>

          <text x="425" y="392" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#0b6bff">Estelí</text>
        </svg>

        <div class="map-caption">
          <div class="map-caption-title">Estelí, Nicaragua</div>
          <div class="map-caption-text">Nicaragua is highlighted, with Estelí marked in the north-central part of the country.</div>
        </div>
      </div>
    </div>
  `,

  "dominican-santiago": `
    <div class="map-modal-body">
      <div class="map-card map-card--regional">
        <svg class="map-svg" viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="waterGradDR" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#dbeeff"/>
              <stop offset="100%" stop-color="#c8def7"/>
            </linearGradient>
            <filter id="shadowSoftDR" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,.14)"/>
            </filter>
          </defs>

          <rect width="900" height="620" fill="url(#waterGradDR)"/>

          <g filter="url(#shadowSoftDR)">
            <path d="M130 160 L330 128 L470 136 L456 170 L255 184 L150 178 Z" fill="#d9ddd2"/>
            <path d="M210 355 L310 350 L320 372 L220 378 Z" fill="#d9ddd2"/>
            <path d="M668 286 L790 280 L800 305 L678 312 Z" fill="#d9ddd2"/>
            <path d="M350 235 L452 206 L520 214 L528 270 L465 298 L382 288 Z" fill="#d9ddd2"/>
            <path d="M518 214 L642 215 L716 240 L700 298 L602 320 L522 270 Z" fill="#3f8f6b"/>
          </g>

          <g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#6f7783">
            <text x="238" y="110" font-size="24">Cuba</text>
            <text x="218" y="338" font-size="20">Jamaica</text>
            <text x="688" y="265" font-size="20">Puerto Rico</text>
            <text x="386" y="196" font-size="20">Haiti</text>
          </g>

          <text x="498" y="366" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="#205d46">Dominican Republic</text>

          <g transform="translate(584 232)">
            <path d="M0 -24 C13 -24 23 -14 23 -1 C23 16 0 38 0 38 C0 38 -23 16 -23 -1 C-23 -14 -13 -24 0 -24 Z" fill="#0b6bff"/>
            <circle cx="0" cy="-2" r="8" fill="#ffffff"/>
          </g>

          <text x="608" y="228" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="#0b6bff">Santiago</text>
        </svg>

        <div class="map-caption">
          <div class="map-caption-title">Santiago, Dominican Republic</div>
          <div class="map-caption-text">The Dominican Republic is highlighted, with Santiago marked in the northern interior.</div>
        </div>
      </div>
    </div>
  `,

  "dominican-republic": `
    <div class="map-modal-body">
      <div class="map-card map-card--regional">
        <svg class="map-svg" viewBox="0 0 900 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="waterGradDR2" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#dbeeff"/>
              <stop offset="100%" stop-color="#c8def7"/>
            </linearGradient>
            <filter id="shadowSoftDR2" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="rgba(0,0,0,.14)"/>
            </filter>
          </defs>

          <rect width="900" height="620" fill="url(#waterGradDR2)"/>

          <g filter="url(#shadowSoftDR2)">
            <path d="M130 160 L330 128 L470 136 L456 170 L255 184 L150 178 Z" fill="#d9ddd2"/>
            <path d="M210 355 L310 350 L320 372 L220 378 Z" fill="#d9ddd2"/>
            <path d="M668 286 L790 280 L800 305 L678 312 Z" fill="#d9ddd2"/>
            <path d="M350 235 L452 206 L520 214 L528 270 L465 298 L382 288 Z" fill="#d9ddd2"/>
            <path d="M518 214 L642 215 L716 240 L700 298 L602 320 L522 270 Z" fill="#3f8f6b"/>
          </g>

          <g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#6f7783">
            <text x="238" y="110" font-size="24">Cuba</text>
            <text x="218" y="338" font-size="20">Jamaica</text>
            <text x="688" y="265" font-size="20">Puerto Rico</text>
            <text x="386" y="196" font-size="20">Haiti</text>
          </g>

          <text x="498" y="366" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="#205d46">Dominican Republic</text>
        </svg>

        <div class="map-caption">
          <div class="map-caption-title">Dominican Republic</div>
          <div class="map-caption-text">The country is highlighted against the surrounding Caribbean region.</div>
        </div>
      </div>
    </div>
  `
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
  const params = new URLSearchParams(window.location.search);
  return params.get("brand");
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

function saveBrandData(slug, data) {
  localStorage.setItem(storageKey(slug), JSON.stringify(data));
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

function renderHeroQuickLinks(brand) {
  const links = Array.isArray(brand.quickLinks) ? brand.quickLinks : [];
  return `
    <div class="hero-quick-links editable-zone">
      ${editorButton("quickLinks", "Edit hero quick links")}
      ${links.map(item => `<div class="hero-quick-link">${escapeHtml(item)}</div>`).join("")}
    </div>
  `;
}

function renderTabContentParagraphs(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(p => `<p>${escapeHtml(p)}</p>`).join("");
}

function renderUpdates(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(item => `
    <article class="update-card">
      <div class="update-date">${escapeHtml(item.date || "")}</div>
      <div class="update-text">${escapeHtml(item.text || "")}</div>
    </article>
  `).join("");
}

function renderAdminBar() {
  if (!isAdminMode()) return "";

  return `
    <div class="admin-floating-bar">
      <div class="admin-floating-title">Edit Mode</div>
      <div class="admin-floating-actions">
        <button class="admin-action-btn is-active" type="button" id="previewModeBtn">Preview</button>
        <button class="admin-action-btn is-active" type="button" id="saveBrandBtn">Save</button>
      </div>
    </div>
  `;
}

function renderBrandPage() {
  const slug = getBrandSlug();
  const brand = currentBrandState(slug);

  if (!brand) {
    document.body.innerHTML = `
      <main class="page">
        <section class="hero-card" style="display:flex;align-items:center;justify-content:center;text-align:center;">
          <div>
            <h1 class="brand-name" style="font-size:48px;">Brand Not Found</h1>
            <p class="brand-subtitle">This brand page has not been created yet.</p>
            <p style="margin-top:24px;">
              <a class="back-chip" href="/brands/" style="position:static;">Brands</a>
            </p>
          </div>
        </section>
      </main>
    `;
    return;
  }

  document.title = `${brand.name} | CigarOS`;

  const websiteIcon = brand.website
    ? `
      <a class="link-icon" href="${brand.website}" target="_blank" rel="noopener noreferrer" aria-label="Website">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3 12h18"></path>
          <path d="M12 3a15 15 0 0 1 0 18"></path>
          <path d="M12 3a15 15 0 0 0 0 18"></path>
        </svg>
      </a>
    `
    : "";

  const subtitleMarkup = brand.subtitle
    ? `
      <button
        class="brand-subtitle brand-map-trigger editable-zone"
        type="button"
        aria-label="Open location map for ${escapeHtml(brand.subtitle)}"
      >
        ${editorButton("subtitle", "Edit location")}
        <span class="brand-subtitle-pin">📍</span>
        <span>${escapeHtml(brand.subtitle)}</span>
      </button>
    `
    : "";

  document.getElementById("app").innerHTML = `
    ${renderAdminBar()}

    <main class="page">
      <section class="hero-card">
        <a class="back-chip" href="/brands/">Brands</a>

        <div class="brand-hero">
          <div class="editable-zone editable-zone--hero-icon">
            ${editorButton("icon", "Edit brand icon")}
            <img class="brand-icon" src="${escapeHtml(brand.icon)}" alt="${escapeHtml(brand.name)} logo">
          </div>

          <div class="editable-zone editable-zone--title">
            ${editorButton("name", "Edit brand name")}
            <h1 class="brand-name">${escapeHtml(brand.name)}</h1>
          </div>

          ${subtitleMarkup}

          <div class="brand-links">
            <div class="editable-zone editable-zone--website">
              ${editorButton("website", "Edit website")}
              ${websiteIcon}
            </div>
          </div>

          ${renderHeroQuickLinks(brand)}
        </div>
      </section>

      <section class="tabs-shell">
        <div class="tabs-bar tabs-bar--three">
          <button class="tab-btn active" data-tab="about">About</button>
          <button class="tab-btn" data-tab="new-releases">New Releases</button>
          <button class="tab-btn" data-tab="updates">Updates</button>
        </div>

        <div class="tab-panel active editable-zone" id="panel-about">
          ${editorButton("about", "Edit About")}
          <div class="section-copy">
            ${renderTabContentParagraphs(brand.about)}
          </div>
        </div>

        <div class="tab-panel editable-zone" id="panel-new-releases">
          ${editorButton("newReleases", "Edit New Releases")}
          <div class="section-copy">
            ${renderTabContentParagraphs(brand.newReleases)}
          </div>
        </div>

        <div class="tab-panel editable-zone" id="panel-updates">
          ${editorButton("updates", "Edit Updates")}
          <div class="update-list">
            ${renderUpdates(brand.updates)}
          </div>
        </div>
      </section>
    </main>

    <div class="map-modal" id="mapModal" aria-hidden="true">
      <div class="map-modal-backdrop" data-close-map></div>
      <div class="map-modal-dialog" role="dialog" aria-modal="true" aria-label="Location map">
        <button class="map-modal-close" type="button" aria-label="Close map" data-close-map>×</button>
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

    <div class="editor-modal" id="editorModal" aria-hidden="true">
      <div class="editor-modal-backdrop" data-close-editor></div>
      <div class="editor-modal-dialog" role="dialog" aria-modal="true" aria-label="Edit field">
        <div class="editor-modal-head">
          <div class="editor-modal-title" id="editorModalTitle">Edit</div>
          <button class="editor-modal-close" type="button" aria-label="Close editor" data-close-editor>×</button>
        </div>
        <div class="editor-modal-body" id="editorModalBody"></div>
        <div class="editor-modal-actions">
          <button class="editor-btn editor-btn--secondary" type="button" data-close-editor>Cancel</button>
          <button class="editor-btn" type="button" id="editorSaveBtn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  bindTabs();
  bindMapModal();
  bindEditor(slug);
  bindAdminActions(slug);
}

function bindTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = {
    "about": document.getElementById("panel-about"),
    "new-releases": document.getElementById("panel-new-releases"),
    "updates": document.getElementById("panel-updates")
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      const tab = button.dataset.tab;
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle("active", key === tab);
      });
    });
  });
}

function bindMapModal() {
  const trigger = document.querySelector(".brand-map-trigger");
  const modal = document.getElementById("mapModal");
  const closeButtons = document.querySelectorAll("[data-close-map]");

  if (!trigger || !modal) return;

  trigger.addEventListener("click", (event) => {
    if (event.target.closest(".edit-pencil")) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("map-modal-open");
  });

  closeButtons.forEach(button => {
    button.addEventListener("click", () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("map-modal-open");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("map-modal-open");
    }
  });
}

function bindAdminActions(slug) {
  if (!isAdminMode()) return;

  const saveBtn = document.getElementById("saveBrandBtn");
  const previewBtn = document.getElementById("previewModeBtn");

  saveBtn?.addEventListener("click", () => {
    const temp = currentBrandState(slug);
    saveBrandData(slug, temp);
    alert("Changes saved for this brand.");
  });

  previewBtn?.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("admin");
    window.location.search = params.toString();
  });
}

function bindEditor(slug) {
  if (!isAdminMode()) return;

  const editButtons = document.querySelectorAll("[data-edit-field]");
  const modal = document.getElementById("editorModal");
  const modalTitle = document.getElementById("editorModalTitle");
  const modalBody = document.getElementById("editorModalBody");
  const saveBtn = document.getElementById("editorSaveBtn");
  const closeButtons = document.querySelectorAll("[data-close-editor]");

  let activeField = null;

  editButtons.forEach(button => {
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
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("editor-modal-open");
    });
  });

  closeButtons.forEach(button => {
    button.addEventListener("click", () => closeEditor(modal));
  });

  saveBtn?.addEventListener("click", () => {
    if (!activeField) return;

    const brand = currentBrandState(slug);
    brand[activeField] = readEditorValue(activeField);
    setTempState(slug, brand);
    closeEditor(modal);
    renderBrandPage();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeEditor(modal);
    }
  });
}

function closeEditor(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("editor-modal-open");
}

function buildEditorMarkup(field, value, config) {
  if (config.type === "text") {
    return `
      <label class="editor-label" for="editorInput">${escapeHtml(config.label)}</label>
      <input class="editor-input" id="editorInput" type="text" value="${escapeHtml(value || "")}">
    `;
  }

  if (config.type === "list-simple") {
    const text = Array.isArray(value) ? value.join("\n") : "";
    return `
      <label class="editor-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">One item per line.</p>
      <textarea class="editor-textarea" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  if (config.type === "list-paragraphs") {
    const text = Array.isArray(value) ? value.join("\n\n") : "";
    return `
      <label class="editor-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">Separate paragraphs with a blank line.</p>
      <textarea class="editor-textarea editor-textarea--lg" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  if (config.type === "updates-list") {
    const text = Array.isArray(value)
      ? value.map(item => `${item.date || ""} | ${item.text || ""}`).join("\n")
      : "";
    return `
      <label class="editor-label" for="editorTextarea">${escapeHtml(config.label)}</label>
      <p class="editor-help">One update per line. Format: Date | Text</p>
      <textarea class="editor-textarea editor-textarea--lg" id="editorTextarea">${escapeHtml(text)}</textarea>
    `;
  }

  return `<div>Unsupported field type.</div>`;
}

function readEditorValue(field) {
  const config = EDITABLE_FIELDS[field];
  if (!config) return "";

  if (config.type === "text") {
    return document.getElementById("editorInput")?.value.trim() || "";
  }

  const raw = document.getElementById("editorTextarea")?.value || "";

  if (config.type === "list-simple") {
    return raw
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);
  }

  if (config.type === "list-paragraphs") {
    return raw
      .split(/\n\s*\n/g)
      .map(v => v.trim())
      .filter(Boolean);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderBrandPage();
