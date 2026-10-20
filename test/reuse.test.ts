import {expect,test} from 'bun:test';
import {reuseDiscussion} from '../.archon/workflows/prepr/.shared/reuse.ts';
import {type Debate,type Finding} from '../.archon/workflows/prepr/.shared/core.ts';
import {buildReport,markdownReport} from '../.archon/workflows/prepr/review-debate/scripts/reporting.ts';
const a:Finding={id:'reviewer-a-1',reviewer:'reviewer-a',summary:'missing request guard',file:'a.ts',line:1,evidence:'Anonymous requests throw.',verdict:'issue',severityLevel:'high'};
const b:Finding={...a,id:'reviewer-b-1',reviewer:'reviewer-b',summary:'anonymous requests crash'};
const scope={mode:'branch' as const,targetSha:'target',baseSha:'base',startingPointSha:'base',freshness:'pinned'};
const source:Debate={dispute:[a],rounds:[{round:1,reviewerA:{status:'completed'} as never,reviewerB:{status:'completed'} as never,positionA:{stance:'maintain',verdict:'issue',rationale:'Anonymous requests throw.',sameConcernAs:[b.id]},positionB:{stance:'accept',verdict:'issue',rationale:'Confirmed.',sameConcernAs:[b.id]}}],stopReason:'agreement',conclusion:'converged-on-issue'};
test('reuse requires bilateral unchanged scope evidence, resolved verdicts and compatible mapped urgency',()=>{
 const reused=reuseDiscussion(source,[a,b],[b],[a,b],scope,'run')!;
 expect(reused.stopReason).toBe('reused');expect(reused.rounds).toHaveLength(0);
 expect(reused.reuse?.runId).toBe('run');
 for(const modified of [
  {...source,conclusion:'unresolved' as const},
  {...source,stopReason:'incomplete' as const},
  {...source,stopReason:'agree_to_disagree' as const},
  {...source,rounds:[{...source.rounds[0],positionA:{...source.rounds[0].positionA,severityLevel:'high'},positionB:{...source.rounds[0].positionB,severityLevel:'low'}}]},
  {...source,rounds:[{...source.rounds[0],positionB:{...source.rounds[0].positionB,sameConcernAs:[]}}]},
  {...source,rounds:[{...source.rounds[0],positionA:{...source.rounds[0].positionA,correctedFinding:'Material new trigger'}}]},
 ]) expect(reuseDiscussion(modified,[a,b],[b],[a,b],scope,'run')).toBeUndefined();
 for(const changed of [{...b,evidence:'New evidence'},{...b,severityLevel:'low'},{...b,verdict:'no_issue'},{...b,id:'unknown'},{...b,line:2}])expect(reuseDiscussion(source,[a,b],[changed],[a,changed],scope,'run')).toBeUndefined();
 expect(reuseDiscussion(source,[a,b],[b],[{...a,evidence:'changed source'},b],scope,'run')).toBeUndefined();
});
test('reused results count once and retain source proof without invented rounds; wrong-run links fail closed',()=>{
 const reused=reuseDiscussion(source,[a,b],[b],[a,b],scope,'run')!;
 const initialReviews={a:{scope},b:{scope}} as never;
 const comparison={runId:'run',reviewers:{a:'A',b:'B'},findings:[a,b],agreements:[],initialReviews};
 const data=buildReport(comparison,[source,reused]);
 expect(data.confirmedBugs).toHaveLength(1);expect(data.debates).toHaveLength(2);
 expect(data.debates[1].rounds).toHaveLength(0);expect(data.concerns[0].dispute).toHaveLength(2);
 expect(markdownReport(data).match(/^### /gm)).toHaveLength(1);
 expect(buildReport({...comparison,runId:'another-run'},[source,reused]).stillDisputed).toHaveLength(1);
 expect(buildReport({...comparison,initialReviews:{a:{scope:{...scope,targetSha:'changed'}},b:{scope}} as never},[source,reused]).stillDisputed).toHaveLength(1);
});
