const listEl = document.querySelector("#shList");
const searchInput = document.querySelector("#shQuery");

const DEFAULT_SHOP_ICON = "/uxui/darkmode/darkmodeshops.png";

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
  return String(v ?? "").replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function shopDetailHref(shop) {
  const key = slugKey(shop.slug || shop.name);
  return `/shops/shop-page.html?shop=${encodeURIComponent(key)}`;
}

function logoHtml(key, name) {
  const safeKey = encodeURIComponent(key);
  const safeName = escapeHtml(name);
  const fallback = DEFAULT_SHOP_ICON;
  const svg = `/img/icons/shops/${safeKey}.svg`;
  const png = `/img/icons/shops/${safeKey}.png`;

  return `
    <img
      class="sh-item-logo"
      src="${svg}"
      alt="${safeName}"
      loading="lazy"
      onerror="
        if (!this.dataset.fallbackStep) {
          this.dataset.fallbackStep='png';
          this.src='${png}';
        } else if (this.dataset.fallbackStep==='png') {
          this.dataset.fallbackStep='default';
          this.src='${fallback}';
        } else {
          this.onerror=null;
          this.src='${fallback}';
        }
      "
    />
  `;
}

function render(list, q) {
  const query = slugKey(q);

  listEl.innerHTML = "";

  const filtered = list.filter((shop) => {
    const n = slugKey(shop.name);
    const c = slugKey(shop.city);
    const s = slugKey(shop.state);
    return !query || n.includes(query) || c.includes(query) || s.includes(query);
  });

  filtered.forEach((shop) => {
    const key = slugKey(shop.slug || shop.name);
    const row = document.createElement("a");

    row.className = "sh-item";
    row.href = shopDetailHref(shop);

    row.innerHTML = `
      <div class="sh-item-main">
        ${logoHtml(key, shop.name)}
        <div>
          <div class="sh-item-name">${escapeHtml(shop.name)}</div>
          <div class="sh-item-sub">${escapeHtml(shop.city)}, ${escapeHtml(shop.state)}</div>
        </div>
      </div>
    `;

    listEl.appendChild(row);
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "sh-item";
    empty.innerHTML = `
      <div class="sh-item-main">
        <img
          class="sh-item-logo"
          src="${DEFAULT_SHOP_ICON}"
          alt="Default shop icon"
        />
        <div>
          <div class="sh-item-name">No shops found</div>
          <div class="sh-item-sub">Try a different search</div>
        </div>
      </div>
    `;
    listEl.appendChild(empty);
  }
}

async function init() {
  try {
    const res = await fetch(`/shops/shops.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load shops.json: ${res.status}`);

    const data = await res.json();
    render(Array.isArray(data) ? data : [], "");

    searchInput?.addEventListener("input", () => {
      render(Array.isArray(data) ? data : [], searchInput.value);
    });
  } catch (err) {
    console.error("[shop-search.js] init failed:", err);

    listEl.innerHTML = `
      <div class="sh-item">
        <div class="sh-item-main">
          <img
            class="sh-item-logo"
            src="${DEFAULT_SHOP_ICON}"
            alt="Default shop icon"
          />
          <div>
            <div class="sh-item-name">Unable to load shops</div>
            <div class="sh-item-sub">Please try again</div>
          </div>
        </div>
      </div>
    `;
  }
}

init();
