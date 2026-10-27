import {createRemoteJWKSet,jwtVerify} from 'jose';
import {publicSnapshot,fresh,metrics} from '../web/snapshot.mjs';
const issuer='https://token.actions.githubusercontent.com';
const jwks=createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
const headers={'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store','x-content-type-options':'nosniff'};
export function authorizeClaims(claims,env){
 if(claims.repository!==env.SOURCE_REPOSITORY||claims.repository_id!==env.SOURCE_REPOSITORY_ID||claims.repository_owner_id!==env.SOURCE_OWNER_ID||claims.ref!=='refs/heads/main'||claims.environment!=='cluster-observation'||claims.workflow_ref!==`${env.SOURCE_REPOSITORY}/.github/workflows/node-contract-observer.yml@refs/heads/main`||!['schedule','workflow_dispatch'].includes(claims.event_name))throw new Error('Forbidden publisher');
}
export function authorizeSnapshot(input,payload,now=Date.now()){
 const s=publicSnapshot(input);
 if(!fresh(s.observedAt,now)||s.repository!==payload.repository||s.sha!==payload.sha||s.batch!==`${payload.run_id}-${payload.run_attempt}`)throw new Error('Publisher revision mismatch or expired observation');
 return s;
}
function observationTime(previous){
 if(previous?.schema===2||previous?.unavailable)return Date.parse(previous.observedAt);
 try{return Date.parse(JSON.parse(previous.indexCheck.output.text).observedAt);}catch{return NaN;}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(['/latest.json','/metrics'].includes(url.pathname)&&['GET','HEAD'].includes(request.method)){
   let input;try{const object=await env.SNAPSHOTS.get('latest.json');if(object)input=await object.json();}catch{}
   if(url.pathname==='/metrics')return new Response(request.method==='HEAD'?null:metrics(input),{headers:{...headers,'content-type':'text/plain; version=0.0.4; charset=utf-8'}});
   try{const snapshot=publicSnapshot(input);if(!fresh(snapshot.observedAt))throw new Error('Expired');return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});}
   catch{return new Response('{"error":"Unknown: no current aggregate observation"}',{status:503,headers});}
  }
  if(url.pathname==='/api/snapshot'&&request.method==='POST'){
   try{
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return new Response('Unauthorized',{status:401});
    const {payload}=await jwtVerify(token,jwks,{issuer,audience:env.PUBLISH_AUDIENCE,algorithms:['RS256'],maxTokenAge:'10m'});authorizeClaims(payload,env);
    const body=await request.text();if(body.length>512000)return new Response('Too large',{status:413});
    const snapshot=authorizeSnapshot(JSON.parse(body),payload);
    const previous=await env.SNAPSHOTS.get('latest.json');
    if(previous&&observationTime(await previous.json())>=Date.parse(snapshot.observedAt))return new Response('Older observation',{status:409});
    const result=await env.SNAPSHOTS.put('latest.json',JSON.stringify(snapshot),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
    return new Response(result?'Published':'Concurrent publication',{status:result?201:409});
   }catch{return new Response('Invalid or unauthorized snapshot',{status:403});}
  }
  if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
  return env.ASSETS.fetch(request);
 }
};
