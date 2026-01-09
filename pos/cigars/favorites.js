/* /pos/cigars/favorites.js
   Favorites shortcut page (hard-coded for now, easy to expand later)

   Behavior:
   - Brands are links to /pos/cigars/{brandSlug}
   - Cigars:
     - tap name -> opens brand page and auto-opens cigar modal via ?open=
     - plus button -> adds to invoice via [data-receipt-item] (cart.js listens for this)
*/

(function(){
  "use strict";

  // --- Hard-coded favorites (expand anytime) ---
  // NOTE: Replace icon paths with your real brand icon SVG/PNG paths
  const FAVORITE_BRANDS = [
    { name: "Padron", slug: "padron", icon: "/img/icons/brands/padron.svg" },
    { name: "Arturo Fuente", slug: "arturo-fuente", icon: "/img/icons/brands/arturofuente.svg" },
    { name: "Aladino", slug: "aladino", icon: "/img/icons/brands/aladino.svg" },
  ];

  const FAVORITE_CIGARS = [
    {
      name: "La Flor Dominicana Andalusian Bull",
      brand: "La Flor Dominicana",
      brandSlug: "la-flor-dominicana",
      brandIcon: "/img/icons/brands/laflordominicana.svg",
      price: 0,      // set your real price if you want it displayed
      vitola: ""      // optional subtitle (e.g., "Perfecto")
    },
    {
      name: "Padron 60th Anniversary Perfecto",
      brand: "Padron",
      brandSlug: "padron",
      brandIcon: "/img/icons/brands/padron.svg",
      price: 0,
      vitola: "Perfecto"
    }
  ];

  function $(id){ return document.getElementById(id); }

  function brandHref(slug){
    // Works for both /pos/cigars/padron and /pos/cigars/padron.html patterns (Netlify tolerant)
    return `/pos/cigars/${slug}`;
  }

  function openCigarHref(brandSlug, cigarName){
    // Deep link: brand page reads ?open= and auto-clicks that cigar row (patch below)
    const qs = new URLSearchParams({ open: cigarName });
    return `${brandHref(brandSlug)}?${qs.toString()}`;
  }

  function money(n){
    if (!n || Number(n) === 0) return ""; // don’t show 0.00 unless you want to
    return Number(n).toFixed(2);
  }

  function renderBrands(){
    const grid = $("favBrandsGrid");
    if (!grid) return;

    grid.innerHTML = FAVORITE_BRANDS.map(b => `
      <a class="brand-card" href="${brandHref(b.slug)}" aria-label="${b.name}">
        <div class="brand-icon">
          <img src="${b.icon}" alt="${b.name}">
        </div>
        <div class="brand-name">${b.name}</div>
      </a>
    `).join("");
  }

  function renderCigars(){
    const list = $("favCigarsList");
    if (!list) return;

    list.innerHTML = FAVORITE_CIGARS.map(c => {
      const priceText = money(c.price);

      // data-receipt-item format: keep it SIMPLE for your cart.js interceptor
      // If your cart expects different keys, tell me and I’ll align it.
      const receiptPayload = {
        name: c.name,
        price: Number(c.price || 0),
        category: "Cigars",
        brand: c.brand
      };

      return `
        <div class="fav-row">
          <div class="fav-brand-badge">
            <img src="${c.brandIcon}" alt="${c.brand}">
          </div>

          <div class="fav-mid">
            <div class="fav-name"
                 role="button"
                 tabindex="0"
                 onclick="location.href='${openCigarHref(c.brandSlug, c.name)}'">
              ${c.name}
            </div>
            <div class="fav-sub">${c.vitola ? c.vitola : c.brand}</div>
          </div>

          <div class="fav-right">
            <div class="fav-price">${priceText}</div>
            <button class="fav-add"
                    type="button"
                    aria-label="Add"
                    data-receipt-item='${JSON.stringify(receiptPayload)}'>
              +
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  renderBrands();
  renderCigars();
})();
