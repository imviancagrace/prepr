# Prepr

Prepr is an Archon workflow package for a private, pre-PR discussion between two code-review skills. It does not contain a default review prompt or replace either reviewer. It launches two independent, read-only reviewer sessions on the selected local Git diff (uncommitted changes by default, or explicit committed branch scope), then resumes those same sessions to discuss material disagreements. The result is a private report for engineering judgment; Prepr never creates or updates a GitHub PR.

## Install

Copy `.archon/workflows/prepr/` into the repository you want to review. Archon 0.11.1+, Bun, and the selected launcher CLI (Codex or Claude Code) must be available. Run from the checkout you want reviewed. Uncommitted work is the default; committed branch review must be selected explicitly.

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
    model: gpt-5.6-sol # optional; omit to use the launcher's configured default
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

A profile can declare `required_access` entries with `tool` and `resource`. Supported probes are `file` (an exact path), `gh` (an API resource read with `gh api --method GET`), and `git` (a repository URL read with `git ls-remote`). Unsupported or unverifiable required resources stop preparation. No declarations means additional dependency access is undeclared, not verified. This is not an arbitrary setup-command runner; Prepr does not infer access authorization from a skill's startup instructions.

`severity_map` destinations are `critical`, `high`, `medium`, and `low`. Native labels remain in the evidence. Missing or unmapped labels are incomparable; they do not create a severity disagreement. Direct skill references have no profile mapping.

GitHub is never a PR review or publication target. Skill retrieval and explicitly declared read-only dependency probes are separate from reviewing a PR.

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

Show the scope without starting reviewer sessions or readiness probes:

```sh
archon workflow run prepr --no-worktree --input preview_only=true
archon workflow run prepr --no-worktree --input scope=branch --input preview_only=true
```

The preview shows mode, target/base revisions, file count, diff size, and limitations. Normal runs display this summary and continue automatically, with no human approval gate. Preview-only completes successfully with a scope summary and no reviewer sessions. It does not need reviewer authentication or retrieve remote reviewer skills. A later normal run captures its own current scope again.

Choose another comparison base for branch scope:

```sh
archon workflow run prepr --no-worktree --input scope=branch --input base=origin/develop
```

Remote-backed base refs are refreshed; explicit local refs or commit SHAs retain the selected local revision. The report states that freshness basis. Invalid bases, missing common ancestors, and a base override with local scope stop preparation without a fallback.

Before a normal review, Prepr checks both selected launchers and actual model responses with bounded 30-second read-only probes, including any declared required access. Neither code review starts if either side fails. The error identifies the side and required next step; Prepr never repairs login, installs tools, switches launchers/models, or changes global settings or permissions. A successful probe does not guarantee later access, and is not evidence that project tests passed. Probe results are recorded separately in `prepr-readiness.json` and the final report's preparation metadata.

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

A direct skill reference takes precedence over `default_pair`; otherwise each `reviewer_a` or `reviewer_b` input may name a local profile. Direct references require their matching `_launcher` input and may use a matching `_model` pin when their launcher is not Archon's current large-tier launcher. `--no-worktree` lets both reviewer agents inspect the live uncommitted diff rather than a new worktree. Codex uses its read-only sandbox; Claude uses a restricted read-tool allowlist. Both receive the same prohibition on file changes and publication.

Archon's graph shows the two initial review nodes in parallel. Each disputed finding then has a bounded, session-safe debate node: A sees B's latest position, then B sees A's reply, for at most three rounds. Debate stops on agreement, mutual `agree_to_disagree`, no material movement, or the round limit. Click an initial or debate node to see its attributed transcript. If both original reviewers confirm a pending finding duplicates a resolved concern in this run and scope, Prepr reuses that result instead of resuming both sessions again. The node transcript identifies reuse; JSON links its source finding IDs, scope, and both confirmations, with no invented reviewer turns. New evidence, corrections, conflicting mapped urgency or verdicts, and unresolved outcomes retain their own discussion.

The readable report is a summary for a human engineer deciding their next steps. It opens with a short assessment and verification/limitations summary, followed by disagreements, agreements, and meaningful withdrawn concerns when present. Each distinct concern appears once, with a short title and labeled bullets explaining the concern, reviewer reasoning, outcome, and practical consequence when recorded. Disagreements preserve each side's reasoning and explain what changed during debate or what remains uncertain. Useful file references remain; routine workflow metadata stays in JSON. Recorded checks keep passed/failed/blocked/not-run/unknown status, attribution, and the tested snapshot when known. Missing evidence stays unknown. Conditions such as unverified runtime data remain visible with the affected concern, even when other text is shortened.

For example:

### Missing request guard

- **Concern:** Anonymous requests reach an unguarded user access (`src/auth.ts:12`).
- **A's reasoning:** The endpoint can return a server error for anonymous requests.
- **B's reasoning:** The shared middleware appeared to guard this route.
- **Review conclusion:** Both reviewers concluded this is an issue.
- **Why the conclusion changed:** Reviewer B verified that this route bypasses the middleware.

The summary uses the existing reviews and debate evidence; it does not launch a summarization agent or prescribe new agent work. Reviewer agreement remains evidence for your judgment, rather than independent proof of correctness. Two sessions may use the same skill, although different skills provide a broader review.

The JSON report retains `confirmedBugs` (explicit issue verdicts from both reviewers), `stillDisputed`, and `uncontestedFindings` (initial sole-reviewer attribution), plus original reviews, source evidence, and all debate responses. These JSON categories can overlap; the Markdown summary does not repeat them. The `concerns` collection contains distinct final concerns; `debates` retains every actual discussion and explicitly linked reuse record. The `verification` and `preparation` fields retain check statuses, limitations, scope and readiness evidence; each finding preserves native severity and any mapped level and mapping source. During existing debate, both original reviewers can explicitly identify duplicate same-location finding IDs. Only bilateral identification with compatible resolved conclusions consolidates those records; shared locations, unknown IDs, or one-sided claims do not. Machine conclusions remain `converged-on-issue`, `converged-on-no-issue`, or `unresolved`.

Structured reviewer output can supply a `findings` array with summary, evidence, file, line, severity, verdict (`issue` or `no_issue`), and optional title and impact. Prose support recognizes numbered or anchored concerns and associates rationale and questions with them; it excludes review metadata and explicit no-finding statements. Unrecognized prose is retained in the original review rather than turned into findings. Matching requires a shared location and a strongly matching concern; ambiguous paraphrases remain separate for debate. Markdown links retain their real file/line targets; absolute paths inside the checkout normalize to repository-relative paths. Severity-prefixed default-review bullets remain in scope, and explicit references to overlapping Vee questions preserve both source descriptions. Progress messages before a final structured debate response do not replace its verdict. Missing verdicts require explicit confirmation from the original reviewers before a concern can become a confirmed bug.

## Report artifacts

When the workflow finishes, open Archon's **Artifacts** tab for `prepr-report.md`, the readable conclusion, and `prepr-report.json`, the complete attributed evidence. Both files are written to Archon's `$ARTIFACTS_DIR`; Prepr does not write them into the repository being reviewed.
