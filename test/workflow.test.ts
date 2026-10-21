import {fixtureReviewer} from "./helpers/reviewers.ts";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { compare, findings, debateDispute, runInitialAgent, type Reviewer } from "../.archon/workflows/prepr/.shared/core.ts";
import { buildReport, markdownReport } from "../.archon/workflows/prepr/review-debate/scripts/reporting.ts";

test("distinct original reviewers debate, then deliver both report artifacts without another agent", async () => {
  const root = resolve(import.meta.dir, ".."), fixtures = join(root, ".archon/workflows/prepr/review-debate/fixtures");
  const a: Reviewer = { name: "Correctness", reference: "fixture-a", skillPath: join(fixtures, "reviewer-a-skill/SKILL.md"), launcher: "codex", model: "fixture" };
  const b: Reviewer = { name: "Security", reference: "fixture-b", skillPath: join(fixtures, "reviewer-b-skill/SKILL.md"), launcher: "claude", model: "fixture" };
  const previousA = Bun.env.PREPR_CODEX_BIN, previousB = Bun.env.PREPR_CLAUDE_BIN;
  const dir = await mkdtemp(join(tmpdir(), "prepr-report-test-"));
  const oldCwd = process.cwd();
  try {
    Bun.spawnSync(["git","init"],{cwd:dir});
    Object.assign(a,{reference:a.skillPath},fixtureReviewer(dir,a.skillPath));
    Object.assign(b,{reference:b.skillPath},fixtureReviewer(dir,b.skillPath));
    process.chdir(dir);
    Bun.env.PREPR_CODEX_BIN = join(fixtures, "fake-codex-multiround");
    Bun.env.PREPR_CLAUDE_BIN = join(fixtures, "fake-claude-multiround");
    const [reviewA, reviewB] = await Promise.all([runInitialAgent(a), runInitialAgent(b)]);
    expect(reviewA.status).toBe("completed");
    expect(reviewB.status).toBe("completed");
    const comparison = { reviewers: { a: a.name, b: b.name }, initialReviews: { a: reviewA, b: reviewB }, ...compare(findings("reviewer-a", reviewA.stdout), findings("reviewer-b", reviewB.stdout)) };
    expect(comparison.disputes).toHaveLength(1);
    const debate = await debateDispute(a, b, reviewA, reviewB, comparison.disputes[0]);
    expect(debate.rounds).toHaveLength(2);
    expect(debate.conclusion).toBe("converged-on-no-issue");
    const report = buildReport(comparison, [debate]);
    const summary = markdownReport(report);
    expect(summary).toContain("## Disagreements");
    expect(summary).toContain("Why the conclusion changed:** Reviewer A:");
    expect(summary).not.toContain("What you need to decide");
    expect(summary).not.toContain("Remaining decision");
    expect(summary).toContain("No change is needed for this concern; both reviewers concluded this is not an issue.");
    expect(report.initialReviews?.a.rawStdout).toContain("thread.started");
    // The delivery script receives saved evidence only; launchers cannot be used during rendering.
    const deliveryProcess = Bun.spawn(["bun", join(root, ".archon/workflows/prepr/review-debate/scripts/report.ts")], {
      cwd: root, stdout: "pipe", stderr: "pipe", env: { ...Bun.env, PREPR_CODEX_BIN: "/does-not-exist", PREPR_CLAUDE_BIN: "/does-not-exist", ARTIFACTS_DIR: dir, WORKFLOW_ID: "fixture-run", INPUTS_COMPARISON: JSON.stringify(comparison), INPUTS_DEBATES: JSON.stringify([debate]) },
    });
    const [out, err, code] = await Promise.all([new Response(deliveryProcess.stdout).text(), new Response(deliveryProcess.stderr).text(), deliveryProcess.exited]);
    expect(err).toBe("");
    expect(code).toBe(0);
    expect(JSON.parse(out).report).toEqual({ type: "archon_artifact", run_id: "fixture-run", path: "prepr-report.md" });
    expect(JSON.parse(out).data.path).toBe("prepr-report.json");
    expect(await Bun.file(join(dir, "prepr-report.md")).text()).toBe(summary);
    const data = await Bun.file(join(dir, "prepr-report.json")).json();
    expect(data.debates[0].rounds).toHaveLength(2);
    expect(data.initialReviews.a.stdout).toBe(reviewA.stdout);
    expect(data.confirmedBugs).toHaveLength(0);
  } finally {
    process.chdir(oldCwd);
    if (previousA === undefined) delete Bun.env.PREPR_CODEX_BIN; else Bun.env.PREPR_CODEX_BIN = previousA;
    if (previousB === undefined) delete Bun.env.PREPR_CLAUDE_BIN; else Bun.env.PREPR_CLAUDE_BIN = previousB;
    await rm(dir, { recursive: true });
  }
});
