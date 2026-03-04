(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanStr(v){ return String(v ?? "").trim(); }

   function slugifyShop(x){
  const s = cleanStr(x.slug || x.Slug || x.slug_id).toLowerCase();
  if (s) return s;

  // fallback: slug from name
  return shopName(x)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

  function shopName(x){
    return cleanStr(x.name || x.Shop || x.shop);
  }

  function shopCityState(x){
    const city = cleanStr(x.city || x.City);
    const st = cleanStr(x.state || x.ST || x.State);
    return [city, st].filter(Boolean).join(", ");
  }

  async function fetchJson(url){
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache:"no-store" });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function render(list, q){
    const el = $("#shList");
    if(!el) return;

    const query = cleanStr(q).toLowerCase();
    const filtered = list.filter((x) => {
      const n = shopName(x).toLowerCase();
      const cs = shopCityState(x).toLowerCase();
      const s = slugifyShop(x).toLowerCase();
      return !query || n.includes(query) || cs.includes(query) || s.includes(query);
    });

    el.innerHTML = "";

    if(!filtered.length){
      el.innerHTML = `<div style="color:#8e8e93;font-weight:700;padding:8px 2px;">No matches.</div>`;
      return;
    }

    filtered.forEach((x) => {
      const slug = slugifyShop(x);
      const name = shopName(x) || slug || "Shop";
      const sub = shopCityState(x) || "—";

      const a = document.createElement("a");
      a.className = "sh-item";
      a.href = `/shops/shop.html?shop=${encodeURIComponent(slug)}`;

      a.innerHTML = `
        <div class="sh-item-left">
          <div class="sh-item-name">${escapeHtml(name)}</div>
          <div class="sh-item-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="sh-item-go">›</div>
      `;

      el.appendChild(a);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  async function init(){
    const input = $("#shQuery");
    const data = await fetchJson("/shops/shops.json");
    const list = Array.isArray(data) ? data : [];

    render(list, "");

    if(input){
      input.addEventListener("input", () => render(list, input.value));
      input.addEventListener("search", () => render(list, input.value));
    }
  }

  init().catch((e) => console.error("[shops.js] failed:", e));
})();
