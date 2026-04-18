// /brands/brands.js (FULL UPDATED — uses /data/brands.json)

(() => {
  "use strict";

  const app = document.getElementById("app");

  function clean(v) {
    return String(v ?? "").trim();
  }

  function slugKey(v) {
    return clean(v)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getIconPaths(name) {
    const key = slugKey(name);
    return {
      svg: `/img/icons/brands/${key}.svg`,
      png: `/img/icons/brands/${key}.png`
    };
  }

  function renderBrandCard(name) {
    const { svg, png } = getIconPaths(name);

    return `
      <a class="brand-card" href="/pos/cigars/brand?brand=${encodeURIComponent(name)}" aria-label="${escapeHtml(name)}">
        <div class="brand-icon-wrap">
          <img
            class="brand-icon"
            src="${svg}"
            alt="${escapeHtml(name)} logo"
            loading="lazy"
            onerror="this.onerror=null;this.src='${png}'"
          >
        </div>

        <h2 class="brand-name">${escapeHtml(name)}</h2>
      </a>
    `;
  }

  function renderBrandsPage(brands) {
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
            ${brands.map(renderBrandCard).join("")}
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

    bindSearch(brands);
  }

  function bindSearch(brands) {
    const input = document.getElementById("brandSearch");
    const grid = document.getElementById("brandsGrid");

    input?.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();

      const filtered = brands.filter(name =>
        name.toLowerCase().includes(q)
      );

      grid.innerHTML = filtered.map(renderBrandCard).join("");
    });
  }

  async function init() {
    try {
      const res = await fetch(`/data/brands.json?v=${Date.now()}`);
      const data = await res.json();

      const brands = data
        .map(b => clean(b.name || b))
        .filter(Boolean);

      renderBrandsPage(brands);

    } catch (err) {
      console.error("Brands load failed:", err);
      app.innerHTML = `<div style="padding:20px;">Error loading brands.</div>`;
    }
  }

  init();
})();
