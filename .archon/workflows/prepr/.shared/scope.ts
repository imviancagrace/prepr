import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type ReviewScope = {
  mode: "local" | "branch"; branch?: string; targetSha: string;
  base?: string; baseSha?: string; startingPointSha?: string; freshness: string;
  root?: string; snapshotId?: string; snapshotPath?: string;
  files?: string[]; diffBytes?: number; statistics?: string; limitations?: string[];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const command = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
};
function localState(cwd: string) {
  const head = Bun.spawnSync(["git", "rev-parse", "--verify", "HEAD"], { cwd });
  const targetSha = head.exitCode === 0 ? head.stdout.toString().trim() : "unborn";
  const staged = command(cwd, "diff", "--cached", "--binary", "--no-ext-diff");
  const unstaged = command(cwd, "diff", "--binary", "--no-ext-diff");
  const untracked = command(cwd, "ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).map(path => {
    const full = join(cwd, path), stat = lstatSync(full);
    return { path, mode: stat.mode, type: stat.isSymbolicLink() ? "symlink" : "file", content: stat.isSymbolicLink() ? readlinkSync(full) : readFileSync(full).toString("base64") };
  });
  return { targetSha, staged, unstaged, untracked };
}
export function verifyScope(scope: ReviewScope, cwd = process.cwd()) {
  if (scope.mode === "local") {
    if (hash(JSON.stringify(localState(cwd))) !== scope.snapshotId) throw new Error("Local work changed after scope capture; rerun to review a consistent snapshot.");
  } else if (command(cwd, "rev-parse", "HEAD").trim() !== scope.targetSha || command(cwd, "status", "--porcelain").trim()) {
    throw new Error("Checkout changed after branch scope capture; rerun before starting reviewers.");
  }
}
export function captureDiff(mode = "local", cwd = process.cwd(), base = "", artifactsDir?: string) {
  const git = (...args: string[]) => command(cwd, ...args);
  const root = git("rev-parse", "--show-toplevel").trim();
  if (mode !== "local" && mode !== "branch") throw new Error("Review scope must be local or branch.");
  if (mode === "local" && base) throw new Error("A base override requires scope=branch; it cannot be used with local scope.");
  if (mode === "local") {
    const state = localState(root), snapshotId = hash(JSON.stringify(state));
    const files = [...new Set([...git("diff", "--cached", "--name-only", "-z").split("\0"), ...git("diff", "--name-only", "-z").split("\0"), ...state.untracked.map(f => f.path)].filter(Boolean))];
    if (!files.length) throw new Error("No uncommitted changes. Use --input scope=branch to explicitly review committed branch changes.");
    if (hash(JSON.stringify(localState(root))) !== snapshotId) throw new Error("Local work changed during scope capture; rerun.");
    const dir = artifactsDir || mkdtempSync(join(tmpdir(), "prepr-snapshot-"));
    mkdirSync(dir, { recursive: true });
    const snapshotPath = join(dir, `prepr-local-${snapshotId}.json`);
    writeFileSync(snapshotPath, JSON.stringify(state));
    const diff = state.staged + state.unstaged;
    const scope: ReviewScope = { mode, root, targetSha: state.targetSha, snapshotId, snapshotPath, files,
      diffBytes: Buffer.byteLength(diff) + state.untracked.reduce((n, f) => n + Buffer.byteLength(f.content, f.type === "file" ? "base64" : "utf8"), 0),
      statistics: `${files.length} files; ${state.untracked.length} untracked`,
      freshness: "Captured staged, unstaged, and non-ignored untracked work; committed branch changes are excluded.",
      limitations: ["Ignored files are excluded. Tests have not been run by scope capture."] };
    return { diff, changed: true, scope };
  }
  const clean = () => { if (git("status", "--porcelain").trim()) throw new Error("Branch review requires a clean checkout; use local scope for uncommitted changes."); };
  clean();
  const branch = git("symbolic-ref", "--short", "HEAD").trim(), targetSha = git("rev-parse", "HEAD").trim();
  let baseSha: string, freshness: string;
  const remotes = git("remote").trim().split("\n").filter(Boolean);
  if (!base) {
    const remoteHead = git("ls-remote", "--symref", "origin", "HEAD");
    const baseBranch = remoteHead.match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1];
    if (!baseBranch) throw new Error("Could not verify origin's default branch.");
    git("fetch", "--quiet", "origin", `refs/heads/${baseBranch}`);
    baseSha = git("rev-parse", "FETCH_HEAD").trim(); base = `origin/${baseBranch}`;
    freshness = "Default branch verified and fetched; target is the pinned local HEAD, not a remote replacement.";
  } else {
    if (base.startsWith("-")) throw new Error("Invalid comparison base.");
    const ref = base.replace(/^refs\/remotes\//, "");
    const remote = remotes.find(name => ref.startsWith(`${name}/`));
    if (remote) {
      git("fetch", "--quiet", remote, `refs/heads/${ref.slice(remote.length + 1)}`);
      baseSha = git("rev-parse", "FETCH_HEAD").trim();
      freshness = "Explicit remote comparison branch refreshed; local target preserved.";
    } else {
      baseSha = git("rev-parse", "--verify", `${base}^{commit}`).trim();
      freshness = "Explicit local comparison ref or commit pinned; remote freshness is not claimed.";
    }
  }
  const startingPointSha = git("merge-base", targetSha, baseSha).trim();
  clean();
  if (git("rev-parse", "HEAD").trim() !== targetSha) throw new Error("Checkout changed while preparing branch review.");
  const diff = git("diff", "--binary", "--no-ext-diff", startingPointSha, targetSha, "--");
  const scope: ReviewScope = { mode, root, branch, targetSha, base, baseSha, startingPointSha, freshness,
    files: git("diff", "--name-only", "-z", startingPointSha, targetSha, "--").split("\0").filter(Boolean),
    diffBytes: Buffer.byteLength(diff), statistics: git("diff", "--shortstat", startingPointSha, targetSha, "--").trim(),
    limitations: ["Only committed changes since the merge base are selected. Tests have not been run by scope capture."] };
  return { diff, changed: diff.length > 0, scope };
}
export const scopePreview = (scope: ReviewScope) => ({ mode: scope.mode, target: scope.branch || "working tree", targetSha: scope.targetSha, base: scope.base ?? null, baseSha: scope.baseSha ?? null, startingPointSha: scope.startingPointSha ?? null, snapshotId: scope.snapshotId ?? null, changedFileCount: scope.files?.length ?? 0, diffBytes: scope.diffBytes ?? 0, statistics: scope.statistics, freshness: scope.freshness, limitations: scope.limitations });
