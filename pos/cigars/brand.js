const urlParams = new URLSearchParams(window.location.search);
const brandName = (urlParams.get("brand") || "").toLowerCase();

const brandTitle = document.querySelector(".brand-title");
const cigarList = document.querySelector(".brand-list");
const searchInput = document.querySelector(".brand-search input");

let cigars = [];
let filtered = [];

async function loadCigars(){

const res = await fetch("/data/cigars.json");
cigars = await res.json();

render();

}

function render(){

filtered = cigars.filter(c =>
(c.brand || "").toLowerCase() === brandName
);

const search = searchInput.value?.toLowerCase() || "";

if(search){
filtered = filtered.filter(c =>
c.name.toLowerCase().includes(search)
);
}

if(filtered.length === 0){

cigarList.innerHTML =
`<div style="opacity:.6;font-size:18px">
No cigars found for ${brandName.charAt(0).toUpperCase()+brandName.slice(1)}
</div>`;

return;
}

cigarList.innerHTML = filtered.map(c => `
<div class="brand-row">

<img src="${c.icon}" />

<div class="brand-row-main">

<div class="brand-row-title"
onclick="openCigar('${c.id}')">
${c.name}
</div>

<div class="brand-row-sub">
${c.vitola}
</div>

</div>

<div class="brand-row-right">

<div class="brand-row-price">
${c.price.toFixed(2)}
</div>

<div class="pos-add"
onclick="addToInvoice('${c.id}')">
+
</div>

</div>

</div>
`).join("");

}

function openCigar(id){

const cigar = cigars.find(c => c.id === id);

const sheet = document.getElementById("cigar-sheet");

sheet.querySelector(".sheet-title").innerText = cigar.name;
sheet.querySelector(".sheet-stick").src = cigar.image;

sheet.classList.add("show");

}

function closeSheet(){

document.getElementById("cigar-sheet").classList.remove("show");

}

searchInput.addEventListener("input", render);

loadCigars();
