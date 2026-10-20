import { createHash } from "node:crypto";
import type { Debate } from "./core.ts";
import type { ReviewScope } from "./scope.ts";
import { sameLocation, severityConflict, type Finding } from "./findings.ts";
export type Reuse = { runId: string; scope: ReviewScope; sourceIds: string[]; candidateIds: string[]; fingerprint: string; confirmations: { a: string[]; b: string[] } };
const fingerprint = (findings: Finding[]) => createHash('sha256').update(JSON.stringify(findings)).digest('hex');
export function reuseDiscussion(source: Debate, originalFindings: Finding[], pending: Finding[], currentFindings: Finding[], scope: ReviewScope, runId: string): Debate | undefined {
  const last = source.rounds.at(-1);
  if (!pending.length || !last || source.reuse || source.conclusion === 'unresolved' || !['agreement'].includes(source.stopReason)) return;
  if (last.reviewerA.status !== 'completed' || last.reviewerB.status !== 'completed' || !last.positionA.verdict || last.positionA.verdict !== last.positionB.verdict || (last.positionA.stance==='agree_to_disagree' && last.positionB.stance==='agree_to_disagree')) return;
  if (severityConflict(last.positionA,last.positionB)) return;
  if (source.conclusion !== (last.positionA.verdict==='issue'?'converged-on-issue':'converged-on-no-issue')) return;
  if (source.rounds.some(round=>Boolean(round.positionA.correctedFinding || round.positionB.correctedFinding))) return;
  const a=last.positionA.sameConcernAs??[], b=last.positionB.sameConcernAs??[];
  const selected=[...source.dispute,...pending];
  if (selected.some(f=>!originalFindings.some(original=>original.id===f.id && fingerprint([original])===fingerprint([f])) || !currentFindings.some(current=>current.id===f.id && fingerprint([current])===fingerprint([f])))) return;
  if (pending.some(f=>!a.includes(f.id)||!b.includes(f.id)||!source.dispute.some(other=>sameLocation(f,other)) || (f.verdict && f.verdict!==last.positionA.verdict) || source.dispute.some(other=>severityConflict(f,other)) || severityConflict(f,last.positionA) || severityConflict(f,last.positionB))) return;
  const reuse: Reuse={runId,scope,sourceIds:source.dispute.map(f=>f.id),candidateIds:pending.map(f=>f.id),fingerprint:fingerprint(selected),confirmations:{a,b}};
  return {dispute:pending,rounds:[],stopReason:'reused',conclusion:source.conclusion,reuse};
}
