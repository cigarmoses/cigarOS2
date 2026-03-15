const BRANDS = [
  {
    slug: "padron",
    name: "Padron",
    meta: "Estelí, Nicaragua",
    icon: "/img/brands/padron.png"
  },
  {
    slug: "arturo-fuente",
    name: "Arturo Fuente",
    meta: "Dominican Republic",
    icon: "/img/brands/arturo-fuente.png"
  },
  {
    slug: "davidoff",
    name: "Davidoff",
    meta: "Dominican Republic",
    icon: "/img/brands/davidoff.png"
  },
  {
    slug: "my-father",
    name: "My Father",
    meta: "Estelí, Nicaragua",
    icon: "/img/brands/my-father.png"
  },
  {
    slug: "oliva",
    name: "Oliva",
    meta: "Nicaragua",
    icon: "/img/brands/oliva.png"
  },
  {
    slug: "romeo-y-julieta",
    name: "Romeo y Julieta",
    meta: "Dominican Republic",
    icon: "/img/brands/romeo-y-julieta.png"
  },
  {
    slug: "montecristo",
    name: "Montecristo",
    meta: "Dominican Republic",
    icon: "/img/brands/montecristo.png"
  },
  {
    slug: "perdomo",
    name: "Perdomo",
    meta: "Nicaragua",
    icon: "/img/brands/perdomo.png"
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
          onerror="this.onerror=null;this.src='/img/brands/default-brand.png';"
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
