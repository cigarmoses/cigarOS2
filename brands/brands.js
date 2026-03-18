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
    <main class="brands-page">

      <div class="brands-header">
        <h1>Brands</h1>

        <div class="search-bar">
          <input type="text" placeholder="Search brands" id="brandSearch">
        </div>
      </div>

      <div class="brands-grid" id="brandsGrid">
        ${BRANDS.map(renderBrandCard).join("")}
      </div>

    </main>
  `;

  bindSearch();
}

function renderBrandCard(brand) {
  return `
    <a class="brand-card" href="/brands/detail.html?brand=${brand.slug}">
      <img src="${brand.icon}" class="brand-icon">
      <div class="brand-name">${brand.name}</div>
    </a>
  `;
}

function bindSearch() {
  const input = document.getElementById("brandSearch");
  const grid = document.getElementById("brandsGrid");

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();

    grid.innerHTML = BRANDS
      .filter(b => b.name.toLowerCase().includes(q))
      .map(renderBrandCard)
      .join("");
  });
}

renderBrandsPage();
