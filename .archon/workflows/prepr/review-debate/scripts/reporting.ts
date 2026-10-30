import type {Failure} from '../../.shared/failures.ts';
import { sameConcern, type Debate, type Finding, type ReviewResult } from "../../.shared/core.ts";
import { sameLocation, severityConflict } from "../../.shared/findings.ts";

import { reuseDiscussion } from "../../.shared/reuse.ts";
import { verification, type Verification } from "../../.shared/verification.ts";

type Comparison = { runId?: string; reviewers: { a: string; b: string }; findings: unknown[]; agreements: Finding[][]; initialReviews?: { a: ReviewResult; b: ReviewResult } };
export type PreprReport = {
  failure?:Failure;
  reviewers: Comparison["reviewers"];
  initialFindings: unknown[];
  initialReviews?: Comparison["initialReviews"];
  agreedFindings: Finding[][];
  initialAgreements: Debate[];
  confirmedBugs: Debate[];
  stillDisputed: (Debate & { whatRemainsUncertain: string })[];
  uncontestedFindings: (Debate & { initiallyRaisedBy?: string })[];
  debates: Debate[];
  concerns: Debate[];
  verification: { a: Verification; b: Verification };
  preparation: { status?: string; checks?: any[]; confirmation?: any; limitations?: string[]; scope?: ReviewResult["scope"]; runtime?: {a?:ReviewResult["runtime"];b?:ReviewResult["runtime"]}; readiness: { a?: ReviewResult["readiness"]; b?: ReviewResult["readiness"] } };
};

function distinctConcerns(debates: Debate[]): Debate[] {
  const parents = debates.map((_, index) => index);
  const root = (index: number): number => parents[index] === index ? index : root(parents[index]);
  for (const [index, debate] of debates.entries()) {
    const latest = debate.rounds.at(-1);
    if (debate.conclusion === "unresolved" || (!latest && !debate.reuse)) continue;
    const confirmedIds = debate.reuse?.sourceIds ?? (latest!.positionA.sameConcernAs ?? []).filter(id => latest!.positionB.sameConcernAs?.includes(id));
    for (const id of confirmedIds) {
      const otherIndex = debates.findIndex(other => other.dispute.some(finding => finding.id === id));
      if (otherIndex < 0 || otherIndex === index) continue;
      const other = debates[otherIndex];
      if (other.conclusion !== debate.conclusion || !debate.dispute.some(a => other.dispute.some(b => b.id === id && sameLocation(a, b)))) continue;
      parents[root(otherIndex)] = root(index);
    }
  }
  const groups = new Map<number, Debate[]>();
  debates.forEach((debate, index) => groups.set(root(index), [...(groups.get(root(index)) ?? []), debate]));
  return [...groups.values()].map(group => ({
    ...group[0],
    dispute: [...new Map(group.flatMap(debate => debate.dispute).map(finding => [finding.id, finding])).values()],
    rounds: group.flatMap(debate => debate.rounds),
  }));
}

const initialConclusion = (dispute: Finding[]): Debate["conclusion"] => {
  if (dispute.length !== 2 || new Set(dispute.map(finding => finding.reviewer)).size !== 2 || !sameConcern(dispute[0], dispute[1])) return "unresolved";
  if (dispute.every(finding => finding.verdict === "issue")) return "converged-on-issue";
  if (dispute.every(finding => finding.verdict === "no_issue")) return "converged-on-no-issue";
  return "unresolved";
};
const uncertainty = (debate: Debate) => debate.stopReason === "incomplete"
  ? "Discussion did not complete; this concern remains unconfirmed until the missing discussion evidence is available."
  : "Decide whether this concern needs action by weighing the reviewers' differing evidence; they have not established a shared conclusion.";

export const buildReport = (comparison: Comparison, debates: Debate[]): PreprReport => {
  const initialAgreements: Debate[] = comparison.agreements.map(dispute => ({ dispute, rounds: [], stopReason: "agreement", conclusion: initialConclusion(dispute) }));
  // Verify explicit positions even if an upstream caller supplies an optimistic conclusion.
  let checkedDebates = debates.map(debate => {
    const last = debate.rounds.at(-1);
    const shared = last && last.reviewerA.status === "completed" && last.reviewerB.status === "completed"
      && last.positionA.verdict && last.positionA.verdict === last.positionB.verdict
      && !(last.positionA.stance === "agree_to_disagree" && last.positionB.stance === "agree_to_disagree");
    const conclusion: Debate["conclusion"] = debate.conclusion === "unresolved" || !shared ? "unresolved" : last!.positionA.verdict === "issue" ? "converged-on-issue" : "converged-on-no-issue";
    return { ...debate, conclusion };
  });
  checkedDebates = checkedDebates.map((checked,index) => {
    const original=debates[index], link=original.reuse;
    if (!link) return checked;
    const source=checkedDebates.find(candidate=>!candidate.reuse && JSON.stringify(candidate.dispute.map(f=>f.id))===JSON.stringify(link.sourceIds));
    const scope=comparison.initialReviews?.a.scope;
    if (!source || !scope || comparison.runId!==link.runId || JSON.stringify(scope)!==JSON.stringify(link.scope) || JSON.stringify(scope)!==JSON.stringify(comparison.initialReviews?.b.scope)) return checked;
    const expected=reuseDiscussion(source,comparison.findings as Finding[],original.dispute,comparison.findings as Finding[],scope,link.runId);
    return expected && expected.reuse?.fingerprint===link.fingerprint ? expected : checked;
  });
  const all = distinctConcerns([...initialAgreements, ...checkedDebates]);
  return {
    reviewers: comparison.reviewers,
    initialFindings: comparison.findings,
    initialReviews: comparison.initialReviews,
    agreedFindings: comparison.agreements,
    initialAgreements,
    confirmedBugs: all.filter(debate => debate.conclusion === "converged-on-issue"),
    stillDisputed: all.filter(debate => debate.conclusion === "unresolved").map(debate => ({ ...debate, whatRemainsUncertain: uncertainty(debate) })),
    uncontestedFindings: checkedDebates.filter(debate => debate.dispute.length === 1).map(debate => ({ ...debate, initiallyRaisedBy: debate.dispute[0].reviewer })),
    debates: checkedDebates,
    concerns: all,
    verification: { a: verification(comparison.initialReviews?.a), b: verification(comparison.initialReviews?.b) },
    preparation: { ...comparison.initialReviews?.a.preparation, scope: comparison.initialReviews?.a.scope, runtime:{a:comparison.initialReviews?.a.runtime,b:comparison.initialReviews?.b.runtime}, readiness: { a: comparison.initialReviews?.a.readiness, b: comparison.initialReviews?.b.readiness } },
  };
};

const readable = (text: string) => text.replace(/\s+/g, ' ').replace(/^\s*(?:\d+[.)]\s*|\[P[0-3]\]\s*|(?:critical|high|medium|low):\s*)+/i, '').trim();
const sentences = (text: string) => {
  const tokens:string[]=[];let marker='PREPRTOKEN';while(text.includes(marker))marker+='_';
  const protectedText=readable(text).replace(/`[^`]+`|[.\w/-]*[./][\w_/-]+(?:\.[\w_/-]+)*/g,value=>`${marker}${tokens.push(value)-1}END`);
  return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(protectedText)].map(s=>s.segment.trim().replace(new RegExp(marker+'(\\d+)END','g'),(_,n)=>tokens[Number(n)])).filter(Boolean);
};
const material = (text:string) => /\b(if|unless|until|only when|provided that|unverified|unknown|conditional|depends on|partial|could not|couldn't|not verified|not reproduced|not inspect|not run|not established)\b/i.test(text);
// Extract whole statements and their conditions; never cut off the tail of a qualified claim.
const compact = (text:string, context=false) => {
  const parts=sentences(text).filter(s=>{
    if(/^(?:Origin:|target baseline:|current-main status:|(?:The )?Base64 searches.{0,240}(?:found nothing|turned up no))/i.test(s))return false;
    return !/^(?:No (?:new|contrary) evidence|We (?:still )?agree|Nothing new|Everything else holds|Neither gap changes)/i.test(s)||material(s)||/correction|revis|change|but|however/i.test(s);
  });
  const selected=context?parts.filter(material):parts.slice(0,2);
  const corrections=parts.filter(s=>/dropping|withdrawing|(?:half|part|concern) still holds|only correction/i.test(s)).map(s=>s.match(/\bI(?:'m| am) (?:dropping|withdrawing|narrowing)\b.+/i)?.[0]??s);
  const statements=[...new Set([...selected,...corrections,...parts.filter(material)])];
  return statements.filter((s,i)=>!statements.some((other,j)=>i!==j&&other!==s&&other.includes(s))).sort((a,b)=>parts.findIndex(p=>p.includes(a))-parts.findIndex(p=>p.includes(b))).join(' ');
};
const bullet=(label:string,text:string)=>`- **${label}:** ${text}`;
const failureClient=(failure?:Failure)=>failure?.executable?`Client: ${failure.launcher} \`${failure.executable.path}\` (${failure.executable.version}); model \`${failure.model}\`.`:undefined;
const opposite=(a?:{verdict?:string;severityLevel?:string},b?:{verdict?:string;severityLevel?:string})=>Boolean(a&&b&&((a.verdict&&b.verdict&&a.verdict!==b.verdict)||severityConflict(a,b)));
const initial=(d:Debate,side:'a'|'b')=>d.dispute.find(f=>f.reviewer===`reviewer-${side}`);
const lastPosition=(d:Debate,side:'a'|'b')=>d.rounds.at(-1)?.[side==='a'?'positionA':'positionB'];
const opposed=(d:Debate)=>opposite(initial(d,'a'),initial(d,'b'))||d.rounds.some(r=>opposite(r.positionA,r.positionB))||d.stopReason==='agree_to_disagree';
const claim=(f:Finding)=>readable(f.question||f.title||f.summary).replace(/^[\p{L}_ -]+ \d+:\s*/u,'');
const references=(items:Debate[])=>[...new Set(items.flatMap(d=>d.dispute.map(f=>f.file?`${f.file}${f.line!==undefined?`:${f.line}`:''}`:undefined)).filter(Boolean))].map(p=>`\`${p}\``).join(', ');
const title=(text:string)=>sentences(text)[0]||readable(text);

export function verificationBullets(name:string,supplied:Verification) {
  const checks=supplied.checks.filter(c=>['failed','blocked'].includes(c.status)||!/^Resource |snapshot|integrity|actual reviewer response|static workflow/i.test(c.name)&&(/test|suite|lint|build|type.?check/i.test(c.name)&&c.name!=='Project check'||/test|suite|lint|build/i.test(c.evidence)&&/passed|passing|failed|not run|unverified|interrupted|\bran\b|execut/i.test(c.evidence)));
  const routine=(t:string)=>/^Reviewer execution .+; the review is incomplete\.$/i.test(t)||/no (?:current )?(?:feature )?(?:specification|ticket|spec)\b|no alignment score|ignored files and committed branch|operational claims about Git-excluded|snapshot has no tests, CI/i.test(t);
  const overview=sentences(supplied.overview??'').filter(s=>/partial|coverage|only.{0,60}(?:inspect|review)|(?:inspect|review).{0,60}only/i.test(s));
  const limits=[...new Set([...overview,...supplied.limitations].filter(t=>!routine(t)).map(t=>{const brief=compact(t);return [brief,...sentences(t).filter(s=>material(s)&&!brief.includes(s)&&! /^(?:The )?Base64 searches.{0,240}(?:found nothing|turned up no)/i.test(s))].filter(Boolean).join(' ');}))].filter((t,i,all)=>t&&!all.some((u,j)=>j!==i&&u!==t&&u.includes(t))&&!checks.some(c=>readable(c.evidence)===t));
  const assessments:string[]=[];
  const assess=(value:unknown,key='')=>{
    if(!value||typeof value!=='object')return;
    const entries=Object.entries(value),scored=entries.some(([k,v])=>/score|rating/i.test(k)&&typeof v==='number');
    for(const [k,v] of entries){
      if(v&&typeof v==='object')assess(v,k);
      else if(typeof v==='number'&&/score|rating/i.test(k))assessments.push(`${key?key+' ':''}${k}: ${v}`);
      else if(typeof v==='string'&&(scored&&/reason|evidence|limitation/i.test(k)||/alignment|assessment|verdict/i.test(k)&&/unmet|misalign|noncompliant|not satisfied|failed/i.test(v)))assessments.push(compact(v));
    }
  };assess(supplied.assessments);
  return [...checks.map(c=>bullet(`${name} — ${c.name}: ${c.status}`,compact(c.evidence))),...limits.map(t=>bullet(`${name} limitation`,t)),...assessments.map(t=>bullet(`${name} assessment`,t))];
}

// A recorded relation can justify a display group; it does not satisfy bilateral duplicate reuse.
function related(a:Debate,b:Debate,report:PreprReport) {
  if(a.conclusion!=='converged-on-issue'||b.conclusion!==a.conclusion||opposed(a)||opposed(b))return false;
  if(!a.dispute.some(x=>b.dispute.some(y=>x.file&&x.file===y.file&&x.reviewer!==y.reviewer)))return false;
  const links=(from:Debate,to:Debate)=>from.rounds.some(r=>(['a','b'] as const).some(side=>{
    const pos=r[side==='a'?'positionA':'positionB'];
    if(pos.sameConcernAs?.some(id=>to.dispute.some(f=>f.id===id)))return true;
    if(/\b(?:not|different|isn't|is not).{0,35}(?:same concern|duplicate)/i.test(pos.rationale))return false;
    if(!/\b(?:same concern|duplicate) as my first finding\b/i.test(pos.rationale))return false;
    const first=(report.initialFindings as Finding[]).find(f=>f.reviewer===`reviewer-${side}`);
    return Boolean(first&&to.dispute.some(f=>f.id===first.id));
  }));
  return links(a,b)||links(b,a);
}
function displayGroups(report:PreprReport) {
  const groups:Debate[][]=[];
  for(const d of report.concerns){if(!d.dispute.length)continue;const group=groups.find(g=>g.some(other=>related(other,d,report)));if(group)group.push(d);else groups.push([d]);}
  return groups;
}
function section(items:Debate[]) {
  if(items.some(d=>d.conclusion==='unresolved'&&!opposed(d)))return 'Open questions requiring evidence';
  if(items.every(d=>d.conclusion==='converged-on-no-issue')&&!items.some(opposed))return undefined;
  const authors=new Set(items.flatMap(d=>d.dispute.map(f=>f.reviewer)));
  if(items.some(opposed)||authors.size===1||items.some(d=>d.rounds.some(r=>r.positionA.correctedFinding||r.positionB.correctedFinding)))return 'Reviewer differences and where they landed';
  return 'Other agreements';
}
function ratings(items:Debate[],names:{a:string;b:string}) {
  return (['a','b'] as const).flatMap(side=>{
    const values=[...new Set(items.flatMap(d=>{
      const latest=lastPosition(d,side),f=initial(d,side);
      return latest?.severity?[latest.severity]:f?.severity?[f.severity]:[];
    }))];
    return values.length?[bullet(`${names[side]}'s rating`,values.join('; '))]:[];
  });
}
function discussion(d:Debate,names:{a:string;b:string}) {
  const last=d.rounds.at(-1);if(!last)return '';
  const changes=d.rounds.flatMap((r,i)=>{const previous=d.rounds[i-1];return (['a','b'] as const).flatMap(side=>{
    const key=side==='a'?'positionA':'positionB',pos=r[key],before=previous?.[key]?.verdict??initial(d,side)?.verdict;
    return pos.verdict&&pos.verdict!==before&&pos.verdict===last[key].verdict?[{side,pos}]:[];
  });});
  const correction=(['a','b'] as const).find(side=>/dropping|withdraw|narrow|accept.{0,30}correction/i.test(last[side==='a'?'positionA':'positionB'].rationale));
  const changed=correction?{side:correction,pos:last[correction==='a'?'positionA':'positionB']}:changes.at(-1);
  if(changed)return `${names[changed.side]}: ${compact(changed.pos.rationale)}`;
  const first=d.rounds.find(r=>opposite(r.positionA,r.positionB));
  if(first)return `${names.a}: ${compact(first.positionA.rationale)} ${names.b}: ${compact(first.positionB.rationale)}`;
  return '';
}
function entry(items:Debate[],heading:string,names:{a:string;b:string},report:PreprReport) {
  const d=items[0],f=d.dispute[0],last=d.rounds.at(-1);
  const corrected=last?.positionA.correctedFinding??last?.positionB.correctedFinding;
  const narrowed=!f.question&&!f.title&&last&&[last.positionA,last.positionB].some(p=>/dropping|withdraw|narrow|accept.{0,30}correction/i.test(p.rationale));
  const headingText=corrected||f.question||f.title||(narrowed?sentences(last!.positionA.rationale)[0]:claim(f));
  const lines=[`### ${title(headingText)}`,`${references(items)}${items.length>1?` · **${items.length} findings presented together**`:''}`];
  const incomplete=items.some(d=>d.stopReason==='incomplete');
  for(const side of ['a','b'] as const){
    const findings=items.flatMap(d=>d.dispute.filter(f=>f.reviewer===`reviewer-${side}`));
    const initialText=findings.length?findings.map(f=>f.question&&headingText===f.question?['Raised this question.',...sentences(f.question).slice(1)].join(' '):f.question||compact(f.evidence||f.summary)).join(' '):report.initialReviews?.[side]?.status==='completed'?'Did not initially flag this concern.':'Initial evidence unavailable; no initial position is inferred.';
    lines.push(bullet(`${names[side]} initially`,initialText));
  }
  if(heading==='Open questions requiring evidence') {
    const bothUnknown=last&&last.reviewerA.status==='completed'&&last.reviewerB.status==='completed'&&!last.positionA.verdict&&!last.positionB.verdict;
    lines.push(bullet('After discussion',incomplete?'Unconfirmed — discussion did not complete.':bothUnknown?'Both reviewers left the issue verdict unknown.':'No shared issue/no-issue conclusion is established.'));
    const missing=items.flatMap(d=>d.rounds.at(-1)?(['a','b'] as const).flatMap(side=>{
      const text=lastPosition(d,side)?.rationale??'';
      return sentences(text).filter(t=>/until|unless|needs? (?:to|evidence)|cannot (?:verify|establish)|could not|couldn't|not verified|unverified/i.test(t)).map(t=>`${names[side]}: ${t}`);
    }):[]);
    if(missing.length)lines.push(bullet('Evidence needed',[...new Set(missing)].join(' ')));
  } else {
    const discussed=heading==='Other agreements'?items.flatMap(d=>[lastPosition(d,'a'),lastPosition(d,'b')].flatMap((p,i)=>sentences(p?.rationale??'').filter(t=>/only correction/i.test(t)).map(t=>`${i===0?names.a:names.b}: ${t}`))):[...new Set(items.map(d=>discussion(d,names)).filter(Boolean))];
    if(discussed.length)lines.push(bullet('Discussion',discussed.join(' ')));
    if(items.some(d=>d.conclusion==='unresolved')&&last){
      for(const side of ['a','b'] as const)lines.push(bullet(`${names[side]} now`,compact(lastPosition(d,side)!.rationale)));
    }
    const outcome=incomplete?'Unconfirmed — discussion did not complete.':d.stopReason==='agree_to_disagree'?'Both reviewers chose to leave their differing conclusions unresolved.':items.every(d=>d.conclusion==='converged-on-issue')?'Both reviewers support the concern.':items.every(d=>d.conclusion==='converged-on-no-issue')?'Both reviewers concluded no change is needed.':'The reviewers retain differing conclusions.';
    lines.push(bullet('Final position',outcome));
    const a=lastPosition(d,'a')?.severity?lastPosition(d,'a'):initial(d,'a'),b=lastPosition(d,'b')?.severity?lastPosition(d,'b'):initial(d,'b');
    if(d.conclusion==='converged-on-issue'&&severityConflict(a,b))lines.push(bullet('Urgency','Comparable mapped ratings still differ; no shared urgency was recorded.'));
  }
  lines.push(...ratings(items,names));
  const impact=items.flatMap(d=>d.dispute.map(f=>f.impact)).filter((t):t is string=>Boolean(t));
  if(!impact.length&&heading==='Other agreements'){const p=lastPosition(items.at(-1)!,'a');const consequence=sentences(p?.rationale??'').find(t=>/\b(risks?|causes?|throws?|crashes?|leads? to|results? in)\b/i.test(t));if(consequence)impact.push(consequence);}
  if(impact.length)lines.push(bullet('Consequence',[...new Set(impact.map(t=>compact(t)))].join(' ')));
  // Preserve conditions from the finding itself even when the question/title was used for its initial position.
  const conditions=[...new Set(items.flatMap(d=>d.dispute.map(f=>compact(f.evidence,true))).filter(Boolean))].filter(t=>!lines.some(l=>l.includes(t)));
  if(conditions.length&&heading!=='Open questions requiring evidence')lines.push(bullet('Evidence limits',conditions.join(' ')));
  return lines.slice(0,2).filter(Boolean).join('\n\n')+'\n\n'+lines.slice(2).join('\n');
}
export const markdownReport=(report:PreprReport):string=>{
  const names={a:report.reviewers.a===report.reviewers.b?`${report.reviewers.a} (A)`:report.reviewers.a,b:report.reviewers.a===report.reviewers.b?`${report.reviewers.b} (B)`:report.reviewers.b};
  const sections=['Reviewer differences and where they landed','Open questions requiring evidence','Other agreements'];
  const groups=displayGroups(report),issues=report.concerns.filter(d=>d.conclusion==='converged-on-issue').length,open=report.concerns.filter(d=>d.conclusion==='unresolved'&&!opposed(d)).length,differences=report.concerns.filter(d=>d.conclusion==='unresolved'&&opposed(d)).length;
  const incomplete=Boolean(report.failure)||report.preparation.status==='failed'||report.concerns.some(d=>d.stopReason==='incomplete')||[report.initialReviews?.a,report.initialReviews?.b].some(r=>r&&r.status!=='completed');
  const qualified=Object.values(report.verification).some(v=>v.overview||v.limitations.length);
  const assessment=!issues&&!open&&!differences?report.concerns.length?'All raised concerns were dismissed; none remain unresolved.':qualified?'No actionable concerns were identified within the reviewed portions.':'No actionable concerns were identified.':`**${issues} supported finding${issues===1?'':'s'} · ${open} open question${open===1?'':'s'}${differences?` · ${differences} unresolved difference${differences===1?'':'s'}`:''}**`;
  const failure=report.failure,opening=failure?`Review incomplete — ${failure.stage} failed${failure.reviewer?` for ${failure.reviewer}`:''}: ${failure.message} ${failure.recovery}`:incomplete?'Review incomplete. Available concerns remain unconfirmed where discussion did not complete.':assessment;
  const scope=report.preparation.scope,files=scope?.files??[];
  const scopeLine=scope?`Scope: ${scope.mode==='local'?'local uncommitted changes':'committed branch changes'}; ${files.length} eligible files${files.length&&files.length<=5?` (${files.map(f=>'`'+f+'`').join(', ')})`:''}${scope.excluded?.length?`; ${scope.excluded.length} tooling/generated files excluded`:''}.`:undefined;
  const checks=(['a','b'] as const).flatMap(side=>verificationBullets(names[side],report.verification[side]));
  const coverage=Object.entries(report.verification).flatMap(([side,v])=>sentences(v.overview??'').filter(t=>/partial|only.{0,60}(?:review|inspect)/i.test(t)).map(t=>`${names[side as 'a'|'b']}: ${t}`));
  const blocker=checks.filter(t=>/working.tree|snapshot.*(?:inaccessible|unverif)|required.*(?:blocked|unavailable)| — .+: (?:failed|blocked)/i.test(t));
  const content=sections.flatMap(heading=>{const items=groups.filter(g=>section(g)===heading);return items.length?[`## ${heading}`,items.map(g=>entry(g,heading,names,report)).join('\n\n')]:[];});
  const dismissed=groups.filter(g=>!section(g)).flat().length;
  return ['# Prepr report',opening,failureClient(failure),`Reviewers: ${report.reviewers.a} (A); ${report.reviewers.b} (B).`,scopeLine,...new Set([...(!issues?coverage:[]),...blocker]),...content,...(checks.length?['## Material review limits',checks.filter(t=>!blocker.includes(t)&&!coverage.some(c=>t.includes(c.split(': ').slice(1).join(': ')))).join('\n')]:[]),...(dismissed?[`${dismissed} dismissed finding${dismissed===1?'':'s'} retained in JSON.`]:[])].filter(Boolean).join('\n\n');
};

export function incompleteReport(evidence:{scope?:unknown;preparation?:any;initialReviews:{a?:ReviewResult;b?:ReviewResult};missing:string[];failure?:Failure}) {
  const failures:{stage:string;side?:string;launcher?:string;model?:string;evidence:string;recovery:string}[]=[];
  if(evidence.failure)failures.push({stage:evidence.failure.stage,side:evidence.failure.side,launcher:evidence.failure.launcher,model:evidence.failure.model,evidence:`${evidence.failure.reviewer??''} ${evidence.failure.message}`.trim(),recovery:evidence.failure.recovery});
  if(!failures.length&&evidence.preparation?.status==='failed')failures.push({stage:evidence.preparation.stage||'static validation',evidence:evidence.preparation.error||'Static validation failed.',recovery:evidence.preparation.recovery||'Run prepr-setup to inspect configuration.'});
  for(const side of ['a','b'] as const) {
    const result=evidence.initialReviews[side];
    if(!failures.length&&result&&result.status!=='completed')failures.push({stage:'initial review',side,launcher:result.runtime?.launcher,model:result.runtime?.model,evidence:result.failure?.message||result.stderr||result.stdout||`Reviewer execution ${result.status}; no diagnostic supplied.`,recovery:'Check the selected launcher login and model configuration, required resource access, or slow startup hooks/plugins; rerun after resolving the failure. No account, model or permissions were changed.'});
  }
  if(!failures.length)failures.push({stage:'before comparison',evidence:'No usable completed comparison is available; the cause is unknown.',recovery:'Inspect the upstream Archon node errors and rerun after resolving the failure.'});
  return {status:'incomplete' as const,failure:evidence.failure,failures,initialReviews:evidence.initialReviews,preparation:{...evidence.preparation,scope:evidence.scope},verification:{a:verification(evidence.initialReviews.a),b:verification(evidence.initialReviews.b)},limitations:evidence.missing,findingsAvailable:false};
}
export function incompleteMarkdown(report:ReturnType<typeof incompleteReport>) {
  const started=report.preparation.initialReviewsStarted===false?'Neither initial review started.':'Available reviewer results are retained; two completed reviews have not been established.';
  const failures=report.failures.map(f=>`- **${f.side?`Reviewer ${f.side.toUpperCase()} — `:''}${f.stage}${f.launcher?` (${f.launcher}, ${f.model})`:''}:** ${f.evidence}\n  Recovery: ${f.recovery}`);
  const checks=(['a','b'] as const).flatMap(side=>verificationBullets(report.initialReviews[side]?.reviewer||side.toUpperCase(),report.verification[side]));
  const names=(['a','b'] as const).map(side=>{const name=report.initialReviews[side]?.reviewer||report.preparation.reviewers?.[side]?.name;return name?`${name} (${side.toUpperCase()})`:undefined;}).filter(Boolean);
  const scope=report.preparation.scope;
  const scopeLine=scope?`Scope: ${scope.mode==='local'?'uncommitted project changes':'committed branch changes'}; ${scope.files?.length??0} eligible files${scope.excluded?.length?`; ${scope.excluded.length} tooling/generated files excluded`:''}.`:undefined;
  return ['# Prepr report','Review incomplete. '+started,...(names.length?[`Reviewers: ${names.join('; ')}.`]:[]),...(scopeLine?[scopeLine]:[]),'## Material review limits',...failures,failureClient(report.failure),...checks,...(!report.failures.length?report.limitations.map(l=>`- ${l}`):[]),'No completed comparison is available; no shared review conclusion or successful empty review is claimed.'].filter(Boolean).join('\n\n');
}
