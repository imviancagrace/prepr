import {test,expect} from 'bun:test';
import {mkdtemp,rm,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {failureDetail} from '../.archon/workflows/prepr/.shared/failures.ts';
const native=resolve(import.meta.dir,'../.archon/workflows/prepr/.shared/native.ts');
test('terminal model error cancels a sibling and kills a hanging owned process group without extra model calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-native-failure-'));
 try{
  const fail=join(dir,'fail'),slow=join(dir,'slow');
  await Bun.write(fail,`#!/usr/bin/env bun\nawait Bun.sleep(200);console.error('Optional MCP OAuth refresh failed');console.log(JSON.stringify({type:'turn.failed',error:{message:JSON.stringify({error:{message:"The model is not supported for this account",code:'model_not_found'}})}}));setInterval(()=>{},1000);process.on('SIGTERM',()=>{});`);
  await Bun.write(slow,`#!/usr/bin/env bun\nsetInterval(()=>{},1000);process.on('SIGTERM',()=>{});`);await chmod(fail,0o755);await chmod(slow,0o755);
  const start=(name:string,path:string)=>Bun.spawn(['bun','--eval',`import {runNative} from ${JSON.stringify(native)}; console.log(JSON.stringify(await runNative([],{name:${JSON.stringify(name)},launcher:'codex',model:'fixture',reference:'unused',skillPath:'unused',executable:{path:${JSON.stringify(path)},version:'fixture'}},'initial',10000)));`],{env:{...Bun.env,ARTIFACTS_DIR:dir,WORKFLOW_ID:'cancel-test'},stdout:'pipe',stderr:'pipe'});
  const began=Date.now(),a=start('Vee',fail),b=start('Travis',slow);
  const [ra,rb]=await Promise.all([new Response(a.stdout).json(),new Response(b.stdout).json()]);await Promise.all([a.exited,b.exited]);
  expect(Date.now()-began).toBeLessThan(4000);expect(ra.status).toBe('failed');expect(ra.failure.cause).toBe('model compatibility');expect(ra.failure.message).not.toContain('MCP');expect(rb.status).toBe('cancelled');
  const evidence=await Bun.file(join(dir,'prepr-failure.json')).json();expect(evidence.reviewer).toBe('Vee');expect(evidence.executable.path).toBe(fail);
  await rm(join(dir,'prepr-failure.json'));
  const both=await Promise.all(['Vee','Travis'].map(async name=>{const p=start(name,fail);const r=await new Response(p.stdout).json();await p.exited;return r;}));
  expect(both.some(r=>r.status==='failed')).toBe(true);expect(both.every(r=>['failed','cancelled','not_started'].includes(r.status))).toBe(true);
  const first=await Bun.file(join(dir,'prepr-failure.json')).json();expect(['Vee','Travis']).toContain(first.reviewer);expect(first.cause).toBe('model compatibility');
 }finally{await rm(dir,{recursive:true,force:true});}
},10000);
test('error classification does not treat every startup warning as the terminal cause',()=>{
 const reviewer={name:'Vee',launcher:'codex' as const,model:'selected',reference:'x',skillPath:'x'};
 expect(failureDetail('Authentication expired',reviewer,'initial').cause).toBe('authentication');expect(failureDetail('Launcher timed out',reviewer,'initial').cause).toBe('timeout');expect(failureDetail('Unexpected exit',reviewer,'debate').cause).toBe('execution');
});

test('timeouts, nonzero exits, optional warnings and already completed/not-started siblings preserve their actual outcomes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'prepr-native-outcomes-'));const unrelated=Bun.spawn(['bun','--eval','setInterval(()=>{},1000)'],{stdout:'ignore',stderr:'ignore'});
 try{
  const invoke=async(name:string,body:string,timeout=1000,run='outcome')=>{
   const bin=join(dir,name);await Bun.write(bin,'#!/usr/bin/env bun\n'+body);await chmod(bin,0o755);
   const p=Bun.spawn(['bun','--eval',`import {runNative} from ${JSON.stringify(native)};console.log(JSON.stringify(await runNative([],{name:${JSON.stringify(name)},launcher:'claude',model:'fixture',reference:'x',skillPath:'x'},'initial',${timeout})));`],{env:{...Bun.env,PREPR_CLAUDE_BIN:bin,ARTIFACTS_DIR:join(dir,run),WORKFLOW_ID:run},stdout:'pipe',stderr:'pipe'});
   const output=await new Response(p.stdout).json();expect(await p.exited).toBe(0);return output;
  };
  const done=await invoke('completed',`console.error('Optional MCP connection failed');console.log(JSON.stringify({type:'result',session_id:'session',result:'{"findings":[]}'}));`);
  expect(done.status).toBe('completed');expect(done.stderr).toContain('MCP');
  const bad=await invoke('failed',`console.error('Authentication expired');process.exit(1);`);expect(bad.status).toBe('failed');expect(bad.failure.cause).toBe('authentication');expect(done.status).toBe('completed');
  const skipped=await invoke('skip',`throw Error('Should never launch');`);expect(skipped.status).toBe('not_started');expect(skipped.stderr).toContain('failed');
  const timeout=await invoke('slow',`console.error('Optional warning');setInterval(()=>{},1000);process.on('SIGTERM',()=>{});`,100,'timeout');expect(timeout.status).toBe('timed_out');expect(timeout.failure.cause).toBe('timeout');
  expect(unrelated.exitCode).toBeNull();
 }finally{unrelated.kill();await unrelated.exited;await rm(dir,{recursive:true,force:true});}
},10000);
