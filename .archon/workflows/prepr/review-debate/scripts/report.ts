import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { optionalInput, json, type Debate } from '../../.shared/core.ts';
import { buildReport, markdownReport, incompleteReport, incompleteMarkdown } from './reporting.ts';
const artifactsDir=Bun.env.ARTIFACTS_DIR;
if(!artifactsDir)throw new Error('Archon did not provide ARTIFACTS_DIR; Prepr reports must be run through Archon.');
const runId=Bun.env.WORKFLOW_ID;
if(!runId)throw new Error('Archon did not provide WORKFLOW_ID; Prepr cannot declare report artifacts.');
const missing:string[]=[];
async function saved(name:string) {
  try {return await Bun.file(join(artifactsDir!,name)).json();}
  catch {missing.push(`${name} unavailable or invalid.`);return undefined;}
}
const scope=await saved('prepr-scope.json');
if(scope?.previewOnly){json({preview:scope.preview});process.exit(0);}
const decode=(value:unknown)=>typeof value==='string'?JSON.parse(value):value;
let comparison:any,debates:Debate[]=[];
try {comparison=optionalInput('COMPARISON')?JSON.parse(optionalInput('COMPARISON')):await saved('prepr-comparison.json');}catch {missing.push('Comparison input invalid.');}
const preparation=await saved('prepr-preparation.json');
const initialReviews={a:comparison?.initialReviews?.a??await saved('prepr-initial-a.json'),b:comparison?.initialReviews?.b??await saved('prepr-initial-b.json')};
let data:any,markdown:string;
if(initialReviews.a?.status==='completed'&&initialReviews.b?.status==='completed'&&comparison?.ready!==false&&Array.isArray(comparison?.agreements)&&Array.isArray(comparison?.findings)) {
  if(optionalInput('DEBATES'))try {debates=(JSON.parse(optionalInput('DEBATES')) as unknown[]).map(decode) as Debate[];}catch {missing.push('Debate input invalid.');}
  else {
    const cache=await saved('prepr-debate-cache.json');
    const results:Debate[]=cache?.runId===runId&&Array.isArray(cache.results)?cache.results:[];
    debates=(comparison.disputes??[]).map((dispute:Debate['dispute'])=>results.find(result=>JSON.stringify(result.dispute.map(f=>f.id))===JSON.stringify(dispute.map(f=>f.id)))??{dispute,rounds:[],stopReason:'incomplete',conclusion:'unresolved'});
  }
  data=buildReport(comparison,debates);
  data.preparation={...data.preparation,...preparation,scope:scope?.scope??data.preparation.scope};
  markdown=markdownReport(data);
} else {
  data=incompleteReport({scope:scope?.scope,preparation,initialReviews,missing});
  markdown=incompleteMarkdown(data);
}
await mkdir(artifactsDir,{recursive:true});
await Promise.all([Bun.write(join(artifactsDir,'prepr-report.md'),markdown),Bun.write(join(artifactsDir,'prepr-report.json'),JSON.stringify(data,null,2)+'\n')]);
json({report:{type:'archon_artifact',run_id:runId,path:'prepr-report.md'},data:{type:'archon_artifact',run_id:runId,path:'prepr-report.json'}});
