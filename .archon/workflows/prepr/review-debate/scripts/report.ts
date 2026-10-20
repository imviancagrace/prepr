import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { optionalInput, json, type Debate } from "../../.shared/core.ts";
import { buildReport, markdownReport } from "./reporting.ts";
const artifactsDir = Bun.env.ARTIFACTS_DIR;
if (!artifactsDir) throw new Error("Archon did not provide ARTIFACTS_DIR; Prepr reports must be run through Archon.");
const runId = Bun.env.WORKFLOW_ID;
if (!runId) throw new Error("Archon did not provide WORKFLOW_ID; Prepr cannot declare report artifacts.");
const savedScope = Bun.file(join(artifactsDir,"prepr-scope.json"));
if (await savedScope.exists()) {
  const selected = await savedScope.json();
  if (selected.previewOnly) { json({preview:selected.preview}); process.exit(0); }
}
const decode = (value: unknown) => typeof value === "string" ? JSON.parse(value) : value;
const comparisonInput=optionalInput("COMPARISON");
const comparison = comparisonInput ? JSON.parse(comparisonInput) : await Bun.file(join(artifactsDir,"prepr-comparison.json")).json();
const debatesInput=optionalInput("DEBATES");
let debates:Debate[];
if (debatesInput) debates=(JSON.parse(debatesInput) as unknown[]).map(decode) as Debate[];
else {
  const file=Bun.file(join(artifactsDir,"prepr-debate-cache.json"));
  const cache=await file.exists()?await file.json():undefined;
  const results:Debate[]=cache?.runId===runId?cache.results:[];
  debates=(comparison.disputes??[]).map((dispute:Debate['dispute'])=>results.find(result=>JSON.stringify(result.dispute.map(f=>f.id))===JSON.stringify(dispute.map(f=>f.id)))??{dispute,rounds:[],stopReason:'incomplete',conclusion:'unresolved'});
}
const report=buildReport(comparison,debates);
await mkdir(artifactsDir,{recursive:true});
await Promise.all([Bun.write(join(artifactsDir,"prepr-report.md"),markdownReport(report)),Bun.write(join(artifactsDir,"prepr-report.json"),JSON.stringify(report,null,2)+'\n')]);
json({report:{type:'archon_artifact',run_id:runId,path:'prepr-report.md'},data:{type:'archon_artifact',run_id:runId,path:'prepr-report.json'}});
