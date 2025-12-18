// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // Force filter modal hidden on load (prevents the “Brands” sheet showing randomly)
  const filterModal = document.getElementById("filter-modal");
  if (filterModal) {
    filterModal.classList.add("filter-modal--hidden");
  }
});
