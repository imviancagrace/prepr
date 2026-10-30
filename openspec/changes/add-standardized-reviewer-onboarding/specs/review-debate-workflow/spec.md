## MODIFIED Requirements

### Requirement: Explicit local and branch scope selection
The system SHALL default to `scope=local`, selecting eligible staged and unstaged tracked changes plus eligible non-ignored untracked content after the tooling exclusion policy. It MUST select committed branch changes only when `scope=branch` is explicitly supplied. Empty local scope MUST stop before either reviewer starts, report that no eligible project changes were found, explain tooling exclusions when applicable, and suggest explicit branch scope only when appropriate without switching modes. Invalid scope MUST fail with actionable guidance.

Branch scope MUST require a clean checkout and pin local HEAD, the comparison SHA, and their merge base before either reviewer starts. With no explicit base, it MUST verify the default branch directly from `origin` and fetch that comparison branch. An explicit `base` input MUST select the comparison ref instead; it MUST be resolved and pinned without silently falling back to another base. Remote-backed explicit bases MUST be refreshed; explicit local refs or commits MUST retain the selected local revision and disclose that freshness basis. A base override with local scope MUST fail rather than being ignored. An unresolved base or missing common ancestor MUST stop before review.

The branch diff MUST run from the merge base to local HEAD, excluding comparison-only commits. It MUST preserve local commits and MUST NOT check out, fast-forward, or replace the target with a remote revision. Dirty work or a changed HEAD during preparation MUST stop capture rather than silently change scope. Both initial reviewer results MUST retain identical selected scope metadata in JSON.

The system MUST exclude installed Prepr workflow code and local setup/reviewer state, plus known Archon-generated reports/artifacts, logs and caches, from review targets independently of Git ignore, tracking, staging or commit state. This policy MUST apply to local and committed branch scopes before review content snapshots, patches or launcher payloads are produced. Only bounded managed/generated locations MUST be excluded; unrelated authored workflows, application files and archives MUST NOT be excluded merely because they are untracked, large or have a similar name. Approved reviewer instructions MUST remain loadable separately and MUST NOT become review targets.

The same filter MUST govern captured content, eligible file lists, file counts/diff sizes and eligible local-snapshot identity. Excluded content MUST NOT leak through patch entries, renames or untracked payload encoding. A tooling-only change after local capture MUST NOT invalidate unchanged eligible project evidence. If no eligible changes remain in the selected scope, capture MUST stop before reviewers with 'No project changes to review', explain relevant exclusions and MUST NOT silently change mode or review the entire repository. The existing branch clean-checkout guard MUST remain separate and MUST NOT be bypassed by this review-target filter.

#### Scenario: Default local scope contains untracked work
- **WHEN** the user omits scope and the checkout contains non-ignored untracked files or tracked staged or unstaged changes
- **THEN** the preview and both reviewers include the eligible selected local changes
- **AND** ignored files and managed tooling/generated artifacts are excluded

#### Scenario: Local scope is empty
- **WHEN** local scope is selected and no selected local changes exist
- **THEN** the workflow stops before launching reviewers and suggests explicitly choosing branch scope
- **AND** it does not review committed changes or the whole repository automatically

#### Scenario: Clean local branch contains unpublished commits
- **WHEN** branch scope is selected and local HEAD contains unpublished commits
- **THEN** both reviewers inspect the pinned local HEAD against the merge base with the selected comparison revision
- **AND** the checkout is preserved and comparison-only changes are excluded

#### Scenario: User selects a comparison base
- **WHEN** the user supplies branch scope and an explicit resolvable base
- **THEN** the preview and both reviewers use that pinned comparison revision instead of the remote default
- **AND** the report distinguishes refreshed remote evidence from explicitly selected local evidence

#### Scenario: Base selection cannot be honored
- **WHEN** the selected base cannot be resolved, has no common ancestor, or is supplied with local scope
- **THEN** preparation stops with an actionable error and does not choose a replacement base

#### Scenario: Branch scope is requested with local work
- **WHEN** tracked or non-ignored untracked local changes are present
- **THEN** branch capture stops with an actionable clean-checkout error rather than omitting that work silently

#### Scenario: Tooling is staged with application changes
- **WHEN** local scope includes staged Prepr workflow or Archon-generated files alongside application edits
- **THEN** captured patches, content snapshots and reviewer inputs include only eligible application changes
- **AND** tooling staging/tracking state does not bypass the exclusion policy

#### Scenario: Committed branch diff includes tooling
- **WHEN** a clean branch contains committed Prepr tooling or known Archon-generated artifacts plus eligible project changes
- **THEN** both reviewers receive the same pinned branch comparison filtered to eligible project changes
- **AND** excluded content does not enter patches or counts merely because it is committed

#### Scenario: Only tooling changed
- **WHEN** all candidate changes in the selected scope fall under the tooling exclusion policy
- **THEN** capture reports no project changes to review and stops before reviewer selection or launcher calls
- **AND** it explains exclusions without switching scope or claiming a completed review

#### Scenario: Excluded local state changes after capture
- **WHEN** only excluded tooling/state changes after an eligible local snapshot was captured
- **THEN** the eligible snapshot identity remains valid
- **AND** subsequent eligible project changes still invalidate the snapshot

#### Scenario: Rename crosses an exclusion boundary
- **WHEN** a selected rename moves a file between an excluded managed path and an eligible project path
- **THEN** scope represents the eligible-side change without exporting excluded-side contents
- **AND** unusual file names do not escape or broaden the path policy

#### Scenario: Reviewer package resides in excluded state
- **WHEN** the selected accepted reviewer package is stored under excluded Prepr state
- **THEN** the workflow loads that package as approved reviewer instructions separately
- **AND** it does not include the package or runtime artifacts as changed project review targets


### Requirement: Informational scope preview
The system SHALL display the selected mode, target, comparison base and pinned revisions when applicable, changed-file count, diff size, and exclusions or evidence limitations before either reviewer starts. It MUST then continue automatically without a human approval gate. A `preview_only=true` input MUST display the scope and exit before launching reviewer or model-probe sessions or resolving remote reviewer skills. Scope-only preview MAY perform the Git reads and fetches required by the selected scope. Its selected revisions and limits MUST match the normal capture behavior, and a later review invocation MUST capture scope again rather than claim the preview remains current.

Preview MUST apply the same tooling filter as a normal run and briefly disclose excluded-file/category counts and reasons. Detailed exclusion paths/reasons MUST remain in JSON without copying excluded payloads into review inputs. Preview MUST distinguish eligible project counts/diff size from excluded tooling and MUST follow the same no-eligible-changes stop behavior.

#### Scenario: Normal run previews and continues
- **WHEN** a valid review scope has been captured for a normal run
- **THEN** the workflow displays its scope summary and proceeds once readiness checks pass without waiting for human approval

#### Scenario: Scope-only preview
- **WHEN** the user supplies `preview_only=true`
- **THEN** the workflow displays scope and exits without reviewer sessions, model probes, or remote reviewer-skill retrieval
- **AND** unavailable reviewer authentication does not prevent an otherwise valid Git scope preview

#### Scenario: Preview shows tooling exclusions
- **WHEN** capture excludes managed tooling or Archon-generated output from a mixed scope
- **THEN** preview shows a concise exclusion summary and eligible project counts/diff size
- **AND** normal capture uses the same policy without an additional approval gate


### Requirement: Original-agent debate
For every material disagreement not covered by a valid confirmed duplicate reuse, the system SHALL continue the same original reviewer agent that produced each side's initial position through bounded debate rounds. A round MUST give reviewer A reviewer B's latest attributed position, then give reviewer B reviewer A's resulting latest position. Each response MUST state `maintain`, `revise`, `accept`, or `agree_to_disagree`, with rationale, corrected finding when applicable, and confidence. Process updates before a final structured response MUST NOT hide its explicit verdict or duplicate IDs; absent structured verdicts MUST remain unverified. The workflow MUST NOT resume a single reviewer session concurrently, substitute a generic debate agent, or replace its reviewer skill. Separate reviewer sessions MAY proceed independently.

Included debate blocks MUST receive required parent context explicitly and resolve references within their own execution scope. Parent-only references MUST NOT fail during include/fan-out expansion. Initial-review results and raw transcripts MUST be transported as literal evidence, for example through run-scoped artifact references loaded inside the debate script. Quoted `$node.output`-style text inside review evidence MUST NOT be re-evaluated as workflow configuration, stripped from evidence or treated as a reason to rewrite a reviewer skill. A fatal debate-turn error, reference-resolution failure or missing required debate result MUST fail the run, stop further debate scheduling, and retain available original-review and discussion evidence for reporting. Successful report rendering MUST NOT turn upstream orchestration failure into a successful run. Missing debate evidence MUST NOT be reported as proof that an initial reviewer failed. Existing serial session safety, bilateral duplicate reuse and bounded rounds MUST remain intact.

#### Scenario: Both original agents revisit a dispute
- **WHEN** the system identifies a material disagreement without a valid confirmed duplicate reuse
- **THEN** both original reviewer agents are re-invoked for that disagreement with the opposing attributed position and evidence

#### Scenario: A progress message precedes a final debate response
- **WHEN** a reviewer emits process updates followed by a final structured response
- **THEN** the system extracts the final stance, verdict, rationale, and duplicate IDs
- **AND** process text without a valid verdict cannot establish a shared conclusion

#### Scenario: Debate stops without forced agreement
- **WHEN** both reviewers explicitly choose `agree_to_disagree`, no response materially changes, or the configured maximum of three rounds is reached
- **THEN** the system stops debating that finding and retains the latest attributed positions for human engineering judgment

#### Scenario: Included debate requires parent scope context
- **WHEN** real include/fan-out expansion starts a discussion after two completed initial reviews
- **THEN** the included block resolves its supplied inputs without reaching for unavailable parent node outputs
- **AND** both original sessions can continue under the existing debate contract

#### Scenario: Review evidence quotes a workflow expression
- **WHEN** an eligible source file or raw reviewer transcript contains literal `$capture-diff.output.previewOnly` or other workflow-like expressions
- **THEN** included debate receives that text unchanged as evidence without resolving it as a node reference
- **AND** both original reviewer sessions remain reusable without changing their accepted skills

#### Scenario: Debate orchestration fails after initial review
- **WHEN** debate reference resolution or execution fails after both initial reviewers completed
- **THEN** the workflow reports a failed discussion stage, stops further discussion work and preserves completed initial results
- **AND** the final report is produced without claiming a failed initial review or overall successful run


### Requirement: Reviewer skill resolution
The system SHALL resolve a reviewer skill from either a local skill source or a GitHub source pinned to an immutable revision. A GitHub source MUST be used only to obtain the reviewer skill; the workflow MUST NOT inspect, create, modify, or comment on a GitHub pull request.


Resolved source identity MUST map to a current locally accepted standardized reviewer package before either initial review starts. Named profiles, default selections, direct references, and bundled reviewers MUST all obey this requirement. Raw, unsupported, stale, or unaccepted selections MUST fail with side-specific preparation guidance and MUST NOT fall back to loading the original workflow instructions. Normal runs MUST NOT prepare or accept candidates or mutate reviewer configuration. Scope-only preview MUST remain exempt.
#### Scenario: Pinned GitHub skill source
- **WHEN** a selected profile references a GitHub reviewer skill at a pinned revision
- **THEN** the system resolves that revision for the assigned reviewer agent without treating any GitHub PR as review scope

#### Scenario: Direct reference bypass is attempted
- **WHEN** a direct skill source has no matching accepted standardized package
- **THEN** the run stops before either initial review with guidance to onboard that source

#### Scenario: Reviewer registration is unchanged
- **WHEN** both resolved sources match current accepted standardized packages
- **THEN** the workflow uses their accepted effective packages without prompting for human acceptance again

### Requirement: Independent pre-PR reviewer agents
The system SHALL start exactly two independent reviewer agents, each with its selected reviewer skill, against the same selected local review scope: the current uncommitted Git diff by default, or an explicitly selected pinned committed branch diff. Reviewer-specific behavior MUST come from the selected skill; the workflow MUST NOT supply a default review prompt. The workflow MUST run against the developer's live checkout without a worktree and MUST constrain reviewer agents to read-only review activity.


The selected reviewer skill MUST be represented by its accepted effective reviewer package. A shared versioned output and debate envelope MAY specify structure and evidence fields but MUST NOT add default code-review criteria or homogenize reviewer voice, standards, or native severity labels. Raw source instructions for extra reviewers, snapshot mutation, PR publication, or installation MUST NOT be loaded into these sessions. Questions and hypotheses MUST retain uncertainty instead of receiving an invented issue verdict. JSON evidence MUST retain effective reviewer version and source/acceptance provenance; report artifact names and pointer contracts MUST remain unchanged.
#### Scenario: Two skills review the same local change
- **WHEN** a user starts a run in a Git working tree with a local diff and two resolved reviewer selections
- **THEN** the system starts two independent reviewer agents in parallel with access to that same checkout and diff

#### Scenario: Review remains private
- **WHEN** either reviewer agent completes review or debate
- **THEN** the system retains its result inside the Archon workflow and does not publish a GitHub comment, review, or pull request update

#### Scenario: A source reviewer requests another review pass
- **WHEN** its accepted adaptation excludes extra-agent orchestration
- **THEN** Prepr launches only its two independent original reviewers using their accepted review instructions

#### Scenario: A question-led reviewer emits structured output
- **WHEN** a reviewer raises a question without asserting a defect
- **THEN** its question and rationale remain attributable without an inferred issue verdict


### Requirement: Reviewer readiness before review
Before either initial reviewer starts, the system SHALL perform bounded, non-model validation of required executables and supported prerequisite versions, installed workflow/configuration integrity, both current accepted reviewer packages, effective launcher/model compatibility, and matching project-local prerequisite confirmation. This contract MUST apply equally to Claude, Codex, and mixed-launcher pairs, including named profiles and direct overrides. The workflow MUST NOT start a separate AI readiness/model-probe session. Missing or stale prerequisite confirmation MUST stop both initial launches with setup guidance; normal runs MUST NOT prompt, record confirmation, install tools, authenticate, or switch launchers/models/accounts automatically. Scope-only preview MUST remain independent of reviewer registration, launcher login, and prerequisite confirmation.

A matching confirmation SHALL attest only that the user reported being logged in and able to use the effective models. It MUST NOT be described as observed authentication, model entitlement, or resource access. The actual selected reviewer sessions establish runtime login/model behavior and perform any declared resource reads under their existing permissions. Failed or unverifiable required runtime access MUST leave the affected assessment blocked/incomplete rather than claim a complete review; optional missing resources MUST be disclosed as limitations. Host access and user confirmation MUST NOT count as observed reviewer access. Essential review-standard availability remains enforced during onboarding.

Actual-session authentication/model errors and timeouts MUST remain attributable operational failures. Once both sides have passed static validation, one side’s actual startup failure MUST NOT be reported as proof that neither side started. Available evidence MUST be retained for final failure reporting; successful static checks or confirmation MUST NOT overwrite observed failures.

A fatal execution failure observed in either actual initial reviewer MUST promptly cancel the sibling session owned by the same run, stop progression to comparison/debate, and make the run fail while retaining diagnostic reports. Cancellation MUST begin when the failure is known rather than waiting for the sibling's completion. Structured terminal launcher errors, nonzero exits and timeouts MUST be recognized without depending solely on process shutdown. A concern, uncertain verdict or unrelated optional-plugin warning alone MUST NOT trigger fatal cancellation. The system MUST preserve a completed sibling's evidence and distinguish failed, cancelled, not-started and unknown states. It MUST NOT cancel the Archon service or unrelated sessions, retry with another account/model, or expand permissions automatically.

Failure diagnostics MUST name the reviewer and side, observed executable path/version, launcher, requested model and actual stage when known. Structured terminal errors MUST take precedence over incidental stderr warnings, while original diagnostics remain in JSON. Authentication, client/account model incompatibility, timeout, required-access failure and unknown causes MUST be distinguished only when supported by evidence. An observed model rejection MUST NOT be generalized into a permanent account-entitlement claim. Static readiness and confirmation MUST still apply to both runners before launch, without introducing separate AI probes or claiming runtime access is proven in advance.

#### Scenario: One actual runner fails while its sibling is active
- **WHEN** either initial reviewer emits a fatal authentication, model, access or execution error while its sibling is running
- **THEN** cancellation is requested promptly for that sibling and comparison/debate does not start
- **AND** the run fails with preserved primary diagnostics and the sibling's actual cancellation or completion state

#### Scenario: Terminal model rejection accompanies an optional MCP warning
- **WHEN** a native session emits both an optional MCP warning and a terminal model-not-supported error
- **THEN** the user-facing failure identifies the model rejection as primary and includes the selected executable/version and model
- **AND** JSON retains both diagnostics without claiming the warning caused the fatal error


#### Scenario: Shared static checks pass
- **WHEN** both reviewer packages and required static checks pass and matching local confirmation covers the selected effective launchers/models
- **THEN** the workflow proceeds directly to its two actual independent reviewer sessions without a separate readiness AI session
- **AND** the same behavior applies to Claude-only, Codex-only, and mixed pairs

#### Scenario: One reviewer is not ready
- **WHEN** either side lacks a required executable, supported prerequisite, accepted reviewer package, or valid launcher/model configuration
- **THEN** neither initial reviewer starts and the workflow reports the affected check and actionable recovery guidance

#### Scenario: Confirmation is absent or stale
- **WHEN** no matching project-local confirmation exists for the effective launchers/models, including a changed tier resolution or direct override
- **THEN** neither initial reviewer starts and the workflow directs the user to setup for explicit confirmation
- **AND** no confirmation prompt or state mutation occurs during the run

#### Scenario: Login expired after confirmation
- **WHEN** the actual selected reviewer session cannot authenticate despite a matching prerequisite confirmation
- **THEN** its failure is reported as an actual-session authentication failure with login guidance
- **AND** confirmation is not represented as proof of current login

#### Scenario: Host access differs from reviewer access
- **WHEN** a required resource is readable by the host but cannot be read by the actual reviewer under its selected permissions
- **THEN** the affected assessment remains blocked/incomplete with the access limitation preserved
- **AND** no permission expansion or extra model probe is attempted

#### Scenario: No required resource declarations
- **WHEN** profiles and reviewer packages declare no additional required runtime resources
- **THEN** no separate access checks or AI probe sessions are required before the actual reviews
- **AND** the workflow does not claim undeclared dependencies have been verified

#### Scenario: Scope-only preview without setup confirmation
- **WHEN** a user requests preview-only scope capture without accepted reviewers or prerequisite confirmation
- **THEN** scope capture remains available without reviewer/model sessions or new consent

### Requirement: Final attributed report
The system SHALL produce a private Archon report for a human engineer deciding their next steps. Default Markdown MUST open with the outcome, supported-finding/open-question counts when established, resolved reviewer names and a short selected scope. It MUST then prioritize Reviewer differences and where they landed, Open questions requiring evidence, Other agreements and Material review limits, omitting empty sections. A failed stage or material scope/coverage blocker MUST qualify the opening without waiting for the final limits section. Ordinary verification histories and dismissed findings MUST NOT precede actionable review content.

The differences section MUST highlight substantive opposing assessments, material corrections or changed positions during discussion, and concerns initially raised by only one reviewer, including those later accepted. Each compact entry MUST preserve the named initial positions, the material recorded discussion change, the final position or remaining disagreement, and useful file/location context. A resolved difference MUST remain here rather than repeat under agreements. A reviewer not initially flagging a concern MUST NOT be described as opposing or dismissing it; lack of evidence from an incomplete review MUST NOT imply that its author overlooked it. An unrelated no-issue assessment MUST NOT be used to invent opposition to another concern in the same file.

Unanswered questions and hypotheses without established incompatible verdicts MUST appear under Open questions requiring evidence, with who raised them, the observed response from the other reviewer, and the specific missing evidence. Shared uncertainty MUST NOT be labeled disagreement, inferred consensus on an issue, or a confirmed defect. A genuine incompatible-position concern MUST retain its uncertainty in the differences section without duplicate entries. Other agreements MUST contain supported concerns without a material difference that belongs earlier. Routine withdrawn findings MUST remain in JSON rather than receive default full Markdown entries; a short dismissal count MAY be shown. A substantive disagreement ending in dismissal MUST remain visible where needed to explain its resolution.

Useful file references MUST be retained where available. Raw transcript repetitions, session identifiers, round-by-round records, stance enums, stop-reason enums, and machine conclusion labels MUST remain in JSON rather than appearing as routine Markdown metadata. The summary MUST preserve reviewer attribution and evidence limitations, MUST NOT invent evidence or prescribe unsupported next steps, and MUST NOT treat reviewer agreement as independent proof of correctness. It MUST use the existing reviews and debates without launching an additional reviewer, adjudicator, or agent task to generate the summary.

Concern entries MUST use concise, named initial/discussion/final-position explanations rather than require the former Review conclusion, Why the conclusion changed or What you need to decide labels. They MUST preserve the reviewer's question-led wording when relevant and MUST NOT manufacture a fix or generic decision boilerplate. A resolution explanation MUST identify whose recorded reasoning changed and MUST describe review assessment rather than imply implemented code changes. First-person explanations MUST retain visible speaker attribution; identical shared reasoning MUST remain attributable to both. When several verdict changes occur, explain the change leading to the final outcome rather than replay earlier reversals. A recorded correction MUST govern the actionable concern text without presenting withdrawn portions as current defects.

Native severity ratings MUST be optional and explicitly attributed to their author, including applicable ratings supplied during debate rather than the initial review. The report MUST NOT invent a missing rating, inherit one reviewer's rating for the other, force a shared scale or guess a severity mapping. An empty severity convention or absent label MUST NOT imply low urgency or opposition. A single note MAY explain asymmetric rating conventions without repeating unrated placeholders. Materially different explicitly mapped comparable levels MUST retain both ratings and identify unresolved urgency; different native vocabularies alone MUST NOT imply disagreement. A dismissed concern MUST NOT retain an urgency decision based solely on obsolete ratings.

The complete JSON report MUST include a distinct `concerns` collection used for Markdown and final issue counts, while retaining original `debates` as the audit record. Related findings MAY share a Markdown presentation block within an appropriate section only when individual attribution, material differences and the member count remain clear; this MUST NOT semantically merge concerns, change IDs/verdicts/counts or confer agreement on an unresolved member. An unconfirmed member MUST NOT be hidden inside a supported agreement group. Semantic consolidation and duplicate reuse MUST continue to require their existing confirmation evidence. The complete JSON report MUST retain scope-preview evidence, static prerequisite-check results, local prerequisite-confirmation provenance, and available actual-session startup/access evidence, verification status and limitations, native and mapped severity with mapping provenance, and explicit duplicate-reuse links when applicable. The complete JSON report MUST preserve confirmed bugs, still-disputed findings, initial sole-reviewer attribution, original findings and evidence, and all debate rounds and responses. Confirmed bugs MUST require both reviewers to explicitly conclude that the same concern is an issue; matching `no_issue` verdicts MUST NOT count as bugs, and absent verdicts MUST NOT imply confirmation. A conclusion MUST be limited to `converged-on-issue`, `converged-on-no-issue`, or `unresolved`; an explicit agree-to-disagree outcome MUST be represented as unresolved with that reason. The workflow MUST write `prepr-report.md` and `prepr-report.json` to `$ARTIFACTS_DIR`, then return valid `archon_artifact` pointers using its own `$WORKFLOW_ID` and paths relative to `$ARTIFACTS_DIR`, so Archon's Artifacts tab exposes the result without modifying the reviewed checkout.

If static validation fails or either reviewer fails to start or complete, the report MUST state that review is incomplete and retain the actual stage, affected side, launcher/model when known, concise failure evidence, and actionable recovery guidance. Rendering MUST tolerate missing scope, initial-review, comparison, and debate artifacts caused by upstream failure. It MUST NOT replace the original failure with a missing-comparison exception, fabricate findings or comparison evidence, or describe an incomplete run as a successful review with no issues. Existing report filenames and native artifact pointers MUST remain unchanged. Static checks, user confirmation, and observed runtime facts MUST be distinguishable; confirmation MUST NOT imply successful authentication, model execution, or resource reads.

Report normalization MUST retain the final structured reviewer result after progress messages, including nested `verification.checks` and `verification.limitations`, supported historical verification forms, material overview qualifications, and substantive reviewer assessments. JSON MUST preserve all supplied statuses, attribution and snapshot evidence. Markdown MUST preserve meaningful test statuses, attribution and material limitations without treating an ambiguous check as passed or discarding a material limitation because it lacks a particular keyword; complete snapshot identifiers and routine investigation entries remain in JSON unless needed for diagnosis. Passing focused tests and an unverified, interrupted, or unrun full suite MUST be reported separately; overlapping counts from different reviewers MUST NOT be added into a claimed unique total.

When completed reviewers report no actionable concerns but qualify their coverage as partial, the opening assessment MUST limit that conclusion to the reviewed portions and show material coverage and verification limitations near the opening. Session/workflow completion MUST NOT imply exhaustive review, a passing full suite, or verified backend behavior. Preserve unknowns and omitted-assessment explanations without inventing a spec-alignment score or changing finding/debate outcomes. Re-rendering saved evidence for validation MUST use separate output artifacts without overwriting the original live run or launching additional reviewer/model sessions. Existing artifact filenames and pointer structure MUST remain unchanged.

Markdown SHALL be a concise decision-facing view over the complete JSON audit evidence. It MUST open with the outcome, actual failed stage when applicable, named reviewers and a short scope summary. Its material-limits summary MUST retain meaningful test status and coverage, access, snapshot and data limitations, while omitting routine successful setup/integrity checks, repeated confirmation disclaimers, full snapshot hashes/revisions, per-file investigation histories, raw assessment objects, setup history and model-response acknowledgments unless necessary to diagnose an actionable failure. Substantive assessments MUST appear only to the extent they change interpretation or the next decision; routine missing-ticket/score explanations MUST remain in JSON unless materially relevant. A qualification MUST NOT exempt an entire long paragraph from concise presentation or be repeated under both reasoning and evidence limits without distinct information. Complete normalized checks, assessments, limitations, diagnostics, snapshots and original responses MUST remain in JSON. Summarization MUST preserve attribution, conditions, uncertainty and meaningful reviewer differences; it MUST NOT discard a failed check, present passing focused tests as a passing full suite, combine overlapping counts, or claim verified snapshot review after an unverified working-tree substitution.

The report MUST state a shared operational failure once at run level, distinguish initial-review completion from discussion failure, and mark affected initial findings as unconfirmed without repeating generic failure/decision boilerplate for every concern. Concern entries MUST retain the issue or question, concrete consequence and useful location, named reviewer positions actually present, discussion outcome and remaining material uncertainty. A missing opposing position MUST NOT be fabricated, and similar concerns MUST NOT be merged without the existing confirmation evidence. Shortening Markdown MUST NOT change findings, verdicts, severity mappings, the reviewer contract, accepted packages or artifact names/pointers.

#### Scenario: Verification or runtime evidence is missing
- **WHEN** reviewers did not execute tests or a finding depends on a data condition that was not verified
- **THEN** the report retains those limitations in compact material limits or the affected entry, with any critical coverage blocker qualifying the opening
- **AND** shortening preserves the condition and limitation rather than truncating them away or implying a reproduced failure

#### Scenario: Verification results are reported
- **WHEN** supplied evidence records a check as passed, failed, blocked, not run, or unknown
- **THEN** the visible summary retains meaningful test status, attribution and material limits on whether verification matches the selected scope
- **AND** JSON retains the full tested revision or snapshot when known; Markdown includes identifiers only when needed to explain an actionable failure
- **AND** reviewer agreement does not turn unknown or static-only evidence into successful execution

#### Scenario: Focused tests pass while the full suite is unverified
- **WHEN** nested verification records passing focused tests alongside an interrupted, unverified, or unrun full suite
- **THEN** Markdown and JSON retain both facts with the originating reviewer and snapshot when known
- **AND** they do not reduce them to a blanket unknown/not-run project check, claim the full suite passed, or sum overlapping reviewer test counts

#### Scenario: Nested limitations have no recognized keyword
- **WHEN** a reviewer provides an explicit nested limitation about partial file coverage, absent backend validation, or another material evidence boundary
- **THEN** the visible report preserves that limitation and attribution even when its wording does not match a fallback prose keyword
- **AND** supported historical verification arrays and prose remain readable without inventing statuses or evidence

#### Scenario: A partial review returns no findings
- **WHEN** both reviewer sessions complete with no actionable findings and at least one reviewer explicitly describes partial coverage
- **THEN** the opening assessment states that no actionable concerns were identified within the reviewed portions and retains the coverage qualification
- **AND** it does not imply every changed file was reviewed, erase verification limitations, or invent findings or a spec-alignment score

#### Scenario: Saved live evidence is replayed for regression validation
- **WHEN** saved reviewer and comparison results are replayed to validate corrected report rendering
- **THEN** reporting produces the existing Markdown/JSON artifact names and native pointer structure in a separate temporary output location without starting new reviewer/model sessions
- **AND** the original live-run artifacts, accepted reviewer packages and local acceptance records remain unchanged

#### Scenario: A dispute remains unresolved
- **WHEN** reviewers retain incompatible positions or operationally incomplete debate leaves a concern unconfirmed
- **THEN** the Markdown report gives the concern a short title and bullets distinguishing A's and B's reasoning, explaining any incomplete evidence, and identifying the uncertainty or decision that remains for the human engineer
- **AND** JSON retains the unresolved conclusion and complete available attributed positions

#### Scenario: Debate resolves a disagreement
- **WHEN** reviewers initially differ on a concern and reach a shared conclusion during debate
- **THEN** one Markdown entry explains their original reasoning and the evidence or reasoning that resolved the disagreement
- **AND** the concern is not repeated under agreements, and JSON preserves the initial attribution and debate history

#### Scenario: A changed conclusion preserves its speaker
- **WHEN** a reviewer supplies a first-person explanation supporting the final shared conclusion
- **THEN** the discussion/final-position explanation identifies the actual reviewer by name so the reader knows whose assessment changed
- **AND** the explanation does not imply that the workflow implemented a code change

#### Scenario: Debate contains an earlier reversal
- **WHEN** reviewers change verdicts more than once before reaching their final shared conclusion
- **THEN** the resolution explanation attributes the recorded change leading to that final conclusion rather than an earlier reversal

#### Scenario: Reviewers agree that no issue exists
- **WHEN** both reviewers explicitly conclude that a concern is not an issue
- **THEN** JSON records converged-on-no-issue and excludes it from confirmed bugs
- **AND** routine dismissals remain in JSON, with at most a short Markdown count; a substantive resolved disagreement retains its concise resolution in the differences section

#### Scenario: Dismissal makes a severity difference irrelevant
- **WHEN** initial severity ratings differ but both reviewers ultimately conclude that the concern is not an issue
- **THEN** any visible dismissal explains the recorded resolution without an urgency decision about those obsolete ratings

#### Scenario: An agreed issue still has different severity ratings
- **WHEN** both reviewers conclude that a concern is an issue but explicitly mapped shared severity levels differ and no shared urgency is recorded
- **THEN** the differences section identifies unresolved urgency and preserves each reviewer's attributed rating without prescribing a mandatory bullet label

#### Scenario: Agreement lacks an explicit issue verdict
- **WHEN** related review entries match but either reviewer has not explicitly concluded that the concern is an issue
- **THEN** the report does not label the concern a confirmed bug or invent a shared issue verdict

#### Scenario: Summary remains traceable and skimmable
- **WHEN** several transcript fragments or initial-attribution categories refer to the same underlying concern
- **THEN** Markdown presents each normalized concern once with a concise title, compact named explanations and useful file references; any related presentation group preserves each member and its count
- **AND** JSON retains the original evidence and attribution without requiring the reader to process workflow metadata to understand the summary

#### Scenario: No actionable concerns remain
- **WHEN** both reviews complete and contain no actionable concerns after normalization
- **THEN** Markdown gives a concise assessment stating that no actionable concerns were identified within the reviewed scope, retaining any supplied partial-coverage qualification and material limitations without empty numbered sections or fabricated bug counts

#### Scenario: Report is available as an Archon artifact
- **WHEN** the workflow completes its report node
- **THEN** it writes `prepr-report.md` and `prepr-report.json` to `$ARTIFACTS_DIR` and returns valid `archon_artifact` pointers for those relative paths rather than printing the complete report to the node transcript

#### Scenario: Static validation fails before review
- **WHEN** static prerequisite validation fails before either reviewer starts and no comparison artifact exists
- **THEN** the workflow writes an incomplete Markdown and JSON report identifying the blocker and the fact that neither review started
- **AND** report rendering does not fail because comparison or debate artifacts are missing

#### Scenario: Actual reviewer startup fails
- **WHEN** a selected launcher reports expired authentication, unavailable model, or a startup timeout after static validation
- **THEN** the report identifies the affected side and available launcher/model evidence and suggests the relevant login, configuration, or startup recovery action
- **AND** it preserves any other side’s available result without claiming two completed reviews or that neither session started

#### Scenario: Failure evidence is incomplete
- **WHEN** an upstream failure leaves no usable diagnostic or comparison artifact
- **THEN** report generation still returns the existing report artifacts with an explicit incomplete-stage and missing-evidence explanation
- **AND** it does not invent a failure cause or a successful empty review


#### Scenario: Report contains a large verification audit trail
- **WHEN** completed initial reviews supply setup checks, repeated hashes, file-read narratives and substantive verification evidence
- **THEN** Markdown presents only outcome-relevant tests, actionable findings and material limitations with names
- **AND** JSON retains the complete evidence without displaying the audit trail as repeated unknown project-check bullets

#### Scenario: Both reviewers completed but debate results are missing
- **WHEN** both initial sessions completed but a discussion error prevented required debate results
- **THEN** the report identifies failed discussion once and labels affected findings unconfirmed
- **AND** it does not repeat that an initial reviewer failed under each concern

#### Scenario: Reviewer could not read the captured snapshot
- **WHEN** a reviewer discloses using working-tree copies because captured contents were inaccessible
- **THEN** the concise verification summary preserves that material snapshot limitation with attribution
- **AND** neither session completion nor a matching excerpt implies that all reviewed evidence matched the pinned snapshot

#### Scenario: Default report emphasizes reviewer differences
- **WHEN** complete saved evidence contains initial reviewer differences, open evidence questions and other supported agreements
- **THEN** Markdown presents outcome/names/scope, reviewer differences and where they landed, open questions requiring evidence, other agreements and compact material review limits in that order
- **AND** empty sections, routine full assessment paragraphs and default withdrawn-finding write-ups are omitted without losing their JSON evidence

#### Scenario: Only one reviewer initially flags a concern
- **WHEN** one completed initial reviewer raises a concern the other did not flag and both later support it during discussion
- **THEN** the differences entry identifies who raised it, states that the other did not initially flag it and explains the recorded route to the final support
- **AND** it does not claim an opposing initial verdict or hide the initially sole-reviewer contribution under other agreements

#### Scenario: Initial evidence is unavailable
- **WHEN** one initial result is missing or incomplete
- **THEN** the report discloses unavailable initial evidence instead of claiming that reviewer did not flag or dismissed the concern
- **AND** existing incomplete-run qualifications and failure attribution remain intact

#### Scenario: Reviewers share uncertainty rather than disagree
- **WHEN** one reviewer raises a screenshot-data hypothesis and both reviewers leave its issue verdict unknown because image contents were not verified
- **THEN** the concern appears once under open questions with its origin, both observed positions and the missing evidence needed to resolve it
- **AND** no explicit disagreement, shared issue verdict or confirmed data exposure is invented merely because debate reached its round limit

#### Scenario: Ratings belong to one reviewer only
- **WHEN** one accepted reviewer defines no severity scale and supplies no rating, while the other supplies native Must fix, Should fix or Nit labels
- **THEN** Markdown attributes each supplied rating to its author and leaves the other unrated without inventing a common priority or severity disagreement
- **AND** JSON preserves native labels and any explicitly configured mappings independently of presentation

#### Scenario: A rating first appears during discussion
- **WHEN** a reviewer supplies a Nit rating during debate that was absent from the initial finding
- **THEN** the concise entry can show that author's applicable final rating without assigning it to the other reviewer or changing the initial finding
- **AND** JSON retains the recorded initial/debate distinction and rating history

#### Scenario: Related findings share a presentation block
- **WHEN** two supported archive findings cover related inclusion and ignore-coverage concerns
- **THEN** a shared agreement block identifies both initial authors and its two-finding count without changing normalized concern membership, IDs, verdicts or total support counts
- **AND** this presentation grouping neither establishes semantic duplicate confirmation nor absorbs a separate unknown screenshot-data question

#### Scenario: Debate withdraws part of an initial concern
- **WHEN** a reviewer drops criticism of historical folder names after the other reviewer explains it, while both retain a metadata-clutter concern
- **THEN** the differences entry names the correction and final metadata concern rather than describing the withdrawn naming claim as a current defect
- **AND** the complete initial claim and debate remain in JSON

#### Scenario: Long reasoning includes a material qualification
- **WHEN** reasoning or an assessment contains a long paragraph with a material condition or limitation
- **THEN** Markdown retains the attributed decision-relevant claim and condition concisely instead of exempting the paragraph from shortening or repeating its qualification under multiple labels
- **AND** JSON retains the whole paragraph, assessment and all checks without a fixed-length cutoff deleting material evidence

#### Scenario: Successful live evidence is replayed in the approved format
- **WHEN** saved evidence from run `6f0c552f-a62c-426e-9211-420907312acb` is replayed for presentation validation
- **THEN** the report preserves four supported findings displayed in three blocks, one shared-uncertainty question, and the dismissed finding in JSON, with initial authorship, the actual discussion changes and optional attributed ratings
- **AND** replay writes separate temporary report artifacts with unchanged filenames/pointer structure and no new reviewer/model session, original-run overwrite or accepted-reviewer change

## ADDED Requirements

### Requirement: Named reviewer visibility
The workflow SHALL show a visible mapping from resolved reviewer display names to stable A/B roles before initial review work and use those names in reviewer node transcripts, report findings and failure messages. Per-run overrides MUST update the mapping, and duplicate display names MUST remain distinguishable by role. Existing stable node IDs and provenance MUST remain usable. Graph display labels MUST include resolved names when supported by the installed Archon without an upstream change; otherwise the explicit mapping and named supported surfaces MUST remain available without an upstream Archon modification or a misleading install-time name.

#### Scenario: User forgets which reviewer is A
- **WHEN** a normal run resolves its reviewer selections
- **THEN** the run summary and node transcript identify each display name and role before reviewer output
- **AND** report reasoning identifies the reviewer by name rather than requiring the user to remember A/B

#### Scenario: Override or duplicate name is selected
- **WHEN** a run overrides a configured reviewer or both sides share a display name
- **THEN** names reflect the actual resolved selections and the role disambiguates them
- **AND** stable workflow references and original-session attribution remain intact

#### Scenario: Graph cannot display dynamic reviewer labels
- **WHEN** the installed Archon has no supported dynamic node-label mechanism
- **THEN** stable graph IDs remain and the run exposes an explicit name-to-role mapping and named node transcripts
- **AND** Prepr does not claim the graph nodes were renamed
