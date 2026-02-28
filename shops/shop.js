(() => {
  const $ = (sel) => document.querySelector(sel);

  function isTruthy(v) {
    if (!v) return false;
    return ["1","true","yes","y","x"].includes(String(v).toLowerCase());
  }

  function renderAmenities(shop) {
    const row = $("#spAmenRow");
    row.innerHTML = "";

    const items = [
      { ok: isTruthy(shop.Indoor), icon: "/img/icons/indoorseating.svg" },
      { ok: isTruthy(shop.TVs), icon: "/img/icons/tv.svg" },
      { ok: isTruthy(shop.BYOB), icon: "/img/icons/byob.svg" },
    ].filter(i => i.ok);

    items.forEach(a => {
      const img = document.createElement("img");
      img.src = a.icon;
      img.className = "sp-amen-icon";
      row.appendChild(img);
    });
  }

  function wireDock(shop) {
    $("#spActCall").onclick = () => {
      if (shop.Phone) window.location.href = `tel:${shop.Phone}`;
    };

    $("#spActWeb").onclick = () => {
      if (shop.Website) window.open(shop.Website, "_blank");
    };

    $("#spActBrands").onclick = () => {
      document.getElementById("spTabBrands").click();
    };

    $("#spActDir").onclick = () => {
      window.open(
        `https://maps.apple.com/?daddr=${encodeURIComponent(shop.Address)}`,
        "_blank"
      );
    };
  }

  async function init() {
    const shop = await fetch("/shops/shops.json")
      .then(r => r.json())
      .then(arr => arr[0]);

    $("#spName").textContent = shop.Shop;
    $("#spCity").textContent = `${shop.City}, ${shop.ST}`;
    $("#spLogo").src = `/img/icons/shops/${shop.Shop.toLowerCase().replace(/\s/g,'')}.svg`;

    renderAmenities(shop);
    wireDock(shop);
  }

  init();
})();
