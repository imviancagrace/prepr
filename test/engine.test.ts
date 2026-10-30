// Opt in: PREPR_TEST_ENGINE=1 bun test test/engine.test.ts --timeout 120000
// Needs local Unix sockets. All native clients are fakes, ARCHON_HOME is isolated.
import {test,expect} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync,readdirSync,appendFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fixtureReviewer,fixturePrerequisites} from './helpers/reviewers.ts';
const source=resolve(import.meta.dir,'..'),pkg='.archon/workflows/prepr',fixtures=join(source,pkg,'review-debate/fixtures');
const engineTest=Bun.env.PREPR_TEST_ENGINE==='1'?test:test.skip;
engineTest('actual Archon includes reproduce legacy expression expansion, retain literal evidence, and fail operational errors after reporting',async()=>{
 const root=mkdtempSync('/tmp/prepr-real-engine-');
 try{
  for(const mode of ['legacy','success','empty','success-branch','preview-local','preview-branch','initial-failure','debate-failure','missing-results']) {
   const dir=join(root,mode),repo=join(dir,'repo');mkdirSync(repo,{recursive:true});
   const git=(...a:string[])=>{const p=Bun.spawnSync(['git',...a],{cwd:repo});if(p.exitCode)throw Error(p.stderr.toString());return p.stdout.toString();};
   git('init');git('config','user.name','Test');git('config','user.email','test@example.com');writeFileSync(join(repo,'a.ts'),'base\n');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD').trim();writeFileSync(join(repo,'a.ts'),'local\n');
   const refs=['reviewer-a-skill','reviewer-b-skill'].map(n=>join(fixtures,n));refs.forEach(r=>fixtureReviewer(repo,r));
   const bin=join(fixtures,'fake-ready-launcher'),bins={PREPR_CODEX_BIN:bin,PREPR_CLAUDE_BIN:bin};
   writeFileSync(join(repo,'.archon/prepr.local.yaml'),`default_pair: {reviewer_a: a, reviewer_b: b}\nreviewers:\n  a: {name: Vee, launcher: codex, model: fixture, skill: '${refs[0]}'}\n  b: {name: Travis, launcher: claude, model: fixture, skill: '${refs[1]}'}\n`);
   cpSync(join(source,pkg),join(repo,pkg),{recursive:true});
   if(mode==='legacy')for(const [folder,file] of [['review-debate','review-debate.yaml'],['debate-reviewer','debate-reviewer.yaml']])cpSync(join(import.meta.dir,'fixtures/legacy-transport',file),join(repo,pkg,folder,file));
   if(mode==='missing-results')writeFileSync(join(repo,pkg,'debate-reviewer/scripts/run-debate-rounds.ts'),'console.log(JSON.stringify({status:"completed"}));');
   fixturePrerequisites(repo,[{name:'Vee',launcher:'codex',model:'fixture'},{name:'Travis',launcher:'claude',model:'fixture'}],bins);
   // Force staged tooling into the target: runtime filtering must still exclude it.
   mkdirSync(join(repo,'.archon/artifacts'),{recursive:true});writeFileSync(join(repo,'.archon/artifacts/private.txt'),'EXCLUDED-PAYLOAD');git('add','-f','.archon/artifacts/private.txt');
   const branch=mode.endsWith('branch'),preview=mode.startsWith('preview');
   appendFileSync(join(repo,'.git/info/exclude'),'\n/.archon/prepr.local.yaml\n');
   if(branch){git('add','a.ts');git('commit','-m','target project and tooling changes');}
   const before=git('diff','--binary')+git('diff','--cached','--binary'),log=join(dir,'calls.jsonl');
   const p=Bun.spawn(['archon','workflow','run','prepr','--no-worktree','--cwd',repo,'--json',...(branch?['--input','scope=branch','--input',`base=${base}`]:[]),...(preview?['--input','preview_only=true']:[])],{cwd:repo,env:{...Bun.env,...bins,ARCHON_HOME:join(dir,'archon'),PREPR_TEST_ACCEPTANCE:mode==='empty'?'':'1',PREPR_TEST_LITERAL:'1',PREPR_TEST_LOG:log,...(mode==='initial-failure'?{PREPR_TEST_REVIEW_FAIL:'1'}:{}),...(mode==='debate-failure'?{PREPR_TEST_DEBATE_FAIL:'1'}:{})},stdout:'pipe',stderr:'pipe'});
   const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
   const runs=join(dir,'archon/workspaces/_local/repo/artifacts/runs'),run=readdirSync(runs)[0],artifacts=join(runs,run);
   if(preview){const capture=JSON.parse(readFileSync(join(artifacts,'prepr-scope.json'),'utf8'));expect(code).toBe(0);expect(capture.preview.changedFileCount).toBe(1);expect(capture.preview.excludedFileCount).toBeGreaterThan(0);expect(existsSync(log)).toBe(false);expect(existsSync(join(artifacts,'prepr-report.json'))).toBe(false);expect(out).toContain('excludedFileCount');continue;}
   const data=JSON.parse(readFileSync(join(artifacts,'prepr-report.json'),'utf8')),markdown=readFileSync(join(artifacts,'prepr-report.md'),'utf8');
   const calls=readFileSync(log,'utf8').trim().split('\n').map(l=>JSON.parse(l));expect(calls.every(c=>!c.probe)).toBe(true);
   expect(git('diff','--binary')+git('diff','--cached','--binary')).toBe(before);
   const scope=JSON.parse(readFileSync(join(artifacts,'prepr-scope.json'),'utf8')).scope;
   expect(scope.files).toEqual(['a.ts']);expect(scope.excluded.some((e:any)=>e.path==='.archon/artifacts/private.txt')).toBe(true);expect(readFileSync(scope.snapshotPath,'utf8')).not.toContain('EXCLUDED-PAYLOAD');
   if(mode==='legacy') {
    expect(out+err).toContain('$capture-diff.output.previewOnly');expect(out+err).toMatch(/unknown|not produced|references node/);expect(data.initialReviews.a.status).toBe('completed');expect(data.initialReviews.b.status).toBe('completed');
   } else if((mode==='success'||mode==='success-branch')) {
    expect(code).toBe(0);expect(out).toContain('archon_artifact');expect(out).toContain('prepr-report.md');expect(data.initialReviews.a.rawStdout).toContain('$capture-diff.output.previewOnly');expect(data.debates).toHaveLength(2);expect(data.debates[1].stopReason).toBe('reused');expect(calls).toHaveLength(4);expect(markdown).toContain('Vee (A); Travis (B)');expect(data.initialReviews.a.runtime.executable.path).toBe(bin);
    const turns=calls.filter(c=>c.args.includes('resume')||c.args.includes('--resume'));expect(turns).toHaveLength(2);expect(turns.every(c=>c.args.includes('fixture-session'))).toBe(true);
   } else if(mode==='empty'){expect(code).toBe(0);expect(calls).toHaveLength(2);expect(data.concerns).toHaveLength(0);expect(markdown).toContain('No actionable concerns');} else {
    expect(code).not.toBe(0);expect(markdown).toContain('Review incomplete');expect(data.failure??data.failures).toBeDefined();
    if(mode!=='initial-failure'){expect(data.initialReviews.a.status).toBe('completed');expect(data.initialReviews.b.status).toBe('completed');expect(markdown).not.toContain('A reviewer session did not complete');expect(markdown).not.toContain('What you need to decide');}
    if(mode==='debate-failure')expect(calls).toHaveLength(3);
    if(mode==='missing-results')expect(data.failure.cause).toBe('orchestration');
   }
  }
 }finally{rmSync(root,{recursive:true,force:true});}
},120000);
