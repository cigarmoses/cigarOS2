// /pos/cigars/cigars.js
document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // HARD DISABLE filters on cigars page (Dec 10 behavior)
  window.POS_FILTERS_DISABLED = true;
});
