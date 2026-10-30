import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const script=resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/scripts/report.ts');
test('reports survive absent comparison and retain static, login, model, timeout and partial-side failures',async()=>{
 for(const kind of ['static','login','model','timeout','unknown','partial'] as const) {
  const dir=await mkdtemp(join(tmpdir(),'prepr-failure-'));
  try {
   if(kind==='static')await Bun.write(join(dir,'prepr-preparation.json'),JSON.stringify({status:'failed',stage:'select-reviewers',initialReviewsStarted:false,error:'Prerequisite confirmation missing or stale',recovery:'Run prepr-setup.'}));
   else if(kind!=='unknown') {
    const a={reviewer:'A',phase:'initial',status:kind==='timeout'?'timed_out':'failed',stdout:'',stderr:kind==='login'?'Authentication expired':kind==='model'?'Selected model unavailable':kind==='timeout'?'Startup timed out':'Required resource blocked',exitCode:1,runtime:{launcher:'claude',model:'fixture',resources:[]}};
    await Bun.write(join(dir,'prepr-initial-a.json'),JSON.stringify(a));
    if(kind==='partial')await Bun.write(join(dir,'prepr-initial-b.json'),JSON.stringify({reviewer:'B',phase:'initial',status:'completed',stdout:'{"findings":[]}',stderr:'',exitCode:0}));
   }
   const proc=Bun.spawn(['bun',script],{env:{...Bun.env,ARTIFACTS_DIR:dir,WORKFLOW_ID:'failed-run',INPUTS_COMPARISON:'',INPUTS_DEBATES:'',PREPR_CODEX_BIN:'/never-call',PREPR_CLAUDE_BIN:'/never-call'},stdout:'pipe',stderr:'pipe'});
   const [out,err,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
   expect(code).toBe(0);expect(err).toBe('');expect(JSON.parse(out).report).toEqual({type:'archon_artifact',run_id:'failed-run',path:'prepr-report.md'});
   const data=await Bun.file(join(dir,'prepr-report.json')).json(),md=await Bun.file(join(dir,'prepr-report.md')).text();
   expect(data.status).toBe('incomplete');expect(data.findingsAvailable).toBe(false);expect(md).toContain('Review incomplete.');expect(md).not.toContain('No actionable concerns were identified.');expect(md).not.toContain('ENOENT');
   if(kind==='static')expect(md).toContain('Neither initial review started.');
   if(kind==='partial'){expect(data.initialReviews.b.status).toBe('completed');expect(md).not.toContain('Neither initial review started.');}
   if(kind==='unknown')expect(data.failures[0].evidence).toContain('cause is unknown');
   if(['login','model','timeout'].includes(kind)){expect(data.failures[0].launcher).toBe('claude');expect(data.failures[0].model).toBe('fixture');}
  } finally {await rm(dir,{recursive:true,force:true});}
 }
});

test('sanitized completed-review/missing-debate replay stays concise while JSON retains operational history and limits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-report-replay-'));try{
  const scope={mode:'local',targetSha:'pinned',snapshotId:'private-hash',files:['date.ts'],excluded:[{path:'.archon/artifacts/run.json',reason:'Archon generated output'}]};
  const checkHistory=Array.from({length:150},(_,i)=>({name:`Resource file /fixture/read-tests-${i}`,status:'passed',evidence:'Successful read observed.'}));
  const review=(reviewer:string)=>({reviewer,phase:'initial',status:'completed',sessionId:reviewer,rawStdout:'tool output: $capture-diff.output.previewOnly',scope,stdout:JSON.stringify({overview:'Only the date editor was inspected; this is partial coverage.',findings:[],verification:{checks:[...checkHistory,{name:'Focused tests',status:'passed',evidence:'98 focused tests passed.'}],limitations:['Captured contents could not be read; working-tree substitution is unverified.','Export behavior was outside the inspected scope.']},assessments:{alignment:{score:3,reason:'Three verified requirements align; remaining requirements are unverified.'},snapshotPath:'/fixture/private-evidence'}}),stderr:'',exitCode:0});
  const dispute=[{id:'reviewer-a-1',reviewer:'reviewer-a',summary:'Could the date fallback skip a range?',question:'Could the date fallback skip a range?',file:'date.ts',line:7,evidence:'The fallback path remains unverified.',kind:'question'}];
  await Bun.write(join(dir,'prepr-scope.json'),JSON.stringify({scope,previewOnly:false}));await Bun.write(join(dir,'prepr-comparison.json'),JSON.stringify({ready:true,runId:'replay',reviewers:{a:'Vee',b:'Travis'},initialReviews:{a:review('Vee'),b:review('Travis')},findings:dispute,agreements:[],disputes:[dispute]}));
  const p=Bun.spawn(['bun',script],{env:{...Bun.env,ARTIFACTS_DIR:dir,WORKFLOW_ID:'replay',PREPR_CODEX_BIN:'/never-call',PREPR_CLAUDE_BIN:'/never-call'},stdout:'pipe',stderr:'pipe'});await new Response(p.stdout).text();expect(await p.exited).toBe(0);
  const json=await Bun.file(join(dir,'prepr-report.json')).json(),md=await Bun.file(join(dir,'prepr-report.md')).text();
  expect(json.initialReviews.a.status).toBe('completed');expect(json.initialReviews.b.status).toBe('completed');expect(json.verification.a.checks).toHaveLength(151);expect(json.initialReviews.a.rawStdout).toContain('$capture-diff.output.previewOnly');expect(json.verification.a.assessments.snapshotPath).toBe('/fixture/private-evidence');
  expect(md.match(/discussion failed/g)).toHaveLength(1);expect(md).toContain('Unconfirmed');expect(md).toContain('Vee (A); Travis (B)');expect(md).toContain('98 focused tests passed');expect(md).toContain('partial coverage');expect(md).toContain('working-tree substitution is unverified');expect(md).toContain('Export behavior was outside');expect(md).toContain('score: 3');
  expect(md).not.toContain('/fixture/read-');expect(md).not.toContain('private-hash');expect(md).not.toContain('/fixture/private-evidence');expect(md).not.toContain('Did not raise');expect(md).not.toContain('What you need to decide');expect(md).not.toContain('A reviewer session did not complete');expect(md.length).toBeLessThan(2400);
  const verify=Bun.spawn(['bun',resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/scripts/verify-run.ts')],{env:{...Bun.env,ARTIFACTS_DIR:dir,WORKFLOW_ID:'replay'},stdout:'pipe',stderr:'pipe'});await new Response(verify.stderr).text();expect(await verify.exited).not.toBe(0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('primary structured failure names the actual client/version/model and keeps optional warnings in JSON',async()=>{
 const {incompleteReport,incompleteMarkdown}=await import('../.archon/workflows/prepr/review-debate/scripts/reporting.ts');
 const failure={stage:'initial review',cause:'model compatibility',reviewer:'Vee',side:'a',launcher:'codex',model:'selected-model',executable:{path:'/fixture/older-codex',version:'0.1.0'},message:'Selected model was rejected by this client/account.',recovery:'Check the selected client and model, then renew setup confirmation.'};
 const evidence={failure,initialReviews:{a:{reviewer:'Vee',phase:'initial' as const,status:'failed' as const,stdout:'',rawStdout:'structured original error',stderr:'Optional MCP connection warning',exitCode:1}},missing:[]};
 const data=incompleteReport(evidence),md=incompleteMarkdown(data);expect(md).toContain('/fixture/older-codex');expect(md).toContain('0.1.0');expect(md).toContain('selected-model');expect(md).toContain('Selected model was rejected');expect(md).not.toContain('MCP connection');expect(data.initialReviews.a.stderr).toContain('MCP connection');expect(data.failure).toEqual(failure);
});
