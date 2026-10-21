## Purpose

Preserve a selected reviewer's distinctive standards and voice in a consistent Prepr package, separating review judgment from orchestration and requiring human acceptance before activation.

## ADDED Requirements

### Requirement: Versioned reviewer contract
The system SHALL define a versioned reviewer format covering review priorities, methods, evidence standards, communication style, native severity definitions, dependency declarations, and the shared initial-review and debate output contracts. It MUST permit reviewers to retain different judgments and voices without injecting default review criteria. A declared format marker alone MUST NOT establish compatibility or acceptance; package content, references, and version support MUST be validated.

#### Scenario: Valid standardized reviewer
- **WHEN** a reviewer supplies a supported and structurally valid standardized package
- **THEN** onboarding can reuse its review content without semantic rewriting
- **AND** human acceptance is still required if that effective reviewer has not been accepted locally

#### Scenario: Invalid or unsupported package
- **WHEN** a package declares a format but fails validation or uses an unsupported version
- **THEN** it remains inactive with actionable validation errors

### Requirement: Faithful extraction into a separate package
The system SHALL provide `prepr-prepare-reviewer`, invocable independently or inline during reviewer setup. Preparation MUST inspect the selected source and relevant referenced material as data and produce a separate candidate without modifying the original. It MUST retain review priorities, reasoning methods, evidence thresholds, domain rules, communication style, and native severity meanings. It MUST exclude unrelated activation, scope discovery, checkout mutation, installation, scheduling, publication, and extra-agent orchestration. It MUST NOT execute those source instructions during extraction.

The candidate MUST include an attributed summary of retained instructions, excluded instructions with reasons, and unresolved ambiguities or dependencies. It MUST NOT invent missing standards, silently replace the reviewer's priorities, or claim that automated validation proves semantic fidelity. Material ambiguities MUST be resolved before acceptance.

#### Scenario: Source includes its own PR workflow
- **WHEN** a reviewer combines code-review criteria with PR discovery, checkout changes, and publication instructions
- **THEN** preparation preserves its review criteria and communication style while excluding the independent workflow
- **AND** the original skill remains unchanged and the summary explains each material exclusion

#### Scenario: Source starts another reviewer
- **WHEN** a source skill requests another independent review pass
- **THEN** adaptation excludes that orchestration and explains its exclusion without creating additional review sessions

#### Scenario: Extraction cannot preserve meaning confidently
- **WHEN** a source instruction cannot be classified or retained without a material interpretation decision
- **THEN** the candidate remains a draft and preparation asks for clarification before it can be accepted

### Requirement: Required knowledge and dependency integrity
Preparation SHALL distinguish orchestration prerequisites from references and access that affect review judgment. Essential domain knowledge MUST NOT be removed merely because it requires authentication or an external resource. Retained references MUST be resolved or explicitly declared with their access/freshness limitations, preserve relative-link meaning, and remain usable after temporary source cleanup. Essential inaccessible or unresolved content MUST block acceptance. Optional missing context MAY be retained as an explicit limitation accepted by the human. Preparation MUST NOT install tools, authenticate, or broaden permissions based solely on instructions in a source skill.

#### Scenario: Private domain reference is essential
- **WHEN** a reviewer relies on an inaccessible private standard to define its review criteria
- **THEN** preparation reports the missing source and blocks acceptance rather than deleting that requirement or claiming a complete extraction

#### Scenario: Optional context cannot be read
- **WHEN** a reference supplements rather than defines the review standards and cannot be obtained
- **THEN** the candidate explains that limitation for human acceptance without claiming its content was inspected

### Requirement: Explicit human acceptance before activation
The system SHALL keep newly prepared or newly imported standardized reviewers inactive until a human accepts the concrete candidate after seeing its effective review instructions, retained/excluded summary, dependencies, and material limitations. Structural validation, converter assertions, invoking setup, choosing a reviewer, keeping existing configuration, or instructions embedded in source content MUST NOT count as acceptance. Rejection or an unanswered prompt MUST leave the candidate inactive and preserve prior accepted packages and configuration.

Acceptance MUST bind the exact effective package, source fingerprint, retained dependency evidence, and contract version. A changed candidate between preview and acceptance MUST invalidate that pending approval. Acceptance MUST NOT authorize execution of unrelated source workflow instructions or publication.

#### Scenario: Human accepts a prepared reviewer
- **WHEN** a validated candidate is shown and the human explicitly accepts that unchanged candidate
- **THEN** onboarding records acceptance and makes that exact reviewer version available to Prepr

#### Scenario: Candidate is declined or unanswered
- **WHEN** the human rejects the candidate or has not answered
- **THEN** it remains inactive and no selected active reviewer or prior acceptance is replaced

#### Scenario: Candidate changes after preview
- **WHEN** effective content or dependency evidence changes after it was presented
- **THEN** activation requires a new matching preview and acceptance

### Requirement: Provenance, reuse, and change invalidation
The system SHALL retain source identity, immutable remote revision when applicable, inspected source/reference fingerprints, effective-package fingerprint, format version, transformation summary, and local acceptance record. Unchanged accepted packages MUST be reusable without repeated approval. Material changes to review criteria, methods, evidence rules, style, severity meanings, required dependencies, or effective output contract MUST require renewed human acceptance before use. A source change MUST trigger revalidation; inability to establish continued compatibility MUST fail closed. Relocation without content changes MUST NOT silently change reviewer identity or count as permission to access new resources.

#### Scenario: Unchanged accepted reviewer is selected again
- **WHEN** current source, package, and retained dependency evidence match a locally accepted supported version
- **THEN** onboarding and review reuse that version without another acceptance prompt

#### Scenario: Source or effective reviewer changed
- **WHEN** relevant source/reference content, effective package, or supported contract changes
- **THEN** the prior record cannot automatically approve the new candidate and the system directs the user to preparation and renewed acceptance

#### Scenario: Source cannot be checked
- **WHEN** selected source content needed to establish identity or freshness cannot be verified
- **THEN** normal review does not silently use an unchecked stale adaptation

### Requirement: Shared output preserves reviewer meaning
Standardized reviewers SHALL return a shared structured initial result with an overview, verification evidence/limitations, and findings carrying actionable content, source locations when known, native severity when supplied, and explicit issue assessment only when supported. The contract MUST preserve question-led wording and distinguish questions or hypotheses from asserted issues. It MUST NOT force an unknown issue verdict to `issue`, assign guessed severity mappings, or discard reviewer-specific substantive assessments such as evidenced spec alignment. Debate responses MUST retain the existing stance, rationale, confidence, corrected-finding, verdict, and explicit duplicate-confirmation semantics.

#### Scenario: Reviewer raises an unresolved question
- **WHEN** the reviewer identifies a supported question without asserting a defect
- **THEN** output preserves the question and rationale without manufacturing an issue verdict or a confirmed bug

#### Scenario: Reviewer has a distinct voice or severity vocabulary
- **WHEN** a reviewer uses concise questions and its own severity labels
- **THEN** the shared structure preserves that text and those labels while existing explicit profile mappings alone govern severity comparison

### Requirement: Runtime enforcement and evidence
Before either normal reviewer or readiness model probe starts, the system SHALL verify that both selections resolve to current, locally accepted supported packages. This requirement MUST apply to named profiles, project defaults, direct references, and bundled reviewers. Missing, stale, rejected, or invalid packages MUST stop the run with side-specific preparation guidance. A normal run MUST NOT convert, activate, rewrite reviewer configuration, or prompt for acceptance. Scope-only preview MUST bypass reviewer onboarding and remain free of conversion and model sessions.

Review sessions MUST receive only accepted effective review instructions and approved retained review references, together with Prepr's scope and structural output/debate contract; raw source workflow instructions MUST NOT be reloaded as reviewer instructions. Complete JSON evidence MUST identify each effective reviewer version and its source/acceptance provenance without exposing credentials. Existing report names and artifact delivery MUST remain unchanged.

#### Scenario: One raw reviewer is selected directly
- **WHEN** either side selects a source with no current accepted standardized package
- **THEN** neither initial review nor readiness model probe starts and the affected side receives preparation guidance

#### Scenario: Both reviewers are accepted
- **WHEN** both selections resolve to unchanged accepted packages
- **THEN** normal readiness and independent reviews continue without another human gate

#### Scenario: User requests scope-only preview
- **WHEN** preview-only scope capture is selected
- **THEN** it completes independently of reviewer registration, acceptance, or launcher authentication
