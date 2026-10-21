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
