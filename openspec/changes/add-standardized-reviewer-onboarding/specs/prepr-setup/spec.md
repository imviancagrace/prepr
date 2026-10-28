## MODIFIED Requirements

### Requirement: User-selected reviewer configuration and reinvocation
Setup SHALL configure two user-selected reviewer skills using Prepr's existing local profile contract, including names, supported native launchers, a default pair, and compatible model selection. It MUST support existing local skill paths and immutable pinned GitHub skill references. It MUST NOT assume Vee is installed or select a reviewer pair without the user's choice. Optional severity mappings and required-access declarations MUST remain explicit.

When `.archon/prepr.local.yaml` already exists, setup MUST ask whether to keep it or configure a new pair. Choosing keep MUST preserve its bytes. Choosing new MUST preserve unrelated profiles and settings unless the user explicitly requests their removal, retain a recoverable copy, and validate a staged replacement before writing it. Invalid kept configuration MUST remain unchanged with actionable guidance and MUST NOT be reported as ready. The local profile file MUST be excluded from new Git tracking without removing unrelated ignore rules or silently changing the index of an already tracked file.


For each selected reviewer, setup MUST inspect standardized compatibility and current local acceptance. Raw or changed sources MUST automatically enter reviewer preparation inline without requiring the user to invoke another skill or copy sources into a special directory, and no new or materially changed candidate may become active until the human accepts its concrete extraction preview. An already standardized but unaccepted reviewer also requires acceptance. Keeping existing YAML MUST preserve its bytes and MUST NOT bypass onboarding; the separate local reviewer registry MAY be prepared without rewriting kept configuration. Unchanged accepted reviewers MUST be reused without repeated prompts. A declined or blocked reviewer MUST leave setup incomplete without replacing the prior accepted reviewer or silently choosing another skill.
Preparation MUST automatically save separate candidates under the target project’s `.archon/prepr-reviewers/drafts/<id>/package/`, including `SKILL.md`, `reviewer.json`, and retained references. Activation after explicit acceptance MUST save the accepted version under `.archon/prepr-reviewers/accepted/<digest>/` and register it locally. Drafts, accepted packages, and local acceptance state MUST be excluded from new Git tracking; original skills MUST remain unchanged.

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


Setup validation MUST additionally verify the selected effective reviewer packages and matching local acceptance records. Semantic reviewer preparation MAY run in the invoking assistant during onboarding, but MUST NOT launch a separate reviewer, debate, or model-probe session or any Archon workflow. Human acceptance of a package MUST NOT trigger a review. The final handoff MUST identify accepted reviewer versions or pending onboarding blockers alongside existing setup results. The command handoff MUST also include `archon serve`, labeled as the optional manual command for starting the Archon web UI in a separate terminal. It MUST explain that the server runs in the foreground and uses port 3090 by default. Setup MUST NOT automatically start the server or download UI assets as part of presenting this command, and MUST NOT imply that the web UI is required for CLI reviews.
#### Scenario: Setup succeeds
- **WHEN** all setup checks succeed
- **THEN** setup reports configuration complete and provides runnable workflow commands for the selected project
- **AND** no Archon Prepr workflow or reviewer/model session has started
- **AND** it distinguishes static checks and explicit prerequisite confirmation from authentication, model availability, and resource access observed only in later actual reviewer sessions
- **AND** no separate readiness AI session is scheduled or required

#### Scenario: Validation is incomplete
- **WHEN** a required structural, configuration, or source check fails, or required human confirmation is missing
- **THEN** setup reports the specific limitation and next step without claiming full readiness
- **AND** it does not run a workflow to resolve the uncertainty

#### Scenario: Human accepts during setup
- **WHEN** a user accepts a newly prepared reviewer candidate during setup
- **THEN** setup may register that candidate and finish with manual workflow commands
- **AND** no review or scope-preview workflow is automatically invoked

#### Scenario: Setup provides the web UI command
- **WHEN** setup presents its final command handoff
- **THEN** it includes `archon serve` as an optional manual step in a separate terminal, alongside the existing review and preview commands
- **AND** setup does not start the server, download UI assets, or chain review commands after the foreground server command


## ADDED Requirements

### Requirement: Explicit local prerequisite confirmation
Setup SHALL present bounded static prerequisite checks for Git, Bun, supported Archon and the selected Claude and/or Codex launchers, installed workflow integrity, effective launcher/model compatibility, and both locally accepted reviewer packages. Missing prerequisite installation MUST retain the existing explicit user-permission requirement. Setup MUST NOT start an AI session to verify login, model entitlement, or runtime resource access.

After presenting the selected launchers and resolved models, setup MUST obtain explicit human confirmation that the user is logged in to those launchers and can use those models before declaring setup complete. Confirmation MUST be recorded as user attestation, separately from reviewer acceptance, in local Git-excluded state tied to the project and effective launcher/model selections. It MUST NOT contain credentials or be treated as observed authentication, model availability, or external-resource access. Imported confirmation from another project or machine, keeping configuration, accepting a reviewer, invoking setup, and silence MUST NOT count as this confirmation.

Unchanged matching confirmation MUST be reusable without repeated prompts. Changed launcher/model selections, including resolved Archon-tier changes, MUST require renewed confirmation before use, without requiring renewed reviewer acceptance when reviewer content is unchanged. Kept configuration bytes MUST remain unchanged. Rejection, unanswered confirmation, or a failed staged replacement MUST preserve prior active configuration and consent records and leave the requested setup incomplete. Setup MUST NOT start a workflow after confirmation.

#### Scenario: User confirms prerequisites
- **WHEN** static checks pass, both reviewers are accepted, and the user explicitly confirms login and model access for the shown selections
- **THEN** setup saves local prerequisite confirmation and presents manual commands without starting a workflow or model session
- **AND** the final handoff identifies which facts were statically checked and which were user-confirmed

#### Scenario: Confirmation is missing or declined
- **WHEN** the user has not answered or declines the prerequisite confirmation
- **THEN** setup does not declare the requested configuration complete or silently save confirmation
- **AND** prior active configuration and consent remain intact

#### Scenario: Existing confirmation matches
- **WHEN** an unchanged project-local confirmation covers the effective launcher/model selections
- **THEN** setup reuses it without another prerequisite-confirmation prompt while retaining the keep/new configuration choice

#### Scenario: Launcher or effective model changes
- **WHEN** a selected launcher or effective model changes, including a changed Archon tier
- **THEN** setup obtains explicit confirmation for the new selections before they qualify for use
- **AND** unchanged reviewer packages retain their independent existing acceptance

#### Scenario: Existing installation has no prerequisite confirmation
- **WHEN** a project already has valid accepted reviewers but no local prerequisite confirmation
- **THEN** setup reuses unchanged reviewer acceptances and requests only the missing prerequisite confirmation after static checks
- **AND** keeping the profile preserves its bytes
