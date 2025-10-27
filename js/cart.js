/* =========================================================
   CigarOS Shared Cart (v1)
   - Cross-page persistent cart (localStorage)
   - Pub/Sub updates for any UI to react
   - 7% default tax, per-item taxable flag
   ========================================================= */

(function () {
  const KEY = 'cigaros.cart.v1';

  const defaults = {
    taxRate: 0.07,           // 7%
    taxExempt: false,        // whole order tax exempt
    items: {}                // id -> { id, name, price, icon, category, taxable, qty }
  };

  let state = load();

  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed, items: parsed.items || {} };
    } catch {
      return { ...defaults };
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function notify() {
    const snapshot = getSnapshot();
    listeners.forEach(fn => {
      try { fn(snapshot); } catch (_) {}
    });
  }

  function getSnapshot() {
    const items = Object.values(state.items);
    const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);
    const taxableSubtotal = items
      .filter(l => l.taxable !== false) // default taxable true
      .reduce((s, l) => s + l.price * l.qty, 0);

    const tax = state.taxExempt ? 0 : round(taxableSubtotal * state.taxRate);
    const total = round(subtotal + tax);

    return {
      items,
      subtotal: round(subtotal),
      tax,
      total,
      taxRate: state.taxRate,
      taxExempt: state.taxExempt
    };
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function addItem(item, qty = 1) {
    if (!item || !item.id) return;
    const existing = state.items[item.id];
    if (existing) {
      existing.qty += qty;
      if (existing.qty <= 0) delete state.items[item.id];
    } else {
      state.items[item.id] = {
        id: item.id,
        name: item.name || 'Item',
        price: Number(item.price || 0),
        icon: item.icon || '',
        category: item.category || '',
        taxable: item.taxable !== false,
        qty: Math.max(1, Number(qty || 1))
      };
    }
    save(); notify();
  }

  function updateQty(id, qty) {
    const line = state.items[id];
    if (!line) return;
    line.qty = Number(qty || 0);
    if (line.qty <= 0) delete state.items[id];
    save(); notify();
  }

  function inc(id) {
    const line = state.items[id];
    if (!line) return;
    line.qty++;
    save(); notify();
  }

  function dec(id) {
    const line = state.items[id];
    if (!line) return;
    line.qty--;
    if (line.qty <= 0) delete state.items[id];
    save(); notify();
  }

  function remove(id) {
    if (state.items[id]) {
      delete state.items[id];
      save(); notify();
    }
  }

  function clear() {
    state.items = {};
    save(); notify();
  }

  function setTaxRate(rate) {
    const r = Number(rate);
    if (!isNaN(r) && r >= 0 && r <= 1) {
      state.taxRate = r;
      save(); notify();
    }
  }

  function setTaxExempt(v) {
    state.taxExempt = !!v;
    save(); notify();
  }

  function subscribe(fn) {
    listeners.add(fn);
    // immediate fire with snapshot
    try { fn(getSnapshot()); } catch (_) {}
    return () => listeners.delete(fn);
  }

  // Public API
  window.Cart = {
    addItem, updateQty, inc, dec, remove, clear,
    getSnapshot, subscribe, setTaxRate, setTaxExempt
  };
})();
