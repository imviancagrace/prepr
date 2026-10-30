// Test-only simulated human decisions in disposable projects. Production has no auto-accept option.
import { inspectSource, draftReviewer, acceptReviewer, resolveAccepted, type Standard } from '../../.archon/workflows/prepr/.shared/reviewers.ts';
export function standard(name='fixture-reviewer'):Standard {return {format:1,name,priorities:['Assess the supplied behavior.'],methods:[],evidence:['Retain uncertainty.'],communication:['Use concise questions.'],severity:{},assessments:[],references:[],resources:[]};}
export function fixtureDraft(project:string,reference:string,run?:any,override?:Standard) {
 const inspected=inspectSource(reference,[],run,project);
 const p=override ?? (inspected.contents['reviewer.json']?JSON.parse(inspected.contents['reviewer.json']):{...standard(),methods:[inspected.contents['SKILL.md']]});
 return draftReviewer(project,reference,p,{retained:[{source:'SKILL.md',instruction:'Fixture review criteria retained.'}],excluded:[],unresolved:[],limitations:[]},[],run);
}
export function fixtureReviewer(project:string,reference:string,run?:any) {
 const preview=fixtureDraft(project,reference,run);
 acceptReviewer(project,preview.id,preview.digest,'accept',run);
 return resolveAccepted(reference,project,run);
}

import {cpSync,writeFileSync,readFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {inspectPrerequisites,previewConfirmation,confirmationPlan,execute,inventory,CONFIRMATION_PATH} from '../../.archon/workflows/prepr/.shared/prerequisites.ts';
export function fixturePrerequisites(project:string,reviewers:any[],bins:Record<string,string>={}) {
 const old=Object.fromEntries(Object.keys(bins).map(k=>[k,Bun.env[k]]));
 try {
  Object.assign(Bun.env,bins);
  const pkg=join(project,'.archon/workflows/prepr');
  if(!existsSync(pkg))cpSync(resolve(import.meta.dir,'../../.archon/workflows/prepr'),pkg,{recursive:true});
  const git=(args:string[])=>execute(['git',...args],project);
  const exclude=resolve(project,git(['rev-parse','--git-path','info/exclude']));
  mkdirSync(dirname(exclude),{recursive:true});
  writeFileSync(exclude,(existsSync(exclude)?readFileSync(exclude,'utf8'):'')+'\n/.archon/workflows/prepr/\n/.archon/prepr-install.json\n/'+CONFIRMATION_PATH+'\n');
  writeFileSync(join(project,'.archon/prepr-install.json'),JSON.stringify({project:realpathSync(project),files:inventory(pkg)}));
  const exec=(args:string[],cwd?:string)=>args[0]==='which'?'/fixture/bin/'+args[1]:args[1]==='--version'?args[0]==='archon'?'0.11.1':'1.3.14':execute(args,cwd);
  const inspected=inspectPrerequisites(reviewers,project,exec);
  const p=previewConfirmation(project,inspected.selections,exec);
  const confirmation=confirmationPlan(project,inspected.selections,{digest:p.digest,decision:'confirm'},exec);
  writeFileSync(join(project,CONFIRMATION_PATH),JSON.stringify(confirmation));
  return confirmation;
 }finally {for(const [k,v] of Object.entries(old))if(v===undefined)delete Bun.env[k];else Bun.env[k]=v;}
}
