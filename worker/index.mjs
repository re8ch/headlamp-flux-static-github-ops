import {createRemoteJWKSet,jwtVerify} from 'jose';
import {publicSnapshot} from '../web/snapshot.mjs';
const issuer='https://token.actions.githubusercontent.com';
const jwks=createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
const headers={'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store','x-content-type-options':'nosniff'};
export function authorizeClaims(claims,env) {
  if(claims.repository!==env.SOURCE_REPOSITORY||claims.repository_id!==env.SOURCE_REPOSITORY_ID||claims.repository_owner_id!==env.SOURCE_OWNER_ID||claims.ref!=='refs/heads/main'||claims.environment!=='cluster-observation'||claims.workflow_ref!==`${env.SOURCE_REPOSITORY}/.github/workflows/node-contract-observer.yml@refs/heads/main`||!['schedule','workflow_dispatch'].includes(claims.event_name))throw new Error('Forbidden publisher');
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==='/latest.json'&&['GET','HEAD'].includes(request.method)){
      const object=await env.SNAPSHOTS.get('latest.json');
      if(!object)return new Response('{"error":"Unknown: no observation"}',{status:503,headers});
      return new Response(request.method==='HEAD'?null:object.body,{headers:{...headers,etag:object.httpEtag}});
    }
    if(url.pathname==='/api/snapshot'&&request.method==='POST'){
      try {
        const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
        if(!token) return new Response('Unauthorized',{status:401});
        const {payload}=await jwtVerify(token,jwks,{issuer,audience:env.PUBLISH_AUDIENCE,algorithms:['RS256'],maxTokenAge:'10m'});
        authorizeClaims(payload,env);
        const body=await request.text();if(body.length>512000)return new Response('Too large',{status:413});
        const input=JSON.parse(body);
        const unavailable=input.unavailable===true;
        const snapshot=unavailable?{schema:1,repository:input.repository,sha:input.sha,unavailable:true,batch:input.batch,observedAt:input.observedAt}:publicSnapshot(input);
        const index=unavailable?snapshot:JSON.parse(snapshot.indexCheck.output.text);
        const age=Date.now()-Date.parse(index.observedAt);if(!Number.isFinite(age)||age<0||age>900000)throw new Error('Invalid timestamp');
        if(snapshot.repository!==payload.repository||snapshot.sha!==payload.sha||index.batch!==`${payload.run_id}-${payload.run_attempt}`)throw new Error('Publisher revision mismatch');
        // CAS prevents a delayed job from overwriting a newer snapshot.
        const previous=await env.SNAPSHOTS.get('latest.json');
        if(previous){const prior=await previous.json();const at=prior.unavailable?prior.observedAt:JSON.parse(prior.indexCheck.output.text).observedAt;if(Date.parse(at)>=Date.parse(index.observedAt))return new Response('Older observation',{status:409});}
        const result=await env.SNAPSHOTS.put('latest.json',JSON.stringify(snapshot),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
        return new Response(result?'Published':'Concurrent publication',{status:result?201:409});
      }catch{return new Response('Invalid or unauthorized snapshot',{status:403});}
    }
    if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  }
};
