## Why

AI review discussion on a published PR can create noisy, repetitive threads after an author has already asked for review. Prepr moves disagreement into a private local workflow: two skill-equipped reviewer agents review the developer's selected local change, debate material disagreements, and give the developer a skimmable summary that challenges human engineering judgment and helps them decide their next steps before publishing a PR.

## What Changes

- Replace the command-wrapper proof of concept with two user-selected reviewer agents, each loaded with an independently authored reviewer skill.
- Add local-only project profiles that select a default pair of reviewer skills and their native launchers, while allowing either side to be replaced with a direct skill reference for an individual run.
- Resolve reviewer skills from a local source or a pinned GitHub source; GitHub is a skill-source transport only, never a PR-review or publication target.
- Run both reviewer agents against the current local checkout in read-only mode, using either the default uncommitted diff or an explicit pinned committed branch diff, then continue those original agents through bounded, evidence-led per-finding debate rounds.
- Support Codex and Claude Code launchers. A profile may pin a compatible model; otherwise its launcher uses the Archon-configured supported default.
- Check launcher authentication, selected-model availability, and declared required access before starting either reviewer. Report actionable readiness failures without changing credentials, models, or global settings automatically.
- Show an informational scope preview with the mode, comparison base, pinned revisions, changed-file count, and diff size, then continue without a human approval gate. Offer a scope-only preview that exits before launching reviewers and an explicit comparison-base override for branch review.
- Keep scope selection explicit: default to uncommitted local changes, use committed branch changes only when requested, stop an empty local review with guidance, and reject dirty branch scope rather than switching modes or silently excluding work.
- Keep all review, debate, transcripts, and report artifacts inside Archon; do not create, update, or comment on a GitHub PR.
- Produce a human-facing Markdown summary with a short assessment, disagreements and their reasoning, supported agreements, and meaningful withdrawn concerns. Use concise concern titles and labeled bullets, present each distinct concern once, and retain useful file references without repeating workflow metadata or transcripts.
- Preserve complete findings, evidence, initial attribution, debate history, and conclusion metadata in JSON. The readable report summarizes that existing evidence for a human decision; it does not create another agent task or independently adjudicate the review.
- Preserve linked prose anchors and independent default-review findings; consolidate duplicate concerns only with conservative matching or explicit agreement from both original reviewers during debate.
- Exclude prose headings, progress updates, and other non-findings from comparison; require the same underlying concern for matching and explicit shared issue verdicts for bug confirmation.
- Show verification status and material evidence limitations near the report's opening, and preserve assumptions and caveats when shortening concern summaries.
- Allow local reviewer profiles to map native severity labels to shared levels while retaining the original labels. Compare mapped levels when available; unmapped labels remain incomparable rather than automatically establishing a severity disagreement.
- Reuse a resolved concern's outcome for a pending duplicate only after both original reviewers explicitly confirm equivalence for the same pinned scope and compatible conclusions. Preserve attribution and evidence, and retain a separate discussion when equivalence or compatibility is uncertain.

The review, branch-scope, and report-parsing work and follow-up refinements in task sections 12–17 are implemented and validated. The remaining task is the user's manual Artifacts-tab check; normal review artifact filenames and pointer format remain unchanged.

## Capabilities

### New Capabilities

- `review-debate-workflow`: Orchestrates two selected reviewer skills as independent local reviewer agents, debates material disagreements, and presents a private summary for human engineering judgment plus complete structured evidence through Archon.

### Modified Capabilities

- None.

## Impact

- Replaces the existing command-based Prepr PoC package interface and its fixtures.
- Adds a local-only project profile file and skill-source resolution.
- Requires Archon-managed Codex or Claude Code reviewer-agent execution with read-only access to the developer's live checkout.
- Revises finding normalization, concern matching, conclusion classification, and Markdown rendering; retains the existing Markdown and JSON artifact filenames and delivery mechanism.
- Extends workflow inputs and local profile settings for scope preview, explicit branch comparison bases, readiness checks, and severity mappings; adds verification for early failures, scope selection, visible evidence limits, and safe duplicate-discussion reuse.
