const SHEET_URL =
"https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv"

const params = new URLSearchParams(location.search)
let brand = params.get("brand")

const list = document.getElementById("brand-list")
const searchInput = document.getElementById("brand-search")
const title = document.getElementById("brand-title")
const icon = document.getElementById("brand-icon-img")

if (!brand) brand = "Padron"

title.textContent = brand
icon.src = `/img/icons/brands/${brand.toLowerCase()}.svg`

let cigars = []

async function load() {

try {

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
`<div style="opacity:.6;padding:20px">No cigars found for ${brand}</div>`

return

}

render(cigars)

} catch (err) {

console.error(err)

list.innerHTML =
`<div style="padding:20px">Failed to load cigars</div>`

}

}

function render(rows) {

list.innerHTML = ""

rows.forEach(c => {

const row = document.createElement("div")
row.className = "brand-row"

row.innerHTML = `
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

row.querySelector(".brand-row-title").onclick = () => openCigar(c)

list.appendChild(row)

})

}

function openCigar(c) {

const modal = document.getElementById("cigar-modal")
const card = document.getElementById("cigar-modal-card")

card.innerHTML = `

<img src="${c.image || ""}" style="width:100%;margin-bottom:20px">

<h2>${c.cigar}</h2>

<div>Ring ${c.ring}</div>
<div>Length ${c.length}</div>
<div>${c.shape}</div>
<div>${c.wrapper}</div>

<button onclick="closeCigar()">Close</button>

`

modal.classList.add("show")

}

function closeCigar() {

document.getElementById("cigar-modal").classList.remove("show")

}

searchInput.addEventListener("input", e => {

const q = e.target.value.toLowerCase()

render(
cigars.filter(c =>
(c.cigar || "").toLowerCase().includes(q)
)
)

})

load()
