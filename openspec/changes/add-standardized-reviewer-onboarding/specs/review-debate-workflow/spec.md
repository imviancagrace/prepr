## MODIFIED Requirements

### Requirement: Reviewer skill resolution
The system SHALL resolve a reviewer skill from either a local skill source or a GitHub source pinned to an immutable revision. A GitHub source MUST be used only to obtain the reviewer skill; the workflow MUST NOT inspect, create, modify, or comment on a GitHub pull request.


Resolved source identity MUST map to a current locally accepted standardized reviewer package before either readiness model probe or initial review starts. Named profiles, default selections, direct references, and bundled reviewers MUST all obey this requirement. Raw, unsupported, stale, or unaccepted selections MUST fail with side-specific preparation guidance and MUST NOT fall back to loading the original workflow instructions. Normal runs MUST NOT prepare or accept candidates or mutate reviewer configuration. Scope-only preview MUST remain exempt.
#### Scenario: Pinned GitHub skill source
- **WHEN** a selected profile references a GitHub reviewer skill at a pinned revision
- **THEN** the system resolves that revision for the assigned reviewer agent without treating any GitHub PR as review scope

#### Scenario: Direct reference bypass is attempted
- **WHEN** a direct skill source has no matching accepted standardized package
- **THEN** preparation stops before either readiness probe or initial review with guidance to onboard that source

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
