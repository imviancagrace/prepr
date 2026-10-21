## Purpose

Enable users to install and configure Prepr in a local Git project through a reusable assistant skill, obtaining workflow files from the remote main branch without starting a review.

## ADDED Requirements

### Requirement: Portable setup skill and project selection
The system SHALL provide a self-contained `prepr-setup` skill usable from Codex or Claude Code, without depending on the author's laptop paths or personal reviewer skills. It MUST identify the intended local Git project before project writes, ask when the target is ambiguous, and preserve unrelated project content. Marketplace publication MUST remain separate from setup execution.

#### Scenario: User selects a project
- **WHEN** the user invokes setup with an unambiguous local Git project
- **THEN** setup targets that project and reports the resolved location
- **AND** it does not require a local development copy of Prepr

#### Scenario: Target is ambiguous or invalid
- **WHEN** setup cannot identify a valid intended Git project
- **THEN** it requests the missing project selection or reports the invalid target before modifying project files

### Requirement: Remote main source and provenance
Setup SHALL obtain workflow content from `https://github.com/imviancagrace/prepr.git`, branch `main`, on each invocation that installs or updates content. It MUST resolve and record the fetched commit and install consistent content from that revision. It MUST NOT silently use an old cache, another branch, or a local development checkout when remote access fails. Existing credentials MAY authorize private repository reads; setup MUST NOT embed credentials in installed files or reports.

#### Scenario: Install from current main
- **WHEN** remote main is accessible
- **THEN** setup installs content from its resolved commit and records the URL, branch, and commit

#### Scenario: Remote source is inaccessible
- **WHEN** main is unavailable or repository authorization fails
- **THEN** setup reports the access failure and needed next step without replacing existing workflow files or claiming successful installation

### Requirement: Authorized prerequisite preparation
Setup SHALL detect Git, Bun, Archon 0.11.1 or later, the native launcher or launchers selected for the reviewer pair, and tools needed by the selected installation method or explicitly declared reviewer dependencies. It MUST inspect tool availability and compatible versions before proposing changes, explain missing or insufficient prerequisites, and obtain user permission before installation or upgrades. It MUST preserve compatible installations and MUST NOT install an unused second launcher merely because it is supported.

#### Scenario: Missing tools are approved
- **WHEN** setup identifies missing prerequisites and the user authorizes their installation
- **THEN** setup installs the approved tools using supported platform instructions and verifies their availability afterward

#### Scenario: User declines an installation
- **WHEN** the user declines a required installation
- **THEN** setup leaves that tool unchanged and reports setup as incomplete with the remaining steps

#### Scenario: Authentication requires user interaction
- **WHEN** a prerequisite or selected resource requires login
- **THEN** setup directs the user through the appropriate interactive authentication and reassesses availability afterward
- **AND** it does not collect passwords or tokens in project configuration

#### Scenario: Platform installation cannot be supported
- **WHEN** no verified installation method is available for the detected platform
- **THEN** setup reports that limitation and gives applicable manual next steps without claiming completion

### Requirement: Complete and recoverable workflow installation
Setup SHALL install the complete `.archon/workflows/prepr/` package, including shared modules and executable helper permissions, into the selected project. It MUST preserve unrelated workflows. Identical existing content MUST be reusable without rewriting it. Before replacing differing installed workflow content, setup MUST explain the difference, obtain the user's replacement choice, and retain a recoverable copy. Failed replacement MUST leave the previous usable installation available.

#### Scenario: Fresh workflow installation
- **WHEN** the project has no installed Prepr workflow and the source package is valid
- **THEN** setup installs all required workflow content and verifies the expected entrypoints and referenced files

#### Scenario: Existing workflow differs
- **WHEN** installed workflow content differs from fetched main
- **THEN** setup asks whether to retain it or replace it with the fetched version before overwriting anything
- **AND** replacement retains a recoverable copy and reports the resulting installed version

### Requirement: User-selected reviewer configuration and reinvocation
Setup SHALL configure two user-selected reviewer skills using Prepr's existing local profile contract, including names, supported native launchers, a default pair, and compatible model selection. It MUST support existing local skill paths and immutable pinned GitHub skill references. It MUST NOT assume Vee is installed or select a reviewer pair without the user's choice. Optional severity mappings and required-access declarations MUST remain explicit.

When `.archon/prepr.local.yaml` already exists, setup MUST ask whether to keep it or configure a new pair. Choosing keep MUST preserve its bytes. Choosing new MUST preserve unrelated profiles and settings unless the user explicitly requests their removal, retain a recoverable copy, and validate a staged replacement before writing it. Invalid kept configuration MUST remain unchanged with actionable guidance and MUST NOT be reported as ready. The local profile file MUST be excluded from new Git tracking without removing unrelated ignore rules or silently changing the index of an already tracked file.

#### Scenario: Fresh reviewer selection
- **WHEN** no local configuration exists
- **THEN** setup obtains two reviewer selections and produces valid profiles and a default pair using the chosen launchers and model settings

#### Scenario: Keep existing configuration
- **WHEN** configuration exists and the user chooses keep
- **THEN** setup leaves it unchanged and validates it for the final setup assessment

#### Scenario: Configure a new pair
- **WHEN** configuration exists and the user chooses a new pair
- **THEN** setup validates the replacement, preserves unrelated configuration, and retains the prior file for recovery before replacing it

#### Scenario: Profile is already tracked
- **WHEN** the machine-specific profile file is tracked by Git
- **THEN** setup identifies the condition and asks for the user's remediation choice without silently untracking it or claiming that adding an ignore rule makes it untracked

### Requirement: Setup-only validation and command handoff
Setup SHALL verify installed file integrity, local configuration, selected skill references, prerequisite versions, and launcher/model configuration compatibility using bounded checks that do not invoke any Prepr workflow. It MUST NOT run `archon workflow run prepr`, including preview-only mode, automatically. It MUST NOT launch code-review, debate, or model-probe sessions as part of setup. Static validation MUST NOT be described as proof of launcher authentication, model entitlement, reviewer sandbox access, or passing project tests; unknown checks MUST remain visible.

The final response MUST identify completion or blockers, installed source revision, project and configuration locations, approved changes made, and commands for default local review, explicit branch review, and optional scope preview. It MUST explain that local scope selects uncommitted changes and branch scope requires a clean checkout. When setup is incomplete, commands MUST be labeled for use after the reported blockers are resolved.

#### Scenario: Setup succeeds
- **WHEN** all setup checks succeed
- **THEN** setup reports configuration complete and provides runnable workflow commands for the selected project
- **AND** no Archon Prepr workflow or reviewer/model session has started
- **AND** it explains that actual authentication, model availability, and declared resource access are checked by a later normal run

#### Scenario: Validation is incomplete
- **WHEN** a dependency, configuration, or source check fails or remains unknown
- **THEN** setup reports the specific limitation and next step without claiming full readiness
- **AND** it does not run a workflow to resolve the uncertainty
