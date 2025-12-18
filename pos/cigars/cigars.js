/* /pos/cigars/cigars.js
   Small page wiring (back button + filter expand/collapse).
   NOTE: build-cigars.js handles the Google Sheets brand grid build.
*/

document.addEventListener("DOMContentLoaded", () => {
  // Back
  const backBtn = document.getElementById("cigars-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/pos/";
    });
  }

  // “View all” expands inline advanced filters (not the options modal)
  const viewAllBtn = document.getElementById("filters-view-all");
  const advanced = document.getElementById("filters-advanced");

  if (viewAllBtn && advanced) {
    const setExpanded = (expanded) => {
      if (expanded) {
        advanced.hidden = false;
        viewAllBtn.textContent = "hide";
        viewAllBtn.setAttribute("aria-expanded", "true");
      } else {
        advanced.hidden = true;
        viewAllBtn.textContent = "view all";
        viewAllBtn.setAttribute("aria-expanded", "false");
      }
    };

    // default collapsed
    setExpanded(false);

    viewAllBtn.addEventListener("click", () => {
      const isExpanded = viewAllBtn.getAttribute("aria-expanded") === "true";
      setExpanded(!isExpanded);
    });
  }
});
