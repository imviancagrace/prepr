import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkReadiness, reviewersReady } from "../.archon/workflows/prepr/.shared/readiness.ts";
import { runInitialAgent, selectReviewers, type Reviewer } from "../.archon/workflows/prepr/.shared/core.ts";
const fixture = resolve(import.meta.dir,"../.archon/workflows/prepr/review-debate/fixtures/fake-ready-launcher");
const reviewer: Reviewer = {name:"A",reference:"fixture",skillPath:"/no-skill-needed-for-probe",launcher:"codex",model:"fixture"};
test("readiness proves launcher/model and declared resource reads, not host access or model claims", async()=>{
 const keys=['PREPR_CODEX_BIN','PREPR_CLAUDE_BIN','PREPR_TEST_FAIL','PREPR_TEST_DENY','PREPR_TEST_UNPROVEN','PREPR_TEST_DELAY','PREPR_TEST_REVIEW_FAIL'];
 const old=Object.fromEntries(keys.map(k=>[k,Bun.env[k]]));
 try {
  Bun.env.PREPR_CODEX_BIN=fixture; Bun.env.PREPR_CLAUDE_BIN=fixture;
  for(const launcher of ['codex','claude'] as const) {
   const r={...reviewer,launcher,requiredAccess:[{tool:'file',resource:'/readable-resource'}]};
   expect((await checkReadiness(r)).status).toBe('ready');
   Bun.env.PREPR_TEST_DENY='1'; expect((await checkReadiness(r)).status).toBe('failed'); delete Bun.env.PREPR_TEST_DENY;
   Bun.env.PREPR_TEST_UNPROVEN='1'; expect((await checkReadiness(r)).status).toBe('failed'); delete Bun.env.PREPR_TEST_UNPROVEN;
  }
  expect((await checkReadiness({...reviewer,requiredAccess:[{tool:'unsupported',resource:'ticket'}]})).status).toBe('failed');
  Bun.env.PREPR_TEST_FAIL='1'; expect((await reviewersReady(reviewer,reviewer)).ready).toBe(false); delete Bun.env.PREPR_TEST_FAIL;
  Bun.env.PREPR_TEST_DELAY='500'; expect((await checkReadiness(reviewer,20)).probe?.status).toBe('timed_out'); delete Bun.env.PREPR_TEST_DELAY;
  expect((await checkReadiness(reviewer)).status).toBe('ready');
  Bun.env.PREPR_TEST_REVIEW_FAIL='1'; expect((await runInitialAgent(reviewer)).status).toBe('failed'); delete Bun.env.PREPR_TEST_REVIEW_FAIL;
  Bun.env.PREPR_CODEX_BIN='/not-a-launcher'; expect((await checkReadiness(reviewer)).status).toBe('failed');
 } finally { for(const k of keys) if(old[k]===undefined)delete Bun.env[k];else Bun.env[k]=old[k]; }
});
test("local profile severity maps and required access are optional but validated",async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-profiles-')); const old=Bun.env.PREPR_PROFILE_PATH;
 try{
  Bun.env.PREPR_PROFILE_PATH=join(dir,'profile.yaml');
  const skill=resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill');
  const write=async(extra:string)=>Bun.write(Bun.env.PREPR_PROFILE_PATH!,`default_pair: {reviewer_a: a, reviewer_b: a}\nreviewers:\n  a:\n    name: A\n    launcher: codex\n    skill: ${skill}\n${extra}`);
  await write('    severity_map: {P1: high}\n    required_access: [{tool: file, resource: /tmp/readable}]\n');
  expect(selectReviewers('','').reviewerA.severityMap).toEqual({P1:'high'});
  expect(selectReviewers('','').reviewerB.requiredAccess).toHaveLength(1);
  await write('    severity_map: {P1: invented}\n'); expect(()=>selectReviewers('','')).toThrow('invalid severity_map');
  await write('    required_access: [{tool: gh, resource: "repos/org/repo;rm"}]\n'); expect(()=>selectReviewers('','')).toThrow('unsafe');
  await write('    required_access: [{tool: file}]\n'); expect(()=>selectReviewers('','')).toThrow('required_access');
 }finally {if(old===undefined)delete Bun.env.PREPR_PROFILE_PATH;else Bun.env.PREPR_PROFILE_PATH=old;await rm(dir,{recursive:true,force:true});}
});
