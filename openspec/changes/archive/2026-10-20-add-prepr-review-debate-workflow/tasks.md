## 1. Superseded command-wrapper prototype

- [x] 1.1 Build and validate the initial command-wrapper proof of concept; superseded because reviewers are skill-equipped agents, not commands.

## 2. Profile and skill selection

- [x] 2.1 Replace command inputs with two reviewer selections and a local-only `.archon/prepr.local.yaml` profile format, and verify direct-reference, named-profile, and default-pair precedence.
- [x] 2.2 Implement local and pinned-GitHub reviewer-skill resolution with actionable source failures, and verify each resolved skill is scoped to its assigned reviewer agent.
- [x] 2.3 Ignore local profile configuration from version control and document profile setup plus one-off overrides, and verify a profile containing a local path is not tracked.

## 3. Skill-equipped reviewer agents

- [x] 3.1 Replace command execution with two fresh, read-only reviewer-agent nodes that load selected skills against the live local checkout, and verify both start in parallel without modifying the checkout.
- [x] 3.2 Implement original-agent session continuation for every debate branch, and verify the resumed agent retains its reviewer skill and receives opposing attributed evidence.
- [x] 3.3 Block PR publication behavior in the workflow contract, and verify an end-to-end run creates no GitHub comments, reviews, PRs, commits, or pushes.

## 4. Comparison, report, and acceptance coverage

- [x] 4.1 Adapt transcript normalization and matching to skill-agent output while retaining raw transcripts, and verify equivalent, reviewer-only, and incompatible findings.
- [x] 4.2 Adapt the private report to profile identities and original-agent debate transcripts, and verify only the three allowed conclusion states appear.
- [x] 4.3 Replace command fixtures with two test reviewer skills and run a local end-to-end pre-PR acceptance scenario that demonstrates parallel review, debate, and a private final report.

## 5. Launcher-aware iterative debate

- [x] 5.1 Add Codex and Claude Code launcher adapters with launcher-aware profile resolution, optional model pinning, and Archon-configured launcher defaults.
- [x] 5.2 Replace one-pass fan-out debate with bounded, session-safe rounds that serialize each original reviewer session while preserving independent reviewer concurrency.
- [x] 5.3 Classify and report confirmed bugs, still-disputed findings, and uncontested findings; retain agree-to-disagree as an unresolved reason.
- [x] 5.4 Add launcher and multi-round acceptance fixtures, verify no session-writer conflict, and document profile configuration plus workflow invocation in the README.

## 6. Archon artifact report delivery

- [x] 6.1 Write the final Markdown summary and complete JSON report to `$ARTIFACTS_DIR` without modifying the reviewed checkout, and return artifact metadata from the report node.
- [x] 6.2 Add artifact-output acceptance coverage and document where users find Prepr reports in Archon's Artifacts tab.

## 7. Declared Archon artifact pointers

- [x] 7.1 Return validated `archon_artifact` pointers for both report files, with `$WORKFLOW_ID` and paths relative to `$ARTIFACTS_DIR`, and declare the report result contract.
- [ ] 7.2 Verify a real Archon run surfaces the declared reports in the Artifacts tab. User will validate manually; automated work must preserve the existing filenames, artifact pointers, and delivery contract.

## 8. Reliable concern normalization and conclusions

- [x] 8.1 Normalize actionable concerns from structured and prose reviewer output while retaining original evidence; verify a Vee-style report groups location, rationale, and question into one concern and excludes headings, process updates, aggregate verdicts, verification summaries, and explicit no-finding statements.
- [x] 8.2 Consolidate repeated descriptions of the same concern and match reviewers only on the same underlying issue; verify unrelated same-file findings stay separate, equivalent wording matches, and ambiguous correspondence cannot become an agreement.
- [x] 8.3 Require explicit shared issue verdicts for confirmed bugs and preserve no-issue and unknown conclusions; verify matching no_issue verdicts and missing verdicts never become confirmed bugs and initial attribution plus complete debate history remain available in JSON.

## 9. Summary for human engineering judgment

- [x] 9.1 Render a short review assessment and concern sections for disagreements, supported agreements, and meaningful withdrawn concerns using the existing reviewer evidence without an additional agent call; verify concise titles and labeled bullets explain the concern, reasoning, Review conclusion, and supported practical significance without implying code implementation by reviewers.
- [x] 9.2 Summarize initial disagreements and their resolutions in one entry, distinguishing A's and B's reasoning and any remaining uncertainty or human decision; verify Why the conclusion changed identifies the reviewer behind the explanation and reflects the final verdict-changing response rather than an earlier reversal, resolved disagreements are not repeated under agreements, and sole-reviewer attribution is not misrepresented as an opposing position.
- [x] 9.3 Retain useful file references and complete evidence in JSON while removing routine workflow metadata and duplicate concern entries from Markdown; verify stance and stop-reason enums, machine conclusion labels, round transcripts, and rejected non-finding metadata are absent, empty sections are omitted, and a clean review has a concise no-concerns assessment. Verify What you need to decide appears only for meaningful unresolved questions, retains differing severity ratings for agreed issues, and omits obsolete severity decisions after a concern is dismissed.
- [x] 9.4 Update README report guidance and acceptance fixtures for unresolved disagreement, agreement reached during debate, initial agreement, useful dismissal, and incomplete evidence; verify distinct reviewer skills yield an understandable summary, the same-skill Vee case does not inflate findings, both artifact files remain available in Archon, and generation introduces no additional reviewer or agent task.


## 10. Explicit committed branch review

- [x] 10.1 Add optional branch scope while retaining local diff as the default; verify remote-default discovery, fetched comparison pinning, preservation of local unpublished commits, exclusion of comparison-only changes, and dirty-checkout rejection.
- [x] 10.2 Pass identical pinned scope to both reviewer sessions and retain it in JSON; verify the real tax-filing branch run completes without modifying its checkout.

## 11. Captured reviewer output and distinct concerns

- [x] 11.1 Preserve descriptive Markdown link anchors, actionable rationale, independent severity-prefixed default-review findings, and explicit overlap evidence; verify against captured Vee and peer-review transcripts.
- [x] 11.2 Let original reviewers explicitly identify duplicate candidate IDs during existing debates; require bilateral confirmation and compatible resolved outcomes for distinct counts while retaining all source evidence and original debate records.
- [x] 11.3 Validate corrected reporting with tests and a replay of the original reviewer sessions; preserve the original run artifacts and document evidence limits.

Validation: 35 Bun tests and both Archon fixtures pass. Replaying the saved tax-filing findings through the original reviewer sessions retains seven original debate records and produces four distinct concerns: three overlapping pairs plus the recovered navigation concern. The navigation scenario remains conditional on duplicate-date data that was not verified. The original Archon artifacts are preserved.


## 12. Explicit scope controls and preview

- [x] 12.1 Complete default local capture for staged, unstaged, and non-ignored untracked work, retain a shared snapshot, and stop empty local scope with branch-mode guidance; verify untracked-only, ignored-only, staged, unstaged, empty, and changed-during-preparation cases without automatic mode switching.
- [x] 12.2 Add an explicit branch `base` input, resolve and pin selected local refs/commits or refreshed remote refs, and reject invalid bases, missing common ancestors, and base overrides in local scope; verify unpublished target commits and the original checkout are preserved and remote-default behavior remains the default.
- [x] 12.3 Add informational scope output and `preview_only=true`, showing mode, target/base refs and applicable SHAs, changed-file count, diff size, and limits; verify normal runs continue without an approval gate and preview-only launches no reviewer/model sessions or remote skill retrieval and does not require reviewer authentication.

## 13. Readiness before either reviewer starts

- [x] 13.1 Resolve both selected launchers and effective models and add bounded read-only readiness probes in the actual execution environment; verify missing launcher, expired authentication, unavailable model, and probe timeout stop both initial code reviews with side-specific guidance, while successful probes do not become findings or reviewer votes.
- [x] 13.2 Add optional profile `required_access` declarations with bounded tool/resource read checks through the selected launcher; verify sandbox-denied and unverifiable required resources fail even when the host can access them, undeclared resources are not claimed as verified, and checks never install tools or change credentials, models, launchers, permissions, or global settings.
- [x] 13.3 Record scope and readiness independently in workflow evidence and order normal preparation before both initial reviews; verify scope-only preview bypasses launcher readiness and a later runtime access failure remains visible rather than being hidden by an earlier successful probe.

## 14. Comparable severity mappings

- [x] 14.1 Add optional local-profile `severity_map` validation for critical/high/medium/low while preserving native labels and mapping provenance; verify invalid destinations fail before review and existing profiles/direct references without a map remain valid with unavailable severity comparison.
- [x] 14.2 Use mapped levels consistently in concern consolidation, comparison, debate compatibility, duplicate reuse, and report urgency decisions; verify explicitly mapped P1/Must fix equality does not create disagreement, different mapped levels retain urgency differences, and unmapped or missing labels do not imply equivalence, disagreement, or an issue verdict.

## 15. Visible verification and preserved caveats

- [x] 15.1 Add a report-opening verification/limitations summary from recorded reviewer evidence with passed/failed/blocked/not-run/unknown status, attribution, and tested snapshot where known; verify legacy or missing metadata stays unknown and readiness success is not presented as passing project tests.
- [x] 15.2 Preserve material preconditions, unverified data assumptions, and freshness/execution limits with affected concern summaries; verify shortening retains the navigation finding's duplicate-date-data caveat and never changes a conditional static concern into a reproduced failure.

## 16. Reuse confirmed duplicate discussions

- [x] 16.1 Before resuming a pending dispute, check same-run/same-scope resolved outcomes and both original reviewers' explicit confirmations of its finding ID; verify a fully compatible duplicate skips repeated discussion while one-sided confirmation, changed evidence/scope, invalid IDs, incomplete or unresolved outcomes, agree-to-disagree, conflicting verdicts, and differing mapped urgency retain separate debate.
- [x] 16.2 Represent inherited results with source finding IDs, originating discussion, both confirmations, and pinned scope, preserving original missing verdicts and all actual reviewer turns; verify reused concerns count once, no fake rounds are generated, and graph/transcript output makes reuse visible without concurrent resumes of a session.

## 17. Documentation and acceptance of the follow-up

- [x] 17.1 Update README, local-profile examples, workflow input descriptions, and fixtures for readiness, scope previews, base selection, severity mappings, evidence limits, and duplicate reuse; verify documented invocations resolve and existing profiles and report filenames remain compatible.
- [x] 17.2 Run focused regression tests and declared Archon fixtures plus a controlled end-to-end acceptance covering scope preview, early readiness failure, successful dual review, mapped severity, caveat retention, and skipped duplicate discussion; verify both private report artifacts preserve evidence and the reviewed checkout remains unchanged. Keep this validation separate from the earlier 35-test/replay evidence.


Follow-up validation: 44 Bun tests and all three declared Archon fixtures pass. Controlled real Archon runs verified successful scope-only preview (`0b3c91c9b94fc429d4a2c1d4c476530b`), a completed dual-review run with one real discussion and one explicitly reused result (`01b0a00ceb346834923633fcd054f142`), and early readiness failure with neither initial reviewer started (`6ed1cd2674d8cceaef1c45648e285643`). The completed run returned the original `prepr-report.md` / `prepr-report.json` artifact pointer format. Fake launchers and a disposable Git checkout isolated this acceptance from user code and model authentication. Task 7.2 remains for the user's manual UI validation, as requested.
