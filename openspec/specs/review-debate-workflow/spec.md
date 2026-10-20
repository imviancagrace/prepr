# Review Debate Workflow Specification

## Purpose

Provide a private, pre-PR Archon workflow where two independently selected reviewer skills guide separate reviewer agents through review and debate of a developer's local Git change, producing a skimmable summary to challenge human engineering judgment and complete structured evidence for inspection.

## Requirements

### Requirement: Local reviewer profiles and overrides
The system SHALL load project reviewer profiles only from a local-only project configuration. A profile MUST identify one reviewer skill source, a stable display name, and a supported native launcher. A profile MAY declare required read access and an explicit mapping from its native severity labels to shared levels. Both declarations MUST remain local-only, and original severity labels MUST be retained in review evidence. A profile MAY pin a launcher-compatible model; otherwise its launcher MUST use the Archon-configured supported default. The configuration MAY select a default pair of profiles. A workflow invocation MUST permit either reviewer to be selected by profile name or replaced with a direct skill reference; an explicit reference takes precedence over a profile selection, and a profile selection takes precedence over the project default. A direct reference that does not replace a selected profile MUST also select a launcher.

#### Scenario: Project defaults select both reviewers
- **WHEN** a user invokes the workflow without reviewer selections and the local profile configuration defines a default pair
- **THEN** the system uses that pair for the run

#### Scenario: A direct reference replaces one default
- **WHEN** a user supplies a direct reviewer skill reference for one side of a run
- **THEN** the system uses that reference for the selected side and retains the configured selection for the other side

#### Scenario: No reviewer pair is resolvable
- **WHEN** a run has no valid default pair and does not supply two resolvable reviewer selections
- **THEN** the system reports the missing selection and does not start review agents

#### Scenario: A Claude-oriented skill selects Claude Code
- **WHEN** a selected reviewer profile specifies the `claude` launcher and no model override
- **THEN** the system starts the reviewer with Claude Code and that launcher's Archon-configured supported default model

### Requirement: Reviewer skill resolution
The system SHALL resolve a reviewer skill from either a local skill source or a GitHub source pinned to an immutable revision. A GitHub source MUST be used only to obtain the reviewer skill; the workflow MUST NOT inspect, create, modify, or comment on a GitHub pull request.

#### Scenario: Pinned GitHub skill source
- **WHEN** a selected profile references a GitHub reviewer skill at a pinned revision
- **THEN** the system resolves that revision for the assigned reviewer agent without treating any GitHub PR as review scope

### Requirement: Explicit local and branch scope selection
The system SHALL default to `scope=local`, selecting staged and unstaged tracked changes plus non-ignored untracked content. It MUST select committed branch changes only when `scope=branch` is explicitly supplied. Empty local scope MUST stop before either reviewer starts, report that no uncommitted changes were found, and suggest explicit branch scope without switching modes. Invalid scope MUST fail with actionable guidance.

Branch scope MUST require a clean checkout and pin local HEAD, the comparison SHA, and their merge base before either reviewer starts. With no explicit base, it MUST verify the default branch directly from `origin` and fetch that comparison branch. An explicit `base` input MUST select the comparison ref instead; it MUST be resolved and pinned without silently falling back to another base. Remote-backed explicit bases MUST be refreshed; explicit local refs or commits MUST retain the selected local revision and disclose that freshness basis. A base override with local scope MUST fail rather than being ignored. An unresolved base or missing common ancestor MUST stop before review.

The branch diff MUST run from the merge base to local HEAD, excluding comparison-only commits. It MUST preserve local commits and MUST NOT check out, fast-forward, or replace the target with a remote revision. Dirty work or a changed HEAD during preparation MUST stop capture rather than silently change scope. Both initial reviewer results MUST retain identical selected scope metadata in JSON.

#### Scenario: Default local scope contains untracked work
- **WHEN** the user omits scope and the checkout contains non-ignored untracked files or tracked staged or unstaged changes
- **THEN** the preview and both reviewers include those selected local changes
- **AND** ignored files are excluded

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

### Requirement: Informational scope preview
The system SHALL display the selected mode, target, comparison base and pinned revisions when applicable, changed-file count, diff size, and exclusions or evidence limitations before either reviewer starts. It MUST then continue automatically without a human approval gate. A `preview_only=true` input MUST display the scope and exit before launching reviewer or model-probe sessions or resolving remote reviewer skills. Scope-only preview MAY perform the Git reads and fetches required by the selected scope. Its selected revisions and limits MUST match the normal capture behavior, and a later review invocation MUST capture scope again rather than claim the preview remains current.

#### Scenario: Normal run previews and continues
- **WHEN** a valid review scope has been captured for a normal run
- **THEN** the workflow displays its scope summary and proceeds once readiness checks pass without waiting for human approval

#### Scenario: Scope-only preview
- **WHEN** the user supplies `preview_only=true`
- **THEN** the workflow displays scope and exits without reviewer sessions, model probes, or remote reviewer-skill retrieval
- **AND** unavailable reviewer authentication does not prevent an otherwise valid Git scope preview

### Requirement: Reviewer readiness before review
For a normal run, the system SHALL resolve both reviewer selections and establish launcher availability, authentication, and selected-model availability in the actual reviewer execution environment before starting either review. It MUST verify any required read access explicitly declared in the selected local profiles. Required access that fails or cannot be verified MUST stop the run with the affected side, launcher/model or resource, concise evidence, and an actionable next step. Undeclared access MUST NOT be described as verified. Readiness checks MUST be bounded and read-only, MUST NOT review source code, and MUST NOT install tools, change authentication or global configuration, switch models or launchers, or expand permissions automatically. Probe results MUST be retained separately from review findings.

#### Scenario: One reviewer is not ready
- **WHEN** either selected launcher is unavailable, authentication fails, the selected model is unavailable, or a declared required resource cannot be read
- **THEN** neither reviewer begins reviewing code and the workflow reports an actionable readiness failure
- **AND** the workflow does not substitute another account, launcher, model, or permission mode

#### Scenario: Host access differs from reviewer access
- **WHEN** a declared resource is readable by the host but inaccessible in the selected reviewer's sandbox
- **THEN** the resource check fails readiness rather than using host access as evidence that the reviewer can read it

#### Scenario: No required resource declarations
- **WHEN** profiles declare no additional required read resources and launcher/model checks pass
- **THEN** the workflow can proceed but does not claim that every skill dependency has been validated

### Requirement: Independent pre-PR reviewer agents
The system SHALL start exactly two independent reviewer agents, each with its selected reviewer skill, against the same selected local review scope: the current uncommitted Git diff by default, or an explicitly selected pinned committed branch diff. Reviewer-specific behavior MUST come from the selected skill; the workflow MUST NOT supply a default review prompt. The workflow MUST run against the developer's live checkout without a worktree and MUST constrain reviewer agents to read-only review activity.

#### Scenario: Two skills review the same local change
- **WHEN** a user starts a run in a Git working tree with a local diff and two resolved reviewer selections
- **THEN** the system starts two independent reviewer agents in parallel with access to that same checkout and diff

#### Scenario: Review remains private
- **WHEN** either reviewer agent completes review or debate
- **THEN** the system retains its result inside the Archon workflow and does not publish a GitHub comment, review, or pull request update

### Requirement: Material disagreement identification
The system SHALL preserve each reviewer's raw transcript and internally normalize actionable findings sufficiently to compare them. It MUST exclude headings, process updates, location-only entries, aggregate verdicts, verification summaries, and explicit no-finding statements from the actionable findings set. Multiple descriptions of the same concern within one review MUST retain their supporting evidence without becoming separate findings. It MUST classify as a material disagreement a finding made by only one reviewer or incompatible conclusions about the same changed code and concern. It MUST NOT create a debate solely for differently worded equivalent findings. A shared file path or similar wording alone MUST NOT establish that two findings concern the same defect. Ambiguous correspondence MUST NOT be promoted to an agreement. Prose normalization MUST preserve Markdown link targets as file/line anchors, normalize absolute paths inside the checkout to repository-relative paths, and recognize severity-prefixed default-review bullets. Question-led findings MUST retain their actionable rationale, question, and original source text. Explicit references to an earlier Vee question MAY consolidate duplicate descriptions within that reviewer while preserving both sources; independent default-review concerns MUST remain in scope.

During existing debate rounds, each original reviewer MAY identify other supplied finding IDs as `sameConcernAs` when they describe exactly the same failure, trigger, and consequence. Final concern grouping MUST require both reviewers to identify the same valid duplicate ID, a shared location, and compatible resolved conclusions. A pending duplicate can inherit a previously resolved outcome only under the explicit reuse requirement below; it MUST retain its source finding and provenance rather than invent a second debate. Unknown IDs, one-sided equivalence claims, unrelated same-location issues, conflicting conclusions, and unresolved records MUST NOT be collapsed. Shared location alone only establishes a candidate for consideration.

#### Scenario: Equivalent wording does not become a dispute
- **WHEN** both reviewers reach substantively equivalent conclusions about the same changed code
- **THEN** the system does not create a debate for that finding

#### Scenario: Prose metadata does not become a finding
- **WHEN** a review includes headings, progress updates, standalone file locations, rationale, a proposed question, an aggregate verdict, or an explicit no-finding statement
- **THEN** only actionable concerns enter comparison, with rationale and questions retained as supporting evidence for their concerns
- **AND** a review with no actionable concerns produces no fabricated findings or confirmed bugs

#### Scenario: Unrelated concerns share a file
- **WHEN** two reviewers describe different defects in the same file
- **THEN** the system keeps those concerns separate rather than classifying them as an agreement

#### Scenario: One concern has several descriptions
- **WHEN** a reviewer describes the same underlying concern in a question, rationale, and default-review finding
- **THEN** the system compares one distinct concern while preserving the original descriptions and attribution in the structured evidence

#### Scenario: Descriptive linked questions and independent default-review findings
- **WHEN** a review contains numbered descriptive Markdown links, associated rationale and questions, and severity-prefixed default-review bullets
- **THEN** normalization retains actual linked file/line anchors and every independent concern
- **AND** an explicitly overlapping default-review bullet preserves its evidence with the referenced question instead of creating another concern

#### Scenario: Both reviewers confirm equivalent concerns during debate
- **WHEN** both original reviewers explicitly link valid same-location finding IDs and their resolved conclusions are compatible
- **THEN** the final report counts and displays one concern while preserving the source findings and all original debate records
- **AND** a one-sided or unresolved equivalence claim does not reduce the count

### Requirement: Comparable reviewer severity
The system SHALL retain each native severity label and use a selected profile's explicit mappings to compare shared levels. The shared levels SHALL be `critical`, `high`, `medium`, and `low`. Equal mapped levels MUST NOT establish a severity disagreement solely because native labels differ. Different mapped levels MUST retain the urgency disagreement even if both reviewers agree the concern is an issue. If either label is missing or unmapped, the system MUST mark the severity comparison unavailable rather than infer equivalence or disagreement. Native or mapped severity MUST NOT substitute for an explicit issue verdict or establish that two concerns are equivalent. Invalid mappings MUST fail profile validation before review.

#### Scenario: Different labels map to the same urgency
- **WHEN** one reviewer uses `P1`, the other uses `Must fix`, and their profiles map both labels to `high`
- **THEN** comparison treats their severity as equal while preserving both native labels

#### Scenario: Severity cannot be compared
- **WHEN** either reviewer supplies an unmapped or missing severity
- **THEN** the report identifies the unavailable comparison without creating a severity disagreement from the labels alone

#### Scenario: Mapped levels differ
- **WHEN** reviewers agree a concern is an issue but explicitly mapped severity levels differ
- **THEN** the report retains each level and asks the human to decide urgency without changing the shared issue verdict

### Requirement: Reuse confirmed duplicate discussions
Within the same run and pinned scope, the system SHALL reuse a resolved concern's outcome for a pending duplicate only when both original reviewer sessions have explicitly confirmed that the pending finding describes exactly the same failure, trigger, and consequence. Shared location, lexical similarity, and one-sided confirmation MUST NOT authorize reuse. The pending concern MUST have no conflicting recorded verdict, mapped severity, material evidence, or correction; a missing initial verdict MUST remain recorded as missing even when a later explicit duplicate confirmation supports reuse. Unknown, unresolved, incomplete, or agree-to-disagree outcomes MUST NOT be reused. Any material change to the referenced finding or scope MUST invalidate reuse and leave a separate discussion necessary.

A reused result MUST link its source finding IDs, explicit confirmations, originating discussion, and pinned scope in JSON. The Markdown report and confirmed-issue counts MUST show the distinct concern once. The graph or transcript MUST identify reuse without inventing reviewer turns or claiming a skipped discussion ran. Session continuations MUST remain serialized.

#### Scenario: Pending duplicate is already resolved
- **WHEN** both original reviewers identify a pending finding as equivalent to a resolved concern in the same pinned scope and no incompatible evidence or assessment is recorded
- **THEN** the workflow reuses that outcome and does not resume the sessions for another discussion of that duplicate
- **AND** original evidence and the explicit reuse provenance remain available

#### Scenario: Candidate cannot safely reuse an outcome
- **WHEN** equivalence is one-sided, the source outcome is unresolved, or the pending finding has a conflicting assessment or material new evidence
- **THEN** the candidate retains its own discussion and no shared conclusion is inferred

### Requirement: Original-agent debate
For every material disagreement not covered by a valid confirmed duplicate reuse, the system SHALL continue the same original reviewer agent that produced each side's initial position through bounded debate rounds. A round MUST give reviewer A reviewer B's latest attributed position, then give reviewer B reviewer A's resulting latest position. Each response MUST state `maintain`, `revise`, `accept`, or `agree_to_disagree`, with rationale, corrected finding when applicable, and confidence. Process updates before a final structured response MUST NOT hide its explicit verdict or duplicate IDs; absent structured verdicts MUST remain unverified. The workflow MUST NOT resume a single reviewer session concurrently, substitute a generic debate agent, or replace its reviewer skill. Separate reviewer sessions MAY proceed independently.

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

### Requirement: Final attributed report
The system SHALL produce a private Archon report for a human engineer deciding their next steps. The Markdown report MUST open with a concise review assessment followed by a visible verification summary and material evidence limitations, then organize concerns into disagreements, supported agreements, and meaningful withdrawn concerns when present. Each distinct concern MUST appear once, with a concise title and compact labeled bullets explaining the concern, reviewer reasoning, outcome, and practical significance as supported by the evidence. For a disagreement, the report MUST distinguish A's reasoning from B's reasoning, explain whether and why debate resolved it, and state any remaining uncertainty or decision for the human engineer. A substantive disagreement resolved through debate MUST remain in the disagreement section with its resolution rather than appearing again as an agreement. A finding raised by only one reviewer MUST NOT be presented as an opposing position from the other reviewer without evidence of disagreement. Initially equivalent supported concerns and sole-reviewer concerns subsequently accepted without substantive disagreement MUST appear under agreements; unresolved sole-reviewer concerns MUST appear under disagreements with the absence of an opposing position made clear. Withdrawn concerns that were not substantive disagreements MUST appear only when their dismissal adds useful context for human judgment. Empty sections MUST be omitted.

Useful file references MUST be retained where available. Raw transcript repetitions, session identifiers, round-by-round records, stance enums, stop-reason enums, and machine conclusion labels MUST remain in JSON rather than appearing as routine Markdown metadata. The summary MUST preserve reviewer attribution and evidence limitations, MUST NOT invent evidence or prescribe unsupported next steps, and MUST NOT treat reviewer agreement as independent proof of correctness. It MUST use the existing reviews and debates without launching an additional reviewer, adjudicator, or agent task to generate the summary.

The Markdown report MUST label each concern's assessment as Review conclusion. A resolved disagreement's explanation MUST use Why the conclusion changed and identify the reviewer whose recorded reasoning supports that explanation. This explanation MUST describe a change in review assessment, not imply that reviewers implemented code changes. First-person explanations MUST retain visible speaker attribution. Shared reasoning presented on behalf of both reviewers MUST be attributed to both when their recorded explanations are identical. When several verdict changes occur, the resolution explanation MUST reflect the change leading to the final shared conclusion rather than an earlier reversal.

The report MUST use What you need to decide only for a meaningful question that remains for the human engineer: whether an unresolved concern needs action, or the urgency of an agreed issue when comparable mapped severity levels remain different. Missing or unmapped labels MUST be disclosed without being presented as a severity disagreement. It MUST state incomplete evidence where applicable. A concern both reviewers dismiss MUST NOT retain this bullet solely because their initial severity ratings differed.

The complete JSON report MUST include a distinct `concerns` collection used for Markdown and final issue counts, while retaining original `debates` as the audit record. The complete JSON report MUST retain scope-preview and readiness evidence, verification status and limitations, native and mapped severity with mapping provenance, and explicit duplicate-reuse links when applicable. The complete JSON report MUST preserve confirmed bugs, still-disputed findings, initial sole-reviewer attribution, original findings and evidence, and all debate rounds and responses. Confirmed bugs MUST require both reviewers to explicitly conclude that the same concern is an issue; matching `no_issue` verdicts MUST NOT count as bugs, and absent verdicts MUST NOT imply confirmation. A conclusion MUST be limited to `converged-on-issue`, `converged-on-no-issue`, or `unresolved`; an explicit agree-to-disagree outcome MUST be represented as unresolved with that reason. The workflow MUST write `prepr-report.md` and `prepr-report.json` to `$ARTIFACTS_DIR`, then return valid `archon_artifact` pointers using its own `$WORKFLOW_ID` and paths relative to `$ARTIFACTS_DIR`, so Archon's Artifacts tab exposes the result without modifying the reviewed checkout.

#### Scenario: Verification or runtime evidence is missing
- **WHEN** reviewers did not execute tests or a finding depends on a data condition that was not verified
- **THEN** the report states those limitations near its opening and with the affected concern
- **AND** shortening preserves the condition and limitation rather than truncating them away or implying a reproduced failure

#### Scenario: Verification results are reported
- **WHEN** supplied evidence records a check as passed, failed, blocked, not run, or unknown
- **THEN** the visible summary retains that status, attribution, and tested revision or snapshot when known
- **AND** reviewer agreement does not turn unknown or static-only evidence into successful execution

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
- **WHEN** reviews contain no actionable concerns after normalization
- **THEN** Markdown gives a concise assessment stating that no actionable concerns were identified, without empty numbered sections or fabricated bug counts

#### Scenario: Report is available as an Archon artifact
- **WHEN** the workflow completes its report node
- **THEN** it writes `prepr-report.md` and `prepr-report.json` to `$ARTIFACTS_DIR` and returns valid `archon_artifact` pointers for those relative paths rather than printing the complete report to the node transcript

### Requirement: Archon-native interaction
The system SHALL use Archon's existing workflow graph and node transcripts as its interactive surface. A user MUST be able to complete review, debate, and report through one workflow invocation without separate review or debate commands.

#### Scenario: Comprehensive local invocation
- **WHEN** a user starts a valid Prepr workflow invocation for a local change
- **THEN** the workflow carries the process from parallel review through debate and final report without requiring further user commands
