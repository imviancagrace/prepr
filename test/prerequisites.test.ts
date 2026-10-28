import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chooseReferences,runLauncher,runInitialAgent,agentPrompt,type Reviewer} from '../.archon/workflows/prepr/.shared/core.ts';
import {inspectPrerequisites,previewConfirmation,confirmationPlan,execute,CONFIRMATION_PATH,runtimePrerequisites} from '../.archon/workflows/prepr/.shared/prerequisites.ts';
import {fixtureReviewer,fixturePrerequisites} from './helpers/reviewers.ts';
const fixture=resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/fixtures/fake-ready-launcher');
test("local profile severity maps and required access are optional but validated",async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-profiles-')); const old=Bun.env.PREPR_PROFILE_PATH;
 try{
  Bun.env.PREPR_PROFILE_PATH=join(dir,'profile.yaml');
  const skill=resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill');
  const write=async(extra:string)=>Bun.write(Bun.env.PREPR_PROFILE_PATH!,`default_pair: {reviewer_a: a, reviewer_b: a}\nreviewers:\n  a:\n    name: A\n    launcher: codex\n    skill: ${skill}\n${extra}`);
  await write('    severity_map: {P1: high}\n    required_access: [{tool: file, resource: /tmp/readable}]\n');
  expect(chooseReferences('','','','','','').reviewerA.severityMap).toEqual({P1:'high'});
  expect(chooseReferences('','','','','','').reviewerB.requiredAccess).toHaveLength(1);
  await write('    severity_map: {P1: invented}\n'); expect(()=>chooseReferences('','','','','','')).toThrow('invalid severity_map');
  await write('    required_access: [{tool: gh, resource: "repos/org/repo;rm"}]\n'); expect(()=>chooseReferences('','','','','','')).toThrow('unsafe');
  await write('    required_access: [{tool: file}]\n'); expect(()=>chooseReferences('','','','','','')).toThrow('required_access');
 }finally {if(old===undefined)delete Bun.env.PREPR_PROFILE_PATH;else Bun.env.PREPR_PROFILE_PATH=old;await rm(dir,{recursive:true,force:true});}
});

import {readFileSync,writeFileSync,existsSync,cpSync} from 'node:fs';
import {runtimeAccess} from '../.archon/workflows/prepr/.shared/resources.ts';
test('Claude, Codex and mixed pairs use shared static checks and local confirmation without AI calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-static-'));
 const calls:string[][]=[];
 const exec=(args:string[],cwd?:string)=>{calls.push(args);if(args[1]==='--version')return args[0]==='archon'?'0.12.1':'2.1.311';return execute(args,cwd);};
 try {
  execute(['git','init'],dir);
  fixtureReviewer(dir,resolve(import.meta.dir,'../reviewers/peer-review-guidelines'));
  for(const pair of [['claude','claude'],['codex','codex'],['codex','claude']] as const) {
   const reviewers=pair.map((launcher,i)=>({name:String(i),launcher,model:'fixture',reference:'fixture',skillPath:'unused'}));
   fixturePrerequisites(dir,reviewers);
   const checked=runtimePrerequisites({reviewerA:reviewers[0],reviewerB:reviewers[1]},dir,exec);
   expect(checked.preparation.confirmation.status).toBe('user-confirmed');
   expect(checked.reviewerA.model).toBe('fixture');
  }
  expect(calls.some(args=>args.includes('-p')||args.includes('exec')||args.includes('workflow'))).toBe(false);
  const pair=[{name:'A',launcher:'codex' as const,model:'fixture',reference:'fixture',skillPath:'unused'}];
  const inspected=inspectPrerequisites(pair,dir,exec);
  const shown=previewConfirmation(dir,inspected.selections,exec);
  expect(()=>confirmationPlan(dir,inspected.selections,{digest:shown.digest,decision:'decline'},exec)).toThrow('declined');
  expect(()=>confirmationPlan(dir,inspected.selections,{digest:'changed',decision:'confirm'},exec)).toThrow('changed');
  expect(()=>confirmationPlan(dir,[{...inspected.selections[0],model:'new-model'}],undefined,exec)).toThrow('stale');
  const before=readFileSync(join(dir,CONFIRMATION_PATH),'utf8');
  expect(()=>runtimePrerequisites({reviewerA:pair[0],reviewerB:pair[0]},dir,args=>{if(args[0]==='codex')throw new Error('missing');return exec(args,dir);})).toThrow('Missing/incompatible');
  expect(readFileSync(join(dir,CONFIRMATION_PATH),'utf8')).toBe(before);
  writeFileSync(join(dir,'.archon/workflows/prepr/.shared/core.ts'),'altered');
  expect(()=>runtimePrerequisites({reviewerA:pair[0],reviewerB:pair[0]},dir,exec)).toThrow('provenance');
 }finally {await rm(dir,{recursive:true,force:true});}
},15000);

test('resolved tiers, direct model selections and imported confirmations cannot bypass local confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-confirm-')),other=await mkdtemp(join(tmpdir(),'prepr-other-'));
 let model='first';
 const exec=(args:string[],cwd?:string)=>args.join(' ')==='archon ai tier list --json'?JSON.stringify({tiers:[{tier:'large',effective:{provider:'claude',model}}]}):args[1]==='--version'?'0.12.1':execute(args,cwd);
 try {
  for(const project of [dir,other]){execute(['git','init'],project);fixtureReviewer(project,resolve(import.meta.dir,'../reviewers/peer-review-guidelines'));}
  const r={name:'A',launcher:'claude' as const,reference:'fixture',skillPath:'unused'};
  const first=inspectPrerequisites([r],dir,exec);const p=previewConfirmation(dir,first.selections,exec);
  expect(()=>confirmationPlan(dir,first.selections,undefined,exec)).toThrow('missing or stale');
  const record=confirmationPlan(dir,first.selections,{digest:p.digest,decision:'confirm'},exec);
  writeFileSync(join(dir,CONFIRMATION_PATH),JSON.stringify(record));
  expect(confirmationPlan(dir,first.selections,undefined,exec)).toEqual(record);
  model='second';const changed=inspectPrerequisites([r],dir,exec);
  expect(()=>confirmationPlan(dir,changed.selections,undefined,exec)).toThrow('stale');
  expect(()=>inspectPrerequisites([{...r,launcher:'codex'}],dir,exec)).toThrow('large tier');
  cpSync(join(dir,CONFIRMATION_PATH),join(other,CONFIRMATION_PATH));
  expect(()=>confirmationPlan(other,first.selections,undefined,exec)).toThrow('stale');
  execute(['git','add','-f',CONFIRMATION_PATH],dir);
  expect(()=>previewConfirmation(dir,first.selections,exec)).toThrow('tracked');
 }finally {await rm(dir,{recursive:true,force:true});await rm(other,{recursive:true,force:true});}
},15000);

test('required access is established only by successful reads in actual reviewer output',()=>{
 const reviewer:Reviewer={name:'A',launcher:'codex',model:'fixture',reference:'fixture',skillPath:'unused',requiredAccess:[{tool:'file',resource:'/required'}],runtimeAccess:[{tool:'file',resource:'/optional',required:false}]};
 const result={reviewer:'A',phase:'initial' as const,status:'completed' as const,stdout:'{"findings":[]}',stderr:'',exitCode:0};
 const unproven=runtimeAccess(result,reviewer,'fixture');expect(unproven.status).toBe('failed');expect(unproven.runtime?.resources[0].status).toBe('unverifiable');
 for(const launcher of ['codex','claude'] as const) {
  const raw=launcher==='codex'?JSON.stringify({type:'item.completed',item:{type:'command_execution',command:'cat /required',exit_code:0}}):[JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',id:'read-1',name:'Read',input:{file_path:'/required'}}]}}),JSON.stringify({type:'user',message:{content:[{type:'tool_result',tool_use_id:'read-1',is_error:false}]}})].join('\n');
  const verified=runtimeAccess({...result,rawStdout:raw},{...reviewer,launcher},'fixture');expect(verified.status).toBe('completed');expect(verified.runtime?.resources[0].status).toBe('verified');expect(verified.runtime?.resources[1].status).toBe('unverifiable');
 }
 expect(agentPrompt(reviewer)).toContain('affected assessment blocked/incomplete');
});

test('actual sessions retain bounded failures and do not require a readiness phase',async()=>{
 const keys=['PREPR_CODEX_BIN','PREPR_CLAUDE_BIN','PREPR_TEST_DELAY','PREPR_TEST_REVIEW_FAIL'];const old=Object.fromEntries(keys.map(k=>[k,Bun.env[k]]));
 try {
  Bun.env.PREPR_CODEX_BIN=fixture;Bun.env.PREPR_CLAUDE_BIN=fixture;
  for(const launcher of ['codex','claude'] as const) {
   const r={name:'A',launcher,model:'fixture',reference:'unused',skillPath:'unused'};
   Bun.env.PREPR_TEST_REVIEW_FAIL='1';const failed=await runLauncher(r,'initial','You are one side of a private pre-PR review.');expect(failed.status).toBe('failed');expect(failed.stderr).toContain('Authentication');delete Bun.env.PREPR_TEST_REVIEW_FAIL;
   Bun.env.PREPR_TEST_DELAY='1000';expect((await runLauncher(r,'initial','You are one side',100)).status).toBe('timed_out');delete Bun.env.PREPR_TEST_DELAY;
  }
 }finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete Bun.env[k];else Bun.env[k]=v;}
});
