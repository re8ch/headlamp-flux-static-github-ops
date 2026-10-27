import test from 'node:test';import assert from 'node:assert/strict';import worker,{authorizeClaims} from './index.mjs';
const env={SOURCE_REPOSITORY:'re8ch/service-backend',SOURCE_REPOSITORY_ID:'1367237854',SOURCE_OWNER_ID:'283958313'};
const good={repository:env.SOURCE_REPOSITORY,repository_id:env.SOURCE_REPOSITORY_ID,repository_owner_id:env.SOURCE_OWNER_ID,ref:'refs/heads/main',environment:'cluster-observation',workflow_ref:'re8ch/service-backend/.github/workflows/node-contract-observer.yml@refs/heads/main',event_name:'schedule'};
test('only exact production observer identity is accepted',()=>{
 authorizeClaims(good,env);
 for(const change of [{repository:'attacker/repo'},{repository_id:'1'},{repository_owner_id:'1'},{ref:'refs/pull/1/merge'},{environment:'other'},{workflow_ref:'other'},{event_name:'pull_request'}])assert.throws(()=>authorizeClaims({...good,...change},env));
});
test('public reads never query GitHub; absent data and unauthorized writes fail closed',async()=>{
 const response=await worker.fetch(new Request('https://example/latest.json'),{SNAPSHOTS:{get:async()=>null}});assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await worker.fetch(new Request('https://example/api/snapshot',{method:'POST'}),env)).status,401);
});

test('legacy R2 detail is never returned; metrics explicitly report Unknown',async()=>{
 const env={SNAPSHOTS:{get:async()=>({json:async()=>({schema:1,domainChecks:[{secret:'PRIVATE'}]})})}};
 const response=await worker.fetch(new Request('https://example/latest.json'),env);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));
 const metric=await worker.fetch(new Request('https://example/metrics'),env);assert.equal(metric.status,200);assert.match(await metric.text(),/sync="unknown"\} 1/);
});

test('aggregate upload remains bound to exact SHA, run and original observation time',async()=>{
 const {authorizeSnapshot}=await import('./index.mjs');const observedAt=new Date().toISOString();const s={schema:2,repository:'re8ch/service-backend',sha:'a'.repeat(40),batch:'1-2',observedAt,complete:false,domains:[]};const p={repository:s.repository,sha:s.sha,run_id:'1',run_attempt:'2'};
 assert.equal(authorizeSnapshot(s,p).complete,false);
 for(const change of [{sha:'b'.repeat(40)},{repository:'other/repo'},{run_id:'2'},{run_attempt:'3'}])assert.throws(()=>authorizeSnapshot(s,{...p,...change}));
 assert.throws(()=>authorizeSnapshot(s,p,Date.parse(observedAt)+900000));assert.throws(()=>authorizeSnapshot(s,p,Date.parse(observedAt)-1));
});
