// ---------- HELPERS ----------
function getField(obj, keys){
  for(const k of keys){
    if(obj[k] != null && obj[k] !== "") return obj[k];
  }
  return "";
}

function normalizeBrand(v){
  return String(v||"").toLowerCase().replace(/\s+/g,"");
}

function resolveId(r){
  return getField(r, ["key", "cigar_id", "id", "row_id"]) || resolveName(r);
}

function resolveName(r){
  return getField(r, ["Cigar","cigar","name","title"]);
}

function resolveVitola(r){
  return getField(r, ["Vitola","vitola","size"]);
}

function resolveBrand(r){
  return getField(r, ["Brand","brand"]);
}

// ---------- RENDER ----------
function renderCigars(list){

  const wrap = document.getElementById("cigarList");
  wrap.innerHTML = "";

  list.forEach(r => {
    const id = resolveId(r);
    const name = resolveName(r);
    const vitola = resolveVitola(r);
    const brand = resolveBrand(r);

    const row = document.createElement("div");
    row.className = "cigar-row";

    row.innerHTML = `
      <div class="cigar-row-left">
        <img class="cigar-icon" src="/img/icons/brands/${normalizeBrand(brand)}.svg" />
        <div class="cigar-meta">
          <div class="cigar-name">${name}</div>
          <div class="cigar-sub">${vitola}</div>
        </div>
      </div>

      <div class="cigar-row-right">
        <div class="cigar-price">0.00</div>
        <button class="add-btn">+</button>
      </div>
    `;

    // ✅ ONLY LEFT SIDE OPENS DETAIL PAGE
    row.querySelector(".cigar-row-left").addEventListener("click", () => {
      window.location.href = `/pos/cigars/cigar.html?id=${encodeURIComponent(id)}`;
    });

    // ✅ PLUS BUTTON ONLY ADDS TO CART
    row.querySelector(".add-btn").addEventListener("click", (e) => {
      e.stopPropagation();

      if(window.addToCart){
        window.addToCart({
          id,
          name,
          price: 0
        });
      }
    });

    wrap.appendChild(row);
  });
}
