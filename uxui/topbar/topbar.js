(function () {
  const root = document.documentElement;

  function getTheme() {
    return localStorage.getItem("theme") || root.getAttribute("data-theme") || "light";
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";

    // ✅ prevent unnecessary full repaint
    if (root.getAttribute("data-theme") !== next) {
      root.setAttribute("data-theme", next);
    }

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
    path.setAttribute("stroke-width", "2.6");
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
      else window.location.href = config.backHref || "/";
    });

    const spacer = document.createElement("div");
    spacer.className = "topbar-spacer";
    spacer.setAttribute("aria-hidden", "true");

    const right = document.createElement("div");
    right.className = "topbar-right";

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

    right.appendChild(toggle);

    bar.appendChild(backBtn);
    bar.appendChild(spacer);
    bar.appendChild(right);

    container.appendChild(bar);

    // ✅ DO NOT force repaint on mount
    // Only sync toggle state
    document.querySelectorAll(".topbar-toggle").forEach((t) => {
      t.setAttribute("aria-pressed", String(getTheme() === "dark"));
    });
  }

  function refresh() {
    applyTheme(getTheme());
  }

  // ✅ apply theme ONCE, safely, outside heavy render timing
  requestAnimationFrame(() => {
    applyTheme(getTheme());
  });

  window.openGlobalSearch = openGlobalSearch;
  window.CigarOSTopbar = { mount, refresh };
})();
