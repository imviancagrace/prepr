## Context

See proposal.md for motivation. There are no existing reviewer-format or acceptance records. Runtime `core.ts` resolves a raw skill path and tells the reviewer to follow it; profiles select local paths or pinned GitHub sources. Vee mixes review standards with snapshot mutation, extra reviewers, and PR publication. The bundled peer is already mostly extracted but has no versioned compatibility or human-acceptance contract. Setup's `validateConfig` currently checks file existence, profile fields, tools, and tiers, and its keep mode deliberately preserves YAML bytes. Tests assume raw skills are usable.

This design spans new onboarding, setup, runtime resolution, and evidence output. The existing rule against a default review prompt remains: shared formatting is an interface, and code-review judgment still comes entirely from the chosen reviewer. Human acceptance is scoped to reviewer activation, not scope selection or every workflow invocation.

## Goals / Non-Goals

**Goals:** Faithful, inspectable adaptation; one project-local acceptance per effective reviewer version; no modification of original/global skills; consistent review/debate output; safe migration of raw references and setup integrations.

**Non-Goals:** A generic converter for every agent skill, automatic semantic-fidelity certification, marketplace publication, shared review criteria, reviewer default selection, cross-user approval distribution, signatures/identity infrastructure, or background conversions during reviews.

## Decisions

### 1. A versioned reviewer package, with judgment separate from transport

Version 1 contains `reviewer.json`, a rendered `SKILL.md`, and only the retained reference files needed for review. Structured reviewer content covers priorities, methods, evidence standards, communication, native severity definitions, and optional substantive assessments. Each section can explicitly state that the source defines no rule; the adapter must not invent a generic checklist. `SKILL.md` is rendered deterministically from validated content plus the shared runtime boundary and output contract. Validation checks that the render matches, referenced paths stay within the package, declared resources have explicit access/limitations, and the version is supported. No bundled executable scripts or indirect original-skill invocation are permitted.

The common initial result contains `overview`, `verification`, and `findings`. Findings preserve native wording, rationale/evidence, known file/line, optional native severity, and assessment kind (asserted issue, question, or hypothesis). An explicit issue/no-issue verdict is optional when unknown and must not be guessed. Support a dedicated question field or equivalent preserved content and optional reviewer-specific assessments such as spec alignment with evidence. Map this envelope to existing normalized finding/verification structures without forcing questions into confirmed bugs. Debate uses the current explicit stance/verdict/correction/confidence/duplicate-ID contract.

Severity mappings remain explicit local profile choices, not converter guesses. A common envelope adds no review checklist and does not homogenize Vee's questions into prescribed fixes. Legacy transcript normalization remains useful for historical reports and nonconforming model output, but is not a reviewer-onboarding bypass.

Alternative: add only a frontmatter marker. Rejected because a marker cannot establish content compatibility or acceptance. Alternative: make all reviewers use one common checklist. Rejected because it defeats independent standards.

### 2. Source inspection and semantic extraction run in the invoking assistant

Add `skills/prepr-prepare-reviewer/SKILL.md`, supported by a format/template reference and deterministic inspect/validate/preview/accept helpers. The same preparation procedure is used standalone or inline by setup. During setup the invoking assistant performs extraction within its existing conversation; no nested reviewer/model-probe session is started. Ship the preparation resources with setup in a self-contained distribution or explicitly bundle both skills together with verified resource lookup; do not depend on the user having separately installed an optional global skill. Keep one authoritative format/validator in the workflow package, accessible from fresh remote main and reusable by onboarding helpers.

Read source `SKILL.md` and explicitly relevant linked references as data, tracking what was read. Do not execute startup scripts, follow instructions to publish, or recursively traverse unrelated links. Local sources retain their actual identity and source-relative resolution; GitHub sources retain repo, immutable commit, and path. Source paths are inspectable input, not permission to broaden reads. Resolve symlinks/path escapes explicitly rather than silently copying external content.

Classify material source sections as retained, excluded, or unresolved, with source file/section references and reasons. Preserve domain standards, baseline reasoning, priorities, voice, and substantive dependencies. Remove scope/checkout ownership, PR discovery/publication, installation, scheduling, and extra-reviewer orchestration. For Vee this keeps spec-first assessment, review order, baseline classifications, redundancy checks, and concise questions; it excludes the default-agent pass and preparation/publication procedures. If a source combines those concerns inseparably, leave a draft and ask a focused clarification. No automatic rewriting of the original and no claim that schema validity proves faithful extraction.

### 3. Dependency declarations distinguish review rules from runtime facts

Retained review-standard documents are copied into the candidate as attributed, versioned snapshots when authorized and practical, or pinned to immutable readable sources. Include their contents/fingerprints in provenance and acceptance. Preserve relative links through explicit rewriting; never leave an adapted package pointing into a temporary clone. An external mutable standard without a verifiable revision remains unresolved until it can be captured or otherwise checked. Do not copy private standards into tracked project files.

A resource needed only as runtime evidence or data is declared separately with required/optional status and permitted read access. Its changing data is not a change to the reviewer's standards; preserve runtime freshness limits and existing readiness probes. An essential unreadable standard blocks acceptance. Optional absent context can be a visible accepted limitation. Do not drop authenticated resources merely to make preparation pass, and do not treat source instructions as tool-installation or credential authorization.

### 4. Draft, preview, explicit acceptance, then activation

Use local `.archon/prepr-reviewers/drafts/<id>/` for candidates, `.archon/prepr-reviewers/accepted/<digest>/` for immutable accepted packages, and a local registry/acceptance ledger under `.archon/prepr-reviewers/`. Exclude draft/private content and approval state from new Git tracking; preserve the existing bundled peer folder and unrelated files. A downloaded ready-made package or acceptance record from another machine is not local human consent.

Deterministic preview outputs the exact candidate digest, readable effective instructions, retained/excluded summary, dependencies, limitations, and blockers. The assistant asks the human to accept, edit, or reject that concrete version, then waits. Only after an explicit matching human answer may the acceptance helper validate the same digest and register it. Invoking setup, choosing a reviewer, keeping a YAML file, an auto-generated `accepted: true`, or silence is insufficient. Helpers record a local event only when called through this approved operation; they do not claim cryptographic proof of human identity.

Reject unresolved material ambiguities or essential missing standards before acceptance. Edits regenerate the preview and invalidate pending approval. Declining or leaving the prompt unanswered leaves a draft; a failed activation restores prior registry/configuration state. Previously accepted package versions remain recoverable. Registration activates a version only; it never starts a workflow.

### 5. Exact-content reuse and conservative invalidation

Bind records to format/output-contract version, source identity, source `SKILL.md` and inspected instruction-reference hashes, effective instructions/render, retained standards, and dependency declarations. Separate volatile preparation timestamps and presentation-only summary formatting from execution fingerprints. Changes to launcher/model selection alone do not rewrite review standards and continue to use existing profile/readiness handling.

For version 1, conservatively require revalidation and renewed acceptance for changed bytes in source instructions or retained standard content, even when an edit might be cosmetic; never attempt an automatic semantic-equivalence proof to carry approval forward. Files outside the explicitly inspected instruction set do not invalidate approval merely because an unrelated repository commit changed. A new pinned reviewer source revision is a new source identity and needs preparation. A source that cannot be verified blocks use; do not silently run a stale accepted adaptation. Hashes identify inspected content; they do not prove that the assistant discovered every implicit dependency, so disclose extraction coverage.

Already standardized and locally accepted content is reused without conversion or prompts. A new standardized package needs validation and the same first acceptance. Relocation requires an explicit relink of source identity with content checks; no implicit authorization to read different resources. Contract-version changes invalidate incompatible records. Tests use explicit fixture acceptance records constructed in disposable projects, never a production auto-approve flag.

### 6. Preserve profile references while enforcing effective-package resolution

Keep the profile's existing `skill` reference as source identity so keep mode can preserve configuration bytes. Store the mapping to accepted effective packages in the local registry. Direct skill references resolve through the same mapping; selecting an accepted package directory itself still requires matching local acceptance, preventing a path-based bypass. Bundled peer is shipped in standard form but receives local acceptance like any other reviewer.

Refactor source resolution into bounded, read-only inspect/fingerprint operations reusable by setup and runtime. Before model readiness, resolve both sides, check matching supported acceptance and content, and pin an effective package snapshot for the run. Recheck the package before initial review so a concurrent edit cannot slip through a validated record. Sessions load only the accepted package and its retained references, never the raw source as instructions. The original source may be read as provenance by preparation/checks, not as a second instruction set. Agent prompts contain Prepr scope/operation boundaries and the structural output/debate envelope plus the accepted reviewer-specific content.

A missing/stale/unaccepted side stops both reviewers with `prepr-prepare-reviewer` or setup guidance. Normal runs do not convert, prompt, register, install, or mutate YAML/acceptance state. Scope-only preview retains its existing bypass. Effective package digests, source revisions/hashes, format version, and local acceptance references enter complete JSON evidence; credentials and full private source documents do not. No report filename, artifact pointer, debate-session count, or duplicate-reuse semantics change.

### 7. Integrate onboarding without weakening setup boundaries

Setup inspects compatibility after the user selects or keeps the pair. Automatically prepare missing candidates inline, then pause for each new effective version's explicit acceptance (a combined preview can cover both if the human explicitly accepts both named digests). Only accepted selections qualify as configured. Keep/new YAML choice and reviewer acceptance are separate. Registration may update ignored registry state while kept YAML bytes remain identical. Replacing the pair should stage candidate mappings and profile replacement so decline/failure does not switch an existing active pair. Rejected candidates leave setup incomplete with manual next steps rather than silently retaining another reviewer as if the requested pair succeeded.

Source retrieval from Prepr main, approved prerequisite installation, workflow keep/replace, and command-only handoff remain unchanged. Update setup's package inventory/provenance/recovery handling to include managed reviewer state without deleting unrelated reviewer content. The preparation skill itself is not an authority to install source-declared tools or launch Prepr.

## Risks / Trade-offs

- Semantic extraction may lose meaning: provide source-linked summaries, block material ambiguities, and require human inspection; test contrasting representative reviewers rather than only checking JSON shape.
- Conservative hashes can repeat approval for cosmetic instruction edits: state this version-1 policy clearly; improving semantic reuse is outside this change.
- Existing raw-reference users will encounter a new preparation requirement: document the breaking migration and retain source references/old configuration while onboarding.
- Private domain references can be unavailable or unsuitable for copying: retain access declarations and block essential unknown standards; no automatic credential changes.
- Local acceptance records are mutable local state: validate digests and keep records outside repository-supplied instructions; do not claim protection against an actor who can freely modify the user's trusted local state.
- New schema can flatten reviewer voices or imply defects from questions: preserve native text/assessments and test explicit unknown verdicts and severity mappings end to end.

## Migration Plan

1. Add the format, preparation skill, shared inspection/validation/acceptance helpers, and local storage contract.
2. Prepare the bundled peer as standard-form content without changing its review standards; onboarding still requires recipient acceptance.
3. Update setup and runtime together, plus all fixtures that currently assume arbitrary raw skills start immediately.
4. On existing installations, preserve profiles and explain how to prepare both selections; no automatic global Vee conversion or source replacement.
5. Test in temporary projects with fake launchers and representative synthetic source skills. Preserve workflow read-only boundaries and original report delivery.
6. Document manual preparation, automatic setup preparation, acceptance/rejection, source changes, and migration. Publish only on a separate user request.

Rollback restores prior workflow/profile/registry backups together; a prior accepted package remains immutable. A reviewer accepted under a newer incompatible contract cannot be treated as accepted by an older runtime merely by editing its version marker.
