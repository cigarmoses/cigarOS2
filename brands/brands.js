const BRANDS = [
  { slug: "padron", name: "Padron", icon: "/img/icons/brands/padron.svg" },
  { slug: "arturofuente", name: "Arturo Fuente", icon: "/img/icons/brands/arturofuente.svg" },
  { slug: "davidoff", name: "Davidoff", icon: "/img/icons/brands/davidoff.svg" },
  { slug: "myfather", name: "My Father", icon: "/img/icons/brands/myfather.svg" },
  { slug: "oliva", name: "Oliva", icon: "/img/icons/brands/oliva.svg" },
  { slug: "romeoyjulieta", name: "Romeo y Julieta", icon: "/img/icons/brands/romeoyjulieta.svg" },
  { slug: "montecristo", name: "Montecristo", icon: "/img/icons/brands/montecristo.svg" },
  { slug: "perdomo", name: "Perdomo", icon: "/img/icons/brands/perdomo.svg" }
];

function renderBrandsPage() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <main class="page">
      <section class="hero-card">
        <button class="glass-pill back-pill universal-back" type="button" id="brandsBackBtn" aria-label="Go back">
          <span class="back-chevron">‹</span>
        </button>

        <div class="hero-inner">
          <h1 class="page-title">Brands</h1>

          <div class="search-bar" style="max-width:560px;margin:18px auto 0;">
            <input type="text" placeholder="Search brands" id="brandSearch">
          </div>
        </div>
      </section>

      <section class="grid-shell">
        <div class="brands-grid" id="brandsGrid">
          ${BRANDS.map(renderBrandCard).join("")}
        </div>
      </section>
    </main>
  `;

  document.getElementById("brandsBackBtn")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  });

  bindSearch();
}

function renderBrandCard(brand) {
  return `
    <a class="brand-card" href="/brands/detail.html?brand=${brand.slug}" aria-label="${escapeHtml(brand.name)}">
      <div class="brand-icon-wrap">
        <img
          class="brand-icon"
          src="${brand.icon}"
          alt="${escapeHtml(brand.name)} logo"
          loading="lazy"
        >
      </div>

      <h2 class="brand-name">${escapeHtml(brand.name)}</h2>
    </a>
  `;
}

function bindSearch() {
  const input = document.getElementById("brandSearch");
  const grid = document.getElementById("brandsGrid");

  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    const filtered = BRANDS.filter(brand =>
      brand.name.toLowerCase().includes(q)
    );

    grid.innerHTML = filtered.map(renderBrandCard).join("");
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

renderBrandsPage();
