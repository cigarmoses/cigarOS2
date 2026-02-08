// /pos/pos.js
// Global UI helpers (badge + invoice nav) + Contacts wiring + Filter Modal Engine
// ✅ Compatible with /pos/cart.js (localStorage cart: "cigaros_pos_cart_v3")
// ✅ Option A: ALL invoice navigation goes to /pos/invoice/ (never invoice.html)
// ❌ Does NOT create its own cart or invoice popup (old behavior removed)

(function () {
  "use strict";

  // Must match /pos/cart.js
  const CART_KEY = "cigaros_pos_cart_v3";
  const SHOP_KEY = "cigaros_pos_shop_name";
  const INV_KEY  = "cigaros_pos_invoice_number";

  const $ = (sel, root = document) => root.querySelector(sel);

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadCart() {
    return safeJSONParse(localStorage.getItem(CART_KEY), []) || [];
  }

  function getCartProductCount() {
    // count of distinct products with qty > 0
    const cart = loadCart();
    return cart.reduce((sum, item) => (Number(item?.qty || 0) > 0 ? sum + 1 : sum), 0);
  }

  function updateInvoiceBadges() {
    const count = getCartProductCount();

    // Old badge id used in some pages
    const legacy = document.getElementById("receipt-count");
    if (legacy) legacy.textContent = String(count);

    // New universal badge selector (we used this across pages)
    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      el.textContent = String(count);
    });
  }

  function goToInvoice(e) {
    if (e) e.preventDefault();
    window.location.href = "/pos/invoice/";
  }

  function forceInvoiceLinks() {
    // Any old invoice.html links -> /pos/invoice/
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href.includes("/pos/invoice.html") || href.endsWith("invoice.html")) {
        a.setAttribute("href", "/pos/invoice/");
      }
    });
  }

  function wireInvoiceButtons() {
    // Any element can become an invoice trigger by adding:
    // data-invoice-btn="true"
    document.querySelectorAll("[data-invoice-btn]").forEach((el) => {
      if (el.__invoiceBound) return;
      el.__invoiceBound = true;
      el.addEventListener("click", goToInvoice);
    });

    // Also bind common legacy ids/classes if they still exist
    const legacyIds = ["open-receipt", "invoice-btn", "invoiceButton"];
    legacyIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.__invoiceBound) return;
      el.__invoiceBound = true;
      el.addEventListener("click", goToInvoice);
    });

    document.querySelectorAll(".pos-invoice-icon, .invoice-pill, .pos-invoice-pill, .invoice-btn")
      .forEach((el) => {
        if (el.__invoiceBound) return;
        el.__invoiceBound = true;
        el.addEventListener("click", goToInvoice);
      });
  }

  // Keep badges synced if cart changes in other tabs/pages
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateInvoiceBadges();
  });

  // Our cart.js dispatches this event; listen for it here
  document.addEventListener("cigaros:cart-changed", updateInvoiceBadges);
  window.addEventListener("cigaros:cart", updateInvoiceBadges); // back-compat

  document.addEventListener("DOMContentLoaded", () => {
    forceInvoiceLinks();
    wireInvoiceButtons();
    updateInvoiceBadges();
  });

  // Expose a tiny helper in case any page wants it
  window.POS = {
    updateInvoiceBadges,
    goToInvoice,
    loadCart,
    keys: { CART_KEY, SHOP_KEY, INV_KEY },
  };
})();


// ===========================
// LOYALTY CONTACTS WIRING
// (kept, but safe — runs only if elements exist)
// ===========================

document.addEventListener("DOMContentLoaded", () => {
  const customerSelect = document.getElementById("receipt-customer");
  const customerSearchInput = document.getElementById("receipt-customer-search");

  let allContacts = [];

  const CONTACTS_URL = "/pos/pos-contacts.json";

  function normalizePhone(value) {
    if (!value) return "";
    return String(value).replace(/\D+/g, "");
  }

  function formatContactLabel(contact) {
    const parts = [];

    const first = contact.first_name || "";
    const last = contact.last_name || "";
    const name = `${first} ${last}`.trim();

    if (name) parts.push(name);
    if (contact.phone) parts.push(contact.phone);
    if (contact.email) parts.push(contact.email);

    if (!parts.length && contact.customer_id != null) {
      parts.push(`Customer #${contact.customer_id}`);
    }

    return parts.join(" • ");
  }

  function renderCustomerOptions(contacts) {
    if (!customerSelect) return;

    customerSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Attach customer (optional)";
    customerSelect.appendChild(placeholder);

    contacts.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.customer_id;
      opt.textContent = formatContactLabel(c);
      customerSelect.appendChild(opt);
    });
  }

  function filterContacts(term) {
    if (!term) return allContacts;

    const search = term.toLowerCase().trim();
    const numeric = normalizePhone(term);

    return allContacts.filter((c) => {
      const first = (c.first_name || "").toLowerCase();
      const last = (c.last_name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phoneNorm = normalizePhone(c.phone || "");

      const nameMatch = first.includes(search) || last.includes(search);
      const emailMatch = email.includes(search);
      const phoneMatch = numeric && phoneNorm.includes(numeric);

      return nameMatch || emailMatch || phoneMatch;
    });
  }

  async function loadContacts() {
    try {
      const res = await fetch(CONTACTS_URL, { cache: "no-store" });
      if (!res.ok) {
        console.error("Failed to load contacts JSON:", res.status, res.statusText);
        return;
      }
      const data = await res.json();
      allContacts = (data || []).filter((c) => c.active !== false);
      renderCustomerOptions(allContacts);
    } catch (err) {
      console.error("Error loading contacts:", err);
    }
  }

  if (customerSearchInput) {
    customerSearchInput.addEventListener("input", (e) => {
      const term = e.target.value || "";
      const filtered = filterContacts(term);
      renderCustomerOptions(filtered);
    });
  }

  if (customerSelect) {
    customerSelect.addEventListener("change", (e) => {
      const selectedId = e.target.value || "";
      if (window.currentInvoice) {
        window.currentInvoice.customer_id = selectedId || null;
      }
    });
  }

  if (customerSelect || customerSearchInput) {
    loadContacts();
  }
});


// ===========================
// GLOBAL FILTER MODAL ENGINE
// (kept as-is, only tiny path safety)
// ===========================

(function () {
  const filterModal = document.getElementById("filter-modal");
  const filterModalTitle = document.getElementById("filter-modal-title");
  const filterModalSearch = document.getElementById("filter-modal-search-input");
  const filterModalList = document.getElementById("filter-modal-list");
  const filterModalConfirm = document.getElementById("filter-modal-confirm");
  const filterModalBack = document.querySelector(".filter-modal-back");
  const filterModalBackdrop = document.querySelector(".filter-modal-backdrop");

  let currentFilterId = null;
  let currentFilterItems = []; // [{ value, label, iconSlug?, selected }]
  let currentWithIcons = false;
  let currentIconBasePath = "/img/icons/brands/"; // ✅ per your repo convention
  let onFilterConfirm = null;

  function brandSlug(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function openFilterModal(config) {
    const {
      id,
      title,
      items,
      withIcons = false,
      iconBasePath = "/img/icons/brands/",
      onConfirm,
    } = config;

    currentFilterId = id;
    currentFilterItems = (items || []).map((item) => ({ ...item }));
    currentWithIcons = !!withIcons;
    currentIconBasePath = iconBasePath;
    onFilterConfirm = typeof onConfirm === "function" ? onConfirm : null;

    if (!filterModal) return; // safety if modal HTML isn't on this page

    filterModalTitle.textContent = title || "";
    filterModalSearch.value = "";

    renderFilterModalList();
    filterModal.classList.remove("filter-modal--hidden");
    setTimeout(() => filterModalSearch && filterModalSearch.focus(), 0);
  }

  function closeFilterModal() {
    if (!filterModal) return;
    filterModal.classList.add("filter-modal--hidden");
    currentFilterId = null;
    currentFilterItems = [];
    currentWithIcons = false;
    onFilterConfirm = null;
  }

  function renderFilterModalList() {
    if (!filterModalList) return;

    const query = filterModalSearch ? filterModalSearch.value.trim().toLowerCase() : "";
    filterModalList.innerHTML = "";

    currentFilterItems
      .filter((item) => {
        if (!query) return true;
        const label = (item.label || "").toLowerCase();
        return label.includes(query);
      })
      .forEach((item, index) => {
        const row = document.createElement("div");
        row.className =
          "filter-row" + (item.selected ? " filter-row--selected" : "");
        row.dataset.index = index.toString();

        // Optional icon (Brands)
        if (currentWithIcons && item.iconSlug) {
          const iconWrapper = document.createElement("div");
          iconWrapper.className = "filter-row-icon";

          const img = document.createElement("img");
          const slug = brandSlug(item.iconSlug);
          img.src = currentIconBasePath + slug + ".svg";
          img.alt = item.label || "";
          iconWrapper.appendChild(img);

          row.appendChild(iconWrapper);
        }

        // Checkbox square
        const check = document.createElement("div");
        check.className = "filter-row-check";
        row.appendChild(check);

        // Label
        const label = document.createElement("div");
        label.className = "filter-row-label";
        label.textContent = item.label || "";
        row.appendChild(label);

        // Toggle selection
        row.addEventListener("click", () => {
          item.selected = !item.selected;
          row.classList.toggle("filter-row--selected", item.selected);
        });

        filterModalList.appendChild(row);
      });
  }

  if (filterModalSearch) {
    filterModalSearch.addEventListener("input", renderFilterModalList);
  }

  if (filterModalConfirm) {
    filterModalConfirm.addEventListener("click", () => {
      if (onFilterConfirm) {
        const selectedValues = currentFilterItems
          .filter((i) => i.selected)
          .map((i) => i.value);
        onFilterConfirm(selectedValues);
      }
      closeFilterModal();
    });
  }

  if (filterModalBack) {
    filterModalBack.addEventListener("click", closeFilterModal);
  }
  if (filterModalBackdrop) {
    filterModalBackdrop.addEventListener("click", closeFilterModal);
  }

  window.POSFilters = { openFilterModal };
})();
