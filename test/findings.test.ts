import { expect, test } from "bun:test";
import { compare, findings } from "../.archon/workflows/prepr/.shared/core.ts";

const structured = (reviewer: string, entries: object[]) => findings(reviewer, JSON.stringify({ findings: entries }));
test("Vee prose keeps one concern and its question, excluding report metadata", async () => {
  const text = await Bun.file(`${import.meta.dir}/fixtures/vee-review.txt`).text();
  const result = findings("reviewer-a", text);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ file: "a.ts", line: 12, verdict: undefined });
  expect(result[0].evidence).toContain("anonymous requests");
  expect(result[0].evidence).toContain("Proposed question:");
  expect(result[0].sources).toHaveLength(2);
});
test("clean prose and location-only entries cannot fabricate findings", () => {
  for (const text of ["Vee questions:\nNone.\nVee verdict: Ready.\nDefault review:\nNo findings.", "1. a.ts:12\nVee verdict: Ready.", "I’m inspecting a.ts:12\nReview scope: a.ts"]) {
    expect(findings("reviewer-a", text)).toEqual([]);
  }
});
test("preserves a structured final report following process updates", () => {
  expect(findings("reviewer-a", 'I’ll inspect the diff.\n{"findings":[]}')).toEqual([]);
});
test("same-file unrelated claims and ambiguous candidates stay separate", () => {
  const a = structured("reviewer-a", [{ summary: "missing authorization check", file: "a.ts", line: 10, verdict: "issue" }]);
  const b = structured("reviewer-b", [{ summary: "incorrect date formatting", file: "a.ts", line: 200, verdict: "issue" }]);
  expect(compare(a, b).agreements).toHaveLength(0);
  expect(compare(a, b).disputes).toHaveLength(2);
  const candidates = structured("reviewer-b", [
    { summary: "missing authorization check", file: "a.ts", line: 10, verdict: "issue", severity: "high" },
    { summary: "missing authorization check", file: "a.ts", line: 10, verdict: "no_issue", severity: "low" },
  ]);
  expect(compare(a, candidates).agreements).toHaveLength(0);
});
test("matching claims with unknown verdicts need explicit debate conclusions", () => {
  const a = structured("reviewer-a", [{ summary: "missing null check", file: "a.ts", line: 12 }]);
  const b = structured("reviewer-b", [{ summary: "a null check is missing", file: "a.ts", line: 12 }]);
  expect(compare(a, b).disputes).toHaveLength(1);
  expect(compare(a, b).disputes[0]).toHaveLength(2);
});

test("captured branch review retains linked anchors, default-review bullets, and explicit overlap evidence", async () => {
  const a = findings("reviewer-a", await Bun.file(`${import.meta.dir}/fixtures/vee-branch-review.txt`).text(), "/review-repo");
  const b = findings("reviewer-b", await Bun.file(`${import.meta.dir}/fixtures/peer-branch-review.txt`).text(), "/review-repo");
  expect(a).toHaveLength(4);
  expect(b).toHaveLength(3);
  expect(a.map(f => f.line)).toEqual([124, 456, 451, 163]);
  expect(a.slice(0, 3).map(f => f.file)).toEqual(b.map(f => f.file));
  expect(a[0].summary).toContain("editor caps dates");
  expect(a[0].evidence).toContain("Question:");
  expect(a[0].sources?.[0]).toContain("](/review-repo/");
  expect(a[1].sources).toHaveLength(2);
  expect(a[1].sources?.[1]).toContain("default review");
  expect(a[3]).toMatchObject({ severity: "P2", line: 163 });
  expect(a[3].summary).toContain("omits the record ID");
  expect(compare(a, b).agreements).toHaveLength(0);
  expect(a.every(f => f.verdict === undefined)).toBe(true);
});

test("structured absolute and Markdown relative paths normalize to the same checkout anchor", () => {
  const a = findings("reviewer-a", JSON.stringify({ findings: [{ summary: "missing guard", file: "/repo/src/a.ts", line: 12 }] }), "/repo");
  const b = findings("reviewer-b", "1. [Guard](src/a.ts:12)\nQuestion: Is the guard missing?", "/repo");
  expect(a[0].file).toBe("src/a.ts");
  expect(b[0]).toMatchObject({ file: "src/a.ts", line: 12, summary: "Is the guard missing?" });
  const config = findings("reviewer-a", JSON.stringify({ findings: [{ summary: "incorrect build target", file: "/repo/Dockerfile", line: 3 }] }), "/repo");
  expect(config[0]).toMatchObject({ file: "Dockerfile", line: 3 });
});

test("explicit severity mappings compare shared urgency while native and unmapped labels remain intact",()=>{
 const make=(reviewer:string,label:string,map?:Record<string,string>)=>findings(reviewer,JSON.stringify({findings:[{summary:'missing request guard',file:'a.ts',line:1,verdict:'issue',severity:label}]}),process.cwd(),map,reviewer+' profile');
 const a=make('reviewer-a','P1',{P1:'high'}),b=make('reviewer-b','Must fix',{'Must fix':'high'});
 expect(compare(a,b).agreements).toHaveLength(1);
 expect(a[0]).toMatchObject({severity:'P1',severityLevel:'high',severityMappingSource:'reviewer-a profile'});
 expect(b[0].severity).toBe('Must fix');
 expect(compare(a,make('reviewer-b','Should fix',{'Should fix':'medium'})).disputes).toHaveLength(1);
 expect(compare(a,make('reviewer-b','custom')).agreements).toHaveLength(1);
 expect(make('reviewer-b','custom')[0].severityLevel).toBeUndefined();
});
