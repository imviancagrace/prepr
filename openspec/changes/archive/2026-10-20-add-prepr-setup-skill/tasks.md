## 1. Portable skill and installation guidance

- [x] 1.1 Create `skills/prepr-setup/SKILL.md` with project selection, setup-only boundaries, consent routing, and final handoff; validate skill frontmatter/resources and confirm no author-specific paths or personal skill dependencies remain.
- [x] 1.2 Add focused prerequisite references using current official Git, Bun, Archon, Codex, and Claude Code installation documentation and verified host skill-installation conventions; record supported platform methods and verify documented commands without modifying developer global installations or publishing to a marketplace.

## 2. Dependency preparation and remote acquisition

- [x] 2.1 Implement tool/version inspection and selection-dependent installation planning, including bootstrap before Bun/Git exists; verify controlled missing, outdated, compatible, declined, and unsupported-platform scenarios produce the expected plan and make no unapproved installation calls.
- [x] 2.2 Wire approved tool installation and interactive-login handoff with post-install verification; verify fake installers execute only the approved plan, preserve compatible tools, and report failed installation/authentication as incomplete without collecting credentials or launching models.
- [x] 2.3 Fetch the fixed Prepr remote main into temporary staging and record its resolved SHA; verify controlled remotes with differing branches, moving main, denied access, and stale caches always select fetched main or fail without changing installed content.

## 3. Project package installation and recovery

- [x] 3.1 Install and validate the complete workflow package with executable permissions, relative references, and local provenance manifest; verify a fresh temporary Git project receives all shared modules and no unrelated workflows change.
- [x] 3.2 Add identical-content reuse and explicit keep/replace handling for differing or unmanaged workflow files, with backups outside active workflow discovery and failed-write recovery; verify retained content is not mislabeled as the newly fetched revision and replacement failure preserves a usable previous installation.
- [x] 3.3 Materialize the bundled peer reviewer only when selected, using the same fetched revision and a stable project-local path; verify temporary-source cleanup does not break that reviewer and no personal/default pair is selected implicitly.

## 4. Reviewer configuration and local state

- [x] 4.1 Add selection and validation for two profiles, default pair, local/pinned-remote skills, explicit model pins or matching Archon tiers, optional severity mappings, and required-access declarations; verify existing profile contract compatibility without workflow or model-probe calls.
- [x] 4.2 Add mandatory keep/new choice for existing configuration, staged validated replacement, unrelated-profile preservation, and recovery backup; verify keep preserves bytes, invalid kept config reports blockers, and an invalid new pair leaves the old file unchanged.
- [x] 4.3 Exclude profile/provenance/backup state from new Git tracking while preserving existing ignore rules; verify a tracked profile is reported for user remediation without silent index changes.

## 5. Setup-only validation and handoff

- [x] 5.1 Add bounded static installation/configuration checks and a final response with source revision, paths, changes, backups, blockers, and unverified authentication/model/access limits; verify failures cannot produce a successful-readiness claim or invoke runtime readiness helpers.
- [x] 5.2 Produce safely quoted project commands for local review, branch review, and both scope previews, explaining scope and clean-checkout requirements; verify commands are emitted only and remain gated by any reported setup blockers.

## 6. Integration acceptance and documentation

- [x] 6.1 Exercise fresh setup, missing-prerequisite approval/decline, private-source denial, keep/new configuration, customized workflow retention/replacement, and recovery in disposable Git projects with command-recording fakes; assert no `archon workflow run`, reviewer, debate, or model-probe process executes across all paths.
- [x] 6.2 Update README with portable skill installation, private-repository access, repeat-run choices, and manual workflow handoff; verify examples use remote main and distinguish setup validation from runtime readiness without claiming marketplace publication.
- [x] 6.3 Run setup acceptance coverage, the existing Bun suite, skill validation, and strict OpenSpec validation; perform a strategic implementation/spec drift review and report any material differences before declaring the change complete.


Validation (2026-10-20): 54 Bun tests pass across nine files, including 10 setup acceptance tests (296 assertions overall). Temporary Git projects and command-recording fakes covered remote main refresh, denied fetch, bootstrap inspection, approved/declined installation, profile preservation/replacement, tracked-profile rejection, pinned remote skills, bundled reviewer lifetime, separate reviewer-copy choices, retained legacy workflows, and failed-swap recovery. No setup path started a workflow/model session. Skill validation passed using the existing validator with Bun's YAML parser because host Python lacks PyYAML; reference links, shell syntax, diff whitespace, and strict OpenSpec validation also passed. No live prerequisite installers, interactive logins, marketplace publishing, or user-project setup were performed.

Strategic spec-drift review: no material mismatch found with the setup capability or existing review-workflow requirements. Runtime code changes expose the existing pure profile selector with an optional configuration argument; default runtime behavior and artifact delivery are unchanged. Distribution requires publishing this implementation to remote main; setup refuses older main without the pure validation export. Native Windows acceptance is not claimed; the documented WSL/manual route preserves the spec's unsupported-environment behavior.
