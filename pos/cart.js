/* /pos/cart.js
   Shared cart + bottom-right invoice FAB + invoice modal + product "Add to invoice" confirm popup.
   Single source of truth across all POS pages.

   Storage:
   - CART_KEY: active open invoice (persists across pages until saved/confirmed)
   - (sales + customers can be wired next; this file focuses on the cart/invoice UX)

   Icon logic:
   - Green icon when cart empty: /img/icons/receipt.png
   - Red icon when cart has items: /img/icons/receiptred.png
*/

(() => {
  const CART_KEY = "cigaros_cart_v1";
  const TAX_RATE = 0.07;

  // ---------- utils ----------
  const money = (n) => {
    const x = Number(n || 0);
    return x.toFixed(2);
  };

  const nowStamp = () => {
    try {
      return new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return new Date().toString();
    }
  };

  const safeJSON = (s, fallback) => {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  };

 
