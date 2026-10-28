import { join } from "node:path";
import { compare, findings, input, json, type ReviewResult } from "../../.shared/core.ts";

const a = JSON.parse(input("REVIEW_A")) as ReviewResult;
const b = JSON.parse(input("REVIEW_B")) as ReviewResult;
if (a.status !== "completed" || b.status !== "completed") {
  const output={ready:false,initialReviews:{a,b},errors:[a,b].filter(result=>result.status!=="completed")};
  if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,'prepr-comparison.json'),JSON.stringify(output));
  json(output);
} else {
  const result = compare(findings("reviewer-a", a.stdout, process.cwd(), a.severityMap, "reviewer-a profile"), findings("reviewer-b", b.stdout, process.cwd(), b.severityMap, "reviewer-b profile"));
  const output = { ready: true, runId: Bun.env.WORKFLOW_ID, initialReviews: { a, b }, reviewers: { a: a.reviewer, b: b.reviewer }, ...result };
  if (Bun.env.ARTIFACTS_DIR) await Bun.write(join(Bun.env.ARTIFACTS_DIR,"prepr-comparison.json"),JSON.stringify(output));
  json(output);
}
