document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     BACK ARROW (POS BEHAVIOR)
     ========================= */

  const backBtn = document.querySelector(".learn-back");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    });
  }

  /* =========================
     LEARN TILE NAVIGATION
     ========================= */

  const tiles = document.querySelectorAll(".learn-tile");

  tiles.forEach((tile) => {
    tile.addEventListener("click", () => {
      const target = tile.getAttribute("data-target");

      if (target) {
        window.location.href = target;
      }
    });
  });

  /* =========================
     OPTIONAL: iOS TAP FEEDBACK
     ========================= */

  tiles.forEach((tile) => {
    tile.addEventListener("touchstart", () => {
      tile.style.transform = "scale(0.97)";
    });

    tile.addEventListener("touchend", () => {
      tile.style.transform = "scale(1)";
    });

    tile.addEventListener("touchcancel", () => {
      tile.style.transform = "scale(1)";
    });
  });

});
