import { expect, test } from "bun:test";
import { compare, debatePosition, findings, selectReviewers, chooseReferences } from "../.archon/workflows/prepr/.shared/core.ts";
import { buildReport, markdownReport } from "../.archon/workflows/prepr/review-debate/scripts/reporting.ts";

test("normalizes structured findings and matches equivalent claims", () => {
  const a = findings("reviewer-a", JSON.stringify({ findings: [{ summary: "src/auth.ts:12 missing null check", file: "src/auth.ts", line: 12, verdict: "issue" }] }));
  const b = findings("reviewer-b", JSON.stringify({ findings: [{ summary: "src/auth.ts:12 missing null check", file: "src/auth.ts", line: 12, verdict: "issue" }] }));
  const result = compare(a, b);
  expect(result.agreements).toHaveLength(1);
  expect(result.disputes).toHaveLength(0);
});

test("keeps a reviewer-only finding as a disagreement", () => {
  const result = compare(findings("reviewer-a", "- src/auth.ts:12 missing null check"), []);
  expect(result.disputes).toHaveLength(1);
  expect(result.disputes[0][0].reviewer).toBe("reviewer-a");
});

test("classifies incompatible anchored findings as a dispute", () => {
  const a = findings("reviewer-a", JSON.stringify({ findings: [{ summary: "a.ts:1 missing guard", file: "a.ts", line: 1, severity: "high" }] }));
  const b = findings("reviewer-b", JSON.stringify({ findings: [{ summary: "a.ts:1 missing guard", file: "a.ts", line: 1, severity: "low" }] }));
  expect(compare(a, b).disputes).toHaveLength(1);
});

test("raw direct reviewers require onboarding", () => {
  expect(() => selectReviewers(".archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill", ".archon/workflows/prepr/review-debate/fixtures/reviewer-b-skill", "codex", "claude")).toThrow("accepted standardized package");
});

test("uses a direct reference before a named local profile", () => {
  const previous = Bun.env.PREPR_PROFILE_PATH;
  Bun.env.PREPR_PROFILE_PATH = ".archon/workflows/prepr/review-debate/fixtures/profiles.yaml";
  const selected = chooseReferences(".archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill", "fixture-b", "codex", "", "", "");
  if (previous === undefined) delete Bun.env.PREPR_PROFILE_PATH; else Bun.env.PREPR_PROFILE_PATH = previous;
  expect(selected.reviewerA.name).toBe("reviewer-a-skill");
  expect(selected.reviewerB.name).toBe("Fixture B");
  expect(selected.reviewerB.launcher).toBe("claude");
});

test("uses the local default pair when no overrides are supplied", () => {
  const previous = Bun.env.PREPR_PROFILE_PATH;
  Bun.env.PREPR_PROFILE_PATH = ".archon/workflows/prepr/review-debate/fixtures/profiles.yaml";
  const selected = chooseReferences("", "", "", "", "", "");
  if (previous === undefined) delete Bun.env.PREPR_PROFILE_PATH; else Bun.env.PREPR_PROFILE_PATH = previous;
  expect(selected.reviewerA.name).toBe("Fixture A");
  expect(selected.reviewerB.name).toBe("Fixture B");
});

test("requires a launcher for a direct skill reference", () => {
  expect(() => selectReviewers(".archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill", ".archon/workflows/prepr/review-debate/fixtures/reviewer-b-skill")).toThrow("reviewer_a_launcher");
});

test("keeps a direct skill model pin", () => {
  const selected = chooseReferences(".archon/workflows/prepr/review-debate/fixtures/reviewer-a-skill", ".archon/workflows/prepr/review-debate/fixtures/reviewer-b-skill", "codex", "claude", "gpt-5.6-sol");
  expect(selected.reviewerA.model).toBe("gpt-5.6-sol");
});

test("normalizes a structured debate position", () => {
  expect(debatePosition('{"stance":"agree_to_disagree","verdict":"issue","rationale":"Different risk tolerance."}')).toMatchObject({ stance: "agree_to_disagree", verdict: "issue" });
});

test("debate progress updates do not swallow the final verdict or duplicate confirmations", () => {
  const response = { stance: "accept", verdict: "issue", rationale: "Both routes select the first matching date.", sameConcernAs: ["reviewer-a-1"] };
  for (const text of [`I’ll inspect both routes.\n${JSON.stringify(response, null, 2)}`, `Checking the caller.\n\x60\x60\x60json\n${JSON.stringify(response, null, 2)}\n\x60\x60\x60`]) {
    expect(debatePosition(text)).toMatchObject(response);
  }
  expect(debatePosition("I’ll check the route.").verdict).toBeUndefined();
});

test("renders a concise artifact report with attributed evidence", () => {
  const report = buildReport({ reviewers: { a: "A", b: "B" }, findings: [], agreements: [] }, [{
    dispute: [{ id: "reviewer-a-1", reviewer: "reviewer-a", summary: "a.ts:1 missing guard", evidence: "a.ts:1 missing guard" }],
    rounds: [{ round: 1, reviewerA: { status: "completed" } as never, reviewerB: { status: "completed" } as never, positionA: { stance: "accept", verdict: "issue", rationale: "It can throw." }, positionB: { stance: "accept", verdict: "issue", rationale: "Confirmed." } }],
    stopReason: "agreement",
    conclusion: "converged-on-issue",
  }]);
  expect(markdownReport(report)).toContain("# Prepr report");
  expect(markdownReport(report)).toContain("a.ts:1");
  expect(markdownReport(report)).toContain("missing guard");
});
