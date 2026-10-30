import {relative,resolve,dirname,basename} from 'node:path';
import {existsSync,realpathSync} from 'node:fs';
const canonical=(path:string):string=>existsSync(path)?realpathSync(path):resolve(dirname(path))===path?path:resolve(canonical(dirname(path)),basename(path));
export type Excluded={path:string;reason:string};
const managed=['.archon/workflows/prepr','.archon/prepr-reviewers','.archon/prepr-backups'];
const generated=['.archon/artifacts','.archon/logs','.archon/cache','.archon/caches','.archon/temp'];
const state=['.archon/prepr.local.yaml','.archon/prepr-install.json','.archon/prepr-prerequisites.json'];
export function outputRoots(root:string,artifactDir?:string) {
  if(!artifactDir)return [];
  const path=relative(canonical(resolve(root)),canonical(resolve(artifactDir)));
  return path&&!path.startsWith('../')&&path!=='..'&&!path.startsWith('/')?[path]:[];
}
export function exclusion(path:string,outputs:string[]=[]):string|undefined {
  const within=(base:string)=>path===base||path.startsWith(base+'/');
  if(managed.some(within)||state.includes(path)||/^\.archon\/\.prepr-stage-[^/]+(?:\/|$)/.test(path))return 'Prepr tooling/state';
  if([...generated,...outputs].some(within))return 'Archon generated output';
}
export function filterPaths(paths:string[],outputs:string[]=[]) {
  const excluded:Excluded[]=[],eligible:string[]=[];
  for(const path of [...new Set(paths)]){const reason=exclusion(path,outputs);if(reason)excluded.push({path,reason});else eligible.push(path);}
  return {eligible,excluded};
}
