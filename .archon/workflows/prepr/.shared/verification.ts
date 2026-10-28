import type { ReviewResult } from "./core.ts";
export type Check = { name: string; status: "passed" | "failed" | "blocked" | "not run" | "unknown"; evidence: string; reviewer: string; snapshot?: string };
export type Verification = { checks: Check[]; limitations: string[]; overview?: string; assessments?: unknown };
export const limitSentences = (text: string) => text.replace(/\s+/g," ").split(/(?<=[.!?])\s+/).filter(sentence => /\b(unverified|not verified|not run|did not run|not reproduced|not tested|could not|unavailable|unknown|conditional|depends on|if|unless|freshness)\b/i.test(sentence));

function reviewRecord(text: string) {
  const candidates = [{ at: 0, text },
    ...[...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map(m => ({ at: m.index!, text: m[1] })),
    ...[...text.matchAll(/(?:^|\n)[ \t]*(\{)/g)].map(m => ({ at: m.index!, text: text.slice(m.index!).trim() })),
  ].sort((a, b) => b.at - a.at).flatMap(candidate => {
    try { const value = JSON.parse(candidate.text); return value && typeof value === 'object' && !Array.isArray(value) ? [value] : []; } catch { return []; }
  });
  // Prefer the final review envelope over progress objects or nested assessment fragments.
  return candidates.find(value => Array.isArray(value.findings) || value.overview !== undefined || value.assessments !== undefined) ?? candidates.find(value => value.verification !== undefined || value.limitations !== undefined);
}

const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
function proseStatus(text: string): Check['status'] {
  if (/\b(unverified|unknown|not verified|interrupted|inconclusive|not (?:all|every)|(?:would|could|should|might|may|expected|not|never|no|0).{0,25}\b(?:pass(?:ed)?|fail(?:ed)?|blocked))\b/i.test(text)) return 'unknown';
  const statuses: Check['status'][] = [];
  if (/\b(not run|did not run|didn't run|not executed)\b/i.test(text)) statuses.push('not run');
  if (/\bblocked\b/i.test(text)) statuses.push('blocked');
  if (/\bfailed\b/i.test(text)) statuses.push('failed');
  if (/\bpassed\b/i.test(text)) statuses.push('passed');
  return statuses.length === 1 ? statuses[0] : 'unknown';
}

export function verification(result?: ReviewResult): Verification {
  if (!result) return { checks: [{name:"Project checks",status:"unknown",evidence:"No execution evidence supplied.",reviewer:"unknown"}], limitations: [] };
  const snapshot = result.scope?.snapshotId || result.scope?.targetSha;
  const text = result.stdout || "";
  const record = reviewRecord(text);
  const supplied = record?.verification;
  const checks: Check[] = [];
  for (const check of Array.isArray(supplied) ? supplied : Array.isArray(supplied?.checks) ? supplied.checks : typeof supplied === 'string' ? [supplied] : []) {
    if (typeof check === 'string') {
      checks.push({name:'Project check',status:proseStatus(check),evidence:check,reviewer:result.reviewer,snapshot});
      continue;
    }
    if (!check || typeof check.name!=="string") continue;
    checks.push({name:check.name,status:["passed","failed","blocked","not run","unknown"].includes(check.status)?check.status:"unknown",evidence:typeof check.evidence==="string"?check.evidence:"No supporting execution output supplied.",reviewer:result.reviewer,snapshot:typeof check.snapshot==="string"?check.snapshot:snapshot});
  }
  const evidence = record ? '' : text.split("\n").filter(line=>/verification:|did not run|tests? (?:were )?not run|freshness check|remains? unverified/i.test(line)).join(" ");
  if (!checks.length) checks.push({ name:"Project checks", status:proseStatus(evidence), evidence:evidence || "No explicit project-check execution status supplied.", reviewer:result.reviewer, snapshot });
  const overview = typeof record?.overview === 'string' ? record.overview : undefined;
  const limitations = [...new Set([...strings(supplied?.limitations),...strings(record?.limitations),...limitSentences(overview ?? ''),...checks.flatMap(check=>limitSentences(check.evidence)),...(result.status!=="completed"?[`Reviewer execution ${result.status}; the review is incomplete.`]:[])])];
  if(result.runtime)checks.unshift({name:'Actual reviewer response',status:result.runtime.responseObserved?'passed':'unknown',evidence:result.runtime.responseObserved?`Response observed from the selected ${result.runtime.launcher} session requested with model ${result.runtime.model}; this does not establish undeclared resource access.`:`No successful model response established for ${result.runtime.launcher} / ${result.runtime.model}.`,reviewer:result.reviewer,snapshot});
  for(const resource of result.runtime?.resources??[]) {
    checks.push({name:`Resource ${resource.tool} ${resource.resource}`,status:resource.status==='verified'?'passed':resource.required?'blocked':'unknown',evidence:resource.status==='verified'?'Successful read observed in the actual reviewer session.':'Reviewer access not verified by an observed successful read.',reviewer:result.reviewer,snapshot});
    if(resource.status!=='verified')limitations.push(`${resource.required?'Required':'Optional'} resource ${resource.resource} unavailable or unverified; ${resource.required?'affected assessment is incomplete':'context is limited'}.`);
  }
  return { checks, limitations, ...(overview !== undefined ? {overview} : {}), ...(record?.assessments !== undefined ? {assessments:record.assessments} : {}) };
}
