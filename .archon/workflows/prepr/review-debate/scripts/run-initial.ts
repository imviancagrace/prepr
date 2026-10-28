import { input, optionalInput, json, runInitialAgent, type Reviewer, type ReviewResult } from '../../.shared/core.ts';
import { join } from 'node:path';
const reviewer=JSON.parse(input('REVIEWER')) as Reviewer;
const side=optionalInput('REVIEWER_SIDE');
if(!['a','b'].includes(side))throw new Error('Reviewer side must be a or b.');
const scope=JSON.parse(optionalInput('SCOPE')||'null');
let result:ReviewResult;
try { result=await runInitialAgent(reviewer,600_000,scope??undefined); }
catch(error) { result={reviewer:reviewer.name,phase:'initial',status:'failed',stdout:'',stderr:String(error),exitCode:null,scope,runtime:{launcher:reviewer.launcher,model:reviewer.model||'unresolved',resources:[]}}; }
const path=optionalInput('PREPARATION_PATH');
if(path)try {result.preparation=await Bun.file(path).json();} catch {result.preparation={status:'unknown',limitations:['Static preparation evidence was unavailable.']};}
if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,`prepr-initial-${side}.json`),JSON.stringify(result,null,2));
json(result);
