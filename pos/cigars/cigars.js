// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  // Back button -> POS home
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // Disable POS filter modal system on this page (Dec 10 behavior)
  window.POS_FILTERS_DISABLED = true;
});
