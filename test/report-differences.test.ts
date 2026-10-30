import {test,expect} from 'bun:test';
import {buildReport,markdownReport} from '../.archon/workflows/prepr/review-debate/scripts/reporting.ts';
import type {Debate,DebatePosition,Finding,ReviewResult} from '../.archon/workflows/prepr/.shared/core.ts';
import sample from './fixtures/report-differences.json';
const response=(name:string):ReviewResult=>({reviewer:name,phase:'initial',status:'completed',stdout:JSON.stringify({findings:[],verification:{checks:[{name:'Tests',status:'not run',evidence:'Documentation/archive scope; tests were not run.'}],limitations:['Screenshots were not inspected.']},assessments:{summary:'Routine audit narrative. '.repeat(100),sourceDigest:'hash-audit'}}),stderr:'',exitCode:0,scope:{mode:'local',targetSha:'pinned',files:['docs/progress.md','.ux-runs.zip']}});
function fixture() {
 const findings=structuredClone(sample.findings) as Finding[];
 const debates=findings.map((f):Debate=>{const positions=sample.rounds[f.id as keyof typeof sample.rounds];const rounds=positions.map((r,i)=>({round:i+1,positionA:r.a as DebatePosition,positionB:r.b as DebatePosition,reviewerA:response('Vee'),reviewerB:response('Travis')}));return {dispute:[f],rounds,stopReason:f.kind==='hypothesis'?'max_rounds':'agreement',conclusion:f.kind==='hypothesis'?'unresolved':f.verdict==='no_issue'?'converged-on-no-issue':'converged-on-issue'};});
 return buildReport({reviewers:{a:'Vee',b:'Travis'},initialReviews:{a:response('Vee'),b:response('Travis')},findings,agreements:[]},debates);
}
test('approved report preserves four supported records, three presentation blocks and one shared evidence question',()=>{
 const data=fixture(),before=JSON.stringify(data),md=markdownReport(data);
 expect(md).toContain('4 supported findings · 1 open question');expect(md.match(/^### /gm)).toHaveLength(4);
 expect(md.indexOf('## Reviewer differences')).toBeLessThan(md.indexOf('## Open questions'));
 expect(md.indexOf('## Open questions')).toBeLessThan(md.indexOf('## Other agreements'));
 expect(md.indexOf('## Other agreements')).toBeLessThan(md.indexOf('## Material review limits'));
 expect(md).toContain('2 findings presented together');expect(md).toContain('### Can these entries');expect(md).toContain('Vee initially:** Raised this question.');expect(md).toContain('Travis initially:** Did not initially flag');expect(md).toContain('Discussion:** Vee: Travis identified');
 expect(md).toContain('Both reviewers left the issue verdict unknown');expect(md).not.toContain('The reviewers retain differing conclusions');
 expect(md).toContain('dropping that half');expect(md).toContain('metadata concern still holds');expect(md.indexOf('dropping that half')).toBeLessThan(md.indexOf('metadata concern still holds'));expect(md).not.toContain('### The archive contains macOS metadata and uses a retired');
 expect(md).toContain("Travis's rating:** Nit");expect(md).toContain("Travis's rating:** Should fix");expect(md).not.toContain("Vee's rating");expect(md).not.toContain('not supplied');expect(md).not.toContain('Routine audit narrative');expect(md).not.toContain('hash-audit');
 expect(md).toContain('1 dismissed finding retained in JSON');expect(md).not.toContain('## Withdrawn');expect(md.split(/\s+/).length).toBeLessThan(650);
 expect(data.confirmedBugs).toHaveLength(4);expect(data.stillDisputed).toHaveLength(1);expect(data.debates).toHaveLength(6);expect(JSON.stringify(data)).toBe(before);
});
test('unknown, opposing, absent and initially unflagged positions stay distinct',()=>{
 const data=fixture();delete data.initialReviews!.b;let md=markdownReport(data);expect(md).toContain('Initial evidence unavailable');expect(md).not.toContain('Travis initially:** Did not initially flag');
 const concern=data.concerns.find(c=>c.dispute[0].kind==='hypothesis')!;concern.rounds[0].positionA.verdict='issue';concern.rounds[0].positionB.verdict='no_issue';
 md=markdownReport(data);const beforeQuestions=md.split('## Open questions')[0];expect(beforeQuestions).toContain('Did the runs use real data');expect(beforeQuestions).toContain('Vee now');expect(beforeQuestions).toContain('Travis now');
});
test('shared files or one-sided prose do not silently consolidate or confirm findings',()=>{
 const data=fixture();data.concerns[0].rounds[0].positionB.rationale='This is not the same concern as my first finding.';
 const before=JSON.stringify(data);const md=markdownReport(data);expect(md).not.toContain('2 findings presented together');expect(md.match(/^### /gm)).toHaveLength(5);expect(JSON.stringify(data)).toBe(before);
 const unknown=data.concerns.find(d=>d.dispute[0].kind==='hypothesis')!;unknown.rounds[0].positionA.sameConcernAs=['reviewer-a-1'];expect(markdownReport(data)).not.toContain('2 findings presented together');expect(data.confirmedBugs).toHaveLength(4);
});
test('debate ratings replace only the author display, and unmapped replacements do not inherit a prior level',()=>{
 const data=fixture(),d=data.concerns.find(d=>d.dispute[0].id==='reviewer-a-2')!;
 d.dispute[0].severity='P1';d.dispute[0].severityLevel='high';d.rounds.at(-1)!.positionA.severity='Observation';d.rounds.at(-1)!.positionB.severityLevel='low';
 const before=JSON.stringify(data),md=markdownReport(data);expect(md).toContain("Vee's rating:** Observation");expect(md).toContain("Travis's rating:** Nit");expect(md).not.toContain('Urgency:');expect(md).not.toContain('**Urgency:**');expect(JSON.stringify(data)).toBe(before);
});
test('shortening keeps late conditions and failed checks without copying the whole paragraph or cutoff',()=>{
 const data=fixture();const a=data.verification.a;
 a.checks.push({name:'Lint',status:'failed',evidence:'An invalid symbol fails lint.',reviewer:'Vee'});
 a.limitations.push('Only the date editor was inspected. Routine detail. More detail. The full suite is unverified.');
 data.concerns[0].dispute[0].evidence='The export works. '+Array.from({length:12},(_,i)=>`Investigation detail ${i}.`).join(' ')+' It fails only if the cached value is missing.';
 const md=markdownReport(data);expect(md).toContain('It fails only if the cached value is missing.');expect(md).not.toContain('Investigation detail 11');expect(md).toContain('full suite is unverified');expect(md).toContain('Lint: failed');expect(md.indexOf('Lint: failed')).toBeLessThan(md.indexOf('## Reviewer differences'));
});

test('sentence extraction preserves dotted code/paths, literal expressions and placeholder-looking source text',()=>{
 const data=fixture(),d=data.concerns.find(d=>d.dispute[0].id==='reviewer-b-3')!;
 d.rounds[0].positionA.rationale='The archive contains `.DS_Store` files and `__MACOSX/._*` metadata. PREPRTOKEN0END and $capture-diff.output.previewOnly are literal evidence.';
 const md=markdownReport(data);expect(md).toContain('### The archive contains `.DS_Store` files and `__MACOSX/._*` metadata.');
 d.dispute[0].evidence='PREPRTOKEN0END is a literal marker. $capture-diff.output.previewOnly is quoted source text.';
 const again=markdownReport(data);expect(again).toContain('PREPRTOKEN0END is a literal marker.');expect(again).toContain('$capture-diff.output.previewOnly is quoted source text.');
});

test('late discussion qualifications remain visible even after a supported verdict',()=>{
 const data=fixture(),d=data.concerns.find(d=>d.dispute[0].id==='reviewer-a-2')!;
 d.rounds.at(-1)!.positionA.rationale='The repetition hides the current setup. That supports an issue. More routine investigation. Backend behavior was not verified.';
 const md=markdownReport(data);expect(md).toContain('Backend behavior was not verified.');expect(md).not.toContain('More routine investigation.');expect(data.confirmedBugs).toHaveLength(4);
 d.rounds.at(-1)!.positionA.rationale='We agree only if the cache is missing. No contrary evidence was supplied.';expect(markdownReport(data)).toContain('We agree only if the cache is missing.');
});
