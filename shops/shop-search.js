/* /shops/shop-search.js — FULL REPLACEMENT
   - Loads /shops/shops.json
   - Filters by name / city / state / slug / logoKey
   - Uses NO-HYPHEN canonical key for the link: /shops/{key}
*/

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  function cleanStr(v){ return String(v ?? "").trim(); }

  // NO-HYPHEN key: keep only a-z0-9
  function canonicalKey(s){
    return cleanStr(s)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  }

  function shopName(x){
    return cleanStr(x.name || x.Shop || x.shop);
  }

  function shopCityState(x){
    const city = cleanStr(x.city || x.City);
    const st = cleanStr(x.state || x.ST || x.State);
    return [city, st].filter(Boolean).join(", ");
  }

  function shopKey(x){
    // Prefer logoKey (your master file already has this and it’s no-hyphen)
    const lk = cleanStr(x.logoKey || x.LogoKey);
    if (lk) return canonicalKey(lk);

    const slug = cleanStr(x.slug || x.Slug || x.slug_id);
    if (slug) return canonicalKey(slug);

    return canonicalKey(shopName(x));
  }

  async function fetchJson(url){
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache:"no-store" });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function render(list, q){
    const el = $("#shList");
    if(!el) return;

    const query = canonicalKey(q); // canonical search helps match hyphenated/odd inputs

    const filtered = list.filter((x) => {
      const n = canonicalKey(shopName(x));
      const cs = canonicalKey(shopCityState(x));
      const s = canonicalKey(cleanStr(x.slug || x.Slug || x.slug_id));
      const k = shopKey(x);
      return !query || n.includes(query) || cs.includes(query) || s.includes(query) || k.includes(query);
    });

    el.innerHTML = "";

    if(!filtered.length){
      el.innerHTML = `<div style="color:#8e8e93;font-weight:800;padding:14px 14px;">No matches.</div>`;
      return;
    }

    filtered.forEach((x) => {
      const key = shopKey(x);
      if (!key) return;

      const name = shopName(x) || "Shop";
      const sub = shopCityState(x) || "—";

      const a = document.createElement("a");
      a.className = "sh-item";

      // ✅ Pretty URL (Netlify rewrites to shop-page.html?shop=key)
      a.href = `/shops/${encodeURIComponent(key)}`;

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

  init().catch((e) => console.error("[shop-search.js] failed:", e));
})();
