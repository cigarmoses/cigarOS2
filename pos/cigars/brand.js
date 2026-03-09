const SHEET_URL =
"https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv"

const params = new URLSearchParams(location.search)
let brand = params.get("brand") || "Padron"

const list = document.getElementById("brand-list")
const searchInput = document.getElementById("brand-search")
const title = document.getElementById("brand-title")
const icon = document.getElementById("brand-icon-img")

title.textContent = brand
icon.src = `/img/icons/brands/${brand.toLowerCase()}.svg`

let cigars = []

async function load() {

const res = await fetch(SHEET_URL)
const text = await res.text()

const rows = text.split("\n").map(r => r.split(","))

const headers = rows.shift()

const data = rows.map(row => {

let obj = {}

headers.forEach((h,i)=>{
obj[h.trim()] = row[i]
})

return obj

})

cigars = data.filter(c => c.brand === brand)

if (!cigars.length) {

list.innerHTML =
`<div style="padding:20px;opacity:.6">No cigars found for ${brand}</div>`

return

}

render(cigars)

}

function render(rows){

list.innerHTML=""

rows.forEach(c=>{

const row=document.createElement("div")
row.className="brand-row"

row.innerHTML=`
<img src="/img/icons/brands/${brand.toLowerCase()}.svg">

<div class="brand-row-main">

<div class="brand-row-title">${c.cigar}</div>
<div class="brand-row-sub">${c.vitola}</div>

</div>

<div class="brand-row-right">

<div class="brand-row-price">${c.msrp}</div>

<button class="pos-add">+</button>

</div>
`

row.querySelector(".brand-row-title").onclick=()=>{
openSheet(c)
}

list.appendChild(row)

})

}

function openSheet(c){

let sheet=document.getElementById("cigar-sheet")

if(!sheet){

sheet=document.createElement("div")
sheet.id="cigar-sheet"

sheet.innerHTML=`

<div class="sheet-backdrop"></div>

<div class="sheet">

<div class="sheet-handle"></div>

<div id="sheet-content"></div>

</div>
`

document.body.appendChild(sheet)

sheet.querySelector(".sheet-backdrop").onclick=closeSheet

}

const content=document.getElementById("sheet-content")

content.innerHTML=`

<img src="${c.image || ""}" class="sheet-stick">

<h2>${c.cigar}</h2>

<div class="sheet-spec">
<span>Ring</span>
<span>${c.ring}</span>
</div>

<div class="sheet-spec">
<span>Length</span>
<span>${c.length}</span>
</div>

<div class="sheet-spec">
<span>Shape</span>
<span>${c.shape}</span>
</div>

<div class="sheet-spec">
<span>Wrapper</span>
<span>${c.wrapper}</span>
</div>

<div class="sheet-actions">

<button class="sheet-btn">Add</button>
<button class="sheet-btn">Edit</button>
<button class="sheet-btn">Compare</button>

</div>

`

sheet.classList.add("show")

}

function closeSheet(){

document.getElementById("cigar-sheet").classList.remove("show")

}

searchInput.addEventListener("input",e=>{

const q=e.target.value.toLowerCase()

render(
cigars.filter(c=>
(c.cigar||"").toLowerCase().includes(q)
)
)

})

load()
