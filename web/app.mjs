import {readSnapshot,autoRefresh} from './snapshot.mjs';
const byId=id=>document.getElementById(id);
const labels={main:'Main',networking:'Networking','identity-access':'Identity','agent-runtime':'Agent','observability-metering':'Observability','delivery-products':'Delivery products'};
const titles={synced:'Synced',drifted:'Drifted',failed:'Failed',unknown:'Unknown',healthy:'Healthy',unhealthy:'Degraded',current:'Current',succeeded:'Succeeded',running:'Running'};
let raw,busy=false;
function badge(state){const e=document.createElement('span');e.className='badge '+(['healthy','synced','current','succeeded'].includes(state)?'success':['failed','unhealthy','drifted'].includes(state)?'failure':'unknown');e.textContent=titles[state]||'Unknown';return e;}
function cell(row,value){const td=document.createElement('td');value instanceof Node?td.append(value):td.textContent=value;row.append(td);}
function counts(values){return values?Object.entries(values).map(([k,v])=>`${v} ${k}`).join(' · '):'—';}
function render(){
 let view;try{view=readSnapshot(raw);}catch{view=null;}
 const body=byId('domains');body.replaceChildren();
 for(const d of view?.domains||[]){const row=document.createElement('tr');cell(row,labels[d.id]);cell(row,badge(d.syncState));cell(row,counts(d.sync));cell(row,badge(d.healthState));cell(row,counts(d.health));cell(row,badge(d.observation));cell(row,d.observedAt);const op=document.createElement('div');op.append(badge(d.operations.status));const time=document.createElement('small');time.className='subtext';time.textContent=d.operations.observedAt||'No current operation evidence';op.append(time);cell(row,op);body.append(row);}
 if(!view){const row=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Unknown · No current aggregate observation';row.append(td);body.append(row);}
 byId('observation').replaceChildren(badge(view?.observation||'unknown'));
 byId('sync').replaceChildren(badge(!view||view.domains.some(d=>d.syncState==='unknown')?'unknown':view.domains.some(d=>d.syncState==='failed')?'failed':view.domains.some(d=>d.syncState==='drifted')?'drifted':'synced'));
 byId('health').replaceChildren(badge(!view?'unknown':view.domains.some(d=>d.healthState==='unhealthy')?'unhealthy':view.domains.some(d=>d.healthState==='unknown')?'unknown':'healthy'));
 byId('revision').textContent=view?`${view.repository} · ${view.sha} · batch ${view.batch}`:'';
}
async function refresh(){if(busy)return;busy=true;byId('refresh').disabled=true;try{const response=await fetch('/latest.json',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Observation unavailable');raw=await response.json();readSnapshot(raw);byId('message').textContent='';}catch{raw=undefined;byId('message').textContent='Unknown · Public observation is unavailable. The next refresh will retry.';}finally{render();busy=false;byId('refresh').disabled=false;}}
byId('refresh').addEventListener('click',refresh);setInterval(render,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();void refresh();}});autoRefresh(refresh);
