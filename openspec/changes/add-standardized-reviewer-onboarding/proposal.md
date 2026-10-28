## Why

Before the initial onboarding implementation, Prepr loaded arbitrary reviewer skills in full, including scope selection, checkout preparation, extra review passes, and publication procedures that conflict with Prepr's orchestration. A standard reviewer package should preserve each skill's review standards and voice while making its integration predictable and subject to explicit human acceptance.

The reviewer-onboarding implementation is now available, but testing exposed a separate startup problem: mandatory readiness model sessions inherit launcher customizations and can time out after returning a valid answer. Readiness failures can also prevent comparison creation and then cause report rendering to fail. Setup needs a shared Claude/Codex prerequisite contract that does not require extra AI sessions and that distinguishes human confirmation from observed runtime evidence.

The 2026-10-28 live run on symmetry-tax-filing completed with both accepted reviewers, but exposed a report-normalization gap: reviewers returned nested verification checks and limitations that the Markdown summary omitted or reduced to unknown/not-run project checks. The summary also lost Vee's partial-review qualification. Successful workflow execution must not obscure passing focused checks, an unverified full suite, or limited review coverage.

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
- **BREAKING:** Normal reviews require current, accepted standardized packages for both sides, including direct references and the bundled peer. Existing raw references need onboarding; no unchecked legacy fallback is provided. Scope-only preview remains available without reviewer preparation.

## Capabilities

### New Capabilities

- `reviewer-onboarding`: Standard package contract, faithful extraction, source provenance, human acceptance, reuse, and change invalidation.

### Modified Capabilities

- `prepr-setup`: Prepare and validate accepted reviewer packages inline, check prerequisites, obtain launcher/model confirmation, and preserve keep/new configuration choices and setup-only handoff.
- `review-debate-workflow`: Resolve accepted effective reviewers and validate prerequisite confirmation before review without readiness AI sessions; preserve skill-specific judgment, actionable startup-failure reporting, structured verification evidence, and review-coverage limitations.

## Impact

Adds a portable preparation skill, reviewer format documentation/template, deterministic validation/registration helpers, project-local draft/accepted reviewer storage, and acceptance coverage. Updates setup, runtime reviewer selection/prompts, the bundled peer package, fixtures, and documentation. No original/global skill is rewritten, no reviewer defaults or shared code-review criteria are introduced, and report artifact names/pointers remain unchanged. Semantic extraction occurs in the invoking assistant during onboarding, never as a hidden conversion or additional review session in a normal run.

The live-report follow-up is confined to result normalization, attributed report summaries, and regression coverage. It does not change setup, authentication behavior, the version-1 reviewer/output contract, or existing acceptance records. Replay validation writes separate temporary artifacts and preserves the original live-run evidence.
