/* /profile/favorites/favorites.js */

(() => {
  "use strict";

  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const grid = document.getElementById("favGrid");
  const pageTitle = document.getElementById("pageTitle");
  const tabs = Array.from(document.querySelectorAll(".tab-btn"));

  const STORAGE_KEY = "cigaros-theme";

  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (themeIcon) {
      themeIcon.src = theme === "dark"
        ? "/img/icons/moon.svg"
        : "/img/icons/sun.svg";
    }
  };

  setTheme(localStorage.getItem(STORAGE_KEY) || "dark");

  themeToggle?.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  });

  const data = {
    cigars: [
      {
        name: "Padron 1964 Anniversary",
        meta: "Belicoso Maduro",
        img: "/img/cigars/padron/padron1964anniversaryseriesbelicosomaduro.png",
        href: "/pos/cigars/cigar.html?key=Padron%7C1964%20Anniversary%20Series%7CBelicoso%20Maduro"
      },
      {
        name: "Tabak Cafe Con Leche",
        meta: "Belicoso",
        img: "/img/cigars/padron/padron1964anniversaryseriesbelicosomaduro.png",
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

  const titleMap = {
    cigars: "Cigars",
    brands: "Brands",
    shops: "Shops"
  };

  const render = (tab) => {
    pageTitle.textContent = titleMap[tab] || "Favorites";

    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    grid.innerHTML = "";

    data[tab].forEach((item) => {
      const card = document.createElement("a");
      card.className = "item-card";
      card.href = item.href;

      card.innerHTML = `
        <button class="remove-btn" type="button" aria-label="Remove">×</button>
        <img src="${item.img}" alt="${item.name}">
        <strong>${item.name}</strong>
        <span>${item.meta}</span>
      `;

      card.querySelector(".remove-btn").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        card.remove();
      });

      grid.appendChild(card);
    });
  };

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
