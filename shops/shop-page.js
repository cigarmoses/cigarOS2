(() => {

"use strict";

const $ = (sel) => document.querySelector(sel);

function cleanStr(v){
return String(v ?? "").trim();
}

function slugify(x){

return cleanStr(x.slug||x.Slug||x.slug_id)
.toLowerCase();

}

async function fetchJson(url){

const sep=url.includes("?")?"&":"?";

const res=await fetch(`${url}${sep}v=${Date.now()}`,{
cache:"no-store"
});

if(!res.ok) throw new Error(res.status);

return await res.json();

}

function getParam(name){

const url=new URL(location.href);

return url.searchParams.get(name);

}

async function init(){

const slug=getParam("shop");

if(!slug) return;

const list=await fetchJson("/shops/shops.json");

const shop=list.find((x)=>slugify(x)===slug);

if(!shop) return;

$("#spName").textContent=cleanStr(shop.name||shop.Shop);

$("#spCity").textContent=
`${cleanStr(shop.city||shop.City)}, ${cleanStr(shop.state||shop.State)}`;

if(shop.logo){

$("#spLogo").src=shop.logo;

}

if(shop.taa){

$("#spTaa").hidden=false;

}

}

init().catch((e)=>console.error("[shop-page.js] failed:",e));

})();
