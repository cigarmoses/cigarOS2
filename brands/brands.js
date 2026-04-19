(() => {
  "use strict";

  const listEl = document.querySelector("#shList");
  const searchInput = document.querySelector("#shQuery");

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
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeBrandsPayload(data) {
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === "string") {
            const name = clean(item);
            if (!name) return null;
            return { name, slug: slugKey(name) };
          }

          if (item && typeof item === "object") {
            const name = clean(item.name || item.brand || item.title || item.label || item.slug);
            if (!name) return null;
            return {
              ...item,
              name,
              slug: clean(item.slug) || slugKey(name),
            };
          }

          return null;
        })
        .filter(Boolean);
    }

    if (data && typeof data === "object") {
      const possible =
        data.brands ||
        data.items ||
        data.data ||
        data.results ||
        [];

      return normalizeBrandsPayload(possible);
    }

    return [];
  }

  function getBrandName(item) {
    return clean(item?.name || item?.brand || item?.title || item?.label || item);
  }

  function getBrandSlug(item) {
    return slugKey(item?.slug || item?.name || item?.brand || item?.title || item);
  }

  function brandHref(item) {
    const slug = getBrandSlug(item);
    const name = getBrandName(item);
    return `/pos/cigars/brand?brand=${encodeURIComponent(slug || name)}`;
  }

  function logoHtml(item) {
    const name = getBrandName(item);
    const key = getBrandSlug(item);
    const svg = `/img/icons/brands/${key}.svg`;
    const png = `/img/icons/brands/${key}.png`;

    return `
      <img
        class="sh-item-logo"
        src="${svg}"
        alt="${escapeHtml(name)}"
        loading="lazy"
        onerror="
          if (!this.dataset.fallbackStep) {
            this.dataset.fallbackStep='png';
            this.src='${png}';
          } else {
            this.onerror=null;
            this.style.visibility='hidden';
          }
        "
      />
    `;
  }

  function render(list, q) {
    if (!listEl) return;

    const query = slugKey(q);
    listEl.innerHTML = "";

    const filtered = list.filter((item) => {
      const name = slugKey(getBrandName(item));
      return !query || name.includes(query);
    });

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="sh-item">
          <div class="sh-item-main">
            <div class="sh-item-copy">
              <div class="sh-item-name">No brands found</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    filtered.forEach((item) => {
      const name = getBrandName(item);

      const row = document.createElement("a");
      row.className = "sh-item";
      row.href = brandHref(item);

      row.innerHTML = `
        <div class="sh-item-main">
          ${logoHtml(item)}
          <div class="sh-item-copy">
            <div class="sh-item-name">${escapeHtml(name)}</div>
          </div>
        </div>
      `;

      listEl.appendChild(row);
    });
  }

  async function init() {
    try {
      const res = await fetch(`/data/brands.json?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!res.ok) {
        throw new Error(`Failed to load brands.json: ${res.status}`);
      }

      const data = await res.json();
      const brands = normalizeBrandsPayload(data);

      render(brands, "");

      searchInput?.addEventListener("input", () => {
        render(brands, searchInput.value);
      });
    } catch (err) {
      console.error("[brands.js] init failed:", err);

      if (listEl) {
        listEl.innerHTML = `
          <div class="sh-item">
            <div class="sh-item-main">
              <div class="sh-item-copy">
                <div class="sh-item-name">Error loading brands</div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  init();
})();
