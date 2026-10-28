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
