## Context

Prepr already supports two skill-equipped reviewer sessions, explicit committed branch scope, original-session debate, and private Markdown/JSON artifacts. The tax-filing trial exposed launcher readiness failures, a broad 168-file branch comparison, incompatible severity vocabularies, lost report caveats, and repeated discussions of concerns both reviewers later identified as duplicates. Parsing and distinct report counting have been corrected; the readiness, scope-preview, evidence-summary, severity-mapping, and scheduling refinements below are now implemented and validated. See proposal.md for motivation and the capability spec for acceptance behavior.

## Goals / Non-Goals

**Goals:**

- Select two skill-equipped reviewer agents from local-only project profiles or direct references.
- Review either the live uncommitted diff or an explicitly selected pinned committed branch diff before PR publication.
- Preserve reviewer identity and session continuity from initial review into debate.
- Keep all output private to the local Archon run.
- Summarize distinct concerns in compact bullets that explain reviewer reasoning, convergence, and the decisions left to a human engineer.
- Preserve complete structured evidence separately so a short report does not erase uncertainty or attribution.
- Fail readiness before either code review begins, expose scope without adding approval gates, and avoid duplicate session work only when evidence supports reuse.

**Non-Goals:**

- A default reviewer skill, review prompt, generic debate agent, or PR-thread integration.
- A checked-in project profile file or syncing local profile choices between developers.
- Installing arbitrary skills or publishing reviewer output to GitHub.
- An additional summarization agent, automatic remediation, or a report written as instructions for further agent work.
- Automatic authentication repair, model substitution, global setup changes, inferred severity equivalence, or automatic local/branch scope selection.

## Decisions

### Local-only profiles with explicit precedence

Store profiles in `.archon/prepr.local.yaml`, which is ignored by Git. Each profile maps a stable display name to a local skill reference or a pinned GitHub skill reference, plus one supported launcher (`codex` or `claude`) and an optional compatible model. Resolve each side in this order: direct run reference, explicitly selected profile, then the local configuration's default pair. A direct replacement retains the selected profile's launcher and model; a standalone direct reference must name a launcher. When model is omitted, the launcher resolves its Archon-configured supported default.

### Readiness checks in the selected execution environment

Resolve both profiles and effective models without starting code review. Check launcher availability, then use bounded read-only launcher probes in the same environment and sandbox as the intended reviewers to establish authentication and actual model usability. A model appearing in a cached catalog is insufficient when a minimal invocation is rejected. The probes do not load a reviewer skill, inspect project code, create a code-review opinion, or become reviewer votes. They are operational checks, not additional reviewer agents. Retain concise results separately from findings and stop before either initial review when a mandatory check fails.

Profiles can optionally declare `required_access` entries naming a tool and resource for a non-mutating read check. Only explicit declarations authorize these dependency probes; do not infer authorization by executing startup instructions found in skill text. Use a bounded read operation through the same launcher environment rather than a successful host-side request as proof. Unsupported checks are reported as unverifiable and fail if required. Do not add an arbitrary setup-command runner, install dependencies, repair login, switch models, or widen permissions. Profiles without declarations retain their current behavior beyond the launcher checks, with additional dependency readiness marked undeclared. A successful check is point-in-time evidence, not a guarantee against later credential or network expiry.

This catches the observed failures before expensive review work and avoids turning preflight into a general provisioning system. Sharing one successful probe between sides is allowed only when launcher, effective model, environment, sandbox, and declared resources are identical; results remain attributed to both sides.

### Reviewer agents consume skills

Prepr starts two independent, fresh reviewer-agent contexts through a launcher adapter. The first supported adapters are Codex and Claude Code. Each receives exactly one selected reviewer skill plus operational context identifying the local target and diff. The skill supplies review behavior and style; the workflow supplies only phase transport for initial review and focused debate.

### Live checkout and read-only access

Runs use the developer's current checkout rather than a new worktree. Default `scope=local` captures staged and unstaged tracked diffs plus non-ignored untracked content for both reviewers. Empty local capture stops with guidance to request branch scope; it never silently reviews the whole checkout or switches modes. Preserve a shared local snapshot in run evidence and detect changes that would make the preview and actual review target inconsistent.

Explicit `scope=branch` requires cleanliness and pins local HEAD plus the selected comparison and merge-base SHAs. Without a `base` input, verify origin's remote default and fetch it. With a `base` input, resolve the named ref or commit explicitly: refresh remote-backed refs, retain intentionally local refs or historical commits, and record which freshness basis applies. Do not guess another base, assume main, or accept a base override in local scope. An invalid ref or absent common ancestor stops preparation. The diff runs from merge base to pinned local HEAD, excluding comparison-only commits. Never check out or fast-forward; recheck cleanliness and HEAD before returning, retain identical metadata in both results, and read pinned objects if the checkout later changes.

Use `preview_only=true` for a scope-only invocation. It captures and displays the mode, target/base refs and applicable SHAs, file count, diff statistics, and exclusions or limitations, then exits before profile readiness probes or remote reviewer-skill retrieval. Git reads/fetches required for that scope are allowed; reviewer authentication is irrelevant to a scope-only preview. A subsequent normal run recaptures its scope. For normal runs, display the same summary, then continue automatically after readiness succeeds. No approval gate is introduced. This preserves one-command review while making unexpectedly broad comparisons visible; users choose another explicit base on a later invocation if desired.

Reviewer agents remain constrained to read-only review and must not edit code, commit, push, create a PR, or publish GitHub feedback.

### Original-agent continuation for debate

Each initial reviewer agent retains a session handle. For every disagreement not already covered by valid duplicate reuse, Prepr resumes that exact agent/session with opposing attributed evidence. A per-session queue prevents multiple concurrent resumes of the same session. For each finding, reviewer A receives reviewer B's latest position, then reviewer B receives reviewer A's resulting reply. Debate stops when the reviewers agree, explicitly agree to disagree, cease material movement, or reach three rounds. Fan-out therefore preserves the original reviewer skill, its initial context, and transcript rather than recreating a reviewer through a generic wrapper.

### Normalize concerns before comparison

Raw transcripts remain the audit record. Normalize complete actionable concerns, keeping their location, claim, evidence, and explicit verdict together. Accept structured findings when available; prose normalization must recognize concern boundaries and associate rationale and proposed questions with their concern. Do not fall back to treating every nonblank line as a finding. Exclude headings, progress updates, location-only lines, aggregate verdicts, verification summaries, and no-finding statements. Preserve ambiguous source material in JSON without fabricating actionable findings. Parse actual Markdown link targets before removing formatting, normalize in-checkout absolute paths, retain question/rationale source text, and recognize default-review severity bullets. An explicit overlap reference to a numbered Vee question appends its evidence to that question; independent default-review concerns remain separate.

Match on the same underlying concern and affected behavior. File anchors and wording can help identify candidates, but neither shared paths nor word overlap alone establish equivalence. Consolidate repeated representations of the same concern within a reviewer while retaining original evidence; keep independent concerns separate even when their paths match. Ambiguous matches remain unconfirmed. This avoids making presentation cleanup conceal false agreements. During existing debate, provide other same-location findings as candidates and request optional `sameConcernAs` IDs. The coordinator merges concerns only when both original reviewers explicitly select the same valid ID and both debate records have compatible resolved outcomes, or a pending duplicate qualifies for the reuse decision below. It does not lower the lexical matching threshold or use shared location as proof. JSON keeps all original debates, while `concerns` supplies distinct display entries and confirmed-bug counts; merged entries preserve every source finding and round.

### Explicit shared severity levels

Add an optional `severity_map` to each local profile, mapping native labels to `critical`, `high`, `medium`, or `low`. Validate destinations before review; absent maps remain valid and imply no guessed mapping. Store the native label, mapped level when available, and mapping source with each finding. Apply the mapping once during normalization and use the mapped levels consistently in comparison, consolidation, debate compatibility, duplicate reuse, and report decisions. Do not rewrite reviewer wording or replace native labels in the audit record. Direct skill references without a selected profile have no profile map.

`P1` and `Must fix` are equal only if the respective profiles explicitly map them to the same shared level. Missing or unmapped labels produce an unavailable comparison, not a severity conflict. Different mapped levels remain a human urgency decision even when verdicts agree; they do not become a disagreement about whether the defect exists. Do not infer verdicts or concern equivalence from severity. This avoids treating vocabulary differences as evidence of substantive disagreement while preserving actual rating differences.

### Reuse only bilaterally confirmed pending duplicates

Keep the serial dispute queue. After a discussion, retain valid duplicate confirmations from both original sessions alongside the source outcome and scope. Before resuming a pending item, check whether its exact finding ID was identified by both reviewers as the same failure, trigger, and consequence as an already resolved concern. Require a shared location and compatible recorded verdicts and mapped severity; missing initial verdicts remain missing in initial evidence, while later explicit confirmations can support inherited results. Do not copy an outcome across scopes or runs. Material new evidence or corrections invalidate reuse; unknown IDs, incomplete or unresolved results, agree-to-disagree, or conflicting assessments keep the separate discussion.

Represent reuse as a linked result identifying original finding IDs, the source discussion, both confirmations, and the pinned scope. Do not synthesize reviewer responses or append fake rounds. Both inherited and directly debated results feed the same distinct concern and count once. Retain graph/transcript visibility for skipped duplicate work. Existing completed-run grouping continues to retain all genuine historical discussions; the optimization applies only to work that has not yet run. This reduces repeated calls without changing the conservative concern matcher or adding a third agent.

### Explicit conclusions and complete evidence

Only explicit issue verdicts from both reviewers about the same concern support a confirmed bug. Initial agreements with matching no-issue verdicts remain no-issue conclusions; missing verdicts do not become issue verdicts by default. The comparison and debate retain attribution, supporting evidence, initial differences, revised positions, and the allowed machine conclusion states in JSON. Initial sole-reviewer attribution can overlap with final outcome categories in JSON, but is not a separate repeated section in Markdown. No third agent chooses a winner. Extract a final structured debate response even when the session emitted progress updates first; missing verdicts remain unknown. Captured output fixtures and a replay through the original sessions validate the prose/JSON transport without replacing the reviewers or overwriting the original run.

### Human-facing concern summaries

Build the Markdown summary from normalized initial concerns and the existing debate history using coordinator rendering, not an additional agent call. Render a short assessment and a visible verification/limitations summary, then disagreements, supported agreements, and meaningful withdrawn concerns when present. Use final revised concern text when supported by the recorded response while retaining the original text in JSON. Describe reviewer agreement as a shared conclusion, not independent proof of correctness. If evidence or a response is missing, state that limitation instead of inventing reasoning. Retain supplied check statuses as passed, failed, blocked, not run, or unknown, with source attribution and the tested snapshot when known. Older prose or JSON without explicit check metadata remains unknown unless the transcript supports a more specific statement. A green launcher probe is not a passing project build or test suite.

Each concern has a short title and compact labeled bullets. For agreements, use Concern, Reviewers' reasoning, Review conclusion, and Why it matters when a practical consequence was recorded. For disagreements, use Concern, A's reasoning, B's reasoning, Review conclusion, Why the conclusion changed for a resolved disagreement, and What you need to decide when a meaningful question remains. These labels describe review assessments and human judgment; they do not imply that reviewers implemented a change.

Attribute the explanation of a changed conclusion to Reviewer A or Reviewer B. Select the latest recorded verdict change that leads to the final shared conclusion, rather than an earlier reversal. If no explicit verdict change was recorded, attribute the supporting final rationale to its actual speaker without inventing a change of position. First-person reviewer text must retain visible speaker attribution; identical reasoning from both reviewers is attributed to both.

Show What you need to decide for an unresolved concern or, when both reviewers confirm an issue, an unresolved difference in comparable mapped urgency or severity. An unavailable severity comparison is disclosed without creating a disagreement or urgency decision by itself. Make the decision concrete: whether the concern needs action, or how urgently to address an agreed issue. If evidence is incomplete, state that limitation. Once both reviewers dismiss a concern, omit this bullet, including any obsolete severity difference. Keep material preconditions, unverified data assumptions, freshness limits, and missing execution evidence with the concern even when shortening other text. Do not truncate a qualification such as whether duplicate-date records exist; reduce background text first. Include useful file references with the concern. Do not append unsupported fix instructions or speculative next steps.

Give each distinct concern one Markdown location: substantive initial disagreements retain their reasoning and resolution under disagreements, initially equivalent supported concerns and sole-reviewer concerns later accepted without substantive disagreement appear under agreements, and other meaningful dismissals appear under withdrawn concerns. Unresolved sole-reviewer concerns appear under disagreements with any missing position made explicit. A finding raised by one reviewer does not by itself prove the other disagreed; distinguish an initial omission from an actual opposing position. Drop non-finding metadata entirely from the readable report, and omit empty sections. With no actionable concerns, render a short assessment only.

This replaces transcript-per-entry rendering and overlapping Markdown categories, which inflated the test report. Keeping a second agent-generated summary would add another judgment layer and is unnecessary because the original reviewers already supplied their reasoning. Complete evidence remains available for inspection in JSON and Archon's node transcripts.

### Archon artifact report delivery

The report node writes two files to the `$ARTIFACTS_DIR` supplied by Archon: `prepr-report.md` for the skimmable human summary and `prepr-report.json` for complete structured evidence. Markdown includes useful source references; JSON preserves original findings, evidence, initial attribution, every debate round and response, final conclusions, and operational metadata. The node returns only validated `archon_artifact` pointers with the current `$WORKFLOW_ID` and relative file paths, keeping terminal and node output short while allowing the Archon Artifacts tab to present the report. Artifact writing is coordinator output, not a reviewer action, and never writes to the reviewed checkout.

## Risks / Trade-offs

- [A declared dependency is unavailable in the sandbox] -> Fail readiness before either review and preserve the probe evidence; undeclared dependencies may still fail during review and must remain visible.
- [Readiness succeeds but credentials later expire] -> Preserve the later failure and report incomplete review; preflight does not guarantee future access.
- [A duplicate confirmation is stale or misses new evidence] -> Restrict reuse to the same pinned scope and unchanged concern, and fall back to separate debate.
- [Profile mappings hide actual urgency differences] -> Require explicit mappings, preserve native labels, and keep unmapped levels incomparable.
- [Local profiles are not portable] -> Intentional for local paths; a pinned GitHub reference can be used as a profile value.
- [A pinned source is inaccessible] -> Report resolution failure before reviewer agents start.
- [Free-form skill output is ambiguous] -> Recognize concern boundaries, exclude metadata, and retain unsupported or ambiguous source material in JSON without fabricating agreements.
- [Condensation loses a meaningful disagreement or uncertainty] -> Preserve initial reasoning and debate resolution in a single Markdown entry, with complete history in JSON.
- [Two sessions using the same skill give a narrow acceptance example] -> Keep that case as a parsing regression and validate the report with distinct reviewer skills and genuine differing positions.

## Migration Plan

Replace command-input nodes and fixture commands with skill selections, profile resolution, and reviewer-agent nodes. Existing command configuration is intentionally unsupported after migration because it represents the incorrect product boundary. Rollback restores the previous package from version control.

The report revision is implemented: normalization, matching, and confirmation rules precede summary rendering from retained evidence, and the README describes the human-facing report. Artifact filenames and delivery pointers remain stable. Automated checks cover attribution, changed conclusions, and meaningful remaining decisions; a real Archon run with fixture reviewers verified both report artifacts. Preserve the completed task history. Task 7.2 remains pending for the user's manual Artifacts-tab validation, as requested. Normal report filenames and artifact pointers are unchanged.


### Follow-up delivery

Sections 12–17 of tasks.md are implemented and validated with focused regressions and controlled real Archon runs. Preserve earlier completion history and the outstanding Artifacts-tab check. Implement explicit scope/preview controls and readiness first, then consistent severity mapping and visible evidence summaries, then safe pending-duplicate reuse. Update workflow schemas, local-profile documentation, fixtures, and report metadata with each change. Existing profiles remain valid without required-access declarations or severity maps. Existing report filenames and native reviewer transcripts remain stable. Validate changes with focused cases from the captured tax-filing run and a broader workflow acceptance test; the follow-up has its own 44-test suite, three declared fixtures, and controlled Archon preview, readiness-failure, and successful dual-review acceptance evidence, distinct from the earlier run.
