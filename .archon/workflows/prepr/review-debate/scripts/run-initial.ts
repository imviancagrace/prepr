import { input, optionalInput, json, runInitialAgent, type Reviewer } from "../../.shared/core.ts";
import type { ReviewScope } from "../../.shared/scope.ts";

const scope = JSON.parse(optionalInput("SCOPE") || "null") as ReviewScope | null;
const result = await runInitialAgent(JSON.parse(input("REVIEWER")) as Reviewer, 600_000, scope ?? undefined);
const path = optionalInput("READINESS_PATH");
const readiness = path ? (await Bun.file(path).json())[optionalInput("REVIEWER_SIDE")] : JSON.parse(optionalInput("READINESS") || "null");
json({ ...result, readiness });
