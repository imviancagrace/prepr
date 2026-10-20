import { json, optionalInput } from "../../.shared/core.ts";
import { join } from "node:path";
import { captureDiff, scopePreview } from "../../.shared/scope.ts";
const captured = captureDiff(optionalInput("SCOPE") || "local", process.cwd(), optionalInput("BASE"), Bun.env.ARTIFACTS_DIR);
const previewOnly = optionalInput("PREVIEW_ONLY") === "true";
if (Bun.env.ARTIFACTS_DIR) await Bun.write(join(Bun.env.ARTIFACTS_DIR,"prepr-scope.json"),JSON.stringify({scope:captured.scope,preview:scopePreview(captured.scope),previewOnly,runId:Bun.env.WORKFLOW_ID}));
console.error(`Review scope: ${JSON.stringify(scopePreview(captured.scope))}`);
json({ ...captured, preview: scopePreview(captured.scope), debateCachePath: Bun.env.ARTIFACTS_DIR ? join(Bun.env.ARTIFACTS_DIR, "prepr-debate-cache.json") : "", runId: Bun.env.WORKFLOW_ID || "", previewOnly });
