const request = await Bun.stdin.json();
await Bun.sleep(150);
if (request.phase === "initial") {
  console.log(JSON.stringify({ findings: [{ summary: "src/auth.ts:12 missing null guard", file: "src/auth.ts", line: 12, severity: "high" }] }));
} else {
  console.log(JSON.stringify({ verdict: "issue", rationale: "The dereference can throw.", confidence: "high" }));
}
