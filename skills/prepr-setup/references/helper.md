# Setup helper contract

Run with Bun using the absolute installed skill directory; the helper has no package dependencies. Shell examples use placeholders: substitute actual paths with argument-safe quoting. Do not interpolate untrusted paths into shell code.

```sh
bun /path/to/prepr-setup/scripts/setup.ts inspect /path/to/project codex
bun /path/to/prepr-setup/scripts/setup.ts fetch
bun /path/to/prepr-setup/scripts/setup.ts plan /path/to/project /returned/staging/source
```

`fetch` always clones the fixed remote's main into fresh temporary storage. Keep its `staging` for cleanup and `source` for this invocation. `plan` checks the Git root, source identity and cleanliness, complete package, existing workflow differences, and config hash. Show `changed` before obtaining keep/replace consent. Every invocation installing/updating must fetch again, even if the skill itself came from an existing clone.

For new profiles, prepare a YAML file outside the project, with user-selected values:

```yaml
default_pair:
  reviewer_a: first
  reviewer_b: second
reviewers:
  first:
    name: First reviewer
    launcher: codex
    model: USER_SELECTED_COMPATIBLE_MODEL
    skill: /absolute/path/to/first/SKILL.md
  second:
    name: Second reviewer
    launcher: codex
    model: USER_SELECTED_COMPATIBLE_MODEL
    skill: bundled:peer
```

`bundled:peer` is only valid in new input. First run `stage-bundled <project> <source>` to create a stable, versioned, inactive local copy; prepare that returned source and obtain human acceptance. It does not activate a reviewer. Neither reviewer is implicit. Existing relative skill paths resolve from the target project. Remote skill references must pin a 40-character SHA; source verification uses bounded Git reads. Required-access declarations are schema/tool checks only; actual resources are not probed. A matching Archon large-tier provider can replace an explicit profile model; the helper never sets global tiers.

After obtaining user choices, write this temporary JSON request outside the project:

```json
{
  "project": "/absolute/project",
  "source": "/returned/staging/source",
  "workflow": "replace",
  "config": "new",
  "configFile": "/temporary/new-profiles.yaml",
  "expectedConfigHash": null,
  "expectedWorkflow": {},
  "acceptances": [{"id":"DRAFT_ID","digest":"HUMAN_ACCEPTED_DIGEST","decision":"accept"}]
}
```

Use exact `configHash` and `current` values returned by `plan` for `expectedConfigHash` and `expectedWorkflow`; these reject changes since inspection. `workflow` must be `keep` or `replace`; `config` must be `keep` or `new`. Keep requires an existing installation/config. A differing workflow replacement needs separate consent. Omit `configFile` for keep. New YAML merges unrelated profiles/settings; the agent must resolve profile ID collisions before submission.

```sh
bun /path/to/prepr-setup/scripts/setup.ts preview /temporary/request.json
# Show the preview and obtain explicit prerequisite confirmation before apply.
bun /path/to/prepr-setup/scripts/setup.ts apply /temporary/request.json
bun /path/to/prepr-setup/scripts/setup.ts verify /absolute/project /returned/staging/source
```

No workflow/model process starts. Errors yield `status: incomplete`; report that error, don't mark setup complete or work around it by running Prepr. Verify hashes and mode bits against the local provenance record. Backups are stored at `.archon/prepr-backups/<id>/`, with numbered files corresponding to ordered replacements; each backup includes a mapping of original paths. Restore only the requested prior paths, preserving newer user changes. Local state is excluded through the project's Git info/exclude without index changes. Tracked profile input blocks before writes and needs a user remediation decision.

`apply` and `verify` return static assessment, source revision (or null for unknown retained content), project/config paths, and five commands (four review/preview commands plus optional `archon serve`). Display them as instructions. Remove temporary source, YAML, and request files after use; don't remove project backups or change installed tools automatically.

For deterministic execution of an already approved prerequisite plan after Bun exists, `install <plan.json> <approved-plan.json>` accepts two arrays of `{ "tool": "tool-name", "command": ["executable", "arg"] }`. Only pass an approved snapshot after explicit conversational permission; matching files alone are not human permission. The helper rejects changed plans, executes exact argument arrays, and checks version-command success; run `inspect` afterward to establish compatible versions. Install scripts and command arrays must come from the approved official method, never reviewer content. Bootstrap Git/Bun with approved shell commands first. Login is an interactive user handoff, not an installer/model call.

Bundled reviewer sources are stored at `.archon/prepr-reviewers/sources/<main-commit>/peer-review-guidelines/`. Existing unrelated/older peer folders are preserved. An edited versioned source stops with explicit guidance; do not overwrite it silently. New source revisions receive new paths and need new human acceptance. Existing profile references continue to resolve their registered source versions.

Pass the fetched source to `verify` when retaining an older workflow. This reuses main’s current pure profile validator without modifying the kept workflow. Without the source argument, verification uses the installed validator and older installations can report missing setup support.


Before apply, check or prepare each selected reviewer using the preparation skill bundled in the fetched remote checkout. Structural validity alone is insufficient. `acceptances` contains only candidate id/digest/accept decisions actually authorized by the human after preview. Setup stages these records with the profile/workflow transaction; failed replacement restores prior active mappings. Omitting acceptances is valid only when all selected packages are already accepted and unchanged. `keep` never bypasses this validation. The local Git metadata scope marker and ignored registry bind acceptance to this project; imported records are not proof of local consent. Setup does not start an Archon workflow or separate model session.


## Prerequisite confirmation

Run `preview <request.json>` after concrete reviewer acceptance and configuration choices. It validates static prerequisites and shows effective launcher/model `selections` and `confirmation.digest` without an AI session or active-state writes. If status is `confirmation-required`, show its check results and named selections, ask the human to confirm they are logged in and can use those models, and wait. Only that explicit answer authorizes adding:

```json
"confirmation": {"digest": "SHOWN_CONFIRMATION_DIGEST", "decision": "confirm"}
```

Then `apply` recomputes selections and rejects a changed digest. It stages `.archon/prepr-prerequisites.json` with profile, reviewer registry and workflow changes in the same rollback transaction. Matching existing local confirmation can be reused by omitting `confirmation`. A decline/unanswered response leaves prior active state unchanged. State binds the canonical project and local Git scope marker, launcher executable identities and effective models; imported or stale records do not qualify. No credential content is saved. The file is Git-excluded and kept profile bytes are preserved. If already tracked, obtain explicit remediation; no automatic index changes.

Explicit pins and resolved Archon tiers participate in confirmation. Runtime direct overrides must match confirmed launcher/model selections; otherwise rerun setup to confirm them. Unchanged reviewer standards do not need renewed reviewer acceptance for a launcher/model change. Actual sessions establish login/model/resource access; static checks and user confirmation never prove it. Setup and normal runs never start AI readiness probes. Existing installations without confirmation rerun setup, reusing their unchanged accepted reviewer packages.

The fifth returned command starts the optional web UI: `archon serve`. `ui` describes foreground execution in a separate terminal, default port 3090, and binary-install first-use asset download. Display these instructions without executing the command or fetching assets. Existing review/preview commands stay independent of the server. The UI is optional for CLI review; source installations may need Archon's documented UI build step.

## Concrete client and terminal handoff

After `fetch`, run `suggest <project> <source> <codex,claude>` to obtain matching effective Archon large-tier models and their source. A missing match requires an explicit compatible choice. Suggestions do not certify account access, choose the newest model, modify global tiers or override explicit pins.

Preview returns named `executableDetails` (absolute `path`, observed `version`, launcher and effective model). The confirmation binds executable paths and models; a changed selected client requires renewed confirmation. Respect explicit `PREPR_CODEX_BIN`/`PREPR_CLAUDE_BIN` overrides; never switch silently to an app-bundled installation. Observed version changes alone do not invalidate reviewer acceptance.

Apply/verify return `handoff.pathCommand`, `verifyCommand`, `remainingChanges` and local-exclusion guidance. Display the safely quoted detected PATH command only as a manual terminal repair; setup cannot establish another terminal’s PATH. Persistent shell configuration edits require separate permission. The helper excludes only the Prepr workflow package through Git info/exclude and preserves unrelated rules/workflows; to share it remove its rule and explicitly add/commit it. Already tracked files remain tracked. This does not clean remaining project changes or bypass the clean-checkout branch guard. Runtime scope filtering independently excludes managed Prepr tooling and known/configured generated output even when staged/committed.
