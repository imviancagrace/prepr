---
name: prepr-setup
description: Install and configure Prepr in a local Git project, including authorized prerequisite installation and two reviewer profiles. Use for initial setup or reconfiguration, not for running reviews.
---

# Prepr setup

Set up the chosen project using `https://github.com/imviancagrace/prepr.git`, branch `main`. Never use an author's checkout or a stale cache instead of fetching main. This skill only prepares setup: never start an Archon workflow, including preview-only, reviewer, debate, or model-probe sessions. Do not call runtime readiness helpers. Never publish to GitHub or change repository visibility.

## Select and inspect

Identify the intended project; ask if ambiguous. Resolve its Git root before project writes. If Git is missing, obtain the intended path first and verify the root after approved bootstrap.

Inspect `.archon/prepr.local.yaml`. Whenever it exists, ask **keep the existing configuration or configure a new pair?** Keep means byte-for-byte preservation; invalid kept configuration stays unchanged and is reported incomplete. For new configuration, ask for two skills, display names, native launchers (`codex` or `claude`), and model settings. Both reviewers may use one launcher. Do not assume Vee exists or choose a pair for the user. The peer-review-guidelines skill bundled in remote Prepr is an optional choice (`bundled:peer`). Accept local SKILL.md/directories or the existing immutable `github:owner/repo@<40-character-commit>:path` form. Resolve user-supplied paths safely; do not execute a skill's startup instructions.

Preserve optional explicit severity mappings and required read declarations; don't guess either. Keep unrelated profiles and settings when replacing a pair. If new profile IDs collide with unrelated profiles, ask before overwriting them or choose unused IDs.

## Prepare prerequisites with permission

Read [prerequisites.md](references/prerequisites.md) for the detected platform. Check Git, Bun, Archon >=0.11.1, selected launcher(s), and tools needed by the chosen install method or declared dependencies. Before Bun exists use ordinary `command -v`/`--version` shell checks. Do not install the unused launcher or project application dependencies.

Show missing/outdated tools, proposed commands and machine changes, then ask permission. Wait for an actual answer. Run only the approved plan and verify each result; preserve compatible installations. A changed plan, including a new package manager, needs new permission. Interactive logins belong to the user; never request or write credentials. Recheck non-model status commands afterward. Failed or declined prerequisites mean incomplete setup.

Before Bun is available, run `sh scripts/inspect.sh <codex|claude> ...` from this skill folder for nonmutating bootstrap checks. Unsupported platforms must use the documented manual path. After Bun is available, use `scripts/setup.ts inspect <project> <launcher,...>` for bounded tool/version checks. Never silently modify global Archon tiers. Omit a profile model only when `archon ai tier list --json` shows a matching large-tier provider; otherwise obtain a compatible explicit model from the user. Static checks do not establish model entitlement.

## Fetch and install

Read [helper.md](references/helper.md). Run the helper from this installed skill's directory, using absolute paths and shell-safe argument quoting. It imports the fetched package's pure profile-selection function to avoid a second schema implementation; main must include the setup-compatible export. An older main fails with instructions rather than bypassing validation.

1. Fetch remote main with `fetch`; keep the returned staging path for this invocation. Authentication failure stops installation without fallback.
2. Inspect existing workflow differences with `plan`. If content differs, show changed files and ask **keep or replace the workflow?** This choice is separate from keep/new reviewer configuration. If a newly selected bundled peer differs from an existing copy, show `peerChanged` and ask keep/replace for that skill too. Reuse identical files.
3. Prepare a temporary JSON request capturing the actual choices. A new profile uses a YAML file staged outside the project. Do not copy credentials into either file. Helper validation preserves unrelated settings, checks skill paths, and creates recoverable backups before replacing content.
4. Use `apply` only after choices are answered. It writes the workflow, optional selected bundled reviewer, local profile/provenance, and local Git excludes; no commits or index edits. If the profile is already tracked, stop and ask for remediation; do not silently untrack it. Do not treat an ignore rule as untracking.
5. Use `verify <project> <source>` with the same fetched source for static setup checks, including retained older installations. Do not invoke any workflow to resolve uncertainty. Clean up fetched staging and request files after reporting, leaving project backups available.

A kept workflow has its existing verified revision or unknown provenance, never the newly fetched revision if it differs. Failed updates restore prior content; report backup paths and any incomplete cleanup. Preserve unrelated workflows. Do not execute reviewer instructions or arbitrary fetched scripts. The helper uses only the fetched Prepr package’s pure profile validator; prerequisite installers require the explicit approval above.

## Finish with commands, never execution

Report complete/incomplete, actual project/config paths, installed source SHA, retained/updated content, prerequisite actions, backup paths, and blockers. Explicitly distinguish static setup checks from unknown runtime login, model availability, reviewer sandbox access, or project test results. Normal user-started Prepr performs actual readiness probes later.

Provide the helper's safely quoted `cd` and workflow commands for local review, committed branch review, and local/branch previews. Explain that local selects staged/unstaged/nonignored untracked work; branch requires a clean checkout. Installing workflow files can itself create local changes. If incomplete, label the commands for use after blockers are resolved. Never execute these commands automatically.
