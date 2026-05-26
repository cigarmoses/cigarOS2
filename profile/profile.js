(() => {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");

  const idCard = document.getElementById("cigarosIdCard");
  const idExpandBtn = document.getElementById("idExpandBtn");
  const idExpandedPanel = document.getElementById("idExpandedPanel");

  const STORAGE_KEY = "cigaros-theme";
  const ID_CARD_STORAGE_KEY = "cigaros-profile-id-card-expanded";

  function applyTheme(theme){

    root.setAttribute("data-theme", theme);

    localStorage.setItem(STORAGE_KEY, theme);

    if (icon) {

      icon.src =
        theme === "dark"
          ? "/img/icons/moon.svg"
          : "/img/icons/sun.svg";
    }
  }

  function setIdCardExpanded(isExpanded){

    if (!idCard || !idExpandBtn || !idExpandedPanel) return;

    idCard.classList.toggle("is-expanded", isExpanded);

    idExpandBtn.textContent = isExpanded ? "CARD −" : "CARD +";

    idExpandBtn.setAttribute("aria-expanded", String(isExpanded));

    idExpandedPanel.setAttribute("aria-hidden", String(!isExpanded));

    localStorage.setItem(
      ID_CARD_STORAGE_KEY,
      isExpanded ? "true" : "false"
    );
  }

  applyTheme(
    localStorage.getItem(STORAGE_KEY) || "dark"
  );

  toggle?.addEventListener("click", () => {

    const current =
      root.getAttribute("data-theme") || "dark";

    applyTheme(
      current === "dark"
        ? "light"
        : "dark"
    );
  });

  setIdCardExpanded(
    localStorage.getItem(ID_CARD_STORAGE_KEY) === "true"
  );

  idExpandBtn?.addEventListener("click", () => {

    const isExpanded =
      idCard?.classList.contains("is-expanded") || false;

    setIdCardExpanded(!isExpanded);
  });

})();
