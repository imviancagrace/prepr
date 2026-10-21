import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// The invoking skill obtains this checkout from remote main; it is not an author's laptop path.
const [source,action,...args]=process.argv.slice(2);
try {
 const api=await import(pathToFileURL(resolve(source,'.archon/workflows/prepr/.shared/reviewers.ts')).href);
 const load=async(p:string)=>await Bun.file(p).json();
 let result;
 if(action==='inspect') result=api.inspectSource(args[1],args.slice(2),undefined,args[0]);
 else if(action==='draft') {const r=await load(args[1]);result=api.draftReviewer(args[0],r.reference,r.standard,r.extraction,r.inputs);}
 else if(action==='preview') result=api.previewReviewer(args[0],args[1]);
 else if(action==='accept') result=api.acceptReviewer(args[0],args[1],args[2],args[3]);
 else if(action==='check') result=api.resolveAccepted(args[1],args[0]);
 else throw new Error('Use <fresh-prepr-source> inspect <project> <skill> [read-paths...] | draft <project> <request.json> | preview <project> <id> | accept <project> <id> <digest> <accept|reject> | check <project> <skill>.');
 console.log(JSON.stringify(result,null,2));
} catch(e) {console.error(JSON.stringify({status:'blocked',error:String(e)}));process.exitCode=1;}
