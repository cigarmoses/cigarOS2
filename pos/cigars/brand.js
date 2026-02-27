document.addEventListener("DOMContentLoaded", () => {

  const brandList = document.getElementById("brand-list");

  /* =============================
     FIX CIGAR CLICK ROUTING
     ============================= */

  brandList.addEventListener("click", (e) => {
    const row = e.target.closest(".cigar-row");
    if (!row) return;

    const id = row.dataset.id;
    const brand = new URLSearchParams(window.location.search).get("brand");

    window.location.href = `/pos/cigars/cigar.html?brand=${brand}&id=${id}`;
  });

  /* =============================
     FILTERS SHEET
     ============================= */

  const filterTabs = document.querySelectorAll(".filter-tab");
  const filterOptions = document.getElementById("filter-options");

  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderFilterOptions(tab.dataset.tab);
    });
  });

  function renderFilterOptions(type) {
    filterOptions.innerHTML = "";

    const options = getOptionsForType(type); // your existing data source

    options.forEach(opt => {
      const div = document.createElement("div");
      div.className = "filter-option";
      div.innerHTML = `
        <input type="checkbox" value="${opt}">
        <span>${opt}</span>
      `;
      filterOptions.appendChild(div);
    });
  }

  /* =============================
     BANDS SHEET
     ============================= */

  const bandsContainer = document.getElementById("bands-options");

  function renderBands(bands) {
    bandsContainer.innerHTML = "";

    bands.forEach(b => {
      const card = document.createElement("div");
      card.className = "band-card";

      card.innerHTML = `
        <img src="${b.image}" alt="">
        <div class="band-footer">
          <span>${b.name}</span>
          <input type="checkbox" value="${b.name}">
        </div>
      `;

      bandsContainer.appendChild(card);
    });
  }

});
