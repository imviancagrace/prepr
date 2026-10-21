import {buildReport,markdownReport} from "../.archon/workflows/prepr/review-debate/scripts/reporting.ts";
import {test,expect} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,chmodSync,symlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {standard,fixtureDraft,fixtureReviewer} from './helpers/reviewers.ts';
import {inspectSource,draftReviewer,previewReviewer,acceptReviewer,acceptedCandidate,activationPlan,resolveAccepted,packageHash,renderReviewer,recheckReviewer} from '../.archon/workflows/prepr/.shared/reviewers.ts';
import {selectReviewers,agentPrompt,findings,compare} from '../.archon/workflows/prepr/.shared/core.ts';
function fixture(){const root=mkdtempSync(join(tmpdir(),'prepr-onboarding-'));Bun.spawnSync(['git','init'],{cwd:root});const source=join(root,'source');mkdirSync(source);writeFileSync(join(source,'SKILL.md'),'# Reviewer\nPrioritize domain correctness. Ask concise questions.\nCreate a worktree, run another reviewer, and publish a PR comment.\n');return {root,source,clean:()=>rmSync(root,{recursive:true,force:true})};}
const extraction={retained:[{source:'SKILL.md',instruction:'Domain correctness and concise questions.'}],excluded:[{source:'SKILL.md',instruction:'Worktree, extra reviewer, PR comment.',reason:'Prepr owns orchestration.'}],unresolved:[],limitations:[]};
test('separate candidate preserves source, reveals extraction, and cannot run before explicit acceptance',()=>{const f=fixture();try{
 const original=readFileSync(join(f.source,'SKILL.md'),'utf8');const p=draftReviewer(f.root,f.source,{...standard(),priorities:['Prioritize domain correctness.'],communication:['Ask concise questions.']},extraction);
 expect(p.instructions).toContain('Prioritize domain correctness.');expect(p.instructions).toContain('Ask concise questions.');expect(p.instructions).not.toContain('Create a worktree');expect(p.extraction.excluded[0].reason).toContain('Prepr');expect(p.notice).toContain('not semantic fidelity');
 expect(()=>resolveAccepted(f.source,f.root)).toThrow('no accepted');
 expect(acceptReviewer(f.root,p.id,p.digest,'reject')).toEqual({status:'rejected'});expect(()=>resolveAccepted(f.source,f.root)).toThrow();
 acceptReviewer(f.root,p.id,p.digest,'accept');const accepted=resolveAccepted(f.source,f.root);expect(accepted.skillPath).toContain('/accepted/');expect(accepted.reviewerPackage.digest).toBe(p.digest);
 expect(readFileSync(join(f.source,'SKILL.md'),'utf8')).toBe(original);
 expect(resolveAccepted(f.source,f.root).reviewerPackage.digest).toBe(p.digest);
 const raw=readFileSync(join(f.root,'.archon/prepr-reviewers/registry.json'),'utf8');expect(raw).not.toContain('Create a worktree');
}finally{f.clean();}});
test('candidate edits after preview, unresolved meaning and essential missing standards block acceptance',()=>{const f=fixture();try{
 const p=fixtureDraft(f.root,f.source);const file=join(f.root,'.archon/prepr-reviewers/drafts',p.id,'candidate.json');const c=JSON.parse(readFileSync(file,'utf8'));c.extraction.limitations.push('New limitation');writeFileSync(file,JSON.stringify(c));
 expect(()=>acceptReviewer(f.root,p.id,p.digest,'accept')).toThrow('changed since preview');
 const blocked=draftReviewer(f.root,f.source,standard(),{...extraction,unresolved:['Does this instruction define a domain rule?']});
 expect(()=>acceptReviewer(f.root,blocked.id,blocked.digest,'accept')).toThrow('Resolve material');
 expect(()=>draftReviewer(f.root,f.source,{...standard(),resources:[{kind:'standard',reference:'private unavailable rule',required:true}]},extraction)).toThrow('Essential standard');
 const optional=draftReviewer(f.root,f.source,{...standard(),resources:[{kind:'standard',reference:'optional ticket',required:false,limitation:'Ticket unavailable; no acceptance coverage claimed.'}]},extraction);
 expect(optional.instructions).toContain('Ticket unavailable');
}finally{f.clean();}});
test('source/reference changes invalidate, unrelated files do not; accepted package alteration is rejected',()=>{const f=fixture();try{
 writeFileSync(join(f.source,'rules.md'),'Verify domain invariants.');const p=draftReviewer(f.root,f.source,{...standard(),references:[{path:'references/rules.md',source:'rules.md',required:true}]},extraction,['rules.md']);acceptReviewer(f.root,p.id,p.digest,'accept');
 writeFileSync(join(f.source,'unrelated.txt'),'unrelated');expect(resolveAccepted(f.source,f.root).reviewerPackage.digest).toBe(p.digest);
 writeFileSync(join(f.source,'rules.md'),'Different domain invariant.');expect(()=>resolveAccepted(f.source,f.root)).toThrow('changed');
 writeFileSync(join(f.source,'rules.md'),'Verify domain invariants.');const accepted=resolveAccepted(f.source,f.root);
 writeFileSync(accepted.skillPath,readFileSync(accepted.skillPath,'utf8')+'\nAltered');expect(()=>resolveAccepted(f.source,f.root)).toThrow('render');
}finally{f.clean();}});
test('unsupported markers, executables, symlinks, path escapes and broken relative links are rejected',()=>{const f=fixture();try{
 expect(()=>draftReviewer(f.root,f.source,{...standard(),format:2} as any,extraction)).toThrow('Unsupported');
 const p=fixtureDraft(f.root,f.source), dir=join(f.root,'.archon/prepr-reviewers/drafts',p.id,'package');
 writeFileSync(join(dir,'run.sh'),'exit 0');expect(()=>packageHash(dir)).toThrow('Unexpected');rmSync(join(dir,'run.sh'));
 chmodSync(join(dir,'SKILL.md'),0o755);expect(()=>packageHash(dir)).toThrow('executable');chmodSync(join(dir,'SKILL.md'),0o644);
 symlinkSync(join(f.source,'SKILL.md'),join(dir,'link.md'));expect(()=>packageHash(dir)).toThrow('symlink');rmSync(join(dir,'link.md'));
 writeFileSync(join(f.source,'rules.md'),'[missing](../missing.md)');expect(()=>draftReviewer(f.root,f.source,{...standard(),references:[{path:'references/rules.md',source:'rules.md',required:true}]},extraction,['rules.md'])).toThrow('retained link');
 expect(()=>inspectSource(f.source,['../outside'])).toThrow('Unsafe');
}finally{f.clean();}});
test('local acceptance is project-bound and repository-tracked records do not activate',()=>{const f=fixture(),g=fixture();try{
 fixtureReviewer(f.root,f.source);cpSync(join(f.root,'.archon/prepr-reviewers'),join(g.root,'.archon/prepr-reviewers'),{recursive:true});expect(()=>resolveAccepted(f.source,g.root)).toThrow('not local');
 Bun.spawnSync(['git','add','-f','.archon/prepr-reviewers/registry.json'],{cwd:f.root});expect(()=>resolveAccepted(f.source,f.root)).toThrow('tracked');
}finally{f.clean();g.clean();}});
test('pending acceptance stages without activation and a changed digest cannot reach an activation plan',()=>{const f=fixture();try{
 const p=fixtureDraft(f.root,f.source);const pending=acceptedCandidate(f.root,p.id,p.digest,'accept')!;
 expect(()=>resolveAccepted(f.source,f.root)).toThrow();expect(resolveAccepted(f.source,f.root,undefined,[pending]).reviewerPackage.digest).toBe(p.digest);
 const plan=activationPlan(f.root,[pending]);expect(plan.registry.entries[pending.identity].digest).toBe(p.digest);expect(existsSync(plan.path)).toBe(false);
 writeFileSync(join(f.source,'SKILL.md'),'Changed source');expect(()=>activationPlan(f.root,[pending])).toThrow('Source changed');
}finally{f.clean();}});
test('all direct/default/profile references enforce acceptance and a later package change stops launch recheck',()=>{const f=fixture();const old=process.cwd(),oldProfile=Bun.env.PREPR_PROFILE_PATH;try{
 process.chdir(f.root);const file=join(f.root,'profiles.yaml');Bun.env.PREPR_PROFILE_PATH=file;
 writeFileSync(file,`default_pair: {reviewer_a: a, reviewer_b: a}\nreviewers:\n  a: {name: Questions, launcher: codex, model: fixture, skill: ${f.source}}\n`);
 expect(()=>selectReviewers('','')).toThrow('no accepted');fixtureReviewer(f.root,f.source);
 const selected=selectReviewers('','');expect(selected.reviewerA.reviewerPackage.digest).toBeDefined();
 expect(selectReviewers(f.source,f.source,'codex','codex').reviewerA.skillPath).toBe(selected.reviewerA.skillPath);
 expect(selectReviewers(selected.reviewerA.skillPath,selected.reviewerA.skillPath,'codex','codex').reviewerB.reviewerPackage.digest).toBe(selected.reviewerA.reviewerPackage.digest);
 expect(agentPrompt(selected.reviewerA)).not.toContain('Create a worktree');
 writeFileSync(join(f.source,'SKILL.md'),'changed');expect(()=>recheckReviewer(selected.reviewerA)).toThrow();
}finally{process.chdir(old);if(oldProfile===undefined)delete Bun.env.PREPR_PROFILE_PATH;else Bun.env.PREPR_PROFILE_PATH=oldProfile;f.clean();}});
test('structured questions keep native wording, unknown verdicts and assessments without becoming issues',()=>{
 const text=JSON.stringify({overview:'Spec review',assessments:{alignment:{score:50,evidence:'One requirement unverified'}},findings:[{summary:'Coverage intent',question:'Does the existing test already cover this?',kind:'question',evidence:'Both assert the same path.',severity:'Question'}]});
 const items=findings('A',text);expect(items[0].question).toContain('existing test');expect(items[0].kind).toBe('question');expect(items[0].verdict).toBeUndefined();expect(items[0].severityLevel).toBeUndefined();
 expect(compare(items,[]).disputes).toHaveLength(1);
 const report=buildReport({reviewers:{a:'Questions',b:'Peer'},findings:items,agreements:[],initialReviews:{a:{stdout:text,status:'completed'} as any,b:{stdout:'{}',status:'completed'} as any}},[{dispute:items.map(f=>({...f,reviewer:'reviewer-a'})),rounds:[],stopReason:'incomplete',conclusion:'unresolved'}]);
 expect(markdownReport(report)).toContain('Does the existing test already cover this?');expect(report.confirmedBugs).toHaveLength(0);expect(report.initialReviews!.a.stdout).toContain('alignment');
});

test('bundled standard reviewer is imported without rewriting criteria and still requires local acceptance',()=>{
 const f=fixture();try{
  const source=join(import.meta.dir,'../reviewers/peer-review-guidelines');const original=readFileSync(join(source,'SKILL.md'),'utf8');
  const inspected=inspectSource(source,[],undefined,f.root);expect(inspected.contents['reviewer.json']).toBeDefined();expect(()=>resolveAccepted(source,f.root)).toThrow();
  const p=fixtureDraft(f.root,source);expect(p.instructions).toBe(original);acceptReviewer(f.root,p.id,p.digest,'accept');expect(readFileSync(join(source,'SKILL.md'),'utf8')).toBe(original);
 }finally{f.clean();}
});
