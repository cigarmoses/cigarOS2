(function () {
  const root = document.documentElement;

  function getTheme() {
    return localStorage.getItem("theme") || root.getAttribute("data-theme") || "light";
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);

    document.querySelectorAll(".topbar-toggle").forEach((toggle) => {
      toggle.setAttribute("aria-pressed", String(next === "dark"));
    });
  }

  function createIcon(svgPath) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", svgPath);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);
    return svg;
  }

  function ensureSearchModal() {
    let modal = document.getElementById("globalSearchModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "globalSearchModal";
    modal.innerHTML = `
      <div class="search-overlay">
        <div class="search-shell">
          <div class="search-box" role="dialog" aria-modal="true" aria-label="Master search">
            <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
            <input id="globalSearchInput" type="text" autocomplete="off" placeholder="Search cigars, products, customers..." />
            <button class="search-close" type="button" aria-label="Close search">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const overlay = modal.querySelector(".search-overlay");
    const shell = modal.querySelector(".search-box");
    const input = modal.querySelector("#globalSearchInput");
    const closeBtn = modal.querySelector(".search-close");

    function closeModal() {
      modal.style.display = "none";
    }

    overlay.addEventListener("click", (e) => {
      if (!shell.contains(e.target)) closeModal();
    });

    closeBtn.addEventListener("click", closeModal);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "Enter") {
        const q = (input.value || "").trim();
        if (!q) return;
        window.location.href = `/loyalty/?q=${encodeURIComponent(q)}`;
      }
    });

    return modal;
  }

  function openGlobalSearch() {
    const modal = ensureSearchModal();
    modal.style.display = "block";

    const input = modal.querySelector("#globalSearchInput");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 20);
    }
  }

  function makeButton(label, iconPath, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topbar-btn";
    btn.setAttribute("aria-label", label);
    btn.appendChild(createIcon(iconPath));
    btn.addEventListener("click", onClick);
    return btn;
  }

  function mount(selector, config = {}) {
    const container = document.querySelector(selector);
    if (!container) return;

    container.innerHTML = "";

    const bar = document.createElement("div");
    bar.className = "topbar";

    const backBtn = makeButton("Back", "M15 18L9 12L15 6", () => {
      if (history.length > 1) history.back();
      else window.location.href = "/";
    });

    const right = document.createElement("div");
    right.className = "topbar-right";

    const homeBtn = makeButton("Home", "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", () => {
      window.location.href = config.homeHref || "/";
    });

    const favBtn = makeButton("Favorites", "M12 21s-6.7-4.35-9.33-7.02C.7 12.02 1.1 8.5 4 7.1c1.9-.9 4.1-.3 5.3 1.2 1.2-1.5 3.4-2.1 5.3-1.2 2.9 1.4 3.3 4.92 1.33 6.88C18.7 16.65 12 21 12 21z", () => {
      window.location.href = config.favoritesHref || "/pos/favorites/";
    });

    const searchBtn = makeButton("Search", "M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21", (e) => {
      e.preventDefault();
      if (config.searchAction === "modal") {
        openGlobalSearch();
        return;
      }
      if (config.searchHref) {
        window.location.href = config.searchHref;
      }
    });

    const cartBtn = makeButton("Cart", "M7 6h14l-1.7 6.8a2 2 0 0 1-1.94 1.52H10.1a2 2 0 0 1-1.95-1.57L6.1 4.5H3", () => {
      window.location.href = config.cartHref || "/pos/invoice/";
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "topbar-toggle";
    toggle.setAttribute("aria-label", "Toggle theme");
    toggle.setAttribute("aria-pressed", "false");

    const knob = document.createElement("span");
    knob.className = "topbar-toggle-knob";
    toggle.appendChild(knob);

    toggle.addEventListener("click", () => {
      applyTheme(getTheme() === "dark" ? "light" : "dark");
    });

    right.appendChild(homeBtn);
    right.appendChild(favBtn);
    right.appendChild(searchBtn);
    right.appendChild(cartBtn);
    right.appendChild(toggle);

    bar.appendChild(backBtn);
    bar.appendChild(right);
    container.appendChild(bar);

    applyTheme(getTheme());
  }

  window.openGlobalSearch = openGlobalSearch;
  window.CigarOSTopbar = { mount };
})();
