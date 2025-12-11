// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  // Back button: go to main POS page
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // (Filter modal + other page-specific wiring can be added here later if needed)
});
