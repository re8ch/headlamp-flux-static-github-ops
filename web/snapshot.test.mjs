import test from 'node:test';import assert from 'node:assert/strict';
import {publicSnapshot,readSnapshot,autoRefresh} from './snapshot.mjs';
import {TTL,evidenceItems} from './evidence.mjs';
const sha='a'.repeat(40),observedAt=new Date().toISOString();
const index={schema:1,headSha:sha,batch:'1-1',observedAt,domains:[{id:'main',checkRunId:2,count:1}]};
const check=(id,name,data)=>({id,name,head_sha:sha,status:'completed',conclusion:'success',app:{id:5426288},output:{text:JSON.stringify(data)}});
const fixture={schema:1,repository:'re8ch/service-backend',sha,indexCheck:check(1,'flux-runtime',index),domainChecks:[check(2,'flux-runtime/main',{schema:1,headSha:sha,batch:'1-1',observedAt,domain:'main',items:[{kind:'HelmRelease',name:'app',namespace:'flux-system',domain:'main',state:'success',spec:{password:'PRIVATE'}}]})]};
test('public projection strips private fields, validates provenance, expires original time',()=>{
 const result=publicSnapshot(fixture);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 const parsed=readSnapshot(result);assert.equal(evidenceItems(parsed.runtime.index,parsed.runtime.domains,Date.parse(observedAt)+TTL)[0].state,'unknown');
 assert.throws(()=>publicSnapshot({...fixture,domainChecks:[]}));
 assert.throws(()=>publicSnapshot({...fixture,indexCheck:{...fixture.indexCheck,app:{id:1}}}));
});
test('automatic reads repeat after completion and stop cleanly',async()=>{
 let calls=0,scheduled,cleared=false;
 const stop=autoRefresh(async()=>{calls++;},{setTimer:fn=>{scheduled=fn;return 1;},clearTimer:()=>{cleared=true;}});
 await new Promise(setImmediate);assert.equal(calls,1);await scheduled();assert.equal(calls,2);stop();assert.equal(cleared,true);
});
