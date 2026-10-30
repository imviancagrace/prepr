import {fixtureReviewer,fixturePrerequisites} from "./helpers/reviewers.ts";
import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const source=resolve(import.meta.dir,'..'), scripts=join(source,'.archon/workflows/prepr/review-debate/scripts');
test('controlled preparation, two reviews, mapped severity, duplicate reuse and artifact delivery preserve checkout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-accept-')),repo=join(dir,'repo'),artifacts=join(dir,'artifacts');
 const git=(...args:string[])=>{const r=Bun.spawnSync(['git',...args],{cwd:repo});if(r.exitCode)throw new Error(r.stderr.toString());return r.stdout.toString();};
 try {
  await Bun.write(join(repo,'a.ts'),'base\n');git('init');git('config','user.name','Test');git('config','user.email','test@example.com');git('add','.');git('commit','-m','base');
  await Bun.write(join(repo,'a.ts'),'local change\n');const before=git('diff');
  const fixture=join(source,'.archon/workflows/prepr/review-debate/fixtures');
  const profile=join(dir,'profiles.yaml'),log=join(dir,'calls.jsonl');
  await Bun.write(profile,`default_pair: {reviewer_a: a, reviewer_b: b}\nreviewers:\n  a:\n    name: A\n    launcher: codex\n    model: fixture\n    skill: ${fixture}/reviewer-a-skill\n    severity_map: {P1: high}\n  b:\n    name: B\n    launcher: claude\n    model: fixture\n    skill: ${fixture}/reviewer-b-skill\n    severity_map: {Must fix: high}\n`);
  const env={...Bun.env,ARTIFACTS_DIR:artifacts,WORKFLOW_ID:'acceptance',PREPR_PROFILE_PATH:profile,PREPR_CODEX_BIN:join(fixture,'fake-ready-launcher'),PREPR_CLAUDE_BIN:join(fixture,'fake-ready-launcher'),PREPR_TEST_ACCEPTANCE:'1',PREPR_TEST_LOG:log};
  const run=async(path:string,inputs:Record<string,unknown>={},extra:Record<string,string>={})=>{
   const r=Bun.spawn(['bun',path],{cwd:repo,env:{...env,...Object.fromEntries(Object.entries(inputs).map(([k,v])=>['INPUTS_'+k.toUpperCase(),typeof v==='string'?v:JSON.stringify(v)])),...extra},stdout:'pipe',stderr:'pipe'});
   const [stdout,stderr,code]=await Promise.all([new Response(r.stdout).text(),new Response(r.stderr).text(),r.exited]);
   return {code,stderr,output:code===0?JSON.parse(stdout):undefined};
  };
  let captured=await run(join(scripts,'capture-diff.ts'),{scope:'local',preview_only:'true'});
  expect(captured.code).toBe(0);expect(captured.output.preview.changedFileCount).toBe(1);
  expect(await Bun.file(log).exists()).toBe(false);
  const previewDelivery=await run(join(scripts,'report.ts'));
  expect(previewDelivery.output.preview.changedFileCount).toBe(1);
  expect(previewDelivery.output.report).toBeUndefined();
  captured=await run(join(scripts,'capture-diff.ts'),{scope:'local',preview_only:'false'});
  const inputs={reviewer_a:'',reviewer_b:'',reviewer_a_launcher:'',reviewer_b_launcher:'',reviewer_a_model:'',reviewer_b_model:''};
  const unprepared=await run(join(scripts,'select-reviewers.ts'),inputs);expect(unprepared.code).not.toBe(0);expect(unprepared.stderr).toContain('prepare-reviewer');expect(await Bun.file(log).exists()).toBe(false);
  fixtureReviewer(repo,join(fixture,'reviewer-a-skill'));fixtureReviewer(repo,join(fixture,'reviewer-b-skill'));
  const failed=await run(join(scripts,'select-reviewers.ts'),inputs);expect(failed.code).not.toBe(0);expect(failed.stderr).toContain('Neither code review');
  expect(await Bun.file(log).exists()).toBe(false);
  fixturePrerequisites(repo,[{name:'A',launcher:'codex',model:'fixture'},{name:'B',launcher:'claude',model:'fixture'}],{PREPR_CODEX_BIN:env.PREPR_CODEX_BIN,PREPR_CLAUDE_BIN:env.PREPR_CLAUDE_BIN});
  await rm(join(artifacts,'prepr-failure.json'),{force:true});
  await Bun.write(log,'');
  const selection=await run(join(scripts,'select-reviewers.ts'),inputs);expect(selection.code).toBe(0);
  const selected=selection.output;
  const [a,b]=await Promise.all(['A','B'].map(async side=>run(join(scripts,'run-initial.ts'),{reviewer:selected['reviewer'+side],scope:captured.output.scope,preparation_path:selected.preparationPath,reviewer_side:side.toLowerCase()})));
  expect(a.output.status).toBe('completed');expect(b.output.status).toBe('completed');
  const comparison=await run(join(scripts,'compare.ts'),{review_a:a.output,review_b:b.output});expect(comparison.output.disputes).toHaveLength(2);
  const debates=[];
  for(const dispute of comparison.output.disputes){const r=await run(join(source,'.archon/workflows/prepr/debate-reviewer/scripts/run-debate-rounds.ts'),{reviewer_a:selected.reviewerA,reviewer_b:selected.reviewerB,review_a:a.output,review_b:b.output,dispute,findings:comparison.output.findings,cache_path:captured.output.debateCachePath,run_id:captured.output.runId});expect(r.code).toBe(0);debates.push(r.output);}
  expect(debates[0].rounds).toHaveLength(1);expect(debates[1].stopReason).toBe('reused');expect(debates[1].rounds).toHaveLength(0);
  const delivery=await run(join(scripts,'report.ts'));expect(delivery.code).toBe(0);
  expect(delivery.output.report).toEqual({type:'archon_artifact',run_id:'acceptance',path:'prepr-report.md'});
  expect(delivery.output.data.path).toBe('prepr-report.json');
  const data=await Bun.file(join(artifacts,'prepr-report.json')).json(),text=await Bun.file(join(artifacts,'prepr-report.md')).text();
  expect(data.initialReviews.a.reviewerPackage.format).toBe(1);expect(data.initialReviews.a.reviewerPackage.digest).toBeDefined();expect(data.confirmedBugs).toHaveLength(1);expect(data.preparation.confirmation.status).toBe('user-confirmed');
  expect(text).toContain('Tests: not run');expect(text).toContain('Duplicate-date data remains unverified.');expect(text).not.toContain('## Disagreements');
  const calls=(await Bun.file(log).text()).trim().split('\n').map(l=>JSON.parse(l));expect(calls.filter(x=>!x.probe)).toHaveLength(4);
  expect(git('diff')).toBe(before);expect(git('status','--porcelain')).toBe(' M a.ts\n');
 } finally {await rm(dir,{recursive:true,force:true});}
});
