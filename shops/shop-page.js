
(async function(){

function key(s){
return (s||"").toLowerCase().replace(/[^a-z0-9]+/g,"")
}

function getSlug(){
const p=location.pathname.split("/")
return key(p[p.length-1])
}

async function load(){
const res=await fetch("/shops/shops.json")
return await res.json()
}

const slug=getSlug()
const data=await load()

const shop=data.find(s=>key(s.slug||s.name)==slug) || data[0]

document.querySelector("#spName").textContent=shop.name
document.querySelector("#spCity").textContent=shop.city+", "+shop.state

})()
