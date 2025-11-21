// /pos/pos.js
// Handles opening and closing the invoice popup
// from the universal red receipt pill.

document.addEventListener("DOMContentLoaded", () => {
  const pill = document.getElementById("open-receipt");
  const popup = document.getElementById("invoice-popup");
  const closeBtn = document.getElementById("close-receipt");

  if (pill && popup) {
    pill.addEventListener("click", () => {
      popup.classList.add("open");
    });
  }

  if (closeBtn && popup) {
    closeBtn.addEventListener("click", () => {
      popup.classList.remove("open");
    });
  }

  // Optional: clicking the outer grey area closes the popup
  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        popup.classList.remove("open");
      }
    });
  }
});
