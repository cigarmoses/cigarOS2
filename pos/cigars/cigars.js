(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  const listRoot = $("#cigarsList");
  const searchInput = $("#cigars-search-input");

  const CSV_URL =
    "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

  let DATA = [];

  // ---------- CSV PARSER ----------
  function parseCSV(text){
    const rows = text.trim().split("\n").map(r => r.split(","));
    const headers = rows.shift();

    return rows.map(r => {
      const obj = {};
      headers.forEach((h,i)=> obj[h.trim()] = r[i]?.trim());
      return obj;
    });
  }

  // ---------- LOAD ----------
  async function load(){
    try{
      const res = await fetch(CSV_URL);
      const text = await res.text();

      DATA = parseCSV(text);

      render(DATA);

    }catch(e){
      listRoot.innerHTML = `<div class="cigars-empty">Failed to load cigars</div>`;
      console.error(e);
    }
  }

  // ---------- RENDER ----------
  function render(list){
    listRoot.innerHTML = "";

    list.forEach(c => {
      const row = document.createElement("div");
      row.className = "brand-row";

      row.innerHTML = `
        <div class="brand-row-left">
          <div class="brand-row-title">${c.Name || c.name}</div>
          <div class="brand-row-sub">${c.Brand || c.brand}</div>
        </div>
        <div class="brand-row-right">
          <div class="brand-row-msrp">$${c.Price || c.price}</div>
        </div>
      `;

      listRoot.appendChild(row);
    });
  }

  // ---------- SEARCH ----------
  if(searchInput){
    searchInput.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();

      const filtered = DATA.filter(c =>
        (c.Name || "").toLowerCase().includes(q)
      );

      render(filtered);
    });
  }

  load();
})();
