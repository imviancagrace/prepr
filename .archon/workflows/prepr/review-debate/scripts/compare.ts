import {load} from '../../.shared/evidence.ts';
import { join } from "node:path";
import { compare, findings, input, optionalInput, json, type ReviewResult } from "../../.shared/core.ts";

const a = optionalInput("REVIEW_A")?JSON.parse(input("REVIEW_A")):await load("prepr-initial-a.json") as ReviewResult;
const b = optionalInput("REVIEW_B")?JSON.parse(input("REVIEW_B")):await load("prepr-initial-b.json") as ReviewResult;
if (a.status !== "completed" || b.status !== "completed") {
  const output={ready:false,initialReviews:{a,b},errors:[a,b].filter(result=>result.status!=="completed")};
  if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,'prepr-comparison.json'),JSON.stringify(output));
  json(optionalInput("EVIDENCE_ONLY")==="true"?{ready:false,hasDisputes:false,disputeIds:[]}:output);
} else {
  const result = compare(findings("reviewer-a", a.stdout, process.cwd(), a.severityMap, "reviewer-a profile"), findings("reviewer-b", b.stdout, process.cwd(), b.severityMap, "reviewer-b profile"));
  const output = { ready: true, runId: Bun.env.WORKFLOW_ID, initialReviews: { a, b }, reviewers: { a: a.reviewer, b: b.reviewer }, ...result };
  if (Bun.env.ARTIFACTS_DIR) await Bun.write(join(Bun.env.ARTIFACTS_DIR,"prepr-comparison.json"),JSON.stringify(output));
  json(optionalInput("EVIDENCE_ONLY")==="true"?{ready:true,hasDisputes:output.disputes.length>0,disputeIds:output.disputes.map((_:unknown,i:number)=>String(i))}:output);
}
