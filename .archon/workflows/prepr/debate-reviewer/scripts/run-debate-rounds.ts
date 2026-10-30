import {load,artifact,disputeIndex} from '../../.shared/evidence.ts';
import {currentFailure,recordFailure} from '../../.shared/failures.ts';
import { debateDispute, input, optionalInput, json, type Debate, type Finding, type ReviewResult, type Reviewer } from "../../.shared/core.ts";
import { reuseDiscussion } from "../../.shared/reuse.ts";
const operational=optionalInput('DISPUTE_INDEX')!=='';
if(currentFailure())throw new Error('Discussion stopped after an earlier run failure.');
const prepared=operational?await load('prepr-preparation.json'):undefined;
const comparison=operational?await load('prepr-comparison.json'):undefined;
const a=(operational?prepared.reviewers.a:JSON.parse(input('REVIEWER_A'))) as Reviewer,b=(operational?prepared.reviewers.b:JSON.parse(input('REVIEWER_B'))) as Reviewer;
a.side='a';b.side='b';
const reviewA=(operational?comparison.initialReviews.a:JSON.parse(input('REVIEW_A'))) as ReviewResult,reviewB=(operational?comparison.initialReviews.b:JSON.parse(input('REVIEW_B'))) as ReviewResult;
const index=operational?disputeIndex(input('DISPUTE_INDEX')):0;
const dispute=(operational?comparison.disputes[index]:JSON.parse(input('DISPUTE'))) as Finding[],all=(operational?comparison.findings:JSON.parse(optionalInput('FINDINGS')||'[]')) as Finding[];
if(!Array.isArray(dispute))throw new Error('Missing requested dispute.');
const path=operational?artifact('prepr-debate-cache.json'):optionalInput('CACHE_PATH'),runId=operational?Bun.env.WORKFLOW_ID!:optionalInput('RUN_ID'),scope=reviewA.scope;
console.error(`Discussion — ${a.name} (A) and ${b.name} (B).`);
type Cache = {runId:string; scope: unknown; sources: {debate:Debate; findings:Finding[]}[]; results:Debate[]};
let cache:Cache = {runId,scope,sources:[],results:[]};
if (path && runId && scope && JSON.stringify(scope)===JSON.stringify(reviewB.scope)) {
  if (await Bun.file(path).exists()) {
    const saved = await Bun.file(path).json() as Cache;
    if (saved.runId===runId && JSON.stringify(saved.scope)===JSON.stringify(scope)) cache=saved;
  }
  for (const source of cache.sources) {
    const reused = reuseDiscussion(source.debate,source.findings,dispute,all,scope,runId);
    if (reused) { cache.results.push(reused); await Bun.write(path,JSON.stringify(cache)); console.error(`Reused confirmed discussion ${reused.reuse!.sourceIds.join(', ')} for ${dispute.map(f=>f.id).join(', ')}; no reviewer turns launched.`); json(operational?{status:'completed',index}:reused); process.exit(0); }
  }
}
const debate = await debateDispute(a,b,reviewA,reviewB,dispute,3,all);
if (path && runId && scope && JSON.stringify(scope)===JSON.stringify(reviewB.scope)) {
  cache.sources.push({debate,findings:all});
  cache.results.push(debate);
  await Bun.write(path,JSON.stringify(cache));
}
if(debate.stopReason==='incomplete'){recordFailure({stage:'discussion',cause:'execution',message:'An original reviewer discussion turn did not complete.',recovery:'Inspect saved discussion diagnostics; resolve the native launcher failure before retrying.'});if(operational)process.exitCode=1;}
json(operational?{status:debate.stopReason==='incomplete'?'failed':'completed',index}:debate);
