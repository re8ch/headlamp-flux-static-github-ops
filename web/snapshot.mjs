export const REFRESH_MS=15000;
export const TTL=900000;
export const DOMAIN_IDS=['main','networking','identity-access','agent-runtime','observability-metering','delivery-products'];
export const SYNC_KEYS=['synced','drifted','failed','unknown'];
export const HEALTH_KEYS=['healthy','unhealthy','unknown'];
const iso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)&&Number.isFinite(Date.parse(x));
export const fresh=(value,now=Date.now())=>iso(value)&&now-Date.parse(value)>=0&&now-Date.parse(value)<TTL;
function counts(value,keys){
 if(!value||typeof value!=='object')throw new Error('Missing aggregate');
 return Object.fromEntries(keys.map(k=>{const n=value[k];if(!Number.isSafeInteger(n)||n<0||n>1000000)throw new Error('Invalid count');return [k,n];}));
}
// This is the only public projection. No arbitrary labels, URLs or object details survive.
export function publicSnapshot(input){
 if(input?.schema!==2||!/^[-\w.]+\/[-\w.]+$/.test(input.repository||'')||!/^[a-f0-9]{40}$/.test(input.sha||'')||!/^\d+-\d+$/.test(input.batch||'')||!iso(input.observedAt)||typeof input.complete!=='boolean'||!Array.isArray(input.domains))throw new Error('Invalid aggregate snapshot');
 const base={schema:2,repository:input.repository,sha:input.sha,batch:input.batch,observedAt:input.observedAt,complete:input.complete};
 if(!input.complete){if(input.domains.length)throw new Error('Unavailable snapshot must be empty');return {...base,domains:[]};}
 if(input.domains.length!==DOMAIN_IDS.length||new Set(input.domains.map(d=>d.id)).size!==DOMAIN_IDS.length)throw new Error('Incomplete domains');
 const domains=DOMAIN_IDS.map(id=>{
  const d=input.domains.find(x=>x.id===id);if(!d||!['current','unavailable'].includes(d.observation?.status)||!iso(d.observation?.observedAt))throw new Error('Invalid domain observation');
  const o=d.operations;if(!o||!['succeeded','failed','running','unknown'].includes(o.status)||(o.observedAt!==null&&!iso(o.observedAt))||(o.status!=='unknown'&&o.observedAt===null))throw new Error('Invalid operation observation');
  return {id,sync:counts(d.sync,SYNC_KEYS),health:counts(d.health,HEALTH_KEYS),observation:{status:d.observation.status,observedAt:d.observation.observedAt},operations:{status:o.status,observedAt:o.observedAt}};
 });
 return {...base,domains};
}
export function readSnapshot(input,now=Date.now()){
 const s=publicSnapshot(input),current=s.complete&&fresh(s.observedAt,now);
 const domains=DOMAIN_IDS.map(id=>{
  const d=s.domains.find(x=>x.id===id),observed=current&&d?.observation.status==='current'&&fresh(d.observation.observedAt,now);
  const sync=observed?d.sync:null,health=observed?d.health:null;
  return {id,sync,health,observation:observed?'current':'unknown',observedAt:d?.observation.observedAt||s.observedAt,
   syncState:!sync?'unknown':sync.failed?'failed':sync.drifted?'drifted':sync.unknown||!sync.synced?'unknown':'synced',
   healthState:!health?'unknown':health.unhealthy?'unhealthy':health.unknown||!health.healthy?'unknown':'healthy',
   operations:observed&&(!d.operations.observedAt||Date.parse(d.operations.observedAt)<=now)?d.operations:{status:'unknown',observedAt:null}};
 });
 return {...s,domains,observation:current&&domains.every(d=>d.observation==='current')?'current':'unknown'};
}
export function metrics(input,now=Date.now()){
 let domains;try{domains=readSnapshot(input,now).domains;}catch{domains=DOMAIN_IDS.map(id=>({id,syncState:'unknown',healthState:'unknown',observation:'unknown'}));}
 const lines=['# HELP re8ch_gitops_sync_status Cloud release synchronization state (one hot).','# TYPE re8ch_gitops_sync_status gauge','# HELP re8ch_gitops_health_status Observed workload health (one hot).','# TYPE re8ch_gitops_health_status gauge','# TYPE re8ch_gitops_observation_current gauge','# TYPE re8ch_gitops_sync_releases gauge','# TYPE re8ch_gitops_health_workloads gauge'];
 for(const d of domains){
  for(const state of SYNC_KEYS){lines.push(`re8ch_gitops_sync_status{domain="${d.id}",sync="${state}"} ${Number(d.syncState===state)}`);lines.push(`re8ch_gitops_sync_releases{domain="${d.id}",sync="${state}"} ${d.sync?.[state]??'NaN'}`);}
  for(const state of HEALTH_KEYS){lines.push(`re8ch_gitops_health_status{domain="${d.id}",health="${state}"} ${Number(d.healthState===state)}`);lines.push(`re8ch_gitops_health_workloads{domain="${d.id}",health="${state}"} ${d.health?.[state]??'NaN'}`);}
  lines.push(`re8ch_gitops_observation_current{domain="${d.id}"} ${Number(d.observation==='current')}`);
 }
 return lines.join('\n')+'\n';
}
export function autoRefresh(refresh,{setTimer=setTimeout,clearTimer=clearTimeout,interval=REFRESH_MS}={}){
 let stopped=false,timer;async function tick(){try{await refresh();}finally{if(!stopped)timer=setTimer(tick,interval);}}void tick();return ()=>{stopped=true;clearTimer(timer);};
}
