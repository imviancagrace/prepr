import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { captureDiff } from "../.archon/workflows/prepr/.shared/scope.ts";
import { agentPrompt, type Reviewer } from "../.archon/workflows/prepr/.shared/core.ts";

test("branch review pins local commits against the fetched default, preserves checkout, and rejects dirty work", async () => {
  const root = await mkdtemp(join(tmpdir(), "prepr-scope-"));
  const remote = join(root, "origin.git"), repo = join(root, "repo");
  const git = (cwd: string, ...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  try {
    git(root, "init", "--bare", "--initial-branch=trunk", remote);
    git(root, "clone", remote, repo);
    git(repo, "config", "user.name", "Test");
    git(repo, "config", "user.email", "test@example.com");
    await Bun.write(join(repo, "a.ts"), "export const a = 1;\n");
    git(repo, "add", "."); git(repo, "commit", "-m", "base");
    git(repo, "push", "origin", "trunk");
    const base = git(repo, "rev-parse", "HEAD");
    git(repo, "switch", "-c", "feature");
    await Bun.write(join(repo, "a.ts"), "export const a = 2;\n");
    git(repo, "commit", "-am", "local feature");
    const target = git(repo, "rev-parse", "HEAD");
    const upstream = join(root, "upstream");
    git(root, "clone", remote, upstream);
    git(upstream, "config", "user.name", "Test");
    git(upstream, "config", "user.email", "test@example.com");
    await Bun.write(join(upstream, "upstream.ts"), "export const upstream = true;\n");
    git(upstream, "add", "."); git(upstream, "commit", "-m", "advance trunk");
    git(upstream, "push", "origin", "trunk");
    const currentBase = git(upstream, "rev-parse", "HEAD");
    const result = captureDiff("branch", repo);
    expect(result.scope).toMatchObject({ branch: "feature", targetSha: target, base: "origin/trunk", baseSha: currentBase, startingPointSha: base });
    expect(result.diff).toContain("+export const a = 2;");
    expect(result.diff).not.toContain("upstream.ts");
    expect(git(repo, "rev-parse", "HEAD")).toBe(target);
    expect(git(repo, "status", "--porcelain")).toBe("");
    const reviewer: Reviewer = { name: "A", reference: "a", skillPath: "/a/SKILL.md", launcher: "codex" };
    expect(agentPrompt(reviewer, result.scope!)).toContain(`git diff ${base} ${target}`);
    expect(agentPrompt({ ...reviewer, name: "B", skillPath: "/b/SKILL.md" }, result.scope!)).toContain(JSON.stringify(result.scope));
    const localBase = captureDiff("branch", repo, "trunk");
    expect(localBase.scope.baseSha).toBe(base);
    expect(localBase.scope.freshness).toContain("local comparison");
    expect(captureDiff("branch", repo, base).scope.baseSha).toBe(base);
    expect(captureDiff("branch", repo, "origin/trunk").scope.baseSha).toBe(currentBase);
    expect(() => captureDiff("branch", repo, "missing-base")).toThrow();
    const orphan = git(repo, "commit-tree", `${target}^{tree}`, "-m", "unrelated root");
    expect(() => captureDiff("branch", repo, orphan)).toThrow("merge-base");
    await Bun.write(join(repo, "untracked.ts"), "local work");
    expect(() => captureDiff("branch", repo)).toThrow("clean checkout");
    await Bun.write(join(repo, "a.ts"), "export const a = 3;\n");
    expect(captureDiff("local", repo).diff).toContain("+export const a = 3;");
    expect(() => captureDiff("invalid", repo)).toThrow("local or branch");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("local snapshots preserve staged, unstaged, and non-ignored untracked content and detect later changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "prepr-local-"));
  const git = (...args: string[]) => { const r = Bun.spawnSync(["git", ...args], { cwd: root }); if (r.exitCode) throw new Error(r.stderr.toString()); return r.stdout.toString().trim(); };
  try {
    git("init"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com");
    await Bun.write(join(root,".gitignore"), "ignored\n"); await Bun.write(join(root,"a.ts"),"base\n");
    git("add", "."); git("commit", "-m", "base");
    await Bun.write(join(root,"ignored"),"not selected");
    expect(() => captureDiff("local",root)).toThrow("No uncommitted changes");
    await Bun.write(join(root,"new.ts"),"new content\n");
    const untracked = captureDiff("local",root);
    expect(untracked.scope.files).toEqual(["new.ts"]);
    const snapshot = await Bun.file(untracked.scope.snapshotPath!).json();
    expect(Buffer.from(snapshot.untracked[0].content,"base64").toString()).toBe("new content\n");
    await Bun.write(join(root,"a.ts"),"staged\n"); git("add","a.ts");
    await Bun.write(join(root,"a.ts"),"unstaged\n");
    const both = captureDiff("local",root);
    expect(both.diff).toContain("+staged"); expect(both.diff).toContain("+unstaged");
    expect(both.scope.files?.sort()).toEqual(["a.ts","new.ts"]);
    const {verifyScope,scopePreview} = await import("../.archon/workflows/prepr/.shared/scope.ts");
    verifyScope(both.scope,root);
    expect(scopePreview(both.scope).changedFileCount).toBe(2);
    await Bun.write(join(root,"new.ts"),"changed after capture");
    expect(() => verifyScope(both.scope,root)).toThrow("changed after scope capture");
    expect(() => captureDiff("local",root,"HEAD")).toThrow("base override requires");
  } finally { await rm(root,{recursive:true,force:true}); }
});

test("a tracked edit during local preparation invalidates the shared snapshot",async()=>{
 const root=await mkdtemp(join(tmpdir(),'prepr-race-')),repo=join(root,'repo'),bin=join(root,'bin');
 const realGit=Bun.which('git')!;
 const git=(...args:string[])=>{const r=Bun.spawnSync([realGit,...args],{cwd:repo});if(r.exitCode)throw new Error(r.stderr.toString());};
 try{
  await Bun.write(join(repo,'a.ts'),'initial\n');git('init');git('config','user.name','Test');git('config','user.email','test@example.com');git('add','.');git('commit','-m','base');await Bun.write(join(repo,'a.ts'),'selected\n');
  const q=(v:string)=>"'"+v.replace(/'/g,"'\\''")+"'";
  await Bun.write(join(bin,'git'),`#!/bin/sh\n${q(realGit)} "$@"\nrc=$?\ncase "$*" in\n  "ls-files --others --exclude-standard -z") if [ ! -f ${q(join(root,'marker'))} ]; then printf 'raced\\n' >> ${q(join(repo,'a.ts'))}; touch ${q(join(root,'marker'))}; fi ;;\nesac\nexit "$rc"\n`);
  const {chmod}=await import('node:fs/promises');await chmod(join(bin,'git'),0o755);
  const module=resolve(import.meta.dir,'../.archon/workflows/prepr/.shared/scope.ts');
  const r=Bun.spawnSync(['bun','-e',`import {captureDiff} from ${JSON.stringify(module)}; captureDiff('local');`],{cwd:repo,env:{...Bun.env,PATH:bin+':'+Bun.env.PATH}});
  expect(r.exitCode).not.toBe(0);expect(r.stderr.toString()).toContain('changed during scope capture');
 }finally{await rm(root,{recursive:true,force:true});}
});
