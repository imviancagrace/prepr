import { input, json, selectReviewers } from "../../.shared/core.ts";
import { reviewersReady } from "../../.shared/readiness.ts";
import { join } from "node:path";
const selected = selectReviewers(input("REVIEWER_A"), input("REVIEWER_B"), input("REVIEWER_A_LAUNCHER"), input("REVIEWER_B_LAUNCHER"), input("REVIEWER_A_MODEL"), input("REVIEWER_B_MODEL"));
const readiness = await reviewersReady(selected.reviewerA, selected.reviewerB);
const readinessPath = Bun.env.ARTIFACTS_DIR ? join(Bun.env.ARTIFACTS_DIR, "prepr-readiness.json") : "";
if (readinessPath) await Bun.write(readinessPath, JSON.stringify(readiness, null, 2));
if (!readiness.ready) throw new Error(JSON.stringify({ message: "Neither code review was started because readiness failed.", readiness }));
json({ ...selected, readiness, readinessPath });
