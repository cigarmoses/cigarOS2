import {sameOrigin,cookie,reply} from './lib/viewer-auth.js';
export async function handleRequest(event){
 if(event.httpMethod!=='POST')return reply(405,{error:'Use POST'},{Allow:'POST'});
 if(!sameOrigin(event))return reply(403,{error:'Invalid request origin'});
 return reply(200,{ok:true},{'Set-Cookie':cookie('',0)});
}

export default async function(request){
 const result=await handleRequest({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='POST'?await request.text():''});
 return new Response(result.body,{status:result.statusCode,headers:result.headers});
}
