# Prepr

Prepr is an Archon workflow package for a private, pre-PR discussion between two code-review skills. It does not contain a default review prompt or replace either reviewer. It launches two independent, read-only reviewer sessions on the selected local Git diff (uncommitted changes by default, or explicit committed branch scope), then resumes those same sessions to discuss material disagreements. The result is a private report for engineering judgment; Prepr never creates or updates a GitHub PR.

## Install

Copy `.archon/workflows/prepr/` into the repository you want to review. Archon 0.11.1+, Bun, and the selected launcher CLI (Codex or Claude Code) must be available. Run from the checkout you want reviewed. Uncommitted work is the default; committed branch review must be selected explicitly.

## Guided setup skill

The portable [`prepr-setup`](skills/prepr-setup/SKILL.md) skill prepares a project without starting a review. It fetches `main` from `https://github.com/imviancagrace/prepr.git`, records the fetched commit, asks before installing missing prerequisites, and lets you choose two reviewers. This repository is currently private, so Git access is required.

Install the entire `skills/prepr-setup/` folder, including scripts and references, into your host's skill directory. For example, after cloning the remote:

```sh
git clone --branch main --single-branch https://github.com/imviancagrace/prepr.git /path/to/prepr
# Codex: user-level skills
mkdir -p ~/.agents/skills
cp -R /path/to/prepr/skills/prepr-setup ~/.agents/skills/
# Claude Code: use this alternative destination
mkdir -p ~/.claude/skills
cp -R /path/to/prepr/skills/prepr-setup ~/.claude/skills/
```

Choose the destination for your host; avoid overwriting an existing skill without inspecting it. The documented locations follow the [Codex skills documentation](https://developers.openai.com/codex/skills/) and [Claude Code skills documentation](https://code.claude.com/docs/en/skills/). Invoke `$prepr-setup` in Codex or `/prepr-setup` in Claude Code from the target project. A local skill-folder install does not publish or register a marketplace plugin.

On repeat runs, setup asks whether to keep your reviewer configuration or configure a new pair. Differing workflow files receive a separate keep/replace choice, and replacements retain local recovery backups. It preserves unrelated workflows and profiles. Machine-specific profile/provenance/backup state is excluded locally from new Git tracking; an already tracked profile requires your remediation decision.

Setup validates files, prerequisite versions, accepted reviewer packages, and effective model configuration without launching reviewer/model sessions. It then asks you to confirm that you are logged in to the selected Claude and/or Codex launchers and can use the shown models. This separate project-local confirmation is user attestation, not proof of authentication or model entitlement. It is reused for unchanged launcher/model selections; changes, including resolved Archon-tier models, need renewed confirmation. Confirmation is saved in the Git-excluded `.archon/prepr-prerequisites.json`, without credentials. Choosing keep/new or accepting reviewers does not confirm prerequisites.

Setup finishes with local, branch, preview, and optional `archon serve` commands for manual use. It never invokes these commands or a readiness AI session. Run `archon serve` in a separate terminal: it stays in the foreground and defaults to port 3090. Binary installations download matching UI assets on first use; source installations should follow [Archon's UI build instructions](https://archon.diy/reference/cli/#serve) when needed. The web UI is optional for CLI reviews; setup does not start it or download its assets.

The helper requires the setup-compatible profile validator shipped with this version of Prepr; publish this version to remote `main` before distributing the skill. It fails clearly if fetched main predates that support. POSIX helper/bootstrap flows are provided for macOS, Linux, and WSL; native Windows users should follow the skill's documented WSL/manual path rather than run shell commands in PowerShell. Installation methods and acceptance limits are in the skill's [prerequisite reference](skills/prepr-setup/references/prerequisites.md).

## Prepare and accept reviewers

Normal Prepr runs require **locally accepted standardized reviewer packages** for both selections, including direct skill overrides and the bundled peer. Existing raw skill references must be onboarded first. Scope-only previews continue to work without reviewers.

Use `$prepr-prepare-reviewer` in Codex or `/prepr-prepare-reviewer` in Claude Code, or let `prepr-setup` perform preparation automatically inline after you supply local paths or supported pinned GitHub references. You do not need a separate transformation command or a special upload folder. The standalone [preparation skill](skills/prepr-prepare-reviewer/SKILL.md) can be installed by copying its entire folder into your host's skill directory. Setup reads the preparation resources shipped in its fresh remote-main checkout, so a separate global installation is optional.

Preparation reads the original skill as data, preserves its review criteria and voice, and creates a separate version-1 reviewer package. It excludes independent checkout/PR/setup/extra-reviewer procedures. Essential domain standards are retained; inaccessible essential references and material ambiguities block acceptance. The original skill is never rewritten. Helpers automatically save candidates in the target project’s `.archon/prepr-reviewers/drafts/<id>/package/` and accepted versions in `.archon/prepr-reviewers/accepted/<digest>/`, each with `SKILL.md`, `reviewer.json`, and any retained references. The [format reference](skills/prepr-prepare-reviewer/references/format.md) documents the shared structure and helper commands.

Before activation, the assistant shows the effective instructions, retained/excluded summary, dependencies, limitations, and exact digest and asks you to **accept, edit, or reject**. Choosing the reviewer or keeping existing configuration does not count as acceptance. Unanswered/declined candidates stay inactive. Setup stages accepted changes with profile replacement so failures preserve the prior pair. Acceptance never starts a review.

Unchanged accepted versions need no repeated approval. Version 1 conservatively requires renewed acceptance when source instructions or retained standards change, including cosmetic edits. Unknown freshness, unsupported formats, or altered packages stop a normal run with preparation guidance; it does not silently convert or fall back to the original. Local registry, private drafts, and accepted copies are excluded from new Git tracking; approvals are project-local and not portable claims from a downloaded package.

Your profile's `skill` continues to identify the source; Prepr resolves the accepted effective copy through the local registry. Review sessions load the effective instructions and retained references. Native severity labels and question-led text remain distinct; shared JSON structure adds no common review checklist or automatic issue verdict. The complete report retains effective reviewer/source/acceptance provenance, with the same `prepr-report.md` and `prepr-report.json` artifact delivery.

## Configure reviewer profiles

Profiles are local-only and ignored by Git. Create `.archon/prepr.local.yaml` in the checkout:

```yaml
default_pair:
  reviewer_a: vee
  reviewer_b: security
reviewers:
  vee:
    name: Vee
    launcher: codex
    model: gpt-5.6-sol # optional only with a matching Archon large-tier provider
    skill: /Users/you/.codex/skills/vee
    severity_map: # optional; only explicit mappings establish comparable urgency
      P1: high
      P2: medium
    required_access: # optional declared reads, checked inside the reviewer environment
      - tool: gh
        resource: repos/your-org/your-repo
  security:
    name: Security review
    launcher: claude
    skill: /Users/you/.claude/skills/security-review
    severity_map:
      Must fix: high
      Should fix: medium
```

A profile must state its native launcher: `codex` or `claude`. `model` is optional and pins a model only for that profile; otherwise Prepr uses Archon's configured `large` tier when it is for that launcher. If the tier names another launcher, pin a compatible model or configure the tier before running. A local reference can point to a skill directory or directly to its `SKILL.md`. A GitHub skill reference must pin both commit and skill path:

```text
github:owner/repository@0123456789abcdef0123456789abcdef01234567:path/to/skill
```

A profile can declare `required_access` entries with `tool` and `resource`. Supported runtime reads are `file` (an exact path), `gh` (an API resource read with `gh api --method GET`), and `git` (a repository URL read with `git ls-remote`). Unsupported resource declarations stop static validation; failed or unverifiable required reads during actual review leave the affected assessment blocked/incomplete. Optional missing context remains a visible limitation. No declarations means additional dependency access is undeclared, not verified. This is not an arbitrary setup-command runner; Prepr does not infer access authorization from a skill's startup instructions.

`severity_map` destinations are `critical`, `high`, `medium`, and `low`. Native labels remain in the evidence. Missing or unmapped labels are incomparable; they do not create a severity disagreement. Direct skill references have no profile mapping.

GitHub is never a PR review or publication target. Skill retrieval and explicitly declared read-only dependency reads are separate from reviewing a PR.

## Run

Use the default pair:

```sh
archon workflow run prepr --no-worktree
```

For a clean checkout, review the current local branch's committed changes:

```sh
archon workflow run prepr --no-worktree --input scope=branch
```

Branch scope verifies `origin`'s default branch, fetches it, and pins the local
HEAD, comparison tip, and merge base once for both reviewers. It preserves local
commits and does not check out or fast-forward anything. A dirty checkout stops
branch review; the default `scope=local` continues to review uncommitted changes.
The pinned scope is retained with each initial review in the JSON report. Local scope includes staged, unstaged, and non-ignored untracked content; it saves a shared snapshot and stops if that work changes before the reviewers start. Empty local scope stops with guidance and never switches to branch or whole-repository review.

Show the scope without starting reviewer sessions or requiring prerequisite confirmation:

```sh
archon workflow run prepr --no-worktree --input preview_only=true
archon workflow run prepr --no-worktree --input scope=branch --input preview_only=true
```

The preview shows mode, target/base revisions, eligible file count, diff size, limitations, and excluded counts/categories. Both scopes exclude installed Prepr workflow/state/reviewer packages and known Archon output directories (`.archon/artifacts`, `logs`, `cache`, `caches`, `temp`), plus the actual artifact directory when inside the project. Filtering happens before snapshots/patches and untracked payload reads, regardless of Git staging or tracking. Unrelated authored workflows and archives (including `.ux-runs.zip`) remain eligible. Detailed exclusions stay in JSON; a tooling-only scope stops with “No project changes to review”. This does not change the index or bypass branch’s clean-checkout guard. Normal runs display this summary and continue automatically, with no human approval gate. Preview-only completes successfully with a scope summary and no reviewer sessions. It does not need reviewer authentication or retrieve remote reviewer skills. A later normal run captures its own current scope again.

Choose another comparison base for branch scope:

```sh
archon workflow run prepr --no-worktree --input scope=branch --input base=origin/develop
```

Remote-backed base refs are refreshed; explicit local refs or commit SHAs retain the selected local revision. The report states that freshness basis. Invalid bases, missing common ancestors, and a base override with local scope stop preparation without a fallback.

Before a normal review, Prepr performs bounded static checks for installed workflow integrity, required executable versions, accepted reviewer packages, launcher/model configuration, and matching local prerequisite confirmation. Neither initial reviewer starts if those checks fail. There are no separate AI readiness sessions. Authentication, model availability, and declared resource reads are established by the actual reviewer sessions. An expired login, unavailable model, startup timeout, or missing required access produces an incomplete report with available side-specific evidence and recovery guidance, even if comparison never ran. A fatal actual-session error cancels the run’s still-running sibling promptly; completed results and partial diagnostics are retained. The primary structured error takes precedence over incidental startup warnings, and reports identify the reviewer, selected executable/model, failed stage and recovery action. Discussion and missing-result failures keep the run failed even when the report renders successfully. Static preparation evidence is saved in `prepr-preparation.json` and distinguished from user confirmation and observed session evidence in the final report.

Existing installations must rerun `prepr-setup` for the new prerequisite confirmation. Unchanged reviewer acceptances can be reused and kept YAML remains byte-for-byte unchanged. Normal runs do not prompt or repair setup. Actual sessions can still inherit user hooks, plugins, MCP configuration, and project context; removing duplicate probes does not isolate reviewer startup or guarantee low execution cost. Reviews retain bounded execution and read-only tool restrictions.

Choose named local profiles or override either side for one run:

```sh
archon workflow run prepr --no-worktree \
  --input reviewer_a=vee --input reviewer_b=security
archon workflow run prepr --no-worktree \
  --input reviewer_a=/Users/you/.codex/skills/vee \
  --input reviewer_a_launcher=codex \
  --input reviewer_a_model=gpt-5.6-sol \
  --input reviewer_b=/Users/you/.claude/skills/security-review \
  --input reviewer_b_launcher=claude
```

Overrides must also match locally confirmed launcher/model selections; otherwise rerun setup to confirm those selections. A direct skill reference takes precedence over `default_pair`; otherwise each `reviewer_a` or `reviewer_b` input may name a local profile. Direct references require their matching `_launcher` input and may use a matching `_model` pin when their launcher is not Archon's current large-tier launcher. `--no-worktree` lets both reviewer agents inspect the live uncommitted diff rather than a new worktree. Codex uses its read-only sandbox; Claude uses a restricted read-tool allowlist. Both receive the same prohibition on file changes and publication.

Archon's graph shows the two initial review nodes in parallel. Stable graph IDs remain `initial-reviewer-a` and `initial-reviewer-b`; the selection summary and node transcripts explicitly map A/B to resolved display names. Reports and discussion reasoning use those names, with roles to distinguish duplicate names. The supported Archon schema does not provide dynamic graph titles. Each disputed finding then has a bounded, session-safe debate node: A sees B's latest position, then B sees A's reply, for at most three rounds. Debate stops on agreement, mutual `agree_to_disagree`, no material movement, or the round limit. Click an initial or debate node to see its attributed transcript. Full reviews and raw transcripts stay in run artifacts; include/fan-out passes only dispute indices, so workflow-like text in reviewer evidence stays data rather than being evaluated as an expression. If both original reviewers confirm a pending finding duplicates a resolved concern in this run and scope, Prepr reuses that result instead of resuming both sessions again. The node transcript identifies reuse; JSON links its source finding IDs, scope, and both confirmations, with no invented reviewer turns. New evidence, corrections, conflicting mapped urgency or verdicts, and unresolved outcomes retain their own discussion.

The readable report starts with the outcome, reviewer names and selected scope. It then presents:

1. **Reviewer differences and where they landed:** opposing assessments, corrections, and concerns initially raised by one reviewer, with their initial positions, material discussion change and final position.
2. **Open questions requiring evidence:** unanswered hypotheses and the missing evidence. Two unknown verdicts are shared uncertainty, not a disagreement or confirmed bug.
3. **Other agreements:** supported concerns without a material difference. Related findings can share a display block with their member count while retaining separate identities and outcomes.
4. **Material review limits:** meaningful test results and coverage, access or snapshot qualifications. Critical blockers qualify the opening immediately.

For example:

### Can the repeated setup notes be condensed?

`docs/progress.md:3`

- **Vee initially:** Raised this question.
- **Travis initially:** Did not initially flag this concern.
- **Discussion:** Vee confirmed the issue after Travis explained how superseded settings obscure the current configuration.
- **Final position:** Both reviewers support the concern.
- **Travis's rating:** Nit.

Not initially flagging a concern does not mean a reviewer opposed it. Missing initial evidence does not establish either position. Resolved differences stay visible without repeating them under agreements. Native severity is optional and attributed to its author, including ratings first supplied during debate: a question-led reviewer can have no ratings while another uses Must fix, Should fix and Nit. Prepr does not invent missing ratings or a shared scale; comparable urgency differences rely on explicit configured mappings.

The summary uses existing reviews and debate evidence without an additional model call. It preserves actual questions, conditions, corrections and uncertainty, and does not manufacture fixes or imply implemented code changes. Routine assessments, setup history, hashes, per-file investigation and dismissed findings stay in JSON, with at most a short dismissal count. Presentation grouping does not merge concern records, change support counts or authorize semantic duplicate reuse. Reviewer agreement remains evidence for human judgment rather than independent proof of correctness. Two sessions may use the same skill, although different skills provide a broader review.

Recorded checks retain passed/failed/blocked/not-run/unknown status and attribution. Focused tests and full-suite uncertainty stay separate, with no combined overlapping counts. Snapshot substitution and partial coverage remain visible; full tested revisions and audit details stay in JSON. Operational failure is explained once and incomplete discussion findings remain unconfirmed. Saved evidence can be replayed to a separate preview without rerunning reviewers or overwriting the original run.

The JSON report retains `confirmedBugs` (explicit issue verdicts from both reviewers), `stillDisputed`, and `uncontestedFindings` (initial sole-reviewer attribution), plus original reviews, source evidence, and all debate responses. These JSON categories can overlap; the Markdown summary does not repeat them. The `concerns` collection contains distinct final concerns; `debates` retains every actual discussion and explicitly linked reuse record. The `verification` and `preparation` fields retain check statuses, limitations, scope, static checks, user-confirmation provenance, and actual-session evidence (with historical readiness evidence retained when present); each finding preserves native severity and any mapped level and mapping source. During existing debate, both original reviewers can explicitly identify duplicate same-location finding IDs. Only bilateral identification with compatible resolved conclusions consolidates those records; shared locations, unknown IDs, or one-sided claims do not. Machine conclusions remain `converged-on-issue`, `converged-on-no-issue`, or `unresolved`.

Structured reviewer output can supply a `findings` array with summary, evidence, file, line, severity, verdict (`issue` or `no_issue`), and optional title and impact. Prose support recognizes numbered or anchored concerns and associates rationale and questions with them; it excludes review metadata and explicit no-finding statements. Unrecognized prose is retained in the original review rather than turned into findings. Matching requires a shared location and a strongly matching concern; ambiguous paraphrases remain separate for debate. Markdown links retain their real file/line targets; absolute paths inside the checkout normalize to repository-relative paths. Severity-prefixed default-review bullets remain in scope, and explicit references to overlapping Vee questions preserve both source descriptions. Progress messages before a final structured debate response do not replace its verdict. Missing verdicts require explicit confirmation from the original reviewers before a concern can become a confirmed bug.

## Report artifacts

When the workflow finishes, open Archon's **Artifacts** tab for `prepr-report.md`, the readable conclusion, and `prepr-report.json`, the complete attributed evidence. Both files are written to Archon's `$ARTIFACTS_DIR`; Prepr does not write them into the repository being reviewed.

Setup suggests the effective Archon large-tier model only when its provider matches the selected launcher; it preserves explicit pins and requests a compatible choice otherwise. This is configuration guidance, not a newest-model or entitlement claim. Setup shows actual executable paths/versions and effective models; changing the selected executable or model requires renewed prerequisite confirmation, without reconverting unchanged reviewer standards. `PREPR_CODEX_BIN` and `PREPR_CLAUDE_BIN` select explicit clients; setup never silently switches to an app-bundled binary.

The installation adds `/.archon/workflows/prepr/` to local Git info/exclude. Remove that rule and explicitly add/commit the package if you want to share it; tracked files remain tracked. Setup reports remaining changes and a detected, safely quoted PATH command for manual use if your terminal cannot find Archon, followed by `archon --version`. It does not edit shell startup files.
