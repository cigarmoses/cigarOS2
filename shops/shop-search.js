
(async function(){

const listEl=document.querySelector("#shList")
const input=document.querySelector("#shQuery")

function clean(v){return (v||"").toString().trim()}

function key(s){
return clean(s).toLowerCase().replace(/[^a-z0-9]+/g,"")
}

async function load(){
const res=await fetch("/shops/shops.json")
return await res.json()
}

function render(data,q){

const k=key(q)
listEl.innerHTML=""

data.filter(x=>{
return !k || key(x.name).includes(k) || key(x.city).includes(k)
}).forEach(x=>{

const slug=key(x.slug||x.name)

const row=document.createElement("a")
row.className="sh-item"
row.href="/shops/"+slug

row.innerHTML=`
<div class="sh-item-main">
<img class="sh-item-logo" src="/img/icons/shops/${slug}.svg"
onerror="this.style.display='none'">
<div>
<div class="sh-item-name">${x.name}</div>
<div class="sh-item-sub">${x.city}, ${x.state}</div>
</div>
</div>
<div class="sh-item-go">›</div>
`

listEl.appendChild(row)

})

}

const data=await load()
render(data,"")

input.addEventListener("input",()=>render(data,input.value))

})()
