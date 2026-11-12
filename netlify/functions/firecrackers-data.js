import {authorized,reply} from './lib/viewer-auth.js';
import {parseCSV,mapRows} from './lib/catalog.js';
const SOURCE='https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv';
// Guest-safe fields only. Never return inventory, cost, margins, or private notes.
export const FIELDS=new Set('cigar_img brand line cigar vitola shape length ring box_pressed wrapper_shade strength wrapper binder filler origin msrp manufacturer cuban'.split(' '));
// Verified repository aliases for four outdated image paths in the HUB.
const IMAGE_ALIASES={
 '/img/cigars/bandolero/bandolerofirecracker2026.png':'/img/cigars/bandolerofirecracker2026.png',
 '/img/cigars/micallef/micallefblackfirecracker.png':'/img/cigars/micallef/blackfirecracker.png',
 '/img/cigars/perdomo/perdomofirecracker2020.png':'/img/cigars/perdomo/perdomofirecracker.png',
 '/img/cigars/perdomo/perdomofirecracker2021.png':'/img/cigars/perdomo/perdomofirecrackerii.png'
};
export function sanitize(rows){return rows.filter(r=>String(r.vitola||'').trim().toLowerCase()==='firecracker').map(r=>Object.fromEntries(Object.entries(r).filter(([key])=>FIELDS.has(key)))).map(r=>({...r,...(IMAGE_ALIASES[r.cigar_img]?{cigar_img:IMAGE_ALIASES[r.cigar_img]}:{})})).sort((a,b)=>[a.brand,a.line,a.cigar].join(' ').localeCompare([b.brand,b.line,b.cigar].join(' '),undefined,{numeric:true}));}
let cached=null,expires=0,pending=null;
export async function catalog(){if(cached&&Date.now()<expires)return cached;if(pending)return pending;pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);try{const response=await fetch(SOURCE,{signal:controller.signal});if(!response.ok)throw Error('Source unavailable');const csv=parseCSV(await response.text());if(!csv[0]?.includes('Brand')||!csv[0]?.includes('Vitola'))throw Error('Invalid catalog');cached=sanitize(mapRows(csv));expires=Date.now()+5*60*1000;return cached;}finally{clearTimeout(timer);}})().finally(()=>pending=null);return pending;}
export async function handleRequest(event){if(event.httpMethod!=='GET')return reply(405,{error:'Use GET'},{Allow:'GET'});if(!authorized(event))return reply(401,{error:'Enter the viewer password to continue.'});try{return reply(200,{rows:await catalog()});}catch{return reply(502,{error:'Firecrackers could not be loaded. Please try again.'});}}
export default async function(request){const result=await handleRequest({httpMethod:request.method,headers:Object.fromEntries(request.headers)});return new Response(result.body,{status:result.statusCode,headers:result.headers});}
