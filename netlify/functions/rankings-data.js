import {authorized,reply} from './lib/viewer-auth.js';
import {parseCSV,mapRows,recoverPublicationRanks} from './lib/catalog.js';
const SOURCE='https://docs.google.com/spreadsheets/d/10-5j7vKT123WtNhqLynxX3n9BXpb1VlKcuPZHj9YxdM/gviz/tq?tqx=out:csv';
// Deliberate allowlist: no inventory, costs, margin, favorites, UPC, or private notes.
export const FIELDS=new Set(('cigar_img brand line cigar vitola shape pigtail length ring box_pressed wrapper_shade strength wrapper binder filler origin factory msrp release_date manufacturer_img brand_img line_img tubo barber shaggy cuban cuban_vitola length_mm ring_mm key brand_aka manufacturer hw_consensus_year hw_consensus_rank hw_consensus_link cigar_journal_top_25_year cigar_journal_top_25_rank cigar_journal_top_25_full_list cigar_journal_tasting_notes cigar_aficionado_top_25_year cigar_aficionado_top_25_rank cigar_aficionado_top_25_rating cigar_aficionado_top_25_link excerpt').split(' '));
export function sanitize(rows){return rows.filter(r=>['hw_consensus_year','cigar_journal_top_25_year','cigar_aficionado_top_25_year'].some(k=>r[k])).map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>FIELDS.has(k))));}
let cached=null,expires=0,pending=null;
export async function catalog(){
 if(cached&&Date.now()<expires)return cached;
 if(pending)return pending;
 pending=(async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);
 try{
 const r=await fetch(SOURCE,{signal:controller.signal});if(!r.ok)throw Error('Source unavailable');
 const csv=parseCSV(await r.text());if(!csv[0]?.includes('Brand')||!csv[0]?.includes('HW Consensus Year'))throw Error('Invalid catalog');
 const rows=await recoverPublicationRanks(mapRows(csv),{sheetUrl:SOURCE,signal:controller.signal,headers:csv[0]});
 cached=sanitize(rows);expires=Date.now()+5*60*1000;return cached;
 }finally{clearTimeout(timer);}
 })().finally(()=>pending=null);
 return pending;
}
export async function handleRequest(event){
 if(event.httpMethod!=='GET')return reply(405,{error:'Use GET'},{Allow:'GET'});
 if(!authorized(event))return reply(401,{error:'Enter the viewer password to continue.'});
 try{return reply(200,{rows:await catalog()});}catch{return reply(502,{error:'Rankings could not be loaded. Please try again.'});}
}

export default async function(request){
 const result=await handleRequest({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='POST'?await request.text():''});
 return new Response(result.body,{status:result.statusCode,headers:result.headers});
}
