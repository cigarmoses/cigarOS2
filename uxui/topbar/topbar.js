(function () {
  const root = document.documentElement;

  function getTheme() {
    return localStorage.getItem("theme") || root.getAttribute("data-theme") || "light";
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);

    const toggle = document.querySelector(".topbar-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(next === "dark"));
    }
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

  function openGlobalSearch() {
    let modal = document.getElementById("globalSearchModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "globalSearchModal";

      modal.innerHTML = `
        <div class="search-overlay">
          <div class="search-box">
            <input type="text" placeholder="Search cigars, products, customers..." autofocus />
          </div>
        </div>
      `;

      modal.style.position = "fixed";
      modal.style.inset = "0";
      modal.style.background = "rgba(0,0,0,.4)";
      modal.style.zIndex = "9999";

      document.body.appendChild(modal);

      modal.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    modal.style.display = "block";
  }

  function mount(selector, config = {}) {
    const container = document.querySelector(selector);
    if (!container) return;

    container.innerHTML = "";

    const bar = document.createElement("div");
    bar.className = "topbar";

    // LEFT (BACK)
    const backBtn = document.createElement("button");
    backBtn.className = "topbar-btn";
    backBtn.setAttribute("aria-label", "Back");

    backBtn.appendChild(
      createIcon("M15 18L9 12L15 6")
    );

    backBtn.onclick = () => {
      if (history.length > 1) history.back();
      else window.location.href = "/";
    };

    // RIGHT CONTAINER
    const right = document.createElement("div");
    right.className = "topbar-right";

    // HOME
    const homeBtn = document.createElement("button");
    homeBtn.className = "topbar-btn";
    homeBtn.setAttribute("aria-label", "Home");
    homeBtn.appendChild(
      createIcon("M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z")
    );
    homeBtn.onclick = () => {
      window.location.href = config.homeHref || "/";
    };

    // FAVORITES
    const favBtn = document.createElement("button");
    favBtn.className = "topbar-btn";
    favBtn.setAttribute("aria-label", "Favorites");
    favBtn.appendChild(
      createIcon("M12 21s-6.7-4.35-9.33-7.02C.7 12.02 1.1 8.5 4 7.1c1.9-.9 4.1-.3 5.3 1.2 1.2-1.5 3.4-2.1 5.3-1.2 2.9 1.4 3.3 4.92 1.33 6.88C18.7 16.65 12 21 12 21z")
    );
    favBtn.onclick = () => {
      window.location.href = config.favoritesHref || "/pos/favorites/";
    };

    // SEARCH (MODAL ONLY)
    const searchBtn = document.createElement("button");
    searchBtn.className = "topbar-btn";
    searchBtn.setAttribute("aria-label", "Search");
    searchBtn.appendChild(
      createIcon("M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21")
    );

    searchBtn.onclick = (e) => {
      e.preventDefault();

      if (config.searchAction === "modal") {
        openGlobalSearch();
        return;
      }

      if (config.searchHref) {
        window.location.href = config.searchHref;
      }
    };

    // CART
    const cartBtn = document.createElement("button");
    cartBtn.className = "topbar-btn";
    cartBtn.setAttribute("aria-label", "Cart");
    cartBtn.appendChild(
      createIcon("M7 6h14l-1.7 6.8a2 2 0 0 1-1.94 1.52H10.1a2 2 0 0 1-1.95-1.57L6.1 4.5H3")
    );
    cartBtn.onclick = () => {
      window.location.href = config.cartHref || "/pos/invoice/";
    };

    // THEME TOGGLE
    const toggle = document.createElement("button");
    toggle.className = "topbar-toggle";
    toggle.setAttribute("aria-label", "Toggle theme");

    const knob = document.createElement("span");
    knob.className = "topbar-toggle-knob";

    toggle.appendChild(knob);

    toggle.onclick = () => {
      applyTheme(getTheme() === "dark" ? "light" : "dark");
    };

    // BUILD
    right.appendChild(homeBtn);
    right.appendChild(favBtn);
    right.appendChild(searchBtn);
    right.appendChild(cartBtn);
    right.appendChild(toggle);

    bar.appendChild(backBtn);
    bar.appendChild(right);

    container.appendChild(bar);

    // INIT THEME
    applyTheme(getTheme());
  }

  window.CigarOSTopbar = { mount };
})();
