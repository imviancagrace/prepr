## MODIFIED Requirements

### Requirement: User-selected reviewer configuration and reinvocation
Setup SHALL configure two user-selected reviewer skills using Prepr's existing local profile contract, including names, supported native launchers, a default pair, and compatible model selection. It MUST support existing local skill paths and immutable pinned GitHub skill references. It MUST NOT assume Vee is installed or select a reviewer pair without the user's choice. Optional severity mappings and required-access declarations MUST remain explicit.

When `.archon/prepr.local.yaml` already exists, setup MUST ask whether to keep it or configure a new pair. Choosing keep MUST preserve its bytes. Choosing new MUST preserve unrelated profiles and settings unless the user explicitly requests their removal, retain a recoverable copy, and validate a staged replacement before writing it. Invalid kept configuration MUST remain unchanged with actionable guidance and MUST NOT be reported as ready. The local profile file MUST be excluded from new Git tracking without removing unrelated ignore rules or silently changing the index of an already tracked file.


For each selected reviewer, setup MUST inspect standardized compatibility and current local acceptance. Raw or changed sources MUST enter reviewer preparation inline, and no new or materially changed candidate may become active until the human accepts its concrete extraction preview. An already standardized but unaccepted reviewer also requires acceptance. Keeping existing YAML MUST preserve its bytes and MUST NOT bypass onboarding; the separate local reviewer registry MAY be prepared without rewriting kept configuration. Unchanged accepted reviewers MUST be reused without repeated prompts. A declined or blocked reviewer MUST leave setup incomplete without replacing the prior accepted reviewer or silently choosing another skill.
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

#### Scenario: Setup encounters an unprepared reviewer
- **WHEN** a selected reviewer lacks a current accepted standardized package
- **THEN** setup prepares a separate candidate and presents the required human acceptance gate before registration
- **AND** keeping the existing profile file does not imply accepting that candidate

#### Scenario: Setup reuses accepted reviewers
- **WHEN** both selected reviewers match current accepted packages
- **THEN** setup reuses them without another reviewer-acceptance prompt while retaining existing keep/new configuration choices

### Requirement: Setup-only validation and command handoff
Setup SHALL verify installed file integrity, local configuration, selected skill references, prerequisite versions, and launcher/model configuration compatibility using bounded checks that do not invoke any Prepr workflow. It MUST NOT run `archon workflow run prepr`, including preview-only mode, automatically. It MUST NOT launch code-review, debate, or model-probe sessions as part of setup. Static validation MUST NOT be described as proof of launcher authentication, model entitlement, reviewer sandbox access, or passing project tests; unknown checks MUST remain visible.

The final response MUST identify completion or blockers, installed source revision, project and configuration locations, approved changes made, and commands for default local review, explicit branch review, and optional scope preview. It MUST explain that local scope selects uncommitted changes and branch scope requires a clean checkout. When setup is incomplete, commands MUST be labeled for use after the reported blockers are resolved.


Setup validation MUST additionally verify the selected effective reviewer packages and matching local acceptance records. Semantic reviewer preparation MAY run in the invoking assistant during onboarding, but MUST NOT launch a separate reviewer, debate, or model-probe session or any Archon workflow. Human acceptance of a package MUST NOT trigger a review. The final handoff MUST identify accepted reviewer versions or pending onboarding blockers alongside existing setup results.
#### Scenario: Setup succeeds
- **WHEN** all setup checks succeed
- **THEN** setup reports configuration complete and provides runnable workflow commands for the selected project
- **AND** no Archon Prepr workflow or reviewer/model session has started
- **AND** it explains that actual authentication, model availability, and declared resource access are checked by a later normal run

#### Scenario: Validation is incomplete
- **WHEN** a dependency, configuration, or source check fails or remains unknown
- **THEN** setup reports the specific limitation and next step without claiming full readiness
- **AND** it does not run a workflow to resolve the uncertainty

#### Scenario: Human accepts during setup
- **WHEN** a user accepts a newly prepared reviewer candidate during setup
- **THEN** setup may register that candidate and finish with manual workflow commands
- **AND** no review or scope-preview workflow is automatically invoked
