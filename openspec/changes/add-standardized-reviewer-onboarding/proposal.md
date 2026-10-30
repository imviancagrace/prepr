## Why

Before the initial onboarding implementation, Prepr loaded arbitrary reviewer skills in full, including scope selection, checkout preparation, extra review passes, and publication procedures that conflict with Prepr's orchestration. A standard reviewer package should preserve each skill's review standards and voice while making its integration predictable and subject to explicit human acceptance.

The reviewer-onboarding implementation is now available, but testing exposed a separate startup problem: mandatory readiness model sessions inherit launcher customizations and can time out after returning a valid answer. Readiness failures can also prevent comparison creation and then cause report rendering to fail. Setup needs a shared Claude/Codex prerequisite contract that does not require extra AI sessions and that distinguishes human confirmation from observed runtime evidence.

The 2026-10-28 live run on symmetry-tax-filing completed with both accepted reviewers, but exposed a report-normalization gap: reviewers returned nested verification checks and limitations that the Markdown summary omitted or reduced to unknown/not-run project checks. The summary also lost Vee's partial-review qualification. Successful workflow execution must not obscure passing focused checks, an unverified full suite, or limited review coverage.

Testing on 2026-10-29 exposed further setup and runtime usability gaps: the terminal could not find Archon, installation files dirtied the target checkout, launcher executable versions differed, and reviewer names were not obvious in the graph. In a later run both initial reviews completed but the debate stage emitted an unresolved parent-node reference; the report presented missing debates as reviewer failures and printed setup/audit details ahead of actionable concerns. Setup must make selections and local installation effects explicit, and runtime must stop promptly on fatal failures and report the actual failed stage concisely.

The later successful UX Scorer run `6f0c552f-a62c-426e-9211-420907312acb` still produced about 1,970 words for two selected files, including 13 verification/assessment bullets before the findings. It repeated qualifications and long reasoning, obscured which reviewer first flagged each concern, and called a shared uncertainty a disagreement. The approved report format must highlight initial reviewer differences and how discussion changed them, followed by open questions, other agreements and compact material limits. Optional native ratings must remain attributed: this run's accepted Vee profile defines no severity scale, while Travis uses Must fix, Should fix and Nit.

## What Changes

- Define version 1 of a Prepr reviewer package covering review priorities, methods, evidence standards, communication style, native severity definitions, dependencies, and structured output.
- Add `prepr-prepare-reviewer`, usable independently or inline during setup, to inspect a source skill and create a separate adapted package plus an attributed retained/excluded/unresolved summary.
- Preserve original skills and substantive domain references; stop on essential missing knowledge or unresolved changes in meaning rather than silently discarding them.
- Require a human acceptance action before a new reviewer package becomes active. Bind acceptance to exact source, effective package, dependencies, and format version; reuse unchanged accepted packages without repeated prompts.
- Integrate compatibility inspection and preparation into reviewer onboarding, retaining setup's prohibition on automatically running Prepr.
- Check installed prerequisites and configuration statically, then obtain explicit local confirmation that the user is logged in to the selected launcher(s) and can use the effective model(s). Reuse that confirmation for unchanged launcher/model selections; changes require renewed confirmation separately from reviewer acceptance.
- Replace mandatory AI readiness probes with bounded static checks before the actual review sessions. Establish authentication, model availability, and declared runtime access through those sessions, and report startup failures without depending on a completed comparison.
- Preserve nested structured verification checks, limitations, substantive assessments, and partial-review qualifications through normalization and final reporting, while retaining historical output support. Add regressions derived from saved live evidence without new model calls or changes to accepted reviewer packages.
- Extend the setup command handoff with `archon serve` for starting the Archon web UI manually in a separate terminal; setup must not start the server automatically.
- Suggest the matching configured Archon large-tier model instead of asking users to invent a model choice; preserve explicit choices and distinguish configuration from account-specific availability.
- Show the actual launcher executable path/version and model, provide detected PATH recovery guidance, and never silently select a different installed or app-bundled executable.
- Automatically exclude the installed Prepr workflow through local Git excludes, preserving tracked content and unrelated workflows; explain the opt-in path to committing it and any remaining checkout changes.
- Filter managed Prepr tooling and Archon-generated artifacts/logs/caches from review targets before snapshot creation and launcher input, regardless of Git tracking or staging state. Show concise exclusion counts and stop if no eligible project changes remain; load accepted reviewer instructions separately.
- Make reviewer display names visible alongside stable A/B attribution in run summaries, node transcripts, and reports; use graph labels only where supported without changing Archon.
- Cancel the sibling review promptly after a fatal actual-session failure, skip subsequent comparison/debate, and retain precise primary errors and recovery guidance in the existing artifacts.
- Transport captured transcripts as literal artifact data rather than expression-bearing workflow inputs, correct included-debate reference handling and propagate orchestration failures to a failed run; distinguish failed, cancelled, not-started, and missing-evidence stages.
- Make Markdown open with outcome, reviewer names and scope, then show reviewer differences and their resolution, open questions requiring evidence, other agreements and compact material review limits. Distinguish a concern not initially flagged from explicit opposition, and shared uncertainty from disagreement. Preserve each reviewer's optional native ratings, including ratings supplied during debate, without inventing missing ratings or a shared scale. Group related findings for presentation only with their counts/identities preserved; retain the complete audit trail and routine withdrawn findings in JSON rather than repeating assessments, hashes, setup history or long transcripts in Markdown.
- **BREAKING:** Normal reviews require current, accepted standardized packages for both sides, including direct references and the bundled peer. Existing raw references need onboarding; no unchecked legacy fallback is provided. Scope-only preview remains available without reviewer preparation.

## Capabilities

### New Capabilities

- `reviewer-onboarding`: Standard package contract, faithful extraction, source provenance, human acceptance, reuse, and change invalidation.

### Modified Capabilities

- `prepr-setup`: Prepare and validate accepted reviewer packages inline, check prerequisites, obtain launcher/model confirmation, and preserve keep/new configuration choices and setup-only handoff, suggest compatible configured models, expose executable identity/PATH guidance, and exclude local workflow files.
- `review-debate-workflow`: Resolve accepted effective reviewers and validate prerequisite confirmation before review without readiness AI sessions; preserve skill-specific judgment, actionable startup-failure reporting, structured verification evidence, and review-coverage limitations; add named reviewer visibility, prompt sibling cancellation, reliable debate failure propagation, Markdown highlighting initial reviewer differences and discussion outcomes with optional attributed ratings, and tooling-independent review scope with explicit exclusions.

## Impact

Adds a portable preparation skill, reviewer format documentation/template, deterministic validation/registration helpers, project-local draft/accepted reviewer storage, and acceptance coverage. Updates setup, runtime reviewer selection/prompts, the bundled peer package, fixtures, and documentation. No original/global skill is rewritten, no reviewer defaults or shared code-review criteria are introduced, and report artifact names/pointers remain unchanged. Semantic extraction occurs in the invoking assistant during onboarding, never as a hidden conversion or additional review session in a normal run.

The 2026-10-28 live-report follow-up was confined to result normalization, attributed report summaries, and regression coverage. It did not change setup, authentication behavior, the version-1 reviewer/output contract, or existing acceptance records. Replay validation writes separate temporary artifacts and preserves the original live-run evidence.

The 2026-10-29 follow-up changes setup guidance/local exclusion, runtime failure coordination, and report presentation while retaining the two independent native launchers and existing reviewer contract. It does not add AI readiness probes, change credentials or global shell configuration automatically, choose a different executable/model silently, or rewrite accepted reviewers.

The scope-filter follow-up is independent of Git exclusion rules: tracked or staged tooling still must not become a review target. It does not authorize hiding unrelated archives such as `.ux-runs.zip`, modifying the index, broadening launcher permissions, or interpreting reviewer transcripts as workflow expressions.

The approved report-format refinement is confined to report consumption/presentation, documentation and validation against saved evidence. It keeps complete JSON, concern counts/identities, verdict and duplicate-confirmation semantics, reviewer standards/acceptances, scope, native sessions and artifact names/pointers unchanged. It introduces no summary model, new review run, mandatory severity vocabulary or Archon UI artifact-listing change. Earlier completed-task validation remains historical; new implementation tasks must pass before this refinement is complete.
