import { expect, test } from "bun:test";
import { buildReport, markdownReport } from "../.archon/workflows/prepr/review-debate/scripts/reporting.ts";
import { compare, findings, type Debate, type Finding, type DebatePosition } from "../.archon/workflows/prepr/.shared/core.ts";

const finding = (reviewer: string, verdict?: string): Finding => ({ id: `${reviewer}-1`, reviewer, title: "Missing request guard", summary: "missing null check", file: "a.ts", line: 12, evidence: "Anonymous requests reach user.id and throw.", impact: "Anonymous requests return a server error.", verdict });
const position = (verdict: "issue" | "no_issue", rationale: string): DebatePosition => ({ stance: "revise", verdict, rationale });
const round = (a: DebatePosition, b: DebatePosition, n = 1): Debate["rounds"][number] => ({ round: n, reviewerA: { status: "completed", stdout: "original A response" } as never, reviewerB: { status: "completed", stdout: "original B response" } as never, positionA: a, positionB: b });
const report = (agreements: Finding[][] = [], debates: Debate[] = []) => buildReport({ reviewers: { a: "Correctness", b: "Security" }, findings: agreements.flat(), agreements }, debates);

test("matching no-issue and missing verdict agreements cannot become bugs", () => {
  for (const verdict of ["no_issue", undefined]) {
    const data = report([[finding("reviewer-a", verdict), finding("reviewer-b", verdict)]]);
    expect(data.confirmedBugs).toHaveLength(0);
    expect(data.initialAgreements[0].conclusion).toBe(verdict ? "converged-on-no-issue" : "unresolved");
  }
});
test("unverified upstream debate conclusions cannot become bugs", () => {
  const data = report([], [{ dispute: [finding("reviewer-a")], rounds: [], stopReason: "incomplete", conclusion: "converged-on-issue" }]);
  expect(data.confirmedBugs).toHaveLength(0);
});
test("initial agreements have short titles, labeled bullets, source and impact", () => {
  const data = report([[finding("reviewer-a", "issue"), finding("reviewer-b", "issue")]]);
  const text = markdownReport(data);
  expect(text).toContain("## Other agreements");
  expect(text).toContain("### Missing request guard");
  expect(text).toContain("- **Final position:**");
  expect(text).toContain("- **Correctness initially:** Anonymous requests");
  expect(text).toContain("- **Consequence:** Anonymous requests return a server error.");
  expect(text).toContain("`a.ts:12`");
  expect(text).not.toContain("Stop reason");
  expect(text).not.toContain("converged-on");
});
test("a resolved disagreement retains both initial reasons and what changed once", () => {
  const a = finding("reviewer-a", "issue"), b = { ...finding("reviewer-b", "no_issue"), evidence: "The middleware guards anonymous requests." };
  const debate: Debate = { dispute: [a, b], rounds: [round(position("issue", "The endpoint bypasses middleware."), position("issue", "I confirmed that this route bypasses middleware."))], stopReason: "agreement", conclusion: "converged-on-issue" };
  const data = report([], [debate]);
  const text = markdownReport(data);
  expect(text).toContain("## Reviewer differences and where they landed");
  expect(text).toContain("**Final position:**");
  expect(text).not.toContain("**Outcome:**");
  expect(text).not.toContain("**What changed:**");
  expect(text).not.toContain("## Other agreements");
  expect(text).toContain("Correctness initially");
  expect(text).toContain("middleware guards anonymous");
  expect(text).toContain("Discussion:** Security: I confirmed");
  expect(text.match(/### Missing request guard/g)).toHaveLength(1);
  expect(data.debates[0].rounds[0].reviewerA.stdout).toBe("original A response");
});
test("unresolved debate identifies the human decision and incomplete evidence", () => {
  const data = report([], [{ dispute: [finding("reviewer-a", "issue")], rounds: [], stopReason: "incomplete", conclusion: "unresolved" }]);
  const text = markdownReport(data);
  expect(text).not.toContain("Security\'s reasoning:** Did not raise this concern");
  expect(text).not.toContain("What you need to decide");
  expect(text).toContain("discussion did not complete");
  expect(text).not.toContain("B disagreed");
});
test("a sole-reviewer concern accepted without opposition remains visible as a contribution", () => {
  const data = report([], [{ dispute: [finding("reviewer-a", "issue")], rounds: [round(position("issue", "Anonymous requests crash."), position("issue", "The endpoint bypasses the guard."))], stopReason: "agreement", conclusion: "converged-on-issue" }]);
  expect(data.uncontestedFindings).toHaveLength(1);
  expect(data.confirmedBugs).toHaveLength(1);
  const text = markdownReport(data);
  expect(text).toContain("## Reviewer differences and where they landed");
  expect(text).not.toContain("## Other agreements");
  expect(text.match(/### Missing request guard/g)).toHaveLength(1);
});
test("opposition within debate stays visible even when only one reviewer raised it", () => {
  const data = report([], [{ dispute: [finding("reviewer-a", "issue")], rounds: [round(position("issue", "The route bypasses the guard."), position("no_issue", "Middleware appears to guard it.")), round(position("no_issue", "The route is protected after all."), position("no_issue", "The guard applies."), 2)], stopReason: "agreement", conclusion: "converged-on-no-issue" }]);
  const text = markdownReport(data);
  expect(text).toContain("## Reviewer differences and where they landed");
  expect(text).not.toContain("Did not raise this concern in the initial review.");
  expect(text).toContain("Discussion:** Correctness: The route is protected after all.");
  expect(data.debates[0].rounds).toHaveLength(2);
});
test("meaningful dismissals appear briefly without empty sections", () => {
  const text = markdownReport(report([[finding("reviewer-a", "no_issue"), finding("reviewer-b", "no_issue")]]));
  expect(text).toContain("1 dismissed finding retained in JSON.");
  expect(text).not.toContain("## Withdrawn concerns");
  expect(text).not.toContain("## Other agreements");
  expect(text).not.toContain("## Reviewer differences and where they landed");
});
test("same-skill clean prose yields only a concise assessment and preserves raw evidence", async () => {
  const text = "Vee questions:\nNone.\nVee verdict: Ready.\nDefault review:\nNo findings.";
  const comparison = compare(findings("reviewer-a", text), findings("reviewer-b", text));
  const data = buildReport({ reviewers: { a: "Vee", b: "Vee" }, ...comparison, initialReviews: { a: { stdout: text, status: "completed" } as never, b: { stdout: text, status: "completed" } as never } }, []);
  expect(markdownReport(data)).toContain("No actionable concerns were identified.");
  expect(markdownReport(data)).not.toContain("## ");
  expect(data.initialReviews?.a.stdout).toBe(text);
  expect(data.confirmedBugs).toHaveLength(0);
});
test("agree-to-disagree stays unresolved even with shared issue verdicts", () => {
  const pos: DebatePosition = { stance: "agree_to_disagree", verdict: "issue", rationale: "Different risk tolerance." };
  const data = report([], [{ dispute: [finding("reviewer-a", "issue"), finding("reviewer-b", "no_issue")], rounds: [round(pos, pos)], stopReason: "agree_to_disagree", conclusion: "unresolved" }]);
  expect(data.confirmedBugs).toHaveLength(0);
  expect(markdownReport(data)).toContain("Both reviewers chose to leave their differing conclusions unresolved.");
});
test("agreement on an issue does not erase different initial severity ratings", () => {
  const a = { ...finding("reviewer-a", "issue"), severity: "high", severityLevel: "high" }, b = { ...finding("reviewer-b", "issue"), severity: "low", severityLevel: "low" };
  const data = report([], [{ dispute: [a, b], rounds: [round(position("issue", "The route is unguarded."), position("issue", "The route is unguarded."))], stopReason: "agreement", conclusion: "converged-on-issue" }]);
  const text = markdownReport(data);
  expect(text).toContain("Correctness's rating:** high");
  expect(text).toContain("Security's rating:** low");
  expect(text).toContain("no shared urgency was recorded");
});
test("dismissed concerns have an attributed explanation and no severity decision", () => {
  const a = { ...finding("reviewer-a", "issue"), severity: "high", severityLevel: "high" };
  const b = { ...finding("reviewer-b", "no_issue"), severity: "low", severityLevel: "low" };
  const data = report([], [{ dispute: [a, b], rounds: [round(position("no_issue", "I verified that the existing guard covers this route."), position("no_issue", "The router guard is sufficient."))], stopReason: "agreement", conclusion: "converged-on-no-issue" }]);
  const text = markdownReport(data);
  expect(text).toContain("Discussion:** Correctness: I verified");
  expect(text).not.toContain("What you need to decide");
  expect(text).not.toContain("Remaining decision");
});
test("the resolution attributes the final change rather than an earlier reversal", () => {
  const data = report([], [{ dispute: [finding("reviewer-a", "issue"), finding("reviewer-b", "no_issue")], rounds: [round(position("no_issue", "I thought the guard applied."), position("issue", "I found this route bypasses the guard.")), round(position("issue", "I verified this route is unprotected."), position("issue", "The route bypasses the guard."), 2)], stopReason: "agreement", conclusion: "converged-on-issue" }]);
  expect(markdownReport(data)).toContain("Discussion:** Correctness: I verified this route is unprotected.");
});

test("both original reviewers can confirm duplicate concerns without losing either debate", () => {
  const a = finding("reviewer-a"), b = { ...finding("reviewer-b"), summary: "an anonymous request crashes" };
  const make = (f: Finding, sameConcernAs: string[], otherIds = sameConcernAs): Debate => ({
    dispute: [f], stopReason: "agreement", conclusion: "converged-on-issue",
    rounds: [round({ ...position("issue", "Anonymous requests crash."), sameConcernAs }, { ...position("issue", "Confirmed."), sameConcernAs: otherIds })],
  });
  const data = report([], [make(a, [b.id]), make(b, [a.id])]);
  expect(data.confirmedBugs).toHaveLength(1);
  expect(data.concerns[0].dispute.map(f => f.id)).toEqual([a.id, b.id]);
  expect(data.concerns[0].rounds).toHaveLength(2);
  expect(data.debates).toHaveLength(2);
  expect(markdownReport(data)).toContain("1 supported finding");
  expect(markdownReport(data).match(/^### /gm)).toHaveLength(1);
  for (const other of [
    make(b, [], []),
    { ...make(b, [a.id]), conclusion: "unresolved" as const },
    { ...make(b, [a.id]), dispute: [{ ...b, line: 13 }] },
  ]) {
    const left = other.dispute[0].line === 13 ? make(a, [b.id]) : make(a, [b.id], []);
    expect(report([], [left, other]).concerns).toHaveLength(2);
  }
  expect(report([], [make(a, ["invented-id"]), make(b, [])]).concerns).toHaveLength(2);
  expect(report([], [make(a, [b.id]), { ...make(b, [a.id]), conclusion: "unresolved" }]).concerns).toHaveLength(2);
  const dismissed: Debate = { ...make(b, [a.id]), conclusion: "converged-on-no-issue", rounds: [round(position("no_issue", "Guard exists."), position("no_issue", "Confirmed guard."))] };
  expect(report([], [make(a, [b.id]), dismissed]).concerns).toHaveLength(2);
});

test("same-location unrelated concerns never merge just because both are confirmed", () => {
  const a = finding("reviewer-a"), b = { ...finding("reviewer-b"), summary: "incorrect date formatting" };
  const debates: Debate[] = [a, b].map(f => ({ dispute: [f], rounds: [round(position("issue", f.summary), position("issue", f.summary))], stopReason: "agreement", conclusion: "converged-on-issue" }));
  expect(report([], debates).confirmedBugs).toHaveLength(2);
});

test("report opening preserves check status, attribution, snapshot and conditional evidence",()=>{
 const a={...finding('reviewer-a','issue'),evidence:'The route picks the first date. '+ 'Background '.repeat(70)+'I have not verified that duplicate-date records exist in current data.'};
 const b={...finding('reviewer-b','issue')};
 const comparison={reviewers:{a:'Vee',b:'Peer'},findings:[a,b],agreements:[[a,b]],initialReviews:{a:{reviewer:'Vee',status:'completed',stdout:JSON.stringify({verification:[{name:'Tests',status:'not run',evidence:'Static inspection only.'}],limitations:['Duplicate-date data remains unverified.']}),scope:{mode:'branch',targetSha:'abc'}} as never,b:{reviewer:'Peer',status:'completed',stdout:'No execution results.'} as never}};
 const data=buildReport(comparison,[]),text=markdownReport(data);
 expect(data.verification.a.checks[0]).toMatchObject({status:'not run',reviewer:'Vee',snapshot:'abc'});
 expect(data.verification.b.checks[0].status).toBe('unknown');
 expect(text.indexOf('## Material review limits')).toBeGreaterThan(text.indexOf('## Other agreements'));
 expect(text).toContain('duplicate-date records exist in current data.');
 expect(text).toContain('Duplicate-date data remains unverified.');
 expect(text).not.toContain('Tests: passed');
});

test('duplicate display names retain distinct A/B reasoning without changing stable reviewer ids',()=>{
 const data=buildReport({reviewers:{a:'Reviewer',b:'Reviewer'},agreements:[],findings:[]},[{dispute:[finding('reviewer-a','issue'),finding('reviewer-b','no_issue')],rounds:[],stopReason:'max_rounds',conclusion:'unresolved'}]);
 const md=markdownReport(data);expect(md).toContain('Reviewer (A); Reviewer (B)');expect(md).toContain("Reviewer (A) initially");expect(md).toContain("Reviewer (B) initially");expect(md).not.toContain('(A) (A)');expect(data.concerns[0].dispute[0].reviewer).toBe('reviewer-a');
});
