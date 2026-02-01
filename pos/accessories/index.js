// /pos/accessories/index.js
(() => {
  const grid = document.getElementById("posGrid");
  const search = document.getElementById("posSearch");

  // DEMO DATA (replace with your real data feed)
  const ITEMS = [
    {
      id: "acc-stdupont-lighter",
      category: "Accessories",
      brand: "St Dupont",
      name: "St Dupont lighter",
      unit: 49.99,
      img: "/img/pos/accessories/stdupont.png"
    }
  ];

  function card(item){
    const payload = {
      id: item.id,
      type: "other",
      category: item.category,
      brand: item.brand,
      name: item.name,
      unit: item.unit,
      img: item.img
    };

    return `
      <article class="pos-card">
        <img class="pos-img" src="${item.img}" alt="" />
        <div class="pos-name">${item.name}</div>
        <div class="pos-price">$${item.unit.toFixed(2)}</div>

        <!-- ADD BUTTON: cart.js listens for this -->
        <button class="pos-add" type="button"
          data-receipt-item='${JSON.stringify(payload)}'
          aria-label="Add to invoice">+</button>
      </article>
    `;
  }

  function render(){
    const q = (search?.value || "").trim().toLowerCase();
    const list = !q ? ITEMS : ITEMS.filter(x =>
      (x.name + " " + x.brand + " " + x.category).toLowerCase().includes(q)
    );
    grid.innerHTML = list.map(card).join("");
  }

  search?.addEventListener("input", render);
  render();
})();
