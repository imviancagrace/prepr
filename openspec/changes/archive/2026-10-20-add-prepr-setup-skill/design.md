## Context

See proposal.md for motivation and specs/prepr-setup/spec.md for the behavior contract. The repository currently ships an Archon package at `.archon/workflows/prepr/`, one bundled reviewer at `reviewers/peer-review-guidelines/`, and Bun tests. It has no installer or marketplace manifest. The existing README requires Archon 0.11.1+, Bun, and chosen native launchers. Profiles live at `.archon/prepr.local.yaml`; model fallback uses Archon's effective large tier only when its provider matches the chosen launcher. Runtime readiness deliberately launches model probes, making it unsuitable for setup-only validation.

The remote is `https://github.com/imviancagrace/prepr.git`, with `main` as the requested source. It is currently private. Existing review-workflow requirements remain unchanged.

## Goals / Non-Goals

**Goals:** A self-contained skill portable between Codex and Claude Code; fresh remote-main installation with exact provenance; authorized prerequisite preparation; safe repeat invocation; accurate setup assessment without executing a workflow.

**Non-Goals:** Marketplace submission, repository visibility changes, automatic reviewer selection, modifying reviewer skills to make them compatible, configuring unrelated global tools, starting previews or reviews, or proving account model entitlement through a model call.

## Decisions

### 1. A shared skill with small deterministic helpers

Place the portable entrypoint at `skills/prepr-setup/SKILL.md`. Keep consent, target clarification, reviewer choices, and final handoff in the agent instructions. Use a small helper for staging, validation, package comparison, provenance, and recoverable writes where reproducibility matters. Use Bun for post-bootstrap helper work to reuse the existing runtime; prerequisite detection and installation must be possible through shell/tool operations before Bun exists. Keep platform-specific installation references separate and consult only the detected platform's official instructions.

Do not depend on global Vee, author paths, another optional skill, or OpenSpec being installed on the recipient's laptop. The same skill folder must work when copied into either host's supported skill directory. Add host metadata only as verified installation requirements demand; avoid inventing marketplace manifests or treating successful local installation as marketplace acceptance. Document local/manual skill installation; actual submission is a later action.

Alternative: duplicate host-specific skills or bundle the workflow in the skill. Rejected because duplication drifts and bundled content does not satisfy fetching remote main.

### 2. Resolve the target and selections before choosing dependencies

Confirm the intended Git root, inspect existing workflow/profile state, and ask keep/new for any existing profile. For a fresh/new pair, obtain the two skill sources and native launchers. Both may use the same launcher; the optional bundled peer reviewer is a choice, never an automatic default. Retain supported optional profile fields and unrelated profiles. Do not infer severity mappings or resource authorization from a skill's arbitrary startup instructions.

Inspect Git, Bun, Archon version, selected launchers, and needed dependency tools. Git may need to be installed before a root can be verified or remote content fetched; ask for the target path first and validate its Git root after approved bootstrap. Only install the required set. Do not install project application dependencies or run application setup commands.

### 3. Ask for installation permission on a concrete plan

Report missing/insufficient tools, the installation method, and intended machine changes, then wait for permission. A single approved plan may cover several named tools; changing the plan requires updated authorization. Use maintained official installation methods for the detected OS, verify results, and report unsupported platforms or failures. Do not automatically install a package manager merely because a preferred command needs one; include that dependency in the approved plan or use an available supported method.

Keep working compatible installations. Interactive account login remains with the user; never place credentials in YAML or provenance. Authentication status checks can be used where supported, but their limitations must be explicit. No model invocation is allowed. Do not silently change global Archon tiers: use an explicit profile model chosen by the user when the current tier's provider does not match. An unavailable model list means compatibility/entitlement is unverified, not permission to invent a model or switch launchers.

### 4. Fetch main once and install its pinned content

Use a fresh temporary checkout or fetch of the fixed remote's `main`, then resolve its commit. Copy from that commit's complete package, preserving executable modes and shared modules. Never fetch a similarly named repository or use whichever branch is cached. A later invocation fetches main again. Record URL, branch, resolved SHA, installed-file hashes, and relevant installed paths in local `.archon/prepr-install.json`, excluded from Git along with `.archon/prepr.local.yaml`. This record is setup state, not a workflow report artifact, and contains no credentials.

Remote reviewer skill references keep the existing immutable GitHub syntax. Verify source/path readability without executing skill instructions. If the user selects the bundled peer reviewer, materialize its folder from the same resolved remote commit at `.archon/prepr-reviewers/peer-review-guidelines/` so profile references survive temporary-checkout cleanup. Record that managed content in installation provenance. Do not install Vee or other personal skills implicitly.

### 5. Stage changes and preserve repeat-run choices

Treat workflow content updates and reviewer configuration as separate decisions: keeping profiles does not authorize overwriting a customized workflow, and replacing workflow files does not authorize resetting profiles. Compare managed files with the fetched package and previous manifest. Reuse identical files. Show differing files before asking keep/replace; preserve backups outside the active workflow discovery path and ignore local backups in Git. For older installations without a manifest, treat existing content as unmanaged and require the same explicit replacement choice.

Validate source package structure and staged YAML before replacement. Stage files on the destination filesystem, retain a recoverable prior version, and restore it if replacement fails. Preserve other workflows and unrelated configuration. For kept workflows, retain their known installed revision or report it unknown; never label retained differing files as the fetched revision. A declining or failing update must not erase the prior installation.

Use existing profile schema logic where it can be reused without invoking workflows or model probes; otherwise extract the smallest pure validation function rather than duplicate the schema. Inspect helper import paths before reuse: current core imports workflow-relative modules, so avoid a helper that works only from the author's checkout.

### 6. Validate setup without running Prepr

Check versions, workflow entrypoints and referenced files, profile syntax/default pair, local skill files or pinned remote skill paths, model pin/tier provider consistency, and local ignore/tracking status. A tracked local profile requires a user remediation decision; adding an ignore rule cannot fix index tracking. No initial/review/debate/readiness launcher calls, `checkReadiness`, workflow invocations, or preview invocations are allowed. Runtime readiness remains the normal workflow's responsibility.

Finish with actual project/config paths, provenance, retained versus changed files, tool actions, backup paths, blockers, and unverified authentication/model/resource checks. Show commands with a safely quoted project directory for:

- `archon workflow run prepr --no-worktree`
- `archon workflow run prepr --no-worktree --input scope=branch`
- `archon workflow run prepr --no-worktree --input preview_only=true`
- `archon workflow run prepr --no-worktree --input scope=branch --input preview_only=true`

Explain local versus clean-branch scope. Commands are instructions only and must never execute automatically.

## Risks / Trade-offs

- Main can advance between installations: pin once per invocation and record the actual SHA; consistency does not imply a release guarantee.
- Private source blocks general distribution: identify access requirements and stop on denied fetches; publication/visibility decisions remain outside this change.
- Tool installation differs across platforms: verify current official instructions during implementation and use; clearly report unsupported cases instead of guessing commands. Do not promise a platform matrix not actually validated.
- Static setup cannot prove model entitlement or sandbox access: show those limits and leave bounded model/resource probes to a user-started normal run.
- Skill instructions alone can drift in execution: test helper invariants and realistic consent/reinvocation scenarios with command-recording fakes, including an explicit assertion that no workflow/model session starts.
- Workflow installation itself creates local changes: explain this in the handoff; the user decides whether to commit package files before selecting branch scope.

## Migration Plan

Add the skill and supporting resources without altering runtime workflow semantics. Validate in temporary Git projects with controlled remote fixtures and fake tool installers, without changing developer global installations. Document skill installation and private-source access. Existing manual installations are adopted only through the explicit keep/update paths. Roll back project updates from retained backups; do not uninstall shared prerequisites automatically. Keep marketplace publication as a separate, explicitly requested operation.
