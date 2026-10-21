import { basename, isAbsolute, resolve } from "node:path";

import { sameLocation, severityConflict, applySeverity, type Finding } from "./findings.ts";
import type { Reuse } from "./reuse.ts";
import type { ReviewScope } from "./scope.ts";
export { findings, compare, sameConcern, type Finding, type Comparison } from "./findings.ts";
export type Launcher = "codex" | "claude";
export type RequiredAccess = { tool: string; resource: string };
export type Reviewer = { name: string; reference: string; skillPath: string; launcher: Launcher; model?: string; requiredAccess?: RequiredAccess[]; severityMap?: Record<string, string> };
export type Readiness = { reviewer: string; launcher: Launcher; model: string; status: "ready" | "failed"; evidence: string; resources: { tool: string; resource: string; status: "verified" | "unverifiable" }[]; probe?: ReviewResult };
export type ReviewResult = { reviewer: string; phase: "initial" | "debate" | "readiness"; status: "completed" | "failed" | "timed_out"; stdout: string; stderr: string; exitCode: number | null; sessionId?: string; rawStdout?: string; scope?: ReviewScope; readiness?: Readiness; severityMap?: Record<string, string> };
export type DebatePosition = { stance: "maintain" | "revise" | "accept" | "agree_to_disagree"; verdict?: "issue" | "no_issue"; rationale: string; correctedFinding?: string; confidence?: string; severity?: string; severityLevel?: string; sameConcernAs?: string[] };
export type Debate = { dispute: Finding[]; rounds: { round: number; reviewerA: ReviewResult; reviewerB: ReviewResult; positionA: DebatePosition; positionB: DebatePosition }[]; reuse?: Reuse; stopReason: "reused" | "agreement" | "agree_to_disagree" | "no_material_movement" | "max_rounds" | "incomplete"; conclusion: "converged-on-issue" | "converged-on-no-issue" | "unresolved" };
export const input = (name: string) => { const value = Bun.env[`INPUTS_${name}`]; if (value === undefined) throw new Error(`Missing workflow input: ${name}`); return value; };
export const optionalInput = (name: string) => Bun.env[`INPUTS_${name}`] ?? "";
export const json = (value: unknown) => console.log(JSON.stringify(value));

type Profile = { name: string; skill: string; launcher: Launcher; model?: string; required_access?: RequiredAccess[]; severity_map?: Record<string, string> };
type ProfileFile = { default_pair?: { reviewer_a: string; reviewer_b: string }; reviewers?: Record<string, Profile> };
const profilePath = () => Bun.env.PREPR_PROFILE_PATH || resolve(process.cwd(), ".archon/prepr.local.yaml");
const refLabel = (reference: string) => basename(reference.replace(/[\\/#]+$/, "")) || reference;
function readProfiles(): ProfileFile {
  const path = profilePath(), file = Bun.file(path); if (!file.size) return {};
  try { return Bun.YAML.parse(Bun.spawnSync(["cat", path]).stdout.toString()) as ProfileFile; }
  catch (error) { throw new Error(`Could not parse ${path}: ${error}`); }
}
const launcher = (value: string, side: string): Launcher => {
  if (value === "codex" || value === "claude") return value;
  throw new Error(`${side} must select launcher codex or claude.`);
};
export function chooseReferences(selectedA: string, selectedB: string, launcherA: string, launcherB: string, modelA: string, modelB: string, config: ProfileFile = readProfiles()) {
  const pair = config.default_pair;
  const resolveSelection = (selection: string, directLauncher: string, directModel: string, side: "reviewer_a" | "reviewer_b") => {
    const value = selection || pair?.[side];
    if (!value) throw new Error("Choose two reviewers with --input reviewer_a=... and --input reviewer_b=..., or configure default_pair in .archon/prepr.local.yaml.");
    const profile = config.reviewers?.[value];
    if (profile) {
      if (profile.severity_map && (typeof profile.severity_map !== "object" || Array.isArray(profile.severity_map) || Object.values(profile.severity_map).some(level => !["critical", "high", "medium", "low"].includes(level)))) throw new Error(`Profile ${value} has an invalid severity_map; use critical/high/medium/low.`);
      if (profile.required_access && (!Array.isArray(profile.required_access) || profile.required_access.some(item => !item || typeof item.tool !== "string" || !item.tool || typeof item.resource !== "string" || !item.resource || item.resource.startsWith("-")))) throw new Error(`Profile ${value} has invalid required_access declarations.`);
      for (const access of profile.required_access ?? []) {
        if (/[;&|$`<>\r\n\0]/.test(access.resource) || (access.tool === "gh" && !/^\/?[a-zA-Z0-9_./%~-]+$/.test(access.resource)) || (access.tool === "git" && /[\s"']/.test(access.resource))) throw new Error(`Profile ${value} has an unsafe or unsupported read-resource path; declare a literal file, API path, or repository URL without shell expressions.`);
      }
      return { name: profile.name, reference: profile.skill, launcher: launcher(profile.launcher, `Profile ${value}`), model: profile.model, severityMap: profile.severity_map, requiredAccess: profile.required_access };
    }
    if (!directLauncher) throw new Error(`A direct ${side} skill reference needs --input ${side}_launcher=codex or claude.`);
    return { name: refLabel(value), reference: value, launcher: launcher(directLauncher, `${side}_launcher`), model: directModel || undefined };
  };
  return { reviewerA: resolveSelection(selectedA, launcherA, modelA, "reviewer_a"), reviewerB: resolveSelection(selectedB, launcherB, modelB, "reviewer_b") };
}
const githubRef = (reference: string) => {
  const match = reference.match(/^(?:github:|https:\/\/github\.com\/)([^/#]+\/[^/@#]+)@([0-9a-f]{40})(?::|#)(.+)$/i);
  return match ? { repository: match[1], commit: match[2], skill: match[3] } : null;
};
function skillFile(root: string) { const candidate = root.endsWith("SKILL.md") ? root : resolve(root, "SKILL.md"); if (!Bun.file(candidate).size) throw new Error(`Reviewer skill was not found at ${candidate}.`); return candidate; }
function resolveSkill(reference: string): string {
  const remote = githubRef(reference);
  if (!remote) { if (/github\.com/.test(reference)) throw new Error("GitHub skills must be pinned: github:owner/repo@<40-character-commit>:path/to/skill."); return skillFile(isAbsolute(reference) ? reference : resolve(process.cwd(), reference)); }
  const destination = Bun.spawnSync(["mktemp", "-d", "/tmp/prepr-skill-XXXXXX"]);
  if (destination.exitCode !== 0) throw new Error("Could not create a temporary directory for the GitHub reviewer skill.");
  const checkout = `${destination.stdout.toString().trim()}/source`;
  const clone = Bun.spawnSync(["git", "clone", "--quiet", `https://github.com/${remote.repository}.git`, checkout]);
  if (clone.exitCode !== 0) throw new Error(`Could not fetch pinned reviewer skill ${reference}: ${clone.stderr.toString().trim()}`);
  const pinned = Bun.spawnSync(["git", "-C", checkout, "checkout", "--quiet", remote.commit]);
  if (pinned.exitCode !== 0) throw new Error(`Could not resolve pinned commit ${remote.commit} for ${remote.repository}.`);
  return skillFile(resolve(checkout, remote.skill));
}
export function selectReviewers(selectedA: string, selectedB: string, launcherA = "", launcherB = "", modelA = "", modelB = ""): { reviewerA: Reviewer; reviewerB: Reviewer } {
  const refs = chooseReferences(selectedA, selectedB, launcherA, launcherB, modelA, modelB);
  const makeReviewer = (ref: { name: string; reference: string; launcher: Launcher; model?: string; severityMap?: Record<string,string>; requiredAccess?: RequiredAccess[] }): Reviewer => ({ ...ref, skillPath: resolveSkill(ref.reference) });
  return { reviewerA: makeReviewer(refs.reviewerA), reviewerB: makeReviewer(refs.reviewerB) };
}

const parseEvent = (line: string) => { try { return JSON.parse(line) as Record<string, any>; } catch { return {}; } };
const codexText = (event: Record<string, any>) => event.type === "item.completed" && event.item?.type === "agent_message" ? String(event.item.text ?? "") : "";
const claudeText = (event: Record<string, any>) => {
  if (event.type === "result") return String(event.result ?? "");
  const content = event.message?.content;
  return event.type === "assistant" ? (Array.isArray(content) ? content.filter((item: any) => item.type === "text").map((item: any) => item.text).join("\n") : String(content ?? "")) : "";
};
const session = (event: Record<string, any>) => typeof event.thread_id === "string" ? event.thread_id : typeof event.session_id === "string" ? event.session_id : undefined;
export const configuredModel = (reviewer: Reviewer) => {
  if (reviewer.model) return reviewer.model;
  const result = Bun.spawnSync(["archon", "ai", "tier", "list", "--json"]);
  try {
    const tiers = JSON.parse(result.stdout.toString()).tiers as { tier: string; effective?: { provider?: string; model?: string } }[];
    const effective = tiers.find((entry) => entry.tier === "large")?.effective;
    if (effective?.provider === reviewer.launcher && effective.model) return effective.model;
  } catch { /* The actionable error below explains the missing configuration. */ }
  throw new Error(`${reviewer.name} has no model pin and Archon's large tier is not configured for the ${reviewer.launcher} launcher. Pin model in .archon/prepr.local.yaml or configure that Archon tier.`);
};
const runAgent = async (args: string[], reviewer: Reviewer, phase: ReviewResult["phase"], timeoutMs: number): Promise<ReviewResult> => {
  const bin = reviewer.launcher === "codex" ? Bun.env.PREPR_CODEX_BIN || "codex" : Bun.env.PREPR_CLAUDE_BIN || "claude"; let proc: ReturnType<typeof Bun.spawn>;
  try { proc = Bun.spawn([bin, ...args], { cwd: process.cwd(), env: { ...Bun.env }, stdout: "pipe", stderr: "pipe" }); } catch (error) { return { reviewer: reviewer.name, phase, status: "failed", stdout: "", stderr: String(error), exitCode: null }; }
  let timer: ReturnType<typeof setTimeout> | undefined; const timedOut = await Promise.race([proc.exited.then(() => false), new Promise<true>((ok) => { timer = setTimeout(() => ok(true), timeoutMs); })]); if (timer) clearTimeout(timer); if (timedOut) proc.kill();
  const [raw, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]); const events = raw.split("\n").map(parseEvent), text = events.map(reviewer.launcher === "codex" ? codexText : claudeText).filter(Boolean).join("\n");
  return { reviewer: reviewer.name, phase, status: timedOut ? "timed_out" : exitCode === 0 ? "completed" : "failed", stdout: text || raw, rawStdout: raw, stderr, exitCode, sessionId: events.map(session).find(Boolean) };
};
export const agentPrompt = (reviewer: Reviewer, scope?: ReviewScope) => `You are one side of a private pre-PR review. Read and faithfully follow only the reviewer skill at ${reviewer.skillPath}. ${scope?.mode === "branch" ? `Review the committed local branch change in this pinned scope: ${JSON.stringify(scope)}. Inspect git diff ${scope.startingPointSha} ${scope.targetSha} and surrounding code/specs at that target. This is an explicit local historical snapshot; preserve it even if remote refs advance. Do not check out, fast-forward, or replace the selected revision. Read pinned Git objects if the checkout changes. Disclose any later freshness changes instead of silently changing scope.` : scope ? `Review only this captured local-work snapshot: ${JSON.stringify(scope)}. Read the saved JSON at snapshotPath: staged and unstaged patches plus untracked content encoded as base64 (symlinks record their target). Inspect relevant surrounding code at the captured target SHA when applicable. Do not add subsequent working-tree changes to the scope. Disclose changed evidence rather than substituting a different target.` : "Review the current local Git change."} Do not create a PR, comment on GitHub, commit, push, or modify files. Return findings in the format required by that skill.`;
const withModel = (reviewer: Reviewer, args: string[]) => [...args, "--model", configuredModel(reviewer)];
// Keep the same read-tool permissions for probes, reviews and resumed sessions.
const claudeReadTools = ["Read", "Glob", "Grep", "Bash(git diff:*)", "Bash(git show:*)", "Bash(git log:*)", "Bash(git status:*)", "Bash(git rev-parse:*)", "Bash(git ls-remote:*)", "Bash(gh api --method GET:*)"];
export const runLauncher = (reviewer: Reviewer, phase: ReviewResult["phase"], prompt: string, timeoutMs = 600_000) => reviewer.launcher === "codex"
  ? runAgent([...withModel(reviewer, ["exec", "--json", "--sandbox", "read-only", ...(phase === "readiness" ? ["--ephemeral"] : []), "--cd", process.cwd()]), prompt], reviewer, phase, timeoutMs)
  : runAgent([...withModel(reviewer, ["-p", "--verbose", "--output-format", "stream-json", "--permission-mode", "dontAsk", "--tools", "Read,Glob,Grep,Bash", "--allowedTools", claudeReadTools.join(",")]), prompt], reviewer, phase, timeoutMs);
export const runInitialAgent = async (reviewer: Reviewer, timeoutMs = 600_000, scope?: ReviewScope) => {
  if (scope) { const { verifyScope } = await import("./scope.ts"); verifyScope(scope, scope.root || process.cwd()); }
  const result = await runLauncher(reviewer, "initial", agentPrompt(reviewer, scope), timeoutMs);
  return { ...result, ...(scope ? { scope } : {}), severityMap: reviewer.severityMap };
};

export function debatePosition(transcript: string): DebatePosition {
  const candidates = [transcript, ...[...transcript.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].reverse().map(match => match[1]), ...transcript.split("\n").flatMap((line, index, lines) => line.trim().startsWith("{") ? [lines.slice(index).join("\n")] : []).reverse()];
  for (const candidate of candidates) try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    if (!parsed || typeof parsed.rationale !== "string") continue;
    const stance = parsed.stance;
    return { stance: stance === "revise" || stance === "accept" || stance === "agree_to_disagree" ? stance : "maintain", verdict: parsed.verdict === "issue" || parsed.verdict === "no_issue" ? parsed.verdict : undefined, rationale: String(parsed.rationale ?? "No rationale supplied."), correctedFinding: typeof parsed.correctedFinding === "string" ? parsed.correctedFinding : undefined, severity: typeof parsed.severity === "string" ? parsed.severity : undefined, confidence: typeof parsed.confidence === "string" ? parsed.confidence : undefined, sameConcernAs: Array.isArray(parsed.sameConcernAs) ? parsed.sameConcernAs.filter((id): id is string => typeof id === "string") : undefined };
  } catch { /* Continue to the final structured response after process updates. */ }
  return { stance: "maintain", rationale: transcript || "No response supplied." };
}
export const runDebateAgent = (reviewer: Reviewer, sessionId: string, dispute: Finding[], opposing: DebatePosition | Finding | null, round: number, timeoutMs = 600_000, candidates: Finding[] = []) => {
  const prompt = `Continue the same private pre-PR review session for debate round ${round}. Reconsider only this attributed finding: ${JSON.stringify(dispute)}. The other reviewer's latest attributed position is ${JSON.stringify(opposing)}. Do not modify files or interact with GitHub. Return one JSON object with stance (maintain, revise, accept, or agree_to_disagree), verdict (issue or no_issue), rationale, correctedFinding when applicable, and confidence. Keep the rationale concise and human-readable: explain the evidence, practical consequence, and what changed your position if applicable.${candidates.length ? ` These other initial findings share a location but may describe different failures: ${JSON.stringify(candidates)}. Also return sameConcernAs: an array of candidate IDs describing exactly this same failure, trigger, and consequence, or [] when none is established. Shared location or similar wording alone is not enough. Do not include your current finding IDs or invent IDs.` : ""}`;
  return reviewer.launcher === "codex"
    ? runAgent(withModel(reviewer, ["exec", "resume", "--json", sessionId, prompt]), reviewer, "debate", timeoutMs)
    : runAgent(withModel(reviewer, ["-p", "--verbose", "--output-format", "stream-json", "--permission-mode", "dontAsk", "--tools", "Read,Glob,Grep,Bash", "--allowedTools", claudeReadTools.join(","), "--resume", sessionId, prompt]), reviewer, "debate", timeoutMs);
};

export async function debateDispute(reviewerA: Reviewer, reviewerB: Reviewer, reviewA: ReviewResult, reviewB: ReviewResult, dispute: Finding[], maxRounds = 3, allFindings: Finding[] = []): Promise<Debate> {
  if (!reviewA.sessionId || !reviewB.sessionId) return { dispute, rounds: [], stopReason: "incomplete", conclusion: "unresolved" };
  const rounds: Debate["rounds"] = []; let latestB: DebatePosition | Finding | null = dispute.find((finding) => finding.reviewer === "reviewer-b") ?? null;
  const candidates = allFindings.filter(finding => !dispute.some(current => current.id === finding.id) && dispute.some(current => sameLocation(current, finding)));
  for (let round = 1; round <= maxRounds; round++) {
    const responseA = await runDebateAgent(reviewerA, reviewA.sessionId, dispute, latestB, round, 600_000, candidates), positionA = applySeverity(debatePosition(responseA.stdout), reviewerA.severityMap, reviewerA.name);
    const responseB = await runDebateAgent(reviewerB, reviewB.sessionId, dispute, positionA, round, 600_000, candidates), positionB = applySeverity(debatePosition(responseB.stdout), reviewerB.severityMap, reviewerB.name);
    rounds.push({ round, reviewerA: responseA, reviewerB: responseB, positionA, positionB });
    if (responseA.status !== "completed" || responseB.status !== "completed") return { dispute, rounds, stopReason: "incomplete", conclusion: "unresolved" };
    if (positionA.stance === "agree_to_disagree" && positionB.stance === "agree_to_disagree") return { dispute, rounds, stopReason: "agree_to_disagree", conclusion: "unresolved" };
    if (positionA.verdict && positionA.verdict === positionB.verdict) return { dispute, rounds, stopReason: "agreement", conclusion: positionA.verdict === "issue" ? "converged-on-issue" : "converged-on-no-issue" };
    if (positionA.stance === "maintain" && positionB.stance === "maintain") return { dispute, rounds, stopReason: "no_material_movement", conclusion: "unresolved" };
    latestB = positionB;
  }
  return { dispute, rounds, stopReason: "max_rounds", conclusion: "unresolved" };
}
