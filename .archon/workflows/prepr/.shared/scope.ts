import {filterPaths,outputRoots,type Excluded} from './scope-filter.ts';
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type ReviewScope = {
  mode: "local" | "branch"; branch?: string; targetSha: string;
  base?: string; baseSha?: string; startingPointSha?: string; freshness: string;
  root?: string; snapshotId?: string; snapshotPath?: string;
  files?: string[]; excluded?: Excluded[]; outputRoots?: string[]; diffBytes?: number; statistics?: string; limitations?: string[];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const command = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
};
function changed(cwd:string,args:string[],outputs:string[]) {
  const paths=command(cwd,'diff','--no-renames','--name-only','-z',...args,'--').split('\0').filter(Boolean);
  return filterPaths(paths,outputs);
}
function patch(cwd:string,args:string[],paths:string[]) {
  return paths.length?command(cwd,'diff','--no-renames','--binary','--no-ext-diff',...args,'--',...paths.map(p=>':(top,literal)'+p)):'';
}
function localCapture(cwd:string,outputs:string[]) {
  const head=Bun.spawnSync(['git','rev-parse','--verify','HEAD'],{cwd});
  const targetSha=head.exitCode===0?head.stdout.toString().trim():'unborn';
  const cached=changed(cwd,['--cached'],outputs),working=changed(cwd,[],outputs);
  const staged=patch(cwd,['--cached'],cached.eligible),unstaged=patch(cwd,[],working.eligible);
  const fresh=filterPaths(command(cwd,'ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean),outputs);
  const untracked=fresh.eligible.map(path=>{const full=join(cwd,path),stat=lstatSync(full);return {path,mode:stat.mode,type:stat.isSymbolicLink()?'symlink':'file',content:stat.isSymbolicLink()?readlinkSync(full):readFileSync(full).toString('base64')};});
  return {state:{targetSha,staged,unstaged,untracked},files:[...new Set([...cached.eligible,...working.eligible,...fresh.eligible])],excluded:[...new Map([...cached.excluded,...working.excluded,...fresh.excluded].map(e=>[e.path,e])).values()]};
}
export class EmptyScope extends Error {
  constructor(public excluded:Excluded[],public mode:string){super(`No project changes to review. ${excluded.length?`${excluded.length} managed tooling/generated files excluded.`:'No uncommitted changes or eligible branch changes.'} Use scope=branch explicitly for committed changes; no scope switch was made.`);}
}
export function verifyScope(scope: ReviewScope, cwd = process.cwd()) {
  if (scope.mode === "local") {
    if (hash(JSON.stringify(localCapture(cwd,scope.outputRoots??[]).state)) !== scope.snapshotId) throw new Error("Local work changed after scope capture; rerun to review a consistent snapshot.");
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
    const outputs=outputRoots(root,artifactsDir);
    const {state,files,excluded}=localCapture(root,outputs),snapshotId=hash(JSON.stringify(state));
    if (!files.length) throw new EmptyScope(excluded,mode);
    if (hash(JSON.stringify(localCapture(root,outputs).state)) !== snapshotId) throw new Error("Local work changed during scope capture; rerun.");
    const dir = artifactsDir || mkdtempSync(join(tmpdir(), "prepr-snapshot-"));
    mkdirSync(dir, { recursive: true });
    const snapshotPath = join(dir, `prepr-local-${snapshotId}.json`);
    writeFileSync(snapshotPath, JSON.stringify(state));
    const diff = state.staged + state.unstaged;
    const scope: ReviewScope = { mode, root, targetSha: state.targetSha, snapshotId, snapshotPath, files, excluded, outputRoots:outputs,
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
  const outputs=outputRoots(root,artifactsDir), selected=changed(root,[startingPointSha,targetSha],outputs);
  if(!selected.eligible.length)throw new EmptyScope(selected.excluded,mode);
  const diff=patch(root,[startingPointSha,targetSha],selected.eligible);
  const scope: ReviewScope = { mode, root, branch, targetSha, base, baseSha, startingPointSha, freshness,
    files:selected.eligible,excluded:selected.excluded,outputRoots:outputs,
    diffBytes: Buffer.byteLength(diff), statistics:`${selected.eligible.length} eligible files`,
    limitations: ["Only committed changes since the merge base are selected. Tests have not been run by scope capture."] };
  const dir=artifactsDir||mkdtempSync(join(tmpdir(),'prepr-branch-'));mkdirSync(dir,{recursive:true});
  scope.snapshotPath=join(dir,`prepr-branch-${startingPointSha}-${targetSha}.json`);writeFileSync(scope.snapshotPath,JSON.stringify({diff,files:scope.files,targetSha,startingPointSha}));
  return { diff, changed: diff.length > 0, scope };
}
export const scopePreview = (scope: ReviewScope) => ({ mode: scope.mode, target: scope.branch || "working tree", targetSha: scope.targetSha, base: scope.base ?? null, baseSha: scope.baseSha ?? null, startingPointSha: scope.startingPointSha ?? null, snapshotId: scope.snapshotId ?? null, changedFileCount: scope.files?.length ?? 0, diffBytes: scope.diffBytes ?? 0, statistics: scope.statistics, freshness: scope.freshness, limitations: scope.limitations, excludedFileCount:scope.excluded?.length??0, exclusionCategories:[...new Set(scope.excluded?.map(e=>e.reason)??[])] });
