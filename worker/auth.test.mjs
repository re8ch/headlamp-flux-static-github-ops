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
