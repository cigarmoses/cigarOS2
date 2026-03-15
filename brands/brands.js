const BRANDS = [
  {
    slug: "padron",
    name: "Padron",
    meta: "Estelí, Nicaragua",
    icon: "/img/icons/brands/padron.svg"
  },
  {
    slug: "arturofuente",
    name: "Arturo Fuente",
    meta: "Dominican Republic",
    icon: "/img/icons/brands/arturofuente.svg"
  },
  {
    slug: "davidoff",
    name: "Davidoff",
    meta: "Dominican Republic",
    icon: "/img/icons/brands/davidoff.svg"
  },
  {
    slug: "myfather",
    name: "My Father",
    meta: "Estelí, Nicaragua",
    icon: "/img/icons/brands/myfather.svg"
  },
  {
    slug: "oliva",
    name: "Oliva",
    meta: "Nicaragua",
    icon: "/img/icons/brands/oliva.svg"
  },
  {
    slug: "romeoyjulieta",
    name: "Romeo y Julieta",
    meta: "Dominican Republic",
    icon: "/img/icons/brands/romeoyjulieta.svg"
  },
  {
    slug: "montecristo",
    name: "Montecristo",
    meta: "Dominican Republic",
    icon: "/img/icons/brands/montecristo.svg"
  },
  {
    slug: "perdomo",
    name: "Perdomo",
    meta: "Nicaragua",
    icon: "/img/icons/brands/perdomo.svg"
  }
];

function renderBrandsPage() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <main class="page">
      <section class="hero-card">
        <a class="back-chip" href="/">Home</a>

        <div class="hero-inner">
          <h1 class="page-title">Brands</h1>
          <p class="page-subtitle">
            Explore cigar brands through individual public profile pages.
          </p>
        </div>
      </section>

      <section class="grid-shell">
        ${
          BRANDS.length
            ? `
              <div class="brands-grid">
                ${BRANDS.map(renderBrandCard).join("")}
              </div>
            `
            : `
              <div class="empty-state">No brands have been added yet.</div>
            `
        }
      </section>
    </main>
  `;
}

function renderBrandCard(brand) {
  return `
    <a class="brand-card" href="/brands/${brand.slug}/" aria-label="${escapeHtml(brand.name)}">
      <div class="brand-icon-wrap">
        <img
          class="brand-icon"
          src="${brand.icon}"
          alt="${escapeHtml(brand.name)} logo"
          loading="lazy"
        >
      </div>

      <h2 class="brand-name">${escapeHtml(brand.name)}</h2>

      ${brand.meta ? `<div class="brand-meta">${escapeHtml(brand.meta)}</div>` : ""}

      <div class="brand-cta">Open Brand</div>
    </a>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderBrandsPage();
