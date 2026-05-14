/* /profile/profile.js */

(() => {
  "use strict";

  const idCard = document.querySelector(".id-card");

  if (idCard) {
    idCard.addEventListener("click", () => {
      window.location.href = "/profile/my-card/";
    });
  }

  const rows = document.querySelectorAll(".profile-row, .favorite-card, .id-card");

  rows.forEach((row) => {
    row.addEventListener("pointerdown", () => {
      row.style.filter = "brightness(.985)";
    });

    row.addEventListener("pointerup", () => {
      row.style.filter = "";
    });

    row.addEventListener("pointercancel", () => {
      row.style.filter = "";
    });

    row.addEventListener("pointerleave", () => {
      row.style.filter = "";
    });
  });
})();
