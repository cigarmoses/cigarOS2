import {configured,equal,sameOrigin,token,cookie,TTL,reply} from './lib/viewer-auth.js';
// Netlify's platform rate limit applies across function instances, not an in-memory counter.
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
export async function handleRequest(event){
 if(event.httpMethod!=='POST')return reply(405,{error:'Use POST'},{Allow:'POST'});
 if(!sameOrigin(event))return reply(403,{error:'Invalid request origin'});
 if(!configured())return reply(503,{error:'Viewer access has not been configured yet.'});
 if(!/^application\/json(?:;|$)/i.test(event.headers?.['content-type']||event.headers?.['Content-Type']||''))return reply(415,{error:'Use application/json'});
 if((event.body||'').length>4096)return reply(413,{error:'Request too large'});
 let body;try{body=JSON.parse(event.body||'{}');}catch{return reply(400,{error:'Invalid request'});}
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.password!=='string'||!equal(body.password,process.env.RANKINGS_VIEWER_PASSWORD))return reply(401,{error:'Incorrect password.'});
 return reply(200,{ok:true},{'Set-Cookie':cookie(token(),TTL)});
}

export default async function(request){
 const result=await handleRequest({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='POST'?await request.text():''});
 return new Response(result.body,{status:result.statusCode,headers:result.headers});
}
