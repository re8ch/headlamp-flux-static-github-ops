import {readIndex,readDomain,fresh} from './evidence.mjs';
export const REFRESH_MS=15000;
const fields=['kind','name','namespace','domain','generation','observedGeneration','suspended','watched','ready','reason','reconciling','stalled','revision','digest','desired','updated','available','images','state'];
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
// Only the reviewed public projection leaves the authenticated ingestion boundary.
export function publicSnapshot(input) {
  if(input?.schema!==1||!/^[-\w.]+\/[-\w.]+$/.test(input.repository||'')||!/^[a-f0-9]{40}$/.test(input.sha||''))throw new Error('Invalid snapshot');
  const index=readIndex(input.indexCheck,input.sha);
  if(!fresh(index.observedAt))throw new Error('Expired or future observation');
  if(!Array.isArray(input.domainChecks)||input.domainChecks.length!==index.domains.length)throw new Error('Incomplete domains');
  const domainChecks=index.domains.map(d=>{
    const check=input.domainChecks.find(c=>c.id===d.checkRunId),data=readDomain(check,index,d);
    return {...pick(check,['id','name','head_sha','status','conclusion']),app:{id:check.app.id},output:{text:JSON.stringify({...pick(data,['schema','headSha','batch','observedAt','domain']),items:data.items.map(x=>pick(x,fields))})}};
  });
  return {schema:1,repository:input.repository,sha:input.sha,indexCheck:{...pick(input.indexCheck,['id','name','head_sha','status','conclusion']),app:{id:input.indexCheck.app.id},output:{text:JSON.stringify(pick(index,['schema','headSha','batch','observedAt','domains']))}},domainChecks,
    checks:(input.checks||[]).slice(0,100).map(x=>pick(x,['name','html_url','status','conclusion','completed_at','started_at'])),
    statuses:(input.statuses||[]).slice(0,100).map(x=>pick(x,['context','target_url','state','created_at'])),
    deployments:(input.deployments||[]).slice(0,3).map(x=>({...pick(x,['environment','sha','created_at']),latest:pick(x.latest||{},['state','created_at'])}))};
}
export function readSnapshot(input) {
  if(input?.schema!==1||!/^[-\w.]+\/[-\w.]+$/.test(input.repository||'')||!/^[a-f0-9]{40}$/.test(input.sha||''))throw new Error('Invalid snapshot');
  const index=readIndex(input.indexCheck,input.sha);
  if(!Array.isArray(input.domainChecks)||input.domainChecks.length!==index.domains.length)throw new Error('Incomplete domains');
  const domains=index.domains.map(d=>readDomain(input.domainChecks.find(c=>c.id===d.checkRunId),index,d));
  return {sha:input.sha,repository:input.repository,statuses:input.statuses||[],checks:input.checks||[],deployments:input.deployments||[],runtime:{index,domains}};
}
// Sequential fetches, also used by the browser; failure clears health immediately.
export function autoRefresh(refresh,{setTimer=setTimeout,clearTimer=clearTimeout,interval=REFRESH_MS}={}) {
  let stopped=false,timer;
  async function tick(){try{await refresh();}finally{if(!stopped)timer=setTimer(tick,interval);}}
  void tick();return ()=>{stopped=true;clearTimer(timer);};
}
