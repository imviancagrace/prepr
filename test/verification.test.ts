import {expect,test} from 'bun:test';
import {verification} from '../.archon/workflows/prepr/.shared/verification.ts';
import {buildReport,markdownReport,incompleteReport,incompleteMarkdown} from '../.archon/workflows/prepr/review-debate/scripts/reporting.ts';
import type {ReviewResult} from '../.archon/workflows/prepr/.shared/core.ts';
import sample from './fixtures/live-verification.json';
import {mkdtemp,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const result=(value:unknown,reviewer='Vee'):ReviewResult=>({reviewer,phase:'initial',status:'completed',stdout:typeof value==='string'?value:JSON.stringify(value),stderr:'',exitCode:0,scope:{mode:'branch',targetSha:'pinned-target'} as ReviewResult['scope']});
const comparison=()=>({reviewers:{a:'Vee',b:'Peer'},agreements:[],findings:[],initialReviews:{a:result(sample.a),b:result(sample.b,'Peer')}});

test('captured nested verification keeps passing checks, partial coverage and full-suite uncertainty in the standard report',()=>{
 const input=comparison(),data=buildReport(input,[]),md=markdownReport(data);
 expect(data.verification.a.checks).toEqual([
  {name:'Project check',status:'passed',evidence:sample.a.verification.checks[0],reviewer:'Vee',snapshot:'pinned-target'},
  {name:'Project check',status:'passed',evidence:sample.a.verification.checks[1],reviewer:'Vee',snapshot:'pinned-target'},
 ]);
 expect(data.verification.b.checks.map(c=>c.status)).toEqual(['unknown','passed']);
 expect(data.verification.a.assessments).toEqual(sample.a.assessments);
 expect(data.initialReviews).toEqual(input.initialReviews);
 expect(data.confirmedBugs).toHaveLength(0);expect(data.stillDisputed).toHaveLength(0);
 expect(md.split('\n\n')[1]).toContain('within the reviewed portions');
 for(const side of ['a','b'] as const){
  if(side==='a')expect(md).toContain('This was a partial review of the 181-file change.');
  for(const limit of sample[side].verification.limitations)expect(md).toContain(limit);
 }
 expect(md).toContain('Vee — Project check: passed:** Three focused Jest suites passed: 98 tests.');
 expect(md).toContain('Peer — Project check: passed:** Four focused Jest suites passed: 117 tests total.');
 expect(md).not.toContain('Not scored because');expect(md).not.toContain('"scopedSpecAlignment"');expect(md).not.toContain('215');
 expect(md).not.toContain('Project checks: not run');expect(md).not.toContain('Project checks: unknown');
 expect(md.match(/^#.*/gm)).toEqual(['# Prepr report','## Material review limits']);
});

test('nested string/object checks preserve explicit statuses, snapshots and limitations without keyword filtering',()=>{
 const data=verification(result({verification:{checks:[
  {name:'Focused',status:'passed',evidence:'98 assertions completed.',snapshot:'tested-snapshot'},
  {name:'Full suite',status:'unknown',evidence:'Execution was interrupted.'},
  {name:'Lint',status:'failed',evidence:'One rule violation.'},
  {name:'Build',status:'blocked',evidence:'Dependency inaccessible.'},
  {name:'Integration',status:'not run',evidence:'Excluded by this invocation.'},
  {name:'Odd status',status:'green',evidence:'Retain this claim.'},
  'Focused tests passed.', 'Full suite was not run.', 'Integration blocked.', 'Lint failed.',
  'Tests would have passed.', 'Not all tests passed.', 'No tests failed.', 'Tests passed but another check failed.',
  'Tests should have failed.', 'The suite never failed.', '0 tests failed.',
  null,42,{evidence:'No check name.'},
 ],limitations:['Only the date editor was inspected.','The database is outside this review.']},limitations:['Browser coverage excluded.']}));
 expect(data.checks.map(c=>c.status)).toEqual(['passed','unknown','failed','blocked','not run','unknown','passed','not run','blocked','failed','unknown','unknown','unknown','unknown','unknown','unknown','unknown']);
 expect(data.checks[0]).toMatchObject({snapshot:'tested-snapshot',reviewer:'Vee'});
 expect(data.checks[1].snapshot).toBe('pinned-target');
 for(const text of ['Only the date editor was inspected.','The database is outside this review.','Browser coverage excluded.'])expect(data.limitations).toContain(text);
});

test('final plain or fenced review wins over earlier progress JSON and preserves overview-only qualifications',()=>{
 const progress='```json\n'+JSON.stringify({verification:[{name:'Earlier',status:'passed'}],findings:[]})+'\n```';
 const final=JSON.stringify(sample.a,null,2);
 for(const text of [progress+'\nFinal review:\n'+final,JSON.stringify({verification:'Earlier check passed.'})+'\n```json\n'+final+'\n```']){
  const data=verification(result(text));expect(data.checks.some(c=>c.name==='Earlier')).toBe(false);expect(data.overview).toBe(sample.a.overview);expect(data.assessments).toEqual(sample.a.assessments);
 }
 const data=buildReport({...comparison(),initialReviews:{a:result({overview:'Only the date editor was inspected.',findings:[]}),b:result({findings:[]},'Peer')}},[]);
 expect(markdownReport(data)).toContain('within the reviewed portions');expect(markdownReport(data)).toContain('Only the date editor was inspected.');
 expect(data.verification.b.overview).toBeUndefined();expect(data.verification.b.checks[0].status).toBe('unknown');
});

test('historical arrays, prose and malformed evidence remain readable without invented execution',()=>{
 expect(verification(result({verification:[{name:'Tests',status:'not run',evidence:'Static inspection only.'}]})).checks[0].status).toBe('not run');
 expect(verification(result({verification:'Focused tests passed.',limitations:['Backend excluded.']})).checks[0].status).toBe('passed');
 expect(verification(result('Verification: tests not run.')).checks[0].status).toBe('not run');
 expect(verification(result('Unrecognized response')).checks[0].status).toBe('unknown');
 expect(verification(result('{"verification": ')).checks[0].status).toBe('unknown');
 expect(verification().checks[0].status).toBe('unknown');
});

test('incomplete reports retain the completed side checks and qualifications without implying two successful reviews',()=>{
 const data=incompleteReport({initialReviews:{a:result(sample.a),b:{...result('','Peer'),status:'failed',stderr:'Model unavailable.'}},missing:['Comparison unavailable.']});
 const md=incompleteMarkdown(data);
 expect(data.status).toBe('incomplete');expect(md).toContain('Review incomplete.');expect(md).not.toContain('No actionable concerns were identified');
 expect(md).toContain('98 tests.');expect(md).toContain('partial review of the 181-file change');expect(md).toContain('status is unverified');expect(md).not.toContain('Not scored because');
 expect(md).toContain('Vee — Project check: passed');expect(md).toContain('No completed comparison is available');expect(data.limitations).toContain('Comparison unavailable.');
});

test('saved results render the standard artifacts and pointers without launcher calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-verification-'));
 try {
  const data=comparison(),script=resolve(import.meta.dir,'../.archon/workflows/prepr/review-debate/scripts/report.ts');
  const scope={scope:data.initialReviews.a.scope};
  const log=join(dir,'launcher-called'),bin=join(dir,'never-launch');
  await Bun.write(bin,`#!/bin/sh\nprintf called >> '${log}'\nexit 91\n`);await chmod(bin,0o700);
  await Bun.write(join(dir,'prepr-scope.json'),JSON.stringify(scope));
  await Bun.write(join(dir,'prepr-preparation.json'),JSON.stringify({status:'passed'}));
  await Bun.write(join(dir,'prepr-comparison.json'),JSON.stringify({...data,ready:true,disputes:[]}));
  const proc=Bun.spawn(['bun',script],{env:{...Bun.env,ARTIFACTS_DIR:dir,WORKFLOW_ID:'verification-replay',INPUTS_COMPARISON:'',INPUTS_DEBATES:'[]',PREPR_CODEX_BIN:bin,PREPR_CLAUDE_BIN:bin},stdout:'pipe',stderr:'pipe'});
  const [out,err,code]=await Promise.all([new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
  expect(code).toBe(0);expect(err).toBe('');expect(JSON.parse(out)).toEqual({report:{type:'archon_artifact',run_id:'verification-replay',path:'prepr-report.md'},data:{type:'archon_artifact',run_id:'verification-replay',path:'prepr-report.json'}});
  expect(await Bun.file(log).exists()).toBe(false);
  const json=await Bun.file(join(dir,'prepr-report.json')).json(),md=await Bun.file(join(dir,'prepr-report.md')).text();
  expect(json.verification.a.assessments).toEqual(sample.a.assessments);expect(json.initialReviews).toEqual(data.initialReviews);
  expect(md).toContain('98 tests.');expect(md).toContain('117 tests total.');expect(md).toContain('status is unverified');expect(md).toContain('within the reviewed portions');
  expect(await Bun.file(join(dir,'prepr-comparison.json')).json()).toEqual({...data,ready:true,disputes:[]});
 }finally{await rm(dir,{recursive:true,force:true});}
});
