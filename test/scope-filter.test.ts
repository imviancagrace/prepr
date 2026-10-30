import {test,expect} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {captureDiff,verifyScope,scopePreview} from '../.archon/workflows/prepr/.shared/scope.ts';
import {filterPaths} from '../.archon/workflows/prepr/.shared/scope-filter.ts';
const git=(cwd:string,...args:string[])=>{const p=Bun.spawnSync(['git',...args],{cwd});if(p.exitCode)throw new Error(p.stderr.toString());return p.stdout.toString().trim();};
test('managed tooling filter is bounded and independent of Git state',()=>{
 const paths=['.archon/workflows/prepr/a.ts','.archon/prepr-reviewers/accepted/a/SKILL.md','.archon/prepr.local.yaml','.archon/prepr-install.json','.archon/prepr-prerequisites.json','.archon/prepr-backups/1/a','.archon/.prepr-stage-1/a','.archon/artifacts/x.json','.archon/logs/run','.archon/cache/x','.archon/workflows/other/a.ts','app/.archon/workflows/prepr/a.ts','.ux-runs.zip','prepr-feature.ts','.archon/config.yaml'];
 const result=filterPaths(paths);expect(result.excluded).toHaveLength(10);expect(result.eligible).toEqual(paths.slice(10));
});
test('filter precedes snapshots/patches, preserves application binaries/odd paths and ignores tooling-only edits',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prepr-filter-'));
 try {
  git(root,'init');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.com');
  await Bun.write(join(root,'app.ts'),'base\n');await Bun.write(join(root,'.archon/workflows/prepr/core.ts'),'TOOL-BASE\n');git(root,'add','.');git(root,'commit','-m','base');
  await Bun.write(join(root,'app.ts'),'staged\n');await Bun.write(join(root,'.archon/workflows/prepr/core.ts'),'SECRET-TOOL-STAGED\n');git(root,'add','.');
  await Bun.write(join(root,'app.ts'),'unstaged\n');await Bun.write(join(root,'.archon/artifacts/blob.bin'),new Uint8Array([0,1,2,3]));
  await Bun.write(join(root,'odd\n[abc]*.ts'),'eligible\n');await Bun.write(join(root,'.ux-runs.zip'),new Uint8Array([0,10,255]));
  const artifacts=join(root,'generated-output');await Bun.write(join(artifacts,'before.json'),'SECRET-OUTPUT');
  const captured=captureDiff('local',root,'',artifacts);const saved=await Bun.file(captured.scope.snapshotPath!).text();
  expect(saved).not.toContain('SECRET-TOOL');expect(saved).not.toContain('SECRET-OUTPUT');expect(saved).not.toContain('TOOL-BASE');
  expect(captured.diff).toContain('+staged');expect(captured.diff).toContain('+unstaged');expect(captured.scope.files).toContain('odd\n[abc]*.ts');expect(captured.scope.files).toContain('.ux-runs.zip');expect(scopePreview(captured.scope).excludedFileCount).toBe(3);
  await Bun.write(join(root,'.archon/workflows/prepr/core.ts'),'later-tooling');verifyScope(captured.scope,root);
  await Bun.write(join(root,'app.ts'),'later eligible');expect(()=>verifyScope(captured.scope,root)).toThrow('changed after scope capture');
  expect(()=>captureDiff('branch',root)).toThrow('clean checkout');
 }finally{await rm(root,{recursive:true,force:true});}
},15000);
test('committed tooling is excluded and cross-boundary renames retain only the eligible side',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prepr-filter-branch-'));
 try {
  git(root,'init','-b','main');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.com');
  await Bun.write(join(root,'app.ts'),'before\n');await Bun.write(join(root,'.archon/workflows/prepr/from.ts'),'excluded-old\n');git(root,'add','.');git(root,'commit','-m','base');const base=git(root,'rev-parse','HEAD');
  git(root,'mv','.archon/workflows/prepr/from.ts','new.ts');git(root,'mv','app.ts','.archon/workflows/prepr/app.ts');git(root,'commit','-am','moves');
  const c=captureDiff('branch',root,base);expect(c.scope.files?.sort()).toEqual(['app.ts','new.ts']);expect(c.diff).not.toContain('.archon/workflows/prepr');expect(c.diff).not.toContain('rename from');expect(await Bun.file(c.scope.snapshotPath!).text()).toContain('excluded-old');
  // Moving into an eligible path makes that new file eligible; the old excluded-side deletion is not exported.
  expect(c.diff).toContain('+++ b/new.ts');expect(c.diff).toContain('--- a/app.ts');
  const tip=git(root,'rev-parse','HEAD');await Bun.write(join(root,'.archon/workflows/prepr/only.ts'),'only tooling');git(root,'add','.');git(root,'commit','-m','tool only');
  expect(()=>captureDiff('branch',root,tip)).toThrow('No project changes to review');
 }finally{await rm(root,{recursive:true,force:true});}
},15000);
test('tooling-only local scope stops before a snapshot is written',async()=>{
 const root=await mkdtemp(join(tmpdir(),'prepr-only-tooling-'));
 try{git(root,'init');await Bun.write(join(root,'.archon/workflows/prepr/a.ts'),'tooling');expect(()=>captureDiff('local',root)).toThrow('No project changes to review');}finally{await rm(root,{recursive:true,force:true});}
});
