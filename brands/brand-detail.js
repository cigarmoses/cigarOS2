const BRAND_DATA = {
  "padron": {
    name: "Padron",
    subtitle: "Estelí, Nicaragua",
    icon: "/img/icons/brands/padron.svg",
    website: "https://padron.com/",
    instagram: "",
    about: [
      "Padrón is one of the most respected premium cigar brands in the world, known for box-pressed cigars, Nicaraguan tobacco, and exceptional consistency.",
      "This public brand page mirrors the shop page structure, but is focused specifically on the cigar brand itself."
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
    subtitle: "Dominican Republic",
    icon: "/img/icons/brands/arturofuente.svg",
    website: "https://arturofuente.com/",
    instagram: "",
    about: [
      "Arturo Fuente is one of the most iconic family-owned premium cigar companies, known for Fuente Fuente OpusX, Don Carlos, Hemingway, and a long Dominican cigar legacy."
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
    subtitle: "Dominican Republic",
    icon: "/img/icons/brands/davidoff.svg",
    website: "https://www.davidoffgeneva.com/",
    instagram: "",
    about: [
      "Davidoff is a globally recognized luxury cigar brand known for refined blending, elegant presentation, and a strong Dominican portfolio."
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
    icon: "/img/icons/brands/myfather.svg",
    website: "https://myfathercigars.com/",
    instagram: "",
    about: [
      "My Father Cigars is known for bold Nicaraguan blending and the García family’s major influence on the premium cigar industry."
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
    subtitle: "Nicaragua",
    icon: "/img/icons/brands/oliva.svg",
    website: "https://olivacigar.com/",
    instagram: "",
    about: [
      "Oliva is widely respected for delivering strong value and consistency across core lines such as Serie V, Serie O, and Serie G."
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
    icon: "/img/icons/brands/romeoyjulieta.svg",
    website: "https://www.altadisusa.com/brands/romeo-y-julieta/",
    instagram: "",
    about: [
      "Romeo y Julieta is one of the most recognized names in premium cigars, offering a broad portfolio with long-standing popularity."
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
    icon: "/img/icons/brands/montecristo.svg",
    website: "https://www.altadisusa.com/brands/montecristo/",
    instagram: "",
    about: [
      "Montecristo is one of the most historic and recognizable cigar brands in the world, with both classic heritage and modern portfolio depth."
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
    subtitle: "Nicaragua",
    icon: "/img/icons/brands/perdomo.svg",
    website: "https://perdomocigars.com/",
    instagram: "",
    about: [
      "Perdomo is known for vertically integrated tobacco production, Nicaraguan craftsmanship, and a wide portfolio of box-pressed and traditional cigars."
    ],
    updates: [
      {
        date: "Latest",
        text: "Brand profile page is now live."
      }
    ]
  }
};

function getBrandSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("brand");
}

function renderBrandPage() {
  const slug = getBrandSlug();
  const brand = BRAND_DATA[slug];

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

  const instagramIcon = brand.instagram
    ? `
      <a class="link-icon" href="${brand.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5"></rect>
          <circle cx="12" cy="12" r="4"></circle>
          <circle cx="17.5" cy="6.5" r="1"></circle>
        </svg>
      </a>
    `
    : "";

  document.getElementById("app").innerHTML = `
    <main class="page">
      <section class="hero-card">
        <a class="back-chip" href="/brands/">Brands</a>

        <div class="brand-hero">
          <img
            class="brand-icon"
            src="${brand.icon}"
            alt="${escapeHtml(brand.name)} logo"
          >

          <h1 class="brand-name">${escapeHtml(brand.name)}</h1>

          ${brand.subtitle ? `<p class="brand-subtitle">${escapeHtml(brand.subtitle)}</p>` : ""}

          <div class="brand-links">
            ${websiteIcon}
            ${instagramIcon}
          </div>
        </div>
      </section>

      <section class="tabs-shell">
        <div class="tabs-bar">
          <button class="tab-btn active" data-tab="about">About</button>
          <button class="tab-btn" data-tab="updates">Updates</button>
        </div>

        <div class="tab-panel active" id="panel-about">
          <div class="section-copy">
            ${brand.about.map(p => `<p>${escapeHtml(p)}</p>`).join("")}
          </div>
        </div>

        <div class="tab-panel" id="panel-updates">
          <div class="update-list">
            ${brand.updates.map(item => `
              <article class="update-card">
                <div class="update-date">${escapeHtml(item.date)}</div>
                <div class="update-text">${escapeHtml(item.text)}</div>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
    </main>
  `;

  bindTabs();
}

function bindTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const about = document.getElementById("panel-about");
  const updates = document.getElementById("panel-updates");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      const tab = button.dataset.tab;
      about.classList.toggle("active", tab === "about");
      updates.classList.toggle("active", tab === "updates");
    });
  });
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
