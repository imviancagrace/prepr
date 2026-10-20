import type { ReviewResult } from "./core.ts";
export type Check = { name: string; status: "passed" | "failed" | "blocked" | "not run" | "unknown"; evidence: string; reviewer: string; snapshot?: string };
export const limitSentences = (text: string) => text.replace(/\s+/g," ").split(/(?<=[.!?])\s+/).filter(sentence => /\b(unverified|not verified|not run|did not run|not reproduced|not tested|could not|unavailable|unknown|conditional|depends on|if|unless|freshness)\b/i.test(sentence));
export function verification(result?: ReviewResult): { checks: Check[]; limitations: string[] } {
  if (!result) return { checks: [{name:"Project checks",status:"unknown",evidence:"No execution evidence supplied.",reviewer:"unknown"}], limitations: [] };
  const snapshot = result.scope?.snapshotId || result.scope?.targetSha;
  const text = result.stdout || "";
  let record: any;
  for (const candidate of [text,...[...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].reverse().map(m=>m[1]),...text.split("\n").flatMap((line,index,lines)=>line.trim().startsWith("{")?[lines.slice(index).join("\n")]:[]).reverse()]) {
    try { const parsed=JSON.parse(candidate); if(parsed && (parsed.verification!==undefined || parsed.limitations!==undefined)){record=parsed;break;} } catch {}
  }
  const checks: Check[] = [];
  if (Array.isArray(record?.verification)) for (const check of record.verification) {
    if (!check || typeof check.name!=="string") continue;
    checks.push({name:check.name,status:["passed","failed","blocked","not run","unknown"].includes(check.status)?check.status:"unknown",evidence:typeof check.evidence==="string"?check.evidence:"No supporting execution output supplied.",reviewer:result.reviewer,snapshot:typeof check.snapshot==="string"?check.snapshot:snapshot});
  }
  const evidence = typeof record?.verification==="string" ? record.verification : text.split("\n").filter(line=>/verification:|did not run|tests? (?:were )?not run|freshness check|remains? unverified/i.test(line)).join(" ");
  if (!checks.length) checks.push({ name:"Project checks", status:/did not run|tests? (?:were )?not run/i.test(evidence)?"not run":"unknown", evidence:evidence || "No explicit project-check execution status supplied.", reviewer:result.reviewer, snapshot });
  const limitations = [...new Set([...(Array.isArray(record?.limitations)?record.limitations.filter((v: unknown)=>typeof v==="string"):[]),...limitSentences(evidence),...(result.status!=="completed"?[`Reviewer execution ${result.status}; the review is incomplete.`]:[])])];
  return { checks, limitations };
}
