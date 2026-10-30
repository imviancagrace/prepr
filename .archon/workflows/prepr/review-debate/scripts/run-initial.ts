import {load} from '../../.shared/evidence.ts';
import {recordFailure,failureDetail,failedResult} from '../../.shared/failures.ts';
import { input, optionalInput, json, runInitialAgent, type Reviewer, type ReviewResult } from '../../.shared/core.ts';
import { join } from 'node:path';
const side=optionalInput('REVIEWER_SIDE');
if(!['a','b'].includes(side))throw new Error('Reviewer side must be a or b.');
const operational=optionalInput('EVIDENCE_ONLY')==='true';
const prepared=operational?await load('prepr-preparation.json'):undefined;
const reviewer=(operational?prepared.reviewers[side]:JSON.parse(input('REVIEWER'))) as Reviewer;
const scope=operational?(await load('prepr-scope.json')).scope:JSON.parse(optionalInput('SCOPE')||'null');
console.error(`Initial review — ${reviewer.name} (${side.toUpperCase()}), ${reviewer.launcher} / ${reviewer.model}; ${reviewer.executable?.path??'PATH launcher'}`);
let result:ReviewResult;
try { result=await runInitialAgent(reviewer,600_000,scope??undefined); }
catch(error) {result=failedResult(error,reviewer,'initial');}
if(!['completed','cancelled','not_started'].includes(result.status))recordFailure(result.failure??failureDetail(result.stderr||result.stdout,reviewer,'initial'));
const path=optionalInput('PREPARATION_PATH');
if(operational){const {reviewers,...evidence}=prepared;result.preparation=evidence;}
if(path)try {result.preparation=await Bun.file(path).json();} catch {result.preparation={status:'unknown',limitations:['Static preparation evidence was unavailable.']};}
if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,`prepr-initial-${side}.json`),JSON.stringify(result,null,2));
json(operational?{status:result.status,resultRef:`prepr-initial-${side}.json`}:result);
if(operational&&result.status!=='completed')process.exitCode=1;
