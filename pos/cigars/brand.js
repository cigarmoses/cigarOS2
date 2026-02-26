/* /pos/cigars/brand.js
   Add-on wiring for:
   1) centered theme toggle using sun/moon SVG
   2) top-right invoice icon that opens invoice
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const themeBtn = $("#theme-toggle");
  const knobImg = $("#tt-knob-img");
  const invoiceBtn = $("#invoice-icon");
  const invoiceImg = $("#invoice-icon-img");

  const SUN_ICON = "/img/icons/sun.svg";
  const MOON_ICON = "/img/icons/moon.svg";
  const CART_LIGHT = "/img/icons/cart-light.png";
  const CART_DARK = "/img/icons/cart-dark.png";

  function getTheme() {
    const saved = localStorage.getItem("theme");
    const attr = document.documentElement.getAttribute("data-theme");
    const t = (saved || attr || "light");
    return t === "dark" ? "dark" : "light";
  }

  function syncThemeIcons() {
    const t = getTheme();
    if (knobImg) knobImg.src = t === "dark" ? MOON_ICON : SUN_ICON;
    if (invoiceImg) invoiceImg.src = t === "dark" ? CART_DARK : CART_LIGHT;
  }

  function setTheme(next) {
    const t = next === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
    syncThemeIcons();
  }

  function bindThemeToggle() {
    setTheme(getTheme());
    themeBtn?.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  }

  function openInvoice() {
    const candidates = [
      $("#posInvoiceFab"),
      $("#posReceiptFab"),
      $("#receipt-open"),
      $("#invoice-open"),
      $(".pos-invoice-fab"),
      $(".pos-receipt-fab"),
      $(".receipt-fab"),
      $("[data-open-invoice]"),
      $("[data-open-receipt]"),
    ].filter(Boolean);

    if (candidates.length) {
      candidates[0].click();
      return true;
    }

    try {
      location.href = "/pos/invoice.html";
      return true;
    } catch {
      return false;
    }
  }

  function bindInvoiceIcon() {
    invoiceBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInvoice();
    });
  }

  function bootHeaderUI() {
    bindThemeToggle();
    bindInvoiceIcon();
    syncThemeIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootHeaderUI);
  } else {
    bootHeaderUI();
  }

  // IMPORTANT:
  // Keep the rest of your existing brand.js logic below this,
  // OR paste this into your existing brand.js near the top and call bootHeaderUI().
})();
