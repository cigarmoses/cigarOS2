(function () {
  function initSegmented(root = document) {
    const segmentedGroups = root.querySelectorAll("[data-segmented]");
    segmentedGroups.forEach(group => {
      const buttons = group.querySelectorAll("[data-segment-btn]");
      const panels = document.querySelectorAll(`[data-segment-panel="${group.dataset.segmented}"]`);

      buttons.forEach(button => {
        button.addEventListener("click", () => {
          const value = button.dataset.segmentBtn;

          buttons.forEach(btn => btn.classList.remove("active"));
          button.classList.add("active");

          panels.forEach(panel => {
            panel.classList.toggle("active", panel.dataset.segmentValue === value);
          });
        });
      });
    });
  }

  function initModalTriggers(root = document) {
    const openers = root.querySelectorAll("[data-open-modal]");
    const closers = root.querySelectorAll("[data-close-modal]");

    openers.forEach(opener => {
      opener.addEventListener("click", () => {
        const id = opener.dataset.openModal;
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("is-open");
        document.body.classList.add("modal-open");
      });
    });

    closers.forEach(closer => {
      closer.addEventListener("click", () => {
        const modal = closer.closest(".modal");
        if (!modal) return;
        modal.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".modal.is-open").forEach(modal => modal.classList.remove("is-open"));
      document.body.classList.remove("modal-open");
    });
  }

  function initTapFeedback(root = document) {
    root.querySelectorAll("a, button, .icon-tile, .glass-pill, .segment-btn").forEach(el => {
      if (!el.classList.contains("tap-scale")) {
        el.classList.add("tap-scale");
      }
    });
  }

  function boot(root = document) {
    initSegmented(root);
    initModalTriggers(root);
    initTapFeedback(root);
  }

  window.IOS26UI = {
    boot,
    initSegmented,
    initModalTriggers,
    initTapFeedback
  };

  document.addEventListener("DOMContentLoaded", () => boot(document));
})();
