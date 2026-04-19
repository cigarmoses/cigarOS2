(() => {
  "use strict";

  const listEl = document.querySelector("#shList");
  const searchInput = document.querySelector("#shQuery");
  const stateSelect = document.querySelector("#shState");
  const taaToggle = document.querySelector("#shTaaToggle");

  const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";
  const TAA_ICON = "/img/icons/taa.svg";

  const state = {
    shops: [],
    query: "",
    selectedState: "",
    taaOnly: false,
  };

  function clean(v) {
    return String(v ?? "").trim();
  }

  function slugKey(v) {
    return clean(v)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function isTruthy(v) {
    if (v === true) return true;
    const s = clean(v).toLowerCase();
    return ["1", "true", "yes", "y", "x"].includes(s);
  }

  function getName(shop) {
    return clean(shop.name || shop.shop || shop.Shop);
  }

  function getCity(shop) {
    return clean(shop.city || shop.City);
  }

  function getState(shop) {
    return clean(shop.state || shop.State || shop.ST);
  }

  function getSlug(shop) {
    return slugKey(shop.slug || shop.logoKey || getName(shop));
  }

  function getTaa(shop) {
    return (
      isTruthy(shop.taa) ||
      isTruthy(shop.TAA) ||
      isTruthy(shop?.features?.taa) ||
      isTruthy(shop?.amenities?.taa)
    );
  }

  function shopHref(shop) {
    const key = getSlug(shop);
    return `/shops/shop-page.html?shop=${encodeURIComponent(key)}`;
  }

  function logoHtml(shop) {
    const key = getSlug(shop);
    const name = getName(shop);
    const svg = `/img/icons/shops/${key}.svg`;
    const png = `/img/icons/shops/${key}.png`;

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
          } else if (this.dataset.fallbackStep==='png') {
            this.dataset.fallbackStep='default';
            this.src='${DEFAULT_SHOP_ICON}';
          } else {
            this.onerror=null;
            this.src='${DEFAULT_SHOP_ICON}';
          }
        "
      />
    `;
  }

  function taaHtml(shop) {
    if (!getTaa(shop)) return "";
    return `
      <div class="sh-item-meta">
        <img class="sh-item-taa" src="${TAA_ICON}" alt="TAA shop" loading="lazy">
      </div>
    `;
  }

  function populateStates(shops) {
    if (!stateSelect) return;

    const states = Array.from(new Set(
      shops.map(getState).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    stateSelect.innerHTML = `
      <option value="">All States</option>
      ${states.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
    `;

    stateSelect.value = state.selectedState;
  }

  function getFilteredShops() {
    return state.shops.filter((shop) => {
      const q = slugKey(state.query);
      const name = slugKey(getName(shop));
      const city = slugKey(getCity(shop));
      const shopState = clean(getState(shop));

      if (q && !name.includes(q) && !city.includes(q)) return false;
      if (state.selectedState && shopState !== state.selectedState) return false;
      if (state.taaOnly && !getTaa(shop)) return false;

      return true;
    });
  }

  function render() {
    if (!listEl) return;

    const filtered = getFilteredShops();
    listEl.innerHTML = "";

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="sh-item">
          <div class="sh-item-main">
            <img class="sh-item-logo" src="${DEFAULT_SHOP_ICON}" alt="Default shop icon" />
            <div class="sh-item-copy">
              <div class="sh-item-name">No shops found</div>
              <div class="sh-item-sub">Try a different search or filter</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    filtered.forEach((shop) => {
      const row = document.createElement("a");
      row.className = "sh-item";
      row.href = shopHref(shop);

      const cityState = [getCity(shop), getState(shop)].filter(Boolean).join(", ");

      row.innerHTML = `
        <div class="sh-item-main">
          ${logoHtml(shop)}
          <div class="sh-item-copy">
            <div class="sh-item-name">${escapeHtml(getName(shop))}</div>
            <div class="sh-item-sub">${escapeHtml(cityState || "—")}</div>
          </div>
        </div>
        ${taaHtml(shop)}
      `;

      listEl.appendChild(row);
    });
  }

  async function init() {
    try {
      const res = await fetch(`/shops/shops.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load shops.json: ${res.status}`);

      const data = await res.json();
      state.shops = Array.isArray(data) ? data : [];

      populateStates(state.shops);
      render();

      searchInput?.addEventListener("input", () => {
        state.query = searchInput.value || "";
        render();
      });

      stateSelect?.addEventListener("change", () => {
        state.selectedState = stateSelect.value || "";
        render();
      });

      taaToggle?.addEventListener("click", () => {
        state.taaOnly = !state.taaOnly;
        taaToggle.setAttribute("aria-checked", String(state.taaOnly));
        render();
      });
    } catch (err) {
      console.error("[shop-search.js] init failed:", err);
      if (listEl) {
        listEl.innerHTML = `
          <div class="sh-item">
            <div class="sh-item-main">
              <img class="sh-item-logo" src="${DEFAULT_SHOP_ICON}" alt="Default shop icon" />
              <div class="sh-item-copy">
                <div class="sh-item-name">Error loading shops</div>
                <div class="sh-item-sub">Please try again</div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  init();
})();
