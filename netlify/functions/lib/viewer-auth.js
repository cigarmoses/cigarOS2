import {createHmac, timingSafeEqual, createHash} from 'node:crypto';
export const COOKIE='rankings_viewer';
export const TTL=8*60*60;
export const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
export const reply=(statusCode,body,extra={})=>({statusCode,headers:{...headers,...extra},body:JSON.stringify(body)});
export function equal(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());}
function signature(data){return createHmac('sha256',process.env.RANKINGS_SESSION_SECRET).update(data).digest('base64url');}
export function configured(){return Boolean(process.env.RANKINGS_VIEWER_PASSWORD?.length>=12 && process.env.RANKINGS_SESSION_SECRET?.length>=32);}
export function token(now=Date.now()){
 const body=Buffer.from(JSON.stringify({aud:'rankings-viewer',exp:Math.floor(now/1000)+TTL})).toString('base64url');
 return `${body}.${signature(body)}`;
}
export function authorized(event,now=Date.now()){
 if(!configured())return false;
 const raw=event.headers?.cookie||event.headers?.Cookie||'';
 const value=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
 const parts=value.split('.');if(parts.length!==2)return false;
 try {if(!equal(parts[1],signature(parts[0])))return false;
 const p=JSON.parse(Buffer.from(parts[0],'base64url'));
 return p.aud==='rankings-viewer' && Number.isInteger(p.exp) && p.exp>Math.floor(now/1000) && p.exp<=Math.floor(now/1000)+TTL;
 }catch{return false;}
}
export function sameOrigin(event){
 const origin=event.headers?.origin||event.headers?.Origin;
 // Only browser same-origin POSTs. curl/absent-Origin is intentionally rejected.
 const host=event.headers?.host||event.headers?.Host;
 try{return Boolean(origin&&host&&new URL(origin).host===host&&['http:','https:'].includes(new URL(origin).protocol));}catch{return false;}
}
export const cookie=(value,age)=>`${COOKIE}=${value}; Path=/.netlify/functions/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
