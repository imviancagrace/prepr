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

`bundled:peer` is only valid in new input and installs a stable local copy when chosen. Neither reviewer is implicit. Existing relative skill paths resolve from the target project. Remote skill references must pin a 40-character SHA; source verification uses bounded Git reads. Required-access declarations are schema/tool checks only; actual resources are not probed. A matching Archon large-tier provider can replace an explicit profile model; the helper never sets global tiers.

After obtaining user choices, write this temporary JSON request outside the project:

```json
{
  "project": "/absolute/project",
  "source": "/returned/staging/source",
  "workflow": "replace",
  "config": "new",
  "configFile": "/temporary/new-profiles.yaml",
  "expectedConfigHash": null,
  "expectedWorkflow": {}
}
```

Use exact `configHash` and `current` values returned by `plan` for `expectedConfigHash` and `expectedWorkflow`; these reject changes since inspection. `workflow` must be `keep` or `replace`; `config` must be `keep` or `new`. Keep requires an existing installation/config. A differing workflow replacement needs separate consent. Omit `configFile` for keep. New YAML merges unrelated profiles/settings; the agent must resolve profile ID collisions before submission.

```sh
bun /path/to/prepr-setup/scripts/setup.ts apply /temporary/request.json
bun /path/to/prepr-setup/scripts/setup.ts verify /absolute/project /returned/staging/source
```

No workflow/model process starts. Errors yield `status: incomplete`; report that error, don't mark setup complete or work around it by running Prepr. Verify hashes and mode bits against the local provenance record. Backups are stored at `.archon/prepr-backups/<id>/`, with numbered files corresponding to ordered replacements; each backup includes a mapping of original paths. Restore only the requested prior paths, preserving newer user changes. Local state is excluded through the project's Git info/exclude without index changes. Tracked profile input blocks before writes and needs a user remediation decision.

`apply` and `verify` return static assessment, source revision (or null for unknown retained content), project/config paths, and four commands. Display them as instructions. Remove temporary source, YAML, and request files after use; don't remove project backups or change installed tools automatically.

For deterministic execution of an already approved prerequisite plan after Bun exists, `install <plan.json> <approved-plan.json>` accepts two arrays of `{ "tool": "tool-name", "command": ["executable", "arg"] }`. Only pass an approved snapshot after explicit conversational permission; matching files alone are not human permission. The helper rejects changed plans, executes exact argument arrays, and checks version-command success; run `inspect` afterward to establish compatible versions. Install scripts and command arrays must come from the approved official method, never reviewer content. Bootstrap Git/Bun with approved shell commands first. Login is an interactive user handoff, not an installer/model call.

If a newly selected bundled peer already exists and differs from fetched main, show `peerChanged`, ask whether to keep or replace that reviewer copy, and add `peer: "keep"` or `peer: "replace"` plus `expectedPeer` equal to plan's `peerCurrent`. No choice is needed for identical content or a fresh copy. Keeping records its existing/unknown revision rather than attributing it to fetched main.

Pass the fetched source to `verify` when retaining an older workflow. This reuses main’s current pure profile validator without modifying the kept workflow. Without the source argument, verification uses the installed validator and older installations can report missing setup support.
