## MODIFIED Requirements

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
The system SHALL produce a private Archon report for a human engineer deciding their next steps. The Markdown report MUST open with a concise review assessment followed by a visible verification summary and material evidence limitations, then organize concerns into disagreements, supported agreements, and meaningful withdrawn concerns when present. Each distinct concern MUST appear once, with a concise title and compact labeled bullets explaining the concern, reviewer reasoning, outcome, and practical significance as supported by the evidence. For a disagreement, the report MUST distinguish A's reasoning from B's reasoning, explain whether and why debate resolved it, and state any remaining uncertainty or decision for the human engineer. A substantive disagreement resolved through debate MUST remain in the disagreement section with its resolution rather than appearing again as an agreement. A finding raised by only one reviewer MUST NOT be presented as an opposing position from the other reviewer without evidence of disagreement. Initially equivalent supported concerns and sole-reviewer concerns subsequently accepted without substantive disagreement MUST appear under agreements; unresolved sole-reviewer concerns MUST appear under disagreements with the absence of an opposing position made clear. Withdrawn concerns that were not substantive disagreements MUST appear only when their dismissal adds useful context for human judgment. Empty sections MUST be omitted.

Useful file references MUST be retained where available. Raw transcript repetitions, session identifiers, round-by-round records, stance enums, stop-reason enums, and machine conclusion labels MUST remain in JSON rather than appearing as routine Markdown metadata. The summary MUST preserve reviewer attribution and evidence limitations, MUST NOT invent evidence or prescribe unsupported next steps, and MUST NOT treat reviewer agreement as independent proof of correctness. It MUST use the existing reviews and debates without launching an additional reviewer, adjudicator, or agent task to generate the summary.

The Markdown report MUST label each concern's assessment as Review conclusion. A resolved disagreement's explanation MUST use Why the conclusion changed and identify the reviewer whose recorded reasoning supports that explanation. This explanation MUST describe a change in review assessment, not imply that reviewers implemented code changes. First-person explanations MUST retain visible speaker attribution. Shared reasoning presented on behalf of both reviewers MUST be attributed to both when their recorded explanations are identical. When several verdict changes occur, the resolution explanation MUST reflect the change leading to the final shared conclusion rather than an earlier reversal.

The report MUST use What you need to decide only for a meaningful question that remains for the human engineer: whether an unresolved concern needs action, or the urgency of an agreed issue when comparable mapped severity levels remain different. Missing or unmapped labels MUST be disclosed without being presented as a severity disagreement. It MUST state incomplete evidence where applicable. A concern both reviewers dismiss MUST NOT retain this bullet solely because their initial severity ratings differed.

The complete JSON report MUST include a distinct `concerns` collection used for Markdown and final issue counts, while retaining original `debates` as the audit record. The complete JSON report MUST retain scope-preview evidence, static prerequisite-check results, local prerequisite-confirmation provenance, and available actual-session startup/access evidence, verification status and limitations, native and mapped severity with mapping provenance, and explicit duplicate-reuse links when applicable. The complete JSON report MUST preserve confirmed bugs, still-disputed findings, initial sole-reviewer attribution, original findings and evidence, and all debate rounds and responses. Confirmed bugs MUST require both reviewers to explicitly conclude that the same concern is an issue; matching `no_issue` verdicts MUST NOT count as bugs, and absent verdicts MUST NOT imply confirmation. A conclusion MUST be limited to `converged-on-issue`, `converged-on-no-issue`, or `unresolved`; an explicit agree-to-disagree outcome MUST be represented as unresolved with that reason. The workflow MUST write `prepr-report.md` and `prepr-report.json` to `$ARTIFACTS_DIR`, then return valid `archon_artifact` pointers using its own `$WORKFLOW_ID` and paths relative to `$ARTIFACTS_DIR`, so Archon's Artifacts tab exposes the result without modifying the reviewed checkout.

If static validation fails or either reviewer fails to start or complete, the report MUST state that review is incomplete and retain the actual stage, affected side, launcher/model when known, concise failure evidence, and actionable recovery guidance. Rendering MUST tolerate missing scope, initial-review, comparison, and debate artifacts caused by upstream failure. It MUST NOT replace the original failure with a missing-comparison exception, fabricate findings or comparison evidence, or describe an incomplete run as a successful review with no issues. Existing report filenames and native artifact pointers MUST remain unchanged. Static checks, user confirmation, and observed runtime facts MUST be distinguishable; confirmation MUST NOT imply successful authentication, model execution, or resource reads.

Report normalization MUST retain the final structured reviewer result after progress messages, including nested `verification.checks` and `verification.limitations`, supported historical verification forms, material overview qualifications, and substantive reviewer assessments. JSON and Markdown MUST preserve supplied statuses, attribution and snapshot evidence without treating an ambiguous check as passed or discarding an explicit limitation because it lacks a particular keyword. Passing focused tests and an unverified, interrupted, or unrun full suite MUST be reported separately; overlapping counts from different reviewers MUST NOT be added into a claimed unique total.

When completed reviewers report no actionable concerns but qualify their coverage as partial, the opening assessment MUST limit that conclusion to the reviewed portions and show material coverage and verification limitations near the opening. Session/workflow completion MUST NOT imply exhaustive review, a passing full suite, or verified backend behavior. Preserve unknowns and omitted-assessment explanations without inventing a spec-alignment score or changing finding/debate outcomes. Re-rendering saved evidence for validation MUST use separate output artifacts without overwriting the original live run or launching additional reviewer/model sessions. Existing artifact filenames and pointer structure MUST remain unchanged.

#### Scenario: Verification or runtime evidence is missing
- **WHEN** reviewers did not execute tests or a finding depends on a data condition that was not verified
- **THEN** the report states those limitations near its opening and with the affected concern
- **AND** shortening preserves the condition and limitation rather than truncating them away or implying a reproduced failure

#### Scenario: Verification results are reported
- **WHEN** supplied evidence records a check as passed, failed, blocked, not run, or unknown
- **THEN** the visible summary retains that status, attribution, and tested revision or snapshot when known
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
- **WHEN** reviewers retain incompatible positions or either debate is incomplete
- **THEN** the Markdown report gives the concern a short title and bullets distinguishing A's and B's reasoning, explaining any incomplete evidence, and identifying the uncertainty or decision that remains for the human engineer
- **AND** JSON retains the unresolved conclusion and complete available attributed positions

#### Scenario: Debate resolves a disagreement
- **WHEN** reviewers initially differ on a concern and reach a shared conclusion during debate
- **THEN** one Markdown entry explains their original reasoning and the evidence or reasoning that resolved the disagreement
- **AND** the concern is not repeated under agreements, and JSON preserves the initial attribution and debate history

#### Scenario: A changed conclusion preserves its speaker
- **WHEN** a reviewer supplies a first-person explanation supporting the final shared conclusion
- **THEN** Why the conclusion changed identifies Reviewer A or Reviewer B as the speaker so the reader knows whose assessment changed
- **AND** the explanation does not imply that the workflow implemented a code change

#### Scenario: Debate contains an earlier reversal
- **WHEN** reviewers change verdicts more than once before reaching their final shared conclusion
- **THEN** the resolution explanation attributes the recorded change leading to that final conclusion rather than an earlier reversal

#### Scenario: Reviewers agree that no issue exists
- **WHEN** both reviewers explicitly conclude that a concern is not an issue
- **THEN** JSON records converged-on-no-issue and excludes it from confirmed bugs
- **AND** Markdown includes its dismissal only when useful for human judgment, without displaying metadata rejected as a finding

#### Scenario: Dismissal makes a severity difference irrelevant
- **WHEN** initial severity ratings differ but both reviewers ultimately conclude that the concern is not an issue
- **THEN** the report explains the dismissal without a What you need to decide bullet about those obsolete severity ratings

#### Scenario: An agreed issue still has different severity ratings
- **WHEN** both reviewers conclude that a concern is an issue but explicitly mapped shared severity levels differ and no shared urgency is recorded
- **THEN** What you need to decide asks the human engineer how urgently to address the issue and preserves each reviewer's rating

#### Scenario: Agreement lacks an explicit issue verdict
- **WHEN** related review entries match but either reviewer has not explicitly concluded that the concern is an issue
- **THEN** the report does not label the concern a confirmed bug or invent a shared issue verdict

#### Scenario: Summary remains traceable and skimmable
- **WHEN** several transcript fragments or initial-attribution categories refer to the same underlying concern
- **THEN** Markdown presents one concern with a concise title, compact labeled bullets, and useful file references
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
