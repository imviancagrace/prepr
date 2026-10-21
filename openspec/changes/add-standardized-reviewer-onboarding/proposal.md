## Why

Prepr currently loads arbitrary reviewer skills in full, including scope selection, checkout preparation, extra review passes, and publication procedures that conflict with Prepr's orchestration. A standard reviewer package should preserve each skill's review standards and voice while making its integration predictable and subject to explicit human acceptance.

## What Changes

- Define version 1 of a Prepr reviewer package covering review priorities, methods, evidence standards, communication style, native severity definitions, dependencies, and structured output.
- Add `prepr-prepare-reviewer`, usable independently or inline during setup, to inspect a source skill and create a separate adapted package plus an attributed retained/excluded/unresolved summary.
- Preserve original skills and substantive domain references; stop on essential missing knowledge or unresolved changes in meaning rather than silently discarding them.
- Require a human acceptance action before a new reviewer package becomes active. Bind acceptance to exact source, effective package, dependencies, and format version; reuse unchanged accepted packages without repeated prompts.
- Integrate compatibility inspection and preparation into reviewer onboarding, retaining setup's prohibition on automatically running Prepr.
- **BREAKING:** Normal reviews require current, accepted standardized packages for both sides, including direct references and the bundled peer. Existing raw references need onboarding; no unchecked legacy fallback is provided. Scope-only preview remains available without reviewer preparation.

## Capabilities

### New Capabilities

- `reviewer-onboarding`: Standard package contract, faithful extraction, source provenance, human acceptance, reuse, and change invalidation.

### Modified Capabilities

- `prepr-setup`: Prepare and validate accepted reviewer packages during setup while preserving keep/new configuration choices and setup-only handoff.
- `review-debate-workflow`: Resolve accepted effective reviewers before readiness; use a shared structural output contract while keeping all review judgment skill-specific.

## Impact

Adds a portable preparation skill, reviewer format documentation/template, deterministic validation/registration helpers, project-local draft/accepted reviewer storage, and acceptance coverage. Updates setup, runtime reviewer selection/prompts, the bundled peer package, fixtures, and documentation. No original/global skill is rewritten, no reviewer defaults or shared code-review criteria are introduced, and report artifact names/pointers remain unchanged. Semantic extraction occurs in the invoking assistant during onboarding, never as a hidden conversion or additional review session in a normal run.
