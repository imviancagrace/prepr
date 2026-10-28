import type { RequiredAccess, Reviewer, ReviewResult } from './core.ts';
// Require a successful tool event as well as the probe's claim; host access is not evidence.
export function observedRead(raw: string, access: RequiredAccess) {
  const events = raw.split("\n").flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  for (const event of events) {
    const item = event.item;
    if (item?.type === "command_execution" && item.exit_code === 0 && String(item.command).includes(access.resource)) {
      if (access.tool === "gh" && /gh api --method GET/.test(item.command)) return true;
      if (access.tool === "git" && /git ls-remote/.test(item.command)) return true;
      if (access.tool === "file" && /(?:cat|head|readFile|open\()/.test(item.command)) return true;
    }
    // Claude emits tool_use and matching tool_result records rather than command events.
    for (const use of Array.isArray(event.message?.content) ? event.message.content : []) {
      if (use.type !== "tool_use") continue;
      const allowed = access.tool === "file" ? use.name === "Read" && use.input?.file_path === access.resource
        : use.name === "Bash" && String(use.input?.command).includes(access.resource) && (access.tool === "gh" ? /gh api --method GET/.test(use.input.command) : /git ls-remote/.test(use.input.command));
      if (allowed && events.some(result => Array.isArray(result.message?.content) && result.message.content.some((block: any) => block.type === "tool_result" && block.tool_use_id === use.id && !block.is_error))) return true;
    }
  }
  return false;
}

export function runtimeAccess(result:ReviewResult,reviewer:Reviewer,model:string):ReviewResult {
  const declarations=[...(reviewer.requiredAccess??[]).map(a=>({...a,required:true})),...(reviewer.runtimeAccess??[])];
  const resources=[...new Map(declarations.map(a=>{const key=JSON.stringify([a.tool,a.resource]);return [key,{...a,required:declarations.some(b=>JSON.stringify([b.tool,b.resource])===key&&b.required)}] as const;})).values()].map(a=>({...a,status:observedRead(result.rawStdout||'',a)?'verified':'unverifiable'}));
  const missing=resources.filter(a=>a.required&&a.status!=='verified');
  return {...result,runtime:{launcher:reviewer.launcher,model,responseObserved:result.status==='completed'&&Boolean(result.stdout.trim()),resources},...(missing.length?{status:'failed' as const,stderr:[result.stderr,`Required resource access blocked/incomplete: ${missing.map(a=>`${a.tool} ${a.resource}`).join(', ')}. Check resource access in the selected launcher; no additional permissions were requested.`].filter(Boolean).join('\n')}:{} )};
}
