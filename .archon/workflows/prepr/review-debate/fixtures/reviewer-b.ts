const request = await Bun.stdin.json();
await Bun.sleep(150);
if (request.phase === "initial") console.log(JSON.stringify({ findings: [] }));
else console.log(JSON.stringify({ verdict: "issue", rationale: "The supplied evidence establishes the missing guard.", confidence: "high" }));
