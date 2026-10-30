import type {Reviewer,ReviewResult} from './core.ts';
import {currentFailure,recordFailure,failureDetail} from './failures.ts';
import {launcherBin} from './prerequisites.ts';
const parse=(s:string)=>{try{const v=JSON.parse(s);return v&&typeof v==='object'?v:{};}catch{return {};}};
const fatal=(e:any)=>e.type==='error'||e.type==='turn.failed'||e.type==='result'&&e.is_error;
const message=(e:any)=>{const value=(typeof e.error==='string'?e.error:e.error?.message)??e.message??(Array.isArray(e.errors)?e.errors.map((x:any)=>typeof x==='string'?x:JSON.stringify(x)).join('\n'):undefined)??e.result??'Native launcher reported a fatal error.';return typeof value==='string'?value:JSON.stringify(value);};
export async function runNative(args:string[],reviewer:Reviewer,phase:ReviewResult['phase'],timeoutMs:number):Promise<ReviewResult> {
 const before=currentFailure();
 if(before)return {reviewer:reviewer.name,phase,status:'not_started',stdout:'',stderr:`Not started because ${before.reviewer??before.stage} failed: ${before.message}`,exitCode:null};
 const bin=reviewer.executable?.path||launcherBin(reviewer.launcher);
 let proc:ReturnType<typeof Bun.spawn>;
 try {proc=Bun.spawn([bin,...args],{cwd:process.cwd(),env:{...Bun.env},stdout:'pipe',stderr:'pipe',detached:true});}
 catch(error){const failure=failureDetail(String(error),reviewer,phase);recordFailure(failure);return {reviewer:reviewer.name,phase,status:'failed',stdout:'',stderr:String(error),exitCode:null,failure};}
 const events:any[]=[];let raw='',stderr='',line='',terminal:any;
 let signal!:()=>void;const fatalEvent=new Promise<void>(ok=>signal=ok);
 const stdout=(async()=>{const reader=proc.stdout.getReader(),decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;const text=decoder.decode(value,{stream:true});raw+=text;line+=text;let i;while((i=line.indexOf('\n'))>=0){const e=parse(line.slice(0,i));line=line.slice(i+1);events.push(e);if(fatal(e)&&!terminal){terminal=e;recordFailure(failureDetail(message(e),reviewer,phase));signal();}}}if(line){const e=parse(line);events.push(e);if(fatal(e)&&!terminal){terminal=e;recordFailure(failureDetail(message(e),reviewer,phase));signal();}}})();
 const err=(async()=>{stderr=await new Response(proc.stderr).text();})();
 let timeout:ReturnType<typeof setTimeout>,poll:ReturnType<typeof setInterval>;
 let cancelled=false,timedOut=false;
 const interrupted=new Promise<void>(ok=>{
  timeout=setTimeout(()=>{timedOut=true;recordFailure(failureDetail(`Launcher timed out after ${timeoutMs}ms`,reviewer,phase));ok();},timeoutMs);
  poll=setInterval(()=>{const f=currentFailure();if(f&&!terminal&&!timedOut){cancelled=true;ok();}},50);
 });
 try {
  await Promise.race([Promise.all([proc.exited,stdout,err]),fatalEvent,interrupted]);
  if(terminal||cancelled||timedOut){
   // Each launcher owns a detached process group; never signal a server or another run.
   try{process.kill(-proc.pid,'SIGTERM');}catch{}
   await Promise.race([Promise.all([proc.exited,stdout,err]),Bun.sleep(200)]);
   try{process.kill(-proc.pid,'SIGKILL');}catch{}
  }
  await Promise.all([proc.exited,stdout,err]);
 }finally {clearTimeout(timeout!);clearInterval(poll!);if(proc.exitCode===null)try{process.kill(-proc.pid,'SIGKILL');}catch{}}
 const text=events.flatMap(e=>reviewer.launcher==='codex'?e.type==='item.completed'&&e.item?.type==='agent_message'?[String(e.item.text??'')]:[]:e.type==='result'?[String(e.result??'')]:e.type==='assistant'?[Array.isArray(e.message?.content)?e.message.content.filter((x:any)=>x.type==='text').map((x:any)=>x.text).join('\n'):String(e.message?.content??'')]:[]).filter(Boolean).join('\n');
 const exitCode=await proc.exited;
 const status:ReviewResult['status']=cancelled?'cancelled':timedOut?'timed_out':terminal||exitCode!==0||!text.trim()?'failed':'completed';
 const failure=['failed','timed_out'].includes(status)?failureDetail(timedOut?`Launcher timed out after ${timeoutMs}ms`:terminal?message(terminal):stderr||raw||`Native launcher exited ${exitCode} without a model response.`,reviewer,phase):undefined;
 if(failure)recordFailure(failure);
 return {reviewer:reviewer.name,phase,status,stdout:text||raw,rawStdout:raw,stderr,exitCode,sessionId:events.map(e=>e.thread_id??e.session_id).find(v=>typeof v==='string'),runtime:{launcher:reviewer.launcher,executable:reviewer.executable,model:reviewer.model!,responseObserved:status==='completed',resources:[]},failure};
}
