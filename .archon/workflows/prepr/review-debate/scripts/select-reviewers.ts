import { input, json, selectReviewers } from '../../.shared/core.ts';
import { runtimePrerequisites } from '../../.shared/prerequisites.ts';
import { join } from 'node:path';
const path=Bun.env.ARTIFACTS_DIR?join(Bun.env.ARTIFACTS_DIR,'prepr-preparation.json'):'';
let selected:any;
try {
  selected=selectReviewers(input('REVIEWER_A'),input('REVIEWER_B'),input('REVIEWER_A_LAUNCHER'),input('REVIEWER_B_LAUNCHER'),input('REVIEWER_A_MODEL'),input('REVIEWER_B_MODEL'));
  const validated=runtimePrerequisites(selected);
  if(path)await Bun.write(path,JSON.stringify({...validated.preparation,reviewers:{a:validated.reviewerA,b:validated.reviewerB}},null,2));
  json({...validated,preparationPath:path});
} catch(error) {
  const failure={status:'failed',stage:'select-reviewers',initialReviewsStarted:false,reviewers:selected?{a:selected.reviewerA,b:selected.reviewerB}:undefined,error:String(error),recovery:'Run prepr-setup to check prerequisites, reviewer acceptance and launcher/model confirmation. Neither code review was started. Neither initial review started.'};
  if(path)await Bun.write(path,JSON.stringify(failure,null,2));
  throw new Error(JSON.stringify(failure));
}
