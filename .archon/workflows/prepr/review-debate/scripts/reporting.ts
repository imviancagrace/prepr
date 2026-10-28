import { sameConcern, type Debate, type Finding, type ReviewResult, type DebatePosition } from "../../.shared/core.ts";
import { sameLocation, severityConflict } from "../../.shared/findings.ts";

import { reuseDiscussion } from "../../.shared/reuse.ts";
import { verification, limitSentences, type Verification } from "../../.shared/verification.ts";

type Comparison = { runId?: string; reviewers: { a: string; b: string }; findings: unknown[]; agreements: Finding[][]; initialReviews?: { a: ReviewResult; b: ReviewResult } };
export type PreprReport = {
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
  ? "Decide whether this concern needs action once the missing review evidence is available. A reviewer session did not complete, so the evidence is incomplete."
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

const readable = (text: string) => text.replace(/\s+/g, " ").replace(/^\s*(?:\d+[.)]\s*|\[P[0-3]\]\s*|(?:critical|high|medium|low):\s*)+/i, "").trim();
const short = (text: string, words = 55) => {
  if (words >= 35 && limitSentences(text).length) return readable(text);
  const parts = readable(text).split(" ");
  return parts.length > words ? `${parts.slice(0, words).join(" ")}…` : parts.join(" ");
};
const findingClaim = (finding: Finding) => readable(finding.summary).replace(/^\S+\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|php|md|ya?ml|json|sql):\d+\s*[—:–-]?\s*/, "");
const rationale = (finding?: Finding) => {
  if (!finding) return "Did not raise this concern in the initial review.";
  if (finding.evidence === finding.summary) return finding.verdict === "no_issue"
    ? "Initially dismissed the concern; no separate supporting rationale was recorded."
    : finding.verdict === "issue" ? "Initially considered this an issue; no separate supporting rationale was recorded."
    : "Raised this concern without a separate supporting rationale.";
  const text = finding.evidence.match(/(?:Private rationale|Rationale|Evidence):\s*([^\n]+)/i)?.[1] ?? finding.evidence;
  return short(text);
};
const opposite = (a?: { verdict?: string; severityLevel?: string }, b?: { verdict?: string; severityLevel?: string }) => Boolean(a && b && (
  (a.verdict && b.verdict && a.verdict !== b.verdict) || severityConflict(a, b)
));
const disputed = (debate: Debate) => opposite(debate.dispute.find(f => f.reviewer === "reviewer-a"), debate.dispute.find(f => f.reviewer === "reviewer-b"))
  || debate.rounds.some(round => opposite(round.positionA, round.positionB))
  || debate.stopReason === "agree_to_disagree";
const outcome = (debate: Debate) => debate.conclusion === "converged-on-issue" ? "Both reviewers concluded this is an issue."
  : debate.conclusion === "converged-on-no-issue" ? "No change is needed for this concern; both reviewers concluded this is not an issue."
  : debate.stopReason === "incomplete" ? "Review incomplete; no shared conclusion is established."
  : debate.stopReason === "agree_to_disagree" ? "Both reviewers chose to leave their differing conclusions unresolved."
  : "The reviewers did not reach a shared conclusion.";
const bullet = (label: string, text: string) => `- **${label}:** ${text}`;
const assessmentText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(assessmentText).join('; ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, entry]) => `${key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()}: ${assessmentText(entry)}`).join('; ');
  return String(value);
};
const verificationBullets = (side: string, supplied: Verification) => [
  ...(supplied.overview ? [bullet(`${side} — Review assessment`, readable(supplied.overview))] : []),
  ...supplied.checks.map(check => bullet(`${side} — ${check.name}: ${check.status}`, `${readable(check.evidence)}${check.snapshot ? ` (snapshot ${check.snapshot})` : ""}`)),
  ...supplied.limitations.map(limit => bullet(`${side} limitation`, readable(limit))),
  ...(supplied.assessments !== undefined ? [bullet(`${side} — Additional assessments`, readable(assessmentText(supplied.assessments)))] : []),
];
const positionText = (position: DebatePosition, initial?: Finding) => {
  const before = rationale(initial), after = short(position.rationale, 35);
  return before === after ? before : `${before} Latest reasoning: ${after}`;
};

function entry(debate: Debate, isDisagreement: boolean): string {
  const finding = debate.dispute[0];
  const latest = debate.rounds.at(-1);
  const correction = latest?.positionA.correctedFinding ?? latest?.positionB.correctedFinding;
  const concern = short(correction || findingClaim(finding));
  const title = short(finding.title || findingClaim(finding), 12);
  const references = [...new Set(debate.dispute.map(f => f.file ? `${f.file}${f.line !== undefined ? `:${f.line}` : ""}` : f.summary.match(/(?:[\w./-]+\.[\w]+|\.gitignore):\d+/)?.[0]).filter(Boolean).map(ref => `\`${ref}\``))];
  const lines = [bullet("Concern", `${concern}${references.length ? ` (${references.join(", ")})` : ""}`)];
  for (const initial of debate.dispute) if (initial.question) lines.push(bullet(`${initial.reviewer === 'reviewer-a' ? 'A' : 'B'}'s question`, readable(initial.question)));
  if (isDisagreement) {
    const a = debate.dispute.find(f => f.reviewer === "reviewer-a"), b = debate.dispute.find(f => f.reviewer === "reviewer-b");
    const firstDifference = debate.rounds.find(round => opposite(round.positionA, round.positionB));
    const showReason = (initial: Finding | undefined, side: "positionA" | "positionB") => {
      const severity = severityConflict(a, b) && initial?.severity ? `Initially rated ${initial.severity} severity. ` : "";
      const start = severity + (firstDifference && (!opposite(a, b) || initial?.evidence === initial?.summary) ? positionText(firstDifference[side], initial) : rationale(initial));
      if (debate.conclusion === "unresolved" && latest && firstDifference !== latest) return `${start} Latest reasoning: ${short(latest[side].rationale, 35)}`;
      return start;
    };
    lines.push(bullet("A's reasoning", showReason(a, "positionA")));
    lines.push(bullet("B's reasoning", showReason(b, "positionB")));
    lines.push(bullet("Review conclusion", outcome(debate)));
    if (debate.conclusion !== "unresolved" && latest) {
      // Prefer the response that changed its verdict, so the resolution explains the movement.
      const changed = debate.rounds.flatMap((round, index) => {
        const prior = debate.rounds[index - 1];
        return [[prior?.positionA.verdict ?? a?.verdict, round.positionA, "Reviewer A"], [prior?.positionB.verdict ?? b?.verdict, round.positionB, "Reviewer B"]] as [string | undefined, DebatePosition, string][];
      }).findLast(([before, after]) => before && before !== after.verdict && after.verdict === latest.positionA.verdict);
      lines.push(bullet("Why the conclusion changed", `${changed?.[2] ?? "Reviewer A"}: ${short((changed?.[1] ?? latest.positionA).rationale)}`));
    }
    if (debate.conclusion === "unresolved") lines.push(bullet("What you need to decide", uncertainty(debate)));
    else if (debate.conclusion === "converged-on-issue" && severityConflict(latest?.positionA.severityLevel ? latest.positionA : a, latest?.positionB.severityLevel ? latest.positionB : b)) lines.push(bullet("What you need to decide", `Decide how urgently to address this issue: A initially rated it ${a?.severity} (${a?.severityLevel}), while B rated it ${b?.severity} (${b?.severityLevel}). No shared severity rating was recorded during debate.`));
  } else {
    const reasons = latest ? [latest.positionA.rationale, latest.positionB.rationale] : debate.dispute.map(f => rationale(f));
    const distinct = [...new Set(reasons.map(text => short(text)))];
    lines.push(bullet("Reviewers' reasoning", distinct.length === 1 ? `Both reviewers: ${distinct[0]}` : `A: ${distinct[0]} B: ${distinct[1] ?? "No supporting reasoning recorded."}`));
    lines.push(bullet("Review conclusion", outcome(debate)));
  }
  const limits = [...new Set([...debate.dispute.flatMap(f => limitSentences(f.evidence)), ...(latest ? [...limitSentences(latest.positionA.rationale), ...limitSentences(latest.positionB.rationale)] : [])])];
  if (limits.length) lines.push(bullet("Evidence limits and conditions", limits.join(" ")));
  const a = debate.dispute.find(f => f.reviewer === "reviewer-a"), b = debate.dispute.find(f => f.reviewer === "reviewer-b");
  if (a?.severity || b?.severity) lines.push(bullet("Severity", `A: ${a?.severity || "not supplied"}${a?.severityLevel ? ` (${a.severityLevel})` : " (unmapped)"}; B: ${b?.severity || "not supplied"}${b?.severityLevel ? ` (${b.severityLevel})` : " (unmapped)"}.${!a?.severityLevel || !b?.severityLevel ? " Severity comparison unavailable." : ""}`));
  const impact = debate.dispute.map(f => f.impact).find(Boolean);
  if (impact) lines.push(bullet(debate.conclusion === "converged-on-no-issue" ? "Why it mattered" : "Why it matters", short(impact)));
  return `### ${title}\n\n${lines.join("\n")}`;
}

export const markdownReport = (report: PreprReport): string => {
  const sections: Record<string, Debate[]> = { Disagreements: [], Agreements: [], "Withdrawn concerns": [] };
  const seen: Finding[] = [];
  // Unresolved outcomes take priority if the same concern appears in several evidence categories.
  const all = [...report.concerns].sort((a, b) => Number(b.conclusion === "unresolved") - Number(a.conclusion === "unresolved"));
  for (const debate of all) {
    const finding = debate.dispute[0];
    if (!finding || seen.some(previous => previous.id === finding.id || sameConcern(previous, finding))) continue;
    seen.push(finding);
    const section = debate.conclusion === "unresolved" || disputed(debate) ? "Disagreements"
      : debate.conclusion === "converged-on-no-issue" ? "Withdrawn concerns" : "Agreements";
    sections[section].push(debate);
  }
  const unresolved = Object.values(sections).flat().filter(d => d.conclusion === "unresolved").length;
  const issues = Object.values(sections).flat().filter(d => d.conclusion === "converged-on-issue").length;
  const incomplete=report.preparation.status==='failed'||report.concerns.some(d=>d.stopReason==='incomplete')||[report.initialReviews?.a,report.initialReviews?.b].some(r=>r&&r.status!=='completed');
  const qualified = Object.values(report.verification).some(v=>v.overview || v.limitations.length);
  const assessment = incomplete ? "Review incomplete; the available evidence does not establish a complete review." : !seen.length ? qualified ? "No actionable concerns were identified within the reviewed portions; see the attributed assessments and limitations below." : "No actionable concerns were identified."
    : !issues && !unresolved ? "All raised concerns were dismissed; none remain unresolved."
    : `${issues} concern${issues === 1 ? "" : "s"} supported by both reviewers; ${unresolved} ${unresolved === 1 ? "remains" : "remain"} unresolved. ${unresolved ? "Review the differing evidence before deciding your next steps." : "Use the reasoning below to decide which concerns warrant action."}`;
  const checks = (["a", "b"] as const).flatMap(side => verificationBullets(side.toUpperCase(), report.verification[side]));
  checks.unshift(...(report.preparation.checks??[]).map(c=>bullet(`Static check — ${c.name}: ${c.status}`,c.evidence)),...(report.preparation.confirmation?[bullet('Launcher/model prerequisites: user-confirmed','User reported login/model access; confirmation is not observed runtime authentication or resource access.')]:[]),...(report.preparation.limitations??[]).map(l=>bullet('Preparation limitation',l)));
  return [`# Prepr report`, assessment, `**Verification and limitations**\n\n${checks.join("\n")}`, `Reviewers: A — ${report.reviewers.a}; B — ${report.reviewers.b}.`,
    ...Object.entries(sections).filter(([, items]) => items.length).map(([title, items]) => `## ${title}\n\n${items.map(debate => entry(debate, title === "Disagreements")).join("\n\n")}`),
  ].join("\n\n");
};

export function incompleteReport(evidence:{scope?:unknown;preparation?:any;initialReviews:{a?:ReviewResult;b?:ReviewResult};missing:string[]}) {
  const failures:{stage:string;side?:string;launcher?:string;model?:string;evidence:string;recovery:string}[]=[];
  if(evidence.preparation?.status==='failed')failures.push({stage:evidence.preparation.stage||'static validation',evidence:evidence.preparation.error||'Static validation failed.',recovery:evidence.preparation.recovery||'Run prepr-setup to inspect configuration.'});
  for(const side of ['a','b'] as const) {
    const result=evidence.initialReviews[side];
    if(result&&result.status!=='completed')failures.push({stage:'initial review',side,launcher:result.runtime?.launcher,model:result.runtime?.model,evidence:result.stderr||result.stdout||`Reviewer execution ${result.status}; no diagnostic supplied.`,recovery:'Check the selected launcher login and model configuration, required resource access, or slow startup hooks/plugins; rerun after resolving the failure. No account, model or permissions were changed.'});
  }
  if(!failures.length)failures.push({stage:'before comparison',evidence:'No usable completed comparison is available; the cause is unknown.',recovery:'Inspect the upstream Archon node errors and rerun after resolving the failure.'});
  return {status:'incomplete' as const,failures,initialReviews:evidence.initialReviews,preparation:{...evidence.preparation,scope:evidence.scope},verification:{a:verification(evidence.initialReviews.a),b:verification(evidence.initialReviews.b)},limitations:evidence.missing,findingsAvailable:false};
}
export function incompleteMarkdown(report:ReturnType<typeof incompleteReport>) {
  const started=report.preparation.initialReviewsStarted===false?'Neither initial review started.':'Available reviewer results are retained; two completed reviews have not been established.';
  const failures=report.failures.map(f=>`- **${f.side?`Reviewer ${f.side.toUpperCase()} — `:''}${f.stage}${f.launcher?` (${f.launcher}, ${f.model})`:''}:** ${f.evidence}\n  Recovery: ${f.recovery}`);
  const checks=(['a','b'] as const).flatMap(side=>verificationBullets(side.toUpperCase(),report.verification[side]));
  return ['# Prepr report','Review incomplete. '+started,'**Verification and limitations**',...failures,...checks,...report.limitations.map(l=>`- ${l}`),report.preparation.confirmation?'Launcher/model confirmation was user attestation; it does not prove current authentication or resource access.':'Prerequisite confirmation evidence unavailable or incomplete.','No completed comparison is available; no shared review conclusion or successful empty review is claimed.'].join('\n\n');
}
