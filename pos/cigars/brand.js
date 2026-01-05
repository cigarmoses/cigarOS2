// --- Filters modal (open/close) ---
const filtersModal = document.querySelector("#filters-modal");
const filtersOpenBtn = document.querySelector("#filters-open");
const filtersCloseBtn = document.querySelector("#filters-close");
const filtersApplyBtn = document.querySelector("#filters-apply");

function openFiltersModal() {
  if (!filtersModal) return;

  // show modal
  filtersModal.classList.add("is-open");
  filtersModal.setAttribute("aria-hidden", "false");

  // lock background + hide receipt icon while modal is open
  document.body.classList.add("modal-open");

  // prevent background scroll on iOS
  document.documentElement.classList.add("modal-open");
}

function closeFiltersModal() {
  if (!filtersModal) return;

  filtersModal.classList.remove("is-open");
  filtersModal.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");
}

// open
if (filtersOpenBtn) {
  filtersOpenBtn.addEventListener("click", openFiltersModal);
}

// close (X)
if (filtersCloseBtn) {
  filtersCloseBtn.addEventListener("click", closeFiltersModal);
}

// apply
if (filtersApplyBtn) {
  filtersApplyBtn.addEventListener("click", () => {
    // keep your existing apply logic ABOVE this line if needed
    closeFiltersModal();
  });
}

// tap outside sheet closes
if (filtersModal) {
  filtersModal.addEventListener("click", (e) => {
    if (e.target === filtersModal) closeFiltersModal();
  });
}
