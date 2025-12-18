// /pos/cigars/cigars.js

document.addEventListener("DOMContentLoaded", () => {
  // Back button: go to main POS page
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/pos/";
    });
  }

  // Ensure filter modal is hidden on initial load
  const filterModal = document.getElementById("filter-modal");
  if (filterModal) {
    filterModal.classList.add("filter-modal--hidden");
  }
});
