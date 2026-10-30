import {readFileSync,writeFileSync,linkSync,unlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {Reviewer,ReviewResult} from './core.ts';
export type Failure={runId?:string;stage:string;side?:string;reviewer?:string;launcher?:string;executable?:Reviewer['executable'];model?:string;cause:string;message:string;recovery:string;initialReviewsStarted?:boolean};
const path=()=>Bun.env.ARTIFACTS_DIR&&Bun.env.WORKFLOW_ID?join(Bun.env.ARTIFACTS_DIR,'prepr-failure.json'):undefined;
export function currentFailure():Failure|undefined {try{const f=JSON.parse(readFileSync(path()!,'utf8'));return f.runId===Bun.env.WORKFLOW_ID?f:undefined;}catch{return undefined;}}
export function recordFailure(failure:Failure) {
 const target=path();if(!target)return failure;
 mkdirSync(Bun.env.ARTIFACTS_DIR!,{recursive:true});
 const temp=target+'.'+crypto.randomUUID();writeFileSync(temp,JSON.stringify({...failure,runId:Bun.env.WORKFLOW_ID},null,2));
 try {linkSync(temp,target);}catch(error:any){if(error.code!=='EEXIST')throw error;}finally{unlinkSync(temp);}
 return currentFailure()??failure;
}
export function failureDetail(message:string,reviewer:Reviewer,phase:string):Failure {
 let text=message;
 for(let i=0;i<3;i++)try{const x=JSON.parse(text);text=typeof x.error==='string'?x.error:x.error?.message??x.message??text;}catch{break;}
 const cause=/model_not_found|model.{0,100}(not supported|unavailable|not found|not allowed)|unsupported.model/i.test(text)?'model compatibility':/auth|unauthori[sz]ed|not logged|sign.?in|login|token.{0,30}expired|401\b/i.test(text)?'authentication':/timed?.?out|timeout/i.test(text)?'timeout':/required.resource|access.{0,20}(denied|blocked)/i.test(text)?'required access':'execution';
 const recovery=cause==='model compatibility'?'Select a model supported by this native client and account, then renew setup confirmation.':cause==='authentication'?'Sign in through the selected native launcher and retry.':cause==='timeout'?'Inspect slow launcher hooks/plugins or session startup before retrying.':cause==='required access'?'Check the declared read resource under the selected launcher permissions.':'Inspect the saved launcher diagnostics before retrying.';
 return {stage:phase==='initial'?'initial review':'discussion',side:reviewer.side??Bun.env.INPUTS_REVIEWER_SIDE,reviewer:reviewer.name,launcher:reviewer.launcher,executable:reviewer.executable,model:reviewer.model,cause,message:text,recovery};
}
export function failedResult(error:unknown,reviewer:Reviewer,phase:ReviewResult['phase']):ReviewResult {
 const failure=failureDetail(String(error),reviewer,phase);recordFailure(failure);
 return {reviewer:reviewer.name,phase,status:'failed',stdout:'',stderr:String(error),exitCode:null,failure};
}
