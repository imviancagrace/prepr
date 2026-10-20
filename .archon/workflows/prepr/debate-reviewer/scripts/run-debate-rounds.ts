import { debateDispute, input, optionalInput, json, type Debate, type Finding, type ReviewResult, type Reviewer } from "../../.shared/core.ts";
import { reuseDiscussion } from "../../.shared/reuse.ts";
const a = JSON.parse(input("REVIEWER_A")) as Reviewer, b = JSON.parse(input("REVIEWER_B")) as Reviewer;
const reviewA = JSON.parse(input("REVIEW_A")) as ReviewResult, reviewB = JSON.parse(input("REVIEW_B")) as ReviewResult;
const dispute = JSON.parse(input("DISPUTE")) as Finding[], all = JSON.parse(optionalInput("FINDINGS") || "[]") as Finding[];
const path = optionalInput("CACHE_PATH"), runId = optionalInput("RUN_ID"), scope = reviewA.scope;
type Cache = {runId:string; scope: unknown; sources: {debate:Debate; findings:Finding[]}[]; results:Debate[]};
let cache:Cache = {runId,scope,sources:[],results:[]};
if (path && runId && scope && JSON.stringify(scope)===JSON.stringify(reviewB.scope)) {
  if (await Bun.file(path).exists()) {
    const saved = await Bun.file(path).json() as Cache;
    if (saved.runId===runId && JSON.stringify(saved.scope)===JSON.stringify(scope)) cache=saved;
  }
  for (const source of cache.sources) {
    const reused = reuseDiscussion(source.debate,source.findings,dispute,all,scope,runId);
    if (reused) { cache.results.push(reused); await Bun.write(path,JSON.stringify(cache)); console.error(`Reused confirmed discussion ${reused.reuse!.sourceIds.join(', ')} for ${dispute.map(f=>f.id).join(', ')}; no reviewer turns launched.`); json(reused); process.exit(0); }
  }
}
const debate = await debateDispute(a,b,reviewA,reviewB,dispute,3,all);
if (path && runId && scope && JSON.stringify(scope)===JSON.stringify(reviewB.scope)) {
  cache.sources.push({debate,findings:all});
  cache.results.push(debate);
  await Bun.write(path,JSON.stringify(cache));
}
json(debate);
