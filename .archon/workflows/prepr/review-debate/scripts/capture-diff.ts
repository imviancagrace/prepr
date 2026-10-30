import {json,optionalInput} from '../../.shared/core.ts';
import {join} from 'node:path';
import {captureDiff,scopePreview,EmptyScope} from '../../.shared/scope.ts';
const previewOnly=optionalInput('PREVIEW_ONLY')==='true';
try {
 const captured=captureDiff(optionalInput('SCOPE')||'local',process.cwd(),optionalInput('BASE'),Bun.env.ARTIFACTS_DIR);
 if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,'prepr-scope.json'),JSON.stringify({scope:captured.scope,preview:scopePreview(captured.scope),previewOnly,runId:Bun.env.WORKFLOW_ID}));
 json({...captured,preview:scopePreview(captured.scope),debateCachePath:Bun.env.ARTIFACTS_DIR?join(Bun.env.ARTIFACTS_DIR,'prepr-debate-cache.json'):'',runId:Bun.env.WORKFLOW_ID||'',previewOnly});
}catch(error){
 if(Bun.env.ARTIFACTS_DIR)await Bun.write(join(Bun.env.ARTIFACTS_DIR,'prepr-failure.json'),JSON.stringify({runId:Bun.env.WORKFLOW_ID,stage:'scope capture',cause:'scope',message:String(error),excluded:error instanceof EmptyScope?error.excluded:undefined,initialReviewsStarted:false,recovery:'Inspect eligible project changes and the selected scope; branch review requires a clean checkout.'}));
 throw error;
}
