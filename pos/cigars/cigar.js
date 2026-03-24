// ---------- CONFIG ----------
const DATA_URL = "https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv";

// ROLE CONTROL
const USER_ROLE = "pos"; // consumer | pos | manufacturer

// ---------- HELPERS ----------
function getField(obj, keys){
  for(const k of keys){
    if(obj[k] != null && obj[k] !== "") return obj[k];
  }
  return "";
}

function findById(rows, id){
  return rows.find(r =>
    String(getField(r, ["key","cigar_id","id","row_id"])) === String(id)
  );
}

function findBySlug(rows, slug){
  return rows.find(r =>
    String(getField(r, ["slug","Slug"])).toLowerCase() === String(slug).toLowerCase()
  );
}

// ---------- FAVORITES ----------
function getFavorites(){
  return JSON.parse(localStorage.getItem("favorites") || "[]");
}

function toggleFavorite(id){
  let favs = getFavorites();

  if(favs.includes(id)){
    favs = favs.filter(f => f !== id);
  } else {
    favs.push(id);
  }

  localStorage.setItem("favorites", JSON.stringify(favs));
}

// ---------- LOAD ----------
async function load(){

  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  const slugParam = params.get("slug");

  const res = await fetch(DATA_URL);
  const text = await res.text();

  const rows = text.split("\n").map(r => r.split(","));
  const headers = rows[0];
  const records = rows.slice(1).map(r => {
    let obj = {};
    headers.forEach((h,i)=> obj[h.trim()] = r[i]);
    return obj;
  });

  let rec = null;

  if(idParam) rec = findById(records, idParam);
  if(!rec && idParam) rec = findBySlug(records, idParam);
  if(!rec && slugParam) rec = findBySlug(records, slugParam);

  if(!rec){
    document.getElementById("cdCard").innerHTML = `<div>Cigar not found.</div>`;
    return;
  }

  render(rec);
}

// ---------- RENDER ----------
function render(r){

  const id = getField(r, ["key","cigar_id","id"]);
  const brand = getField(r, ["Brand"]);
  const name = getField(r, ["Cigar"]);
  const vitola = getField(r, ["Vitola"]);
  const ring = getField(r, ["RG"]);
  const length = getField(r, ["Length"]);
  const shape = getField(r, ["Shape"]);
  const wrapper = getField(r, ["Wrapper"]);
  const binder = getField(r, ["Binder"]);
  const filler = getField(r, ["Filler"]);
  const origin = getField(r, ["Origin"]);
  const strength = getField(r, ["Strength"]);
  const shade = getField(r, ["Wrapper Shade"]);
  const img = getField(r, ["Cigar IMG"]);

  const isFav = getFavorites().includes(id);

  document.getElementById("cdCard").innerHTML = `
    <div class="cd-header">
      <div>
        <div class="cd-brand">${brand}</div>
        <div class="cd-name">${name}</div>
      </div>
      <img class="cd-brand-icon" src="/img/icons/brands/${brand.toLowerCase()}.svg">
    </div>

    <div class="cd-body">
      <img class="cd-image" src="${img}" />

      <div class="cd-stats">
        <div>Ring ${ring}</div>
        <div>Length ${length}</div>
        <div>Shape ${shape}</div>
        <div>Vitola ${vitola}</div>
        <div>Wrapper ${wrapper}</div>
        <div>Binder ${binder}</div>
        <div>Filler ${filler}</div>
        <div>Origin ${origin}</div>
        <div>Strength ${strength}</div>
        <div>Shade ${shade || "-"}</div>
      </div>
    </div>

    <div class="cd-actions">
      <button id="favBtn">${isFav ? "❤️" : "🤍"}</button>
      <button id="addBtn">ADD</button>
      ${USER_ROLE !== "consumer" ? `<button id="editBtn">EDIT</button>` : ``}
      <button id="compareBtn">COMPARE</button>
    </div>
  `;

  // FAVORITE
  document.getElementById("favBtn").onclick = () => {
    toggleFavorite(id);
    location.reload();
  };

  // ADD
  document.getElementById("addBtn").onclick = () => {
    if(window.addToCart){
      window.addToCart({ id, name, price: 0 });
    }
  };
}

// ---------- BACK BUTTON ----------
document.getElementById("cdBack").onclick = () => {
  if(history.length > 1){
    history.back();
  } else {
    window.location.href = "/pos/cigars/";
  }
};

// INIT
load();
