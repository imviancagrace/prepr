import {load} from '../../.shared/evidence.ts';
import {currentFailure,recordFailure} from '../../.shared/failures.ts';
const scope=await load('prepr-scope.json').catch(()=>undefined);
if(scope?.previewOnly){console.log(JSON.stringify({preview:scope.preview}));process.exit(0);}
let failure=currentFailure();
if(!failure) {
 const comparison=await load('prepr-comparison.json').catch(()=>undefined),cache=await load('prepr-debate-cache.json').catch(()=>undefined);
 const expected=comparison?.disputes??[];
 if(!comparison?.ready||expected.some((d:any)=>!cache?.results?.some((r:any)=>JSON.stringify(r.dispute.map((f:any)=>f.id))===JSON.stringify(d.map((f:any)=>f.id))&&r.stopReason!=='incomplete')))
  failure=recordFailure({stage:comparison?.ready?'discussion':'initial review',cause:'orchestration',message:comparison?.ready?'Required discussion results are missing or incomplete.':'A complete pair of initial reviews was not established.',recovery:'Inspect the failed Archon node and retained JSON diagnostics; no successful review is claimed.'});
}
if(failure)throw new Error(`${failure.reviewer??failure.stage}: ${failure.message} ${failure.recovery}`);
console.log(JSON.stringify({report:{type:'archon_artifact',run_id:Bun.env.WORKFLOW_ID,path:'prepr-report.md'},data:{type:'archon_artifact',run_id:Bun.env.WORKFLOW_ID,path:'prepr-report.json'}}));
