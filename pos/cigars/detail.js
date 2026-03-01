/* /pos/cigars/detail.js — FULL REPLACEMENT
   Fix:
   - Always populates from sessionStorage (set by brand.js) so you never get “photo only popup”
   - ADD button adds to invoice (same storage key)
*/

(() => {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  const INVOICE_KEY = "cigaros_invoice_items";

  function readInvoice() {
    try {
      const raw = localStorage.getItem(INVOICE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeInvoice(items) {
    localStorage.setItem(INVOICE_KEY, JSON.stringify(items));
  }

  function addToInvoice(item) {
    const items = readInvoice();
    const key = item.id || `${item.name || ""}__${item.vitola || ""}`;
    const found = items.find(x => x.key === key);
    if (found) found.qty = (found.qty || 1) + 1;
    else items.push({ key, qty: 1, item });
    writeInvoice(items);
  }

  function safe(v) {
    const s = String(v ?? "").trim();
    return s ? s : "—";
  }

  function loadDetail() {
    // Primary: sessionStorage injected by brand.js
    let cigar = null;
    try {
      const raw = sessionStorage.getItem("cigaros_detail");
      cigar = raw ? JSON.parse(raw) : null;
    } catch {}

    if (!cigar) {
      // If someone deep-links, at least show something instead of blank
      cigar = { name: "Cigar", brand: "Brand" };
    }

    $("#brandName").textContent = safe(cigar.brand || cigar.brandName || "");
    $("#cigarName").textContent = safe(cigar.name || "");

    const logo = $("#brandLogo");
    const logoSrc = cigar.brandIcon || cigar.logo || cigar.brandLogo || "";
    if (logoSrc) {
      logo.src = logoSrc;
      logo.style.display = "block";
    } else {
      logo.style.display = "none";
    }

    const stick = $("#stickImg");
    const stickSrc = cigar.image || cigar.photo || cigar.img || "";
    if (stickSrc) {
      stick.src = stickSrc;
      stick.style.display = "block";
    } else {
      stick.style.display = "none";
    }

    $("#ring").textContent = safe(cigar.ring || cigar.rg);
    $("#length").textContent = safe(cigar.length);
    $("#shape").textContent = safe(cigar.shape);
    $("#vitola").textContent = safe(cigar.vitola);

    $("#wrapper").textContent = safe(cigar.wrapper);
    $("#binder").textContent = safe(cigar.binder);
    $("#filler").textContent = safe(cigar.filler);
    $("#origin").textContent = safe(cigar.origin);

    $("#strength").textContent = safe(cigar.strength);
    $("#shade").textContent = safe(cigar.wrapperShade || cigar.shade);
    return cigar;
  }

  const cigar = loadDetail();

  $("#backBtn").addEventListener("click", () => history.back());

  $("#addBtn").addEventListener("click", () => {
    addToInvoice(cigar);
    // optional: bounce back to brand list after add
    history.back();
  });

  $("#compareBtn").addEventListener("click", () => {
    // placeholder
    alert("Compare coming soon");
  });

  $("#editBtn").addEventListener("click", () => {
    // placeholder (you said save target TBD since Sheets)
    alert("Inline edit mode coming next");
  });
})();
