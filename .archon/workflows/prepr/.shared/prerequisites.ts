import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { Reviewer } from './core.ts';
import { localScope } from './reviewers.ts';
export type Exec = (args: string[], cwd?: string) => string;
export const execute: Exec = (args,cwd) => {
  const p=Bun.spawnSync(args,{cwd,env:{...Bun.env,GIT_TERMINAL_PROMPT:'0'},timeout:30_000});
  if(p.exitCode!==0) throw new Error(`${args[0]} ${args[1] ?? ''} failed; check installation and configuration.`);
  return p.stdout.toString().trim();
};
export const CONFIRMATION_PATH='.archon/prepr-prerequisites.json';
export const WORKFLOW_PATH='.archon/workflows/prepr';
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const read=(p:string)=>readFileSync(p,'utf8');
export function literal(root:string,path:string) {
  let at=root;
  if(path.startsWith('/')||path.split(/[\\/]/).includes('..')) throw new Error('Invalid local state path.');
  for(const part of path.split('/')) {at=join(at,part);if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw new Error(`Symlink destination not supported: ${at}`);}
  return at;
}
export function inventory(root:string):Record<string,string> {
  const result:Record<string,string>={};
  const walk=(path:string)=>{
    const s=lstatSync(path);
    if(s.isSymbolicLink())throw new Error('Symlink workflow content is unsupported.');
    if(s.isDirectory())for(const n of readdirSync(path).sort())walk(join(path,n));
    else if(s.isFile())result[relative(root,path)]=`${createHash('sha256').update(readFileSync(path)).digest('hex')}:${s.mode&0o111}`;
    else throw new Error('Unsupported workflow content.');
  };
  walk(root);return result;
}
export function checkInstallation(root:string) {
  const record=JSON.parse(read(literal(root,'.archon/prepr-install.json')));
  const files=inventory(literal(root,WORKFLOW_PATH));
  if(record.project!==realpathSync(root)||JSON.stringify(files)!==JSON.stringify(record.files))throw new Error('Installed workflow differs from local provenance; run prepr-setup to inspect/repair it.');
  return {name:'Installed workflow integrity',status:'passed' as const,evidence:'Files and executable modes match local installation provenance.'};
}
export type Tool={tool:string;status:'present'|'missing-or-incompatible';version?:string};
export const launcherBin=(launcher:string)=>launcher==='codex'?Bun.env.PREPR_CODEX_BIN||'codex':Bun.env.PREPR_CLAUDE_BIN||'claude';
export function inspectTools(launchers:string[],exec:Exec=execute,root?:string,gh=false):Tool[] {
  if(launchers.some(l=>!['codex','claude'].includes(l)))throw new Error('Choose codex or claude.');
  return [...new Set(['git','bun','archon',...launchers,...(gh?['gh']:[])])].map(tool=>{
    try {
      const version=exec([['codex','claude'].includes(tool)?launcherBin(tool):tool,'--version'],root);
      const m=version.match(/(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?/);
      if(!m||tool==='archon'&&(m[4]||Number(m[1])===0&&(Number(m[2])<11||Number(m[2])===11&&Number(m[3])<1)))throw new Error('Unsupported version');
      return {tool,status:'present',version};
    }catch{return {tool,status:'missing-or-incompatible'};}
  });
}
export function resolveModel(reviewer:Pick<Reviewer,'name'|'launcher'|'model'>,exec:Exec=execute,root=process.cwd()) {
  if(reviewer.model!==undefined) {
    if(typeof reviewer.model!=='string'||!reviewer.model.trim())throw new Error(`${reviewer.name}: invalid model pin.`);
    return reviewer.model;
  }
  const tiers=JSON.parse(exec(['archon','ai','tier','list','--json'],root));
  const effective=tiers.tiers?.find((t:any)=>t.tier==='large')?.effective;
  if(effective?.provider===reviewer.launcher&&typeof effective.model==='string'&&effective.model.trim())return effective.model as string;
  throw new Error(`${reviewer.name} has no model pin and Archon's large tier is not configured for the ${reviewer.launcher} launcher. Pin a compatible model or configure its matching Archon large tier yourself.`);
}
export type Selection={launcher:string;executable:string;model:string};
export type Confirmation={format:1;project:string;scope:string;selections:Selection[];digest:string;confirmedAt:string};
export function inspectPrerequisites(reviewers:Reviewer[],root:string,exec:Exec=execute) {
  const resolved=reviewers.map(r=>({...r,model:resolveModel(r,exec,root)}));
  const tools=inspectTools(resolved.map(r=>r.launcher),exec,root,resolved.some(r=>r.requiredAccess?.some(a=>a.tool==='gh')));
  const missing=tools.filter(t=>t.status!=='present');
  if(missing.length)throw new Error(`Missing/incompatible prerequisites: ${missing.map(t=>t.tool).join(', ')}. Run prepr-setup; obtain permission before installing.`);
  for(const r of resolved)for(const access of r.requiredAccess??[])if(!['file','git','gh'].includes(access.tool))throw new Error(`${r.name}: unsupported required tool ${access.tool}.`);
  const selections=[...new Map(resolved.map(r=>{
    const bin=launcherBin(r.launcher);const s={launcher:r.launcher,executable:bin.includes('/')?resolve(root,bin):bin,model:r.model};return [JSON.stringify(s),s] as const;
  })).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {reviewers:resolved,tools,selections,checks:[{name:'Prerequisites and model configuration',status:'passed' as const,evidence:'Executable versions and model configuration checked without AI sessions; runtime login/model entitlement remains unverified.'}]};
}
function identity(project:string,exec:Exec) {
  const root=realpathSync(project);
  if(realpathSync(exec(['git','rev-parse','--show-toplevel'],root))!==root)throw new Error('Select the target Git root.');
  if(exec(['git','ls-files','--',CONFIRMATION_PATH],root))throw new Error('Prerequisite confirmation state is tracked; remediate explicitly.');
  const scope=localScope(root,exec);
  if(!scope)throw new Error('No local setup scope; prepare reviewers through prepr-setup first.');
  literal(root,CONFIRMATION_PATH);
  return {project:root,scope};
}
export function previewConfirmation(root:string,selections:Selection[],exec:Exec=execute) {
  const binding={format:1 as const,...identity(root,exec),selections};
  const fingerprint=digest(binding);
  const path=literal(binding.project,CONFIRMATION_PATH);
  const previous=existsSync(path)?JSON.parse(read(path)):null;
  const matches=previous?.digest===fingerprint&&previous?.format===1&&previous?.project===binding.project&&previous?.scope===binding.scope&&JSON.stringify(previous?.selections)===JSON.stringify(selections)&&typeof previous.confirmedAt==='string';
  return { ...binding,digest:fingerprint,status:matches?'user-confirmed' as const:'confirmation-required' as const,confirmedAt:matches?previous.confirmedAt:undefined,
    message:'Confirm you are logged in to the shown launcher(s) and can use these models. This is user attestation, not observed authentication, model entitlement or resource access.' };
}
export function confirmationPlan(root:string,selections:Selection[],decision?:{digest:string;decision:string},exec:Exec=execute):Confirmation {
  const p=previewConfirmation(root,selections,exec);
  if(decision && (decision.decision!=='confirm'||decision.digest!==p.digest))throw new Error('Prerequisite confirmation declined or changed; show current selections and obtain explicit confirmation through prepr-setup.');
  if(!decision&&p.status!=='user-confirmed')throw new Error('Prerequisite confirmation missing or stale. Run prepr-setup and explicitly confirm launcher login/model access.');
  return {format:1,project:p.project,scope:p.scope,selections:p.selections,digest:p.digest,confirmedAt:decision?new Date().toISOString():p.confirmedAt!};
}
export function runtimePrerequisites(pair:{reviewerA:Reviewer;reviewerB:Reviewer},root=process.cwd(),exec:Exec=execute) {
  const installed=checkInstallation(root);
  const inspected=inspectPrerequisites([pair.reviewerA,pair.reviewerB],root,exec);
  const confirmation=confirmationPlan(root,inspected.selections,undefined,exec);
  if(exec(['git','check-ignore','--',CONFIRMATION_PATH],root)!==CONFIRMATION_PATH)throw new Error('Local prerequisite confirmation must be Git-excluded; run prepr-setup.');
  return {reviewerA:inspected.reviewers[0],reviewerB:inspected.reviewers[1],preparation:{status:'passed' as const,checks:[installed,...inspected.checks],tools:inspected.tools,confirmation:{...confirmation,status:'user-confirmed' as const},limitations:['Confirmation is user attestation; login, model execution and resource access are established only by actual reviewer sessions.']}};
}
