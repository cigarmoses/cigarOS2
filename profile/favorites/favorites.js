(() => {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  const grid = document.getElementById("favGrid");
  const tabs = Array.from(document.querySelectorAll(".tab-btn"));

  const STORAGE_KEY = "cigaros-theme";

  function applyTheme(theme){
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if(icon){
      icon.src = theme === "dark"
        ? "/img/icons/moon.svg"
        : "/img/icons/sun.svg";
    }
  }

  applyTheme(localStorage.getItem(STORAGE_KEY) || "dark");

  toggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  const data = {
    cigars: [
      {
        name: "Girl With No Name Lonsdale",
        img: "/img/cigars/girlwithnoname/girlwithnonamelonsdale.png",
        href: "/pos/cigars/cigar.html?key=Girl%20With%20No%20Name%7CGirl%20With%20No%20Name%7CLonsdale"
      },
      {
        name: "Cohiba Nicaragua N50",
        img: "/img/cigars/cohiba/nicaraguarobusto.png",
        href: "//pos/cigars/cigar.html?key=cohiba%7Cn%204%207%2F8%20x%2050%7Crobusto"
      },
      {
        name: "Camacho Connecticut Robusto",
        img: "/img/cigars/camacho/connecticutrobusto.png"
        href: "/pos/cigars/cigar.html?key=camacho%7Cconnecticut%20robusto%7Crobusto"
      },
      {
        name: "Tabak Cafe Con Leche",
        img: "/img/cigars/tabak/cafeconleche.png",
        href: "/pos/cigars/cigar.html?key=Tabak%7CCafe%20Con%20Leche%7CBelicoso"
      }
    ],

    brands: [
      {
        name: "Opus X",
        meta: "Favorite Brand",
        img: "/img/icons/brands/opusx.svg",
        href: "/pos/cigars/brand.html?brand=Opus%20X"
      },
      {
        name: "Padron",
        meta: "Favorite Brand",
        img: "/img/icons/brands/padron.svg",
        href: "/pos/cigars/brand.html?brand=Padron"
      }
    ],

    shops: [
      {
        name: "Fox Cigar Bar",
        meta: "Favorite Shop",
        img: "/img/icons/shops/foxcigarbar.svg",
        href: "/pos/shops/shop.html?shop=Fox%20Cigar%20Bar"
      },
      {
        name: "Smoke Cigar Shop",
        meta: "Bridgeville, PA",
        img: "/img/icons/shops/foxcigarbar.svg",
        href: "/pos/shops/shop.html?shop=Smoke%20Cigar%20Shop"
      }
    ]
  };

  function renderCigars(){
    grid.className = "fav-list";
    grid.innerHTML = "";

    data.cigars.forEach((item) => {
      const row = document.createElement("a");
      row.className = "cigar-row";
      row.href = item.href;

      row.innerHTML = `<img src="${item.img}" alt="${item.name}">`;

      grid.appendChild(row);
    });
  }

  function renderCards(tab){
    grid.className = "fav-list brand-shop-grid";
    grid.innerHTML = "";

    data[tab].forEach((item) => {
      const card = document.createElement("a");
      card.className = "item-card";
      card.href = item.href;

      card.innerHTML = `
        <button class="remove-btn" type="button">×</button>
        <div class="item-stage">
          <img src="${item.img}" alt="${item.name}">
        </div>
        <strong>${item.name}</strong>
        <span>${item.meta}</span>
      `;

      card.querySelector(".remove-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.remove();
      });

      grid.appendChild(card);
    });
  }

  function render(tab){
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    if(tab === "cigars"){
      renderCigars();
    } else {
      renderCards(tab);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get("tab") || "cigars";

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      history.replaceState(null, "", `?tab=${tab}`);
      render(tab);
    });
  });

  render(data[initialTab] ? initialTab : "cigars");
})();
