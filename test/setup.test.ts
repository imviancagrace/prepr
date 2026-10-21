import {fixtureDraft} from "./helpers/reviewers.ts";
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, chmodSync, existsSync, statSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { REMOTE, apply, plan, verify, fetchMain, commands, inspectTools, installApproved, stageBundled, type Run } from '../skills/prepr-setup/scripts/setup.ts';
const repo = resolve(import.meta.dir,'..');
function fixture() {
  const temp=mkdtempSync(join(tmpdir(),'prepr-setup-test-')), source=join(temp,'source'), project=join(temp,"project's checkout"), log:string[][]=[];
  const git = (args:string[],cwd?:string) => {
    const p=Bun.spawnSync(['git',...args],{cwd,env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}});
    if(p.exitCode) throw new Error(p.stderr.toString()); return p.stdout.toString().trim();
  };
  mkdirSync(source); mkdirSync(project); git(['init','-b','main'],source);git(['init','-b','main'],project);
  cpSync(join(repo,'.archon/workflows/prepr'),join(source,'.archon/workflows/prepr'),{recursive:true});
  cpSync(join(repo,'reviewers'),join(source,'reviewers'),{recursive:true});
  git(['add','.'],source);git(['-c','user.name=Test','-c','user.email=test@example.test','commit','-m','fixture'],source);git(['remote','add','origin',REMOTE],source);
  const exec:Run=(args,cwd)=>{
    log.push(args);
    if(args[0]==='git') {
      if(args[1]==='clone' && args.includes(REMOTE)) { git(['clone','--quiet','--branch','main',source,args.at(-1)!]); git(['remote','set-url','origin',REMOTE],args.at(-1)); return ''; }
      return git(args.slice(1),cwd);
    }
    if(args.join(' ')==='archon ai tier list --json') return JSON.stringify({tiers:[{tier:'large',effective:{provider:'codex',model:'test-model'}}]});
    if(args.length===2 && args[1]==='--version' && ['bun','archon','codex','claude','gh'].includes(args[0])) return args[0]==='archon'?'archon 0.11.1':'1.3.14';
    throw new Error(`Unexpected process: ${args.join(' ')}`);
  };
  const configFile=join(temp,'profiles.yaml');
  writeFileSync(configFile,'default_pair:\n  reviewer_a: a\n  reviewer_b: b\nreviewers:\n  a:\n    name: First\n    launcher: codex\n    model: test\n    skill: bundled:peer\n  b:\n    name: Second\n    launcher: codex\n    skill: bundled:peer\n');
  const request=()=>{const p=plan(project,source,exec);const staged=stageBundled(project,source,exec);const acceptances:any[]=[];
   const incoming:any=Bun.YAML.parse(readFileSync(configFile,'utf8'));
   for(const item of Object.values(incoming?.reviewers??{}) as any[]) try {const r=fixtureDraft(project,item.skill==='bundled:peer'?staged.source:item.skill,exec);acceptances.push({id:r.id,digest:r.digest,decision:'accept'});}catch{}
   return {project,source,workflow:'replace' as const,config:'new' as const,configFile,expectedConfigHash:p.configHash,expectedWorkflow:p.current,acceptances};};
  return {temp,source,project,log,exec,git,configFile,request,cleanup:()=>rmSync(temp,{recursive:true,force:true})};
}
test('fresh remote main install preserves modes, peer lifetime, ignores, provenance and command-only handoff',async()=>{
  const f=fixture();try {
    const fetched=fetchMain(f.exec);
    expect(fetched.commit).toBe(f.git(['rev-parse','main'],f.source));
    const r=await apply({...f.request(),source:fetched.source},f.exec);
    rmSync(fetched.staging,{recursive:true,force:true});
    expect(r.status).toBe('configured');expect(r.commands).toHaveLength(4);expect(r.commands[0]).toContain("'\\''");
    const config:any=Bun.YAML.parse(readFileSync(join(f.project,'.archon/prepr.local.yaml'),'utf8'));
    expect(existsSync(join(config.reviewers.a.skill,'SKILL.md'))).toBe(true);
    const executable='.archon/workflows/prepr/review-debate/fixtures/fake-codex';
    expect(statSync(join(f.project,executable)).mode & 0o111).toBe(statSync(join(f.source,executable)).mode & 0o111);
    expect((await verify(f.project,f.exec)).source.commit).toBe(r.source!.commit);
    expect(f.git(['status','--short'],f.project)).not.toContain('prepr.local.yaml');
    expect(f.log.filter(a=>a[0]==='archon').every(a=>a[1]==='--version'||a.join(' ')==='archon ai tier list --json')).toBe(true);
    expect(f.log.some(a=>a.includes('exec')||a.includes('workflow')||a.includes('-p'))).toBe(false);
  } finally {f.cleanup();}
});
test('keep preserves configuration bytes; new merges unrelated profiles; invalid config and races do not write',async()=>{
 const f=fixture();try {
  await apply(f.request(),f.exec);
  const path=join(f.project,'.archon/prepr.local.yaml'), old=readFileSync(path,'utf8')+'\n# keep this comment\n';writeFileSync(path,old);
  await apply({...f.request(),config:'keep'},f.exec);expect(readFileSync(path,'utf8')).toBe(old);
  const config:any=Bun.YAML.parse(old);config.reviewers.extra={name:'Extra',launcher:'claude',skill:'/unrelated'};writeFileSync(path,Bun.YAML.stringify(config));
  await apply(f.request(),f.exec);expect((Bun.YAML.parse(readFileSync(path,'utf8')) as any).reviewers.extra.name).toBe('Extra');
  const before=readFileSync(path,'utf8');writeFileSync(f.configFile,'reviewers: {}');
  await expect(apply(f.request(),f.exec)).rejects.toThrow();expect(readFileSync(path,'utf8')).toBe(before);
  const stale=f.request();writeFileSync(path,before+'\n');await expect(apply(stale,f.exec)).rejects.toThrow('changed since choices');
 } finally {f.cleanup();}
});
test('workflow keep records unknown modified provenance, replacement backs up, failed swap recovers',async()=>{
 const f=fixture();try {
  await apply(f.request(),f.exec);
  const file=join(f.project,'.archon/workflows/prepr/.shared/core.ts'), original=readFileSync(file,'utf8');writeFileSync(file,original+'\n// custom\n');
  const kept=await apply({...f.request(),workflow:'keep',config:'keep'},f.exec);expect(kept.source).toBeNull();
  expect((await verify(f.project,f.exec)).source).toBeNull();
  await expect(apply({...f.request(),config:'keep'},f.exec,()=>{throw new Error('simulated swap failure');})).rejects.toThrow('simulated');
  expect(readFileSync(file,'utf8')).toBe(original+'\n// custom\n');
  const replaced=await apply({...f.request(),config:'keep'},f.exec);expect(existsSync(join(replaced.backup,'0','.shared/core.ts'))).toBe(true);
 } finally {f.cleanup();}
});
test('tracked profile, invalid models, invalid mappings, missing skills, modified package stop before writes',async()=>{
 const f=fixture();try {
  await apply(f.request(),f.exec);const path=join(f.project,'.archon/prepr.local.yaml');
  f.git(['add','-f','.archon/prepr.local.yaml'],f.project);
  await expect(apply({...f.request(),config:'keep'},f.exec)).rejects.toThrow('already tracked');
  expect(f.git(['ls-files','.archon/prepr.local.yaml'],f.project)).toBe('.archon/prepr.local.yaml');
  f.git(['rm','--cached','.archon/prepr.local.yaml'],f.project);
  const original=readFileSync(path,'utf8'), config:any=Bun.YAML.parse(original);
  for (const override of [{skill:'/missing'},{severity_map:{P1:'urgent'}},{model:''},{required_access:[{tool:'arbitrary',resource:'x'}]}]) {
    const next=structuredClone(config);Object.assign(next.reviewers.a,override);writeFileSync(f.configFile,Bun.YAML.stringify(next));
    await expect(apply(f.request(),f.exec)).rejects.toThrow();expect(readFileSync(path,'utf8')).toBe(original);
  }
  writeFileSync(join(f.source,'.archon/workflows/prepr/.shared/core.ts'),'modified');
  expect(()=>plan(f.project,f.source,f.exec)).toThrow('modified');
 }finally{f.cleanup();}
});
test('main is refreshed, other branch ignored, denied fetch never uses cache',()=>{
 const f=fixture();try{
  f.git(['branch','other'],f.source);const a=fetchMain(f.exec);
  writeFileSync(join(f.source,'new.txt'),'new');f.git(['add','.'],f.source);f.git(['-c','user.name=Test','-c','user.email=test@example.test','commit','-m','next'],f.source);
  const b=fetchMain(f.exec);expect(b.commit).not.toBe(a.commit);expect(b.commit).toBe(f.git(['rev-parse','main'],f.source));
  expect(()=>fetchMain(()=>{throw new Error('access denied');})).toThrow('access denied');
  expect(f.git(['status','--short'],f.project)).toBe('');
  rmSync(a.staging,{recursive:true,force:true});rmSync(b.staging,{recursive:true,force:true});
 }finally{f.cleanup();}
});
test('inspection and exact approved installations preserve tools and never start sessions',()=>{
 const seen:string[][]=[];const installed=new Set(['git','bun','codex']);
 const exec:Run=args=>{seen.push(args);if(args[0]==='installer'){installed.add(args[1]);return '';}if(!installed.has(args[0]))throw new Error('missing');return args[0]==='archon'?'0.11.1':'1.3.14';};
 const tools=inspectTools(['codex','codex'],exec);expect(tools.filter(t=>t.status!=='present').map(t=>t.tool)).toEqual(['archon']);expect(seen.some(a=>a[0]==='claude')).toBe(false);
 const steps=[{tool:'archon',command:['installer','archon']}];expect(()=>installApproved(steps,[],exec)).toThrow('not approved');expect(installed.has('archon')).toBe(false);
 installApproved(steps,steps,exec);expect(inspectTools(['codex'],exec).every(t=>t.status==='present')).toBe(true);
 expect(inspectTools(['codex'],args=>args[0]==='archon'?'0.11.0':'1.2.3').find(t=>t.tool==='archon')?.status).toBe('missing-or-incompatible');
 expect(()=>installApproved([{tool:'bun',command:['fail']}],[{tool:'bun',command:['fail']}],()=>{throw new Error('failed');})).toThrow('failed');
 expect(commands('/some/project')).toHaveLength(4);
});
test('bootstrap inspection works without Bun/Git and rejects unsupported platforms without installing',()=>{
 const temp=mkdtempSync(join(tmpdir(),'prepr-bootstrap-'));
 try {
  const uname=join(temp,'uname');writeFileSync(uname,'#!/bin/sh\necho Linux\n');chmodSync(uname,0o755);
  const script=join(repo,'skills/prepr-setup/scripts/inspect.sh');
  const result=Bun.spawnSync(['/bin/sh',script,'codex'],{env:{PATH:temp}});
  expect(result.exitCode).toBe(0);expect(result.stdout.toString()).toContain('bun: missing');expect(result.stdout.toString()).toContain('No tools installed');
  writeFileSync(uname,'#!/bin/sh\necho OtherOS\n');
  const unsupported=Bun.spawnSync(['/bin/sh',script,'codex'],{env:{PATH:temp}});expect(unsupported.exitCode).toBe(1);expect(unsupported.stderr.toString()).toContain('Unsupported');
 } finally {rmSync(temp,{recursive:true,force:true});}
});
test('pinned remote reviewer is verified with Git only and missing commit stops setup',async()=>{
 const f=fixture();try {
  const commit=f.git(['rev-parse','main'],f.source), config:any=Bun.YAML.parse(readFileSync(f.configFile,'utf8'));
  config.reviewers.a.skill=`github:example/reviewers@${commit}:reviewers/peer-review-guidelines`;
  writeFileSync(f.configFile,Bun.YAML.stringify(config));
  const exec:Run=(args,cwd)=>{
   if(args[0]==='git' && args[1]==='clone' && args.includes('https://github.com/example/reviewers.git')) {f.log.push(args); f.git(['clone','--quiet','--no-checkout',f.source,args.at(-1)!]);return '';}
   return f.exec(args,cwd);
  };
  const request=f.request();const preview=fixtureDraft(f.project,config.reviewers.a.skill,exec);request.acceptances.push({id:preview.id,digest:preview.digest,decision:'accept'});
  await apply(request,exec);expect(f.log.some(a=>a.includes('checkout'))).toBe(true);
  const original=readFileSync(join(f.project,'.archon/prepr.local.yaml'),'utf8');
  config.reviewers.a.skill=`github:example/reviewers@${'0'.repeat(40)}:reviewers/peer-review-guidelines`;writeFileSync(f.configFile,Bun.YAML.stringify(config));
  await expect(apply(f.request(),exec)).rejects.toThrow();expect(readFileSync(join(f.project,'.archon/prepr.local.yaml'),'utf8')).toBe(original);
 }finally{f.cleanup();}
});
test('modified versioned bundled source cannot be silently overwritten',async()=>{
 const f=fixture();try{
  await apply(f.request(),f.exec);const path=join(stageBundled(f.project,f.source,f.exec).source,'SKILL.md');
  const custom=readFileSync(path,'utf8')+'\nCustom';writeFileSync(path,custom);
  expect(()=>stageBundled(f.project,f.source,f.exec)).toThrow('modified');expect(readFileSync(path,'utf8')).toBe(custom);
 }finally{f.cleanup();}
});
test('retaining an older workflow uses fetched pure validation without changing installed code',async()=>{
 const f=fixture();try{
  await apply(f.request(),f.exec);const path=join(f.project,'.archon/workflows/prepr/.shared/core.ts');
  const legacy=readFileSync(path,'utf8').replace('export function chooseReferences','function chooseReferences');writeFileSync(path,legacy);
  await apply({...f.request(),workflow:'keep',config:'keep'},f.exec);
  await verify(f.project,f.exec,f.source);expect(readFileSync(path,'utf8')).toBe(legacy);
 }finally{f.cleanup();}
});

test('declined acceptance and failed profile swap preserve the prior registry and active pair',async()=>{
 const f=fixture();try{
  await apply(f.request(),f.exec);
  const registry=join(f.project,'.archon/prepr-reviewers/registry.json'),profile=join(f.project,'.archon/prepr.local.yaml');
  const beforeRegistry=readFileSync(registry,'utf8'),beforeProfile=readFileSync(profile,'utf8');
  const request=f.request();request.acceptances[0].decision='reject';
  await expect(apply(request,f.exec)).rejects.toThrow('declined');
  expect(readFileSync(registry,'utf8')).toBe(beforeRegistry);expect(readFileSync(profile,'utf8')).toBe(beforeProfile);
  await expect(apply(f.request(),f.exec,(from,to)=>{if(String(to).endsWith('prepr.local.yaml'))throw new Error('profile swap failed');renameSync(from,to);})).rejects.toThrow('profile swap');
  expect(readFileSync(registry,'utf8')).toBe(beforeRegistry);expect(readFileSync(profile,'utf8')).toBe(beforeProfile);
 }finally{f.cleanup();}
});
