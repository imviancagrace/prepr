import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, lstatSync, statSync, cpSync, rmSync, renameSync, realpathSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const REMOTE = 'https://github.com/imviancagrace/prepr.git';
const workflow = '.archon/workflows/prepr', profile = '.archon/prepr.local.yaml', manifest = '.archon/prepr-install.json';
export type Run = (args: string[], cwd?: string) => string;
export const run: Run = (args, cwd) => {
  const p = Bun.spawnSync(args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 30_000 });
  if (p.exitCode !== 0) throw new Error(`${args[0]} ${args[1] || ''} failed (check installation, login, permissions, or network).`);
  return p.stdout.toString().trim();
};
const read = (path: string) => readFileSync(path, 'utf8');
const parse = (path: string) => JSON.parse(read(path));
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
export function safePath(root: string, rel: string) {
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`Unsafe path: ${rel}`);
  let at = root;
  for (const part of rel.split('/')) { at = join(at, part); if (existsSync(at) && lstatSync(at).isSymbolicLink()) throw new Error(`Symlink destination not supported: ${at}`); }
  return at;
}
export function files(root: string): Record<string, string> {
  if (!existsSync(root)) return {};
  const result: Record<string,string> = {};
  const walk = (path: string) => {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Symlink package content not supported: ${path}`);
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
    else if (stat.isFile()) result[relative(root,path)] = `${hash(readFileSync(path))}:${stat.mode & 0o111}`;
    else throw new Error(`Unsupported package content: ${path}`);
  };
  walk(root); return result;
}
export function projectRoot(project: string, exec: Run = run) {
  const root = realpathSync(resolve(project));
  if (realpathSync(exec(['git','rev-parse','--show-toplevel'], root)) !== root) throw new Error('Select the Git project root, not a subdirectory.');
  return root;
}
export function fetchMain(exec: Run = run) {
  const staging = mkdtempSync(join(tmpdir(), 'prepr-setup-source-')), source = join(staging,'source');
  try {
    exec(['git','clone','--quiet','--depth','1','--single-branch','--branch','main', REMOTE, source]);
    return { source, commit: exec(['git','rev-parse','HEAD'], source), staging };
  } catch (e) { rmSync(staging,{recursive:true,force:true}); throw e; }
}
export function sourceInfo(source: string, exec: Run = run) {
  if (exec(['git','remote','get-url','origin'],source) !== REMOTE || exec(['git','branch','--show-current'],source) !== 'main') throw new Error('Source must be a fresh clone of the fixed remote main.');
  if (exec(['git','status','--porcelain','--untracked-files=all'],source)) throw new Error('Fetched source was modified; fetch again.');
  const commit = exec(['git','rev-parse','HEAD'],source);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit.');
  validatePackage(join(source, workflow));
  return { url: REMOTE, branch:'main', commit };
}
export function validatePackage(root: string) {
  const inventory = files(root);
  for (const name of Object.keys(inventory).filter(p => p.endsWith('.ts'))) {
    for (const match of read(join(root,name)).matchAll(/(?:from\s+|import\s*)[\"'](\.[^\"']+\.ts)[\"']/g)) {
      const dependency = relative(root,resolve(dirname(join(root,name)),match[1]));
      if (!inventory[dependency]) throw new Error(`Missing local module: ${dependency}`);
    }
  }
  for (const required of ['review-debate/review-debate.yaml','debate-reviewer/debate-reviewer.yaml','.shared/core.ts']) if (!inventory[required]) throw new Error(`Missing package file: ${required}`);
  for (const name of Object.keys(inventory).filter(p => p.endsWith('.yaml') && !p.includes('/fixtures/'))) {
    const doc: any = Bun.YAML.parse(read(join(root,name)));
    for (const node of doc.nodes ?? []) {
      if (node.script && !inventory[join(dirname(name),'scripts',`${node.script}.ts`)]) throw new Error(`Missing script for ${name}: ${node.script}`);
      if (node.workflow && typeof node.workflow === 'string' && node.workflow.includes('..')) throw new Error('Unexpected workflow reference.');
    }
  }
  return inventory;
}
export function plan(project: string, source: string, exec: Run = run) {
  const root = projectRoot(project,exec), info = sourceInfo(source,exec);
  const wanted = files(join(source,workflow)), current = files(safePath(root,workflow));
  const peerCurrent = files(safePath(root,`.archon/prepr-reviewers/sources/${info.commit}/peer-review-guidelines`));
  const peerWanted = files(join(source,'reviewers/peer-review-guidelines'));
  const peerChanged = [...new Set([...Object.keys(peerCurrent),...Object.keys(peerWanted)])].filter(p => peerCurrent[p] !== peerWanted[p]);
  const changed = [...new Set([...Object.keys(wanted),...Object.keys(current)])].filter(p => wanted[p] !== current[p]);
  return { root, source:info, peerCurrent, peerChanged, workflowExists: existsSync(join(root,workflow)), changed, configExists: existsSync(safePath(root,profile)), configHash: existsSync(join(root,profile)) ? hash(read(join(root,profile))) : null, current };
}
export function stageBundled(project:string,source:string,exec:Run=run) {
  const root=projectRoot(project,exec), info=sourceInfo(source,exec);
  const rel=`.archon/prepr-reviewers/sources/${info.commit}/peer-review-guidelines`, target=safePath(root,rel), origin=join(source,'reviewers/peer-review-guidelines');
  const expected=files(origin), actual=files(target);
  if(Object.keys(actual).length && JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error('Versioned bundled source was modified; preserve it and select an explicit local source.');
  const exclude=resolve(root,exec(['git','rev-parse','--git-path','info/exclude'],root));
  if(exec(['git','ls-files','--','.archon/prepr-reviewers/sources'],root)) throw new Error('Local reviewer source storage is tracked; remediate explicitly.');
  const old=existsSync(exclude)?read(exclude):'';
  if(!old.split('\n').includes('/.archon/prepr-reviewers/sources/')) {mkdirSync(dirname(exclude),{recursive:true});writeFileSync(exclude,old+(old&&!old.endsWith('\n')?'\n':'')+'/.archon/prepr-reviewers/sources/\n');}
  if(!Object.keys(actual).length) {mkdirSync(dirname(target),{recursive:true});cpSync(origin,target,{recursive:true});}
  return {source:target,revision:info.commit,status:'inactive-source',note:'Prepare and obtain human acceptance before activation.'};
}
export type Tool = { tool: string; status: 'present'|'missing-or-incompatible'; version?: string };
export function inspectTools(launchers: string[], exec: Run = run): Tool[] {
  if (launchers.some(l => !['codex','claude'].includes(l))) throw new Error('Choose codex or claude.');
  return [...new Set(['git','bun','archon',...launchers])].map(tool => {
    try {
      const version = exec([tool,'--version']);
      const m = version.match(/(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?/);
      if (!m || (tool === 'archon' && (m[4] || Number(m[1]) === 0 && (Number(m[2]) < 11 || Number(m[2]) === 11 && Number(m[3]) < 1)))) throw new Error('Unsupported version');
      return { tool, status:'present', version };
    } catch { return { tool, status:'missing-or-incompatible' }; }
  });
}
export type InstallStep = { tool: string; command: string[] };
// Consent is obtained in the skill conversation, not inferred from invoking the skill.
export function installApproved(steps: InstallStep[], approved: InstallStep[], exec: Run = run) {
  if (JSON.stringify(steps) !== JSON.stringify(approved)) throw new Error('Installation plan was not approved unchanged.');
  for (const step of steps) { exec(step.command); exec([step.tool,'--version']); }
}
const unverified = ['Launcher authentication and model entitlement have not been probed.', 'Reviewer sandbox/resource access and project tests have not been verified.'];
export function commands(root: string) {
  return [...['',' --input scope=branch',' --input preview_only=true',' --input scope=branch --input preview_only=true'].map(flags => `cd ${quote(root)} && archon workflow run prepr --no-worktree${flags}`), `cd ${quote(root)} && archon serve`];
}
async function skillExists(reference: string, root: string, exec: Run) {
  const github = reference.match(/^(?:github:|https:\/\/github\.com\/)([\w.-]+\/[\w.-]+)@([a-f0-9]{40})(?::|#)(.+)$/i);
  if (github) {
    const [,repo,commit,path] = github;
    if (isAbsolute(path) || path.split('/').includes('..')) throw new Error('Invalid remote skill path.');
    const temp = mkdtempSync(join(tmpdir(),'prepr-setup-skill-'));
    try {
      exec(['git','clone','--quiet','--no-checkout',`https://github.com/${repo}.git`,join(temp,'source')]);
      const base = ['git','-C',join(temp,'source'),'cat-file','-e'];
      try { exec([...base,`${commit}:${path.replace(/\/$/,'')}/SKILL.md`]); }
      catch { if (!path.endsWith('/SKILL.md') && path !== 'SKILL.md') throw new Error('Missing pinned SKILL.md'); exec([...base,`${commit}:${path}`]); }
    } finally { rmSync(temp,{recursive:true,force:true}); }
  } else {
    if (/^(github:|https?:)/.test(reference)) throw new Error('Remote reviewer references require an immutable 40-character commit.');
    const path = resolve(root,reference), skill = existsSync(path) && statSync(path).isDirectory() ? join(path,'SKILL.md') : path;
    if (!existsSync(skill) || !statSync(skill).isFile() || !read(skill).trim()) throw new Error(`Missing reviewer SKILL.md: ${reference}`);
  }
}
export async function validateConfig(config: any, root: string, packageRoot: string, exec: Run = run, bundledSource?: string, pending: any[] = []) {
  if (!config || typeof config !== 'object' || !config.reviewers || !config.default_pair) throw new Error('Profiles require reviewers and default_pair.');
  const core = await import(pathToFileURL(join(packageRoot,'.shared/core.ts')).href);
  if (typeof core.chooseReferences !== 'function') throw new Error('Remote main predates setup validation support. Publish the setup-compatible Prepr version to main and fetch again.');
  const {reviewerA,reviewerB} = core.chooseReferences('','','','','','',config);
  for (const side of ['reviewer_a','reviewer_b']) {
    const p = config.reviewers[config.default_pair[side]];
    if (!p || typeof p.name !== 'string' || !p.name.trim() || typeof p.skill !== 'string' || !p.skill.trim() || p.model !== undefined && (typeof p.model !== 'string' || !p.model.trim())) throw new Error(`Invalid ${side} profile.`);
    if (p.skill === 'bundled:peer') {
      if (!bundledSource) throw new Error('Bundled peer source unavailable.');
      await skillExists(bundledSource,root,exec);
    } else await skillExists(p.skill,root,exec);
  }
  const onboarding = await import(pathToFileURL(join(packageRoot,'.shared/reviewers.ts')).href);
  const accepted = [reviewerA,reviewerB].map(reviewer => onboarding.resolveAccepted(reviewer.reference === 'bundled:peer' ? bundledSource! : reviewer.reference,root,exec,pending));
  const prerequisites = await import(pathToFileURL(join(packageRoot,'.shared/prerequisites.ts')).href);
  const inspected=prerequisites.inspectPrerequisites([reviewerA,reviewerB].map((r,i)=>({...r,...accepted[i],requiredAccess:[...(r.requiredAccess??[]),...accepted[i].requiredAccess]})),root,exec);
  return { tools:inspected.tools, checks:inspected.checks, selections:inspected.selections, unverified, reviewers: accepted.map(r=>r.reviewerPackage) };
}

type Request = { project: string; source: string; workflow: 'keep'|'replace'; config: 'keep'|'new'; configFile?: string; expectedConfigHash: string|null; expectedWorkflow: Record<string,string>; peer?: 'keep'|'replace'; expectedPeer?: Record<string,string>; acceptances?: {id:string;digest:string;decision:'accept'}[]; confirmation?: {digest:string;decision:'confirm'|'decline'} };
export async function apply(request: Request, exec: Run = run, replace = renameSync, previewOnly = false) {
  const p = plan(request.project,request.source,exec), root = p.root;
  if (!['keep','replace'].includes(request.workflow) || !['keep','new'].includes(request.config)) throw new Error('Explicit workflow and configuration choices required.');
  if (request.expectedConfigHash !== p.configHash || JSON.stringify(request.expectedWorkflow) !== JSON.stringify(p.current)) throw new Error('Project changed since choices; inspect and ask again.');
  if (!p.configExists && request.config === 'keep') throw new Error('No existing configuration to keep.');
  if (!p.workflowExists && request.workflow === 'keep') throw new Error('No existing workflow to keep.');
  if (exec(['git','ls-files','--',profile],root)) throw new Error('Local profile is already tracked. Ask the user how to remediate; no index changes made.');
  safePath(root,manifest); safePath(root,'.archon/prepr-backups'); safePath(root,'.archon/prepr-reviewers/peer-review-guidelines');
  const oldConfig: any = p.configExists ? Bun.YAML.parse(read(join(root,profile))) : {};
  let config: any = oldConfig;
  if (request.config === 'new') {
    if (!request.configFile) throw new Error('New configuration file required.');
    const incoming: any = Bun.YAML.parse(read(request.configFile));
    if (!incoming?.default_pair || !incoming?.reviewers) throw new Error('New configuration requires a complete pair and reviewers.');
    config = {...oldConfig,...incoming,reviewers:{...oldConfig?.reviewers,...incoming?.reviewers}};
  }
  const peerRel = `.archon/prepr-reviewers/sources/${p.source.commit}/peer-review-guidelines`, peerSource = join(request.source,'reviewers/peer-review-guidelines');
  const usesBundled = Object.values(config.reviewers ?? {}).some((v: any) => v?.skill === 'bundled:peer');
  const selectedPackage = request.workflow === 'keep' ? join(root,workflow) : join(request.source,workflow);
  validatePackage(selectedPackage);
  if (request.config === 'keep' && usesBundled) throw new Error('Existing configuration contains a setup placeholder; choose new configuration to materialize it.');
  if (usesBundled && Object.keys(p.peerCurrent).length && p.peerChanged.length && (!['keep','replace'].includes(request.peer ?? '') || JSON.stringify(request.expectedPeer) !== JSON.stringify(p.peerCurrent))) throw new Error('Bundled peer differs: show changes and obtain an explicit keep/replace choice with expectedPeer.');
  const retainedPeer = usesBundled && request.peer === 'keep' && Object.keys(p.peerCurrent).length > 0;
  const onboarding = await import(pathToFileURL(join(request.source,workflow,'.shared/reviewers.ts')).href);
  if((request.acceptances ?? []).some(a=>a.decision!=='accept')) throw new Error('Reviewer acceptance declined or incomplete; prior configuration remains active.');
  const pending = (request.acceptances ?? []).map(a => onboarding.acceptedCandidate(root,a.id,a.digest,a.decision,exec)).filter(Boolean);
  if(usesBundled && !existsSync(join(root,peerRel))) throw new Error('Stage the versioned bundled source and prepare/accept its preview before applying setup.');
  const validation = await validateConfig(config,root,join(request.source,workflow),exec,join(root,peerRel),pending);
  const prerequisites = await import(pathToFileURL(join(request.source,workflow,'.shared/prerequisites.ts')).href);
  const confirmationPreview=prerequisites.previewConfirmation(root,validation.selections,exec);
  if(previewOnly) return {status:'confirmation-preview', project:root, validation, confirmation:confirmationPreview};
  const confirmation=prerequisites.confirmationPlan(root,validation.selections,request.confirmation,exec);
  const registryPlan = pending.length ? onboarding.activationPlan(root,pending,exec) : null;
  const latest = plan(root,request.source,exec);
  if (latest.configHash !== p.configHash || JSON.stringify(latest.current) !== JSON.stringify(p.current) || JSON.stringify(latest.peerCurrent) !== JSON.stringify(p.peerCurrent)) throw new Error('Project changed during validation; inspect and ask again.');
  const stagedConfig = structuredClone(config);
  if (usesBundled) for (const value of Object.values(stagedConfig.reviewers) as any[]) if (value.skill === 'bundled:peer') value.skill = join(root,peerRel);
  const previous = existsSync(join(root,manifest)) ? parse(join(root,manifest)) : null;
  const actualFiles = files(selectedPackage);
  const sourceMatches = JSON.stringify(actualFiles) === JSON.stringify(files(join(request.source,workflow)));
  const previousMatches = previous && JSON.stringify(previous.files) === JSON.stringify(actualFiles);
  const installedSource = sourceMatches ? p.source : previousMatches ? previous.source : null;
  // Nothing is replaced until all validation has succeeded.
  const stateDir = safePath(root,'.archon'); mkdirSync(stateDir,{recursive:true});
  const temp = mkdtempSync(join(stateDir,'.prepr-stage-')), backup = join(root,'.archon/prepr-backups',`${Date.now()}-${crypto.randomUUID()}`);
  const operations: { target:string; prepared:string; saved?:string }[] = [];
  const prepare = (rel: string, source?: string, text?: string) => {
    const target = safePath(root,rel), prepared = join(temp,String(operations.length));
    if (source) cpSync(source,prepared,{recursive:true,preserveTimestamps:true}); else writeFileSync(prepared,text!);
    operations.push({target,prepared});
  };
  if (request.workflow === 'replace' && p.changed.length) prepare(workflow,join(request.source,workflow));
  if (usesBundled && !retainedPeer && p.peerChanged.length) prepare(peerRel,peerSource);
  for(const item of pending) if(!existsSync(item.target)) prepare(relative(root,item.target),item.package);
  if(registryPlan) prepare(relative(root,registryPlan.path),undefined,JSON.stringify(registryPlan.registry,null,2)+'\n');
  if (request.config === 'new') prepare(profile,undefined,Bun.YAML.stringify(stagedConfig));
  const confirmationPath=prerequisites.CONFIRMATION_PATH;
  if(request.confirmation || !existsSync(join(root,confirmationPath))) prepare(confirmationPath,undefined,JSON.stringify(confirmation,null,2)+'\n');
  const record = { source:installedSource, files:actualFiles, peer: usesBundled ? {path:peerRel,source:retainedPeer ? (JSON.stringify(previous?.peer?.files) === JSON.stringify(p.peerCurrent) ? previous.peer.source : null) : p.source,files:files(retainedPeer ? join(root,peerRel) : peerSource)} : previous?.peer, project:root, config:join(root,profile), updatedAt:new Date().toISOString() };
  prepare(manifest,undefined,JSON.stringify(record,null,2)+'\n');
  const exclude = resolve(root,exec(['git','rev-parse','--git-path','info/exclude'],root));
  const oldExclude = existsSync(exclude) ? read(exclude) : '';
  const ignores = ['/.archon/prepr-prerequisites.json','/.archon/prepr.local.yaml','/.archon/prepr-install.json','/.archon/prepr-backups/','/.archon/.prepr-stage-*/','/.archon/prepr-reviewers/sources/','/.archon/prepr-reviewers/drafts/','/.archon/prepr-reviewers/accepted/','/.archon/prepr-reviewers/registry.json'];
  const extra = ignores.filter(line=>!oldExclude.split('\n').includes(line));
  let applied = 0;
  try {
    mkdirSync(backup,{recursive:true});
    writeFileSync(join(backup,'paths.json'),JSON.stringify(operations.map((op,i)=>({backup:String(i),original:op.target})),null,2));
    for (const [i, op] of operations.entries()) {
      mkdirSync(dirname(op.target),{recursive:true});
      if (existsSync(op.target)) { op.saved=join(backup,String(i)); renameSync(op.target,op.saved); }
      try { replace(op.prepared,op.target); } catch(e) { if(op.saved) renameSync(op.saved,op.target); throw e; }
      applied++;
    }
    mkdirSync(dirname(exclude),{recursive:true});
    if (extra.length) writeFileSync(exclude,oldExclude+(oldExclude.endsWith('\n')||!oldExclude?'':'\n')+extra.join('\n')+'\n');
    if (exec(['git','check-ignore','--',profile],root) !== profile) throw new Error('Local profile exclusion could not be verified.');
  } catch (e) {
    for (const op of operations.slice(0,applied).reverse()) { rmSync(op.target,{recursive:true,force:true}); if(op.saved) renameSync(op.saved,op.target); }
    if (existsSync(exclude)) writeFileSync(exclude,oldExclude);
    throw e;
  } finally { rmSync(temp,{recursive:true,force:true}); }
  return { status:'configured', project:root, config:join(root,profile), source:installedSource, backup, validation:{...validation,confirmation:{...confirmation,status:'user-confirmed'}}, commands:commands(root), ui:{command:commands(root).at(-1),optional:true,separateTerminal:true,note:'Run manually in a separate terminal. Foreground server; default port 3090. Binary installs download matching UI assets on first use. The UI is optional for CLI reviews.'}, note:'Commands are for manual use. Branch scope requires a clean checkout; local scope selects uncommitted work.' };
}
export async function verify(project: string, exec: Run = run, source?: string) {
  const root = projectRoot(project,exec), record = parse(safePath(root,manifest));
  if (JSON.stringify(validatePackage(safePath(root,workflow))) !== JSON.stringify(record.files)) throw new Error('Workflow differs from the recorded installation.');
  if (record.peer && JSON.stringify(files(safePath(root,record.peer.path))) !== JSON.stringify(record.peer.files)) throw new Error('Bundled peer changed since installation.');
  if (exec(['git','ls-files','--',profile],root)) throw new Error('Local profile is tracked.');
  if (exec(['git','check-ignore','--',profile],root) !== profile) throw new Error('Local configuration must be ignored.');
  if (source) sourceInfo(source,exec);
  const validation = await validateConfig(Bun.YAML.parse(read(safePath(root,profile))),root,join(source || root,workflow),exec);
  const prerequisites=await import(pathToFileURL(join(source||root,workflow,'.shared/prerequisites.ts')).href);
  const confirmation=prerequisites.confirmationPlan(root,validation.selections,undefined,exec);
  if(exec(['git','check-ignore','--',prerequisites.CONFIRMATION_PATH],root)!==prerequisites.CONFIRMATION_PATH)throw new Error('Prerequisite confirmation must be locally ignored.');
  return {status:'configured',project:root,config:join(root,profile),source:record.source,validation:{...validation,confirmation:{...confirmation,status:'user-confirmed'}},commands:commands(root),ui:{command:commands(root).at(-1),optional:true,separateTerminal:true,note:'Foreground server in a separate terminal; default port 3090. Binary installs download matching UI assets on first use; UI is optional.'}};
}
if (import.meta.main) {
  try {
    const [action,...args] = process.argv.slice(2);
    const output = action === 'fetch' ? fetchMain() : action === 'plan' ? plan(args[0],args[1]) : action === 'inspect' ? inspectTools((args[1]||'').split(',').filter(Boolean)) : action === 'stage-bundled' ? stageBundled(args[0],args[1]) : action === 'preview' ? await apply(parse(args[0]),run,renameSync,true) : action === 'apply' ? await apply(parse(args[0])) : action === 'install' ? installApproved(parse(args[0]),parse(args[1])) ?? {status:'installed',note:'Re-run inspect to verify compatible versions.'} : action === 'verify' ? await verify(args[0],run,args[1]) : (()=>{throw new Error('Use fetch | plan <project> <source> | inspect <project> <codex,claude> | preview <request.json> | apply <request.json> | install <plan.json> <approved-plan.json> | verify <project>');})();
    console.log(JSON.stringify(output,null,2));
  } catch(e) { console.error(JSON.stringify({status:'incomplete',error:String(e),unverified})); process.exitCode=1; }
}
