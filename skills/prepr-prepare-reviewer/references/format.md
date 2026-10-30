# Prepr reviewer format v1

The authoritative implementation is `.archon/workflows/prepr/.shared/reviewers.ts` in the fresh Prepr-main checkout. A package consists of reviewer.json, its deterministic SKILL.md render, and explicitly listed nonexecutable references (.md/.txt/.json). No scripts, indirect source invocation, extra files, or symlinks. Structural validation does not prove semantic fidelity.

Invoke the installed helper with absolute, safely quoted paths:

```
bun /installed/prepr-prepare-reviewer/scripts/prepare.ts /fresh/prepr-source inspect /project /source/skill
bun /installed/prepr-prepare-reviewer/scripts/prepare.ts /fresh/prepr-source draft /project /temporary/request.json
bun /installed/prepr-prepare-reviewer/scripts/prepare.ts /fresh/prepr-source preview /project DRAFT_ID
```

Draft request shape (all strings/arrays must reflect the source; empty arrays/objects mean no source-defined rule):

```json
{
  "reference": "/absolute/source/SKILL.md",
  "inputs": ["references/standards.md"],
  "standard": {
    "format": 1,
    "name": "reviewer-name",
    "priorities": [],
    "methods": [],
    "evidence": [],
    "communication": [],
    "severity": {},
    "assessments": [],
    "references": [{"path":"references/standards.md","source":"references/standards.md","required":true}],
    "resources": []
  },
  "extraction": {
    "retained": [{"source":"SKILL.md#Review judgment","instruction":"The actual preserved review standard"}],
    "excluded": [{"source":"SKILL.md#Preparation","instruction":"The source workflow action","reason":"Prepr owns this orchestration"}],
    "unresolved": [],
    "limitations": []
  }
}
```

References are copied verbatim from explicitly inspected source inputs. To preserve a document's relative links, include its required target files with the corresponding relative hierarchy, or re-express the pertinent rule in the structured content and explain the rewrite. Unresolved essential links are blockers. Absolute local input files are allowed only after explicit selection/authorization, never inferred broad access. Reviewer SKILL.md and reviewer.json plus listed references are fingerprinted automatically for a standard-form source; raw sources fingerprint SKILL.md plus the explicitly inspected input list.

A standard resource not yet captured is declared as `{ "kind":"standard", "reference":"...", "required":false, "limitation":"Not inspected; optional context only" }`. Essential standards must be inspected and retained, so a required unresolved standard is rejected. Runtime read declarations use `{ "kind":"runtime", "reference":"Purpose of the read", "required":true, "tool":"file|gh|git", "resource":"literal path, GET API path, or repo URL" }`; they are not executed during preparation. Optional runtime reads also require a limitation. Literal resource restrictions match the existing Prepr profile policy. Runtime data changing does not alter reviewer standards; actual-session verification still discloses data-access limits.

The generated output envelope preserves overview, verification, optional assessments, and findings. Findings support summary/evidence, optional question, kind (issue/question/hypothesis), known file/line, native severity, and optional explicit issue/no_issue verdict. Unknown verdicts stay absent. Debate retains existing explicit stances, rationale, confidence, corrections and duplicate IDs. No shared review checklist or inferred severity conversion is added.

The preview returns id/digest, effective instructions, source fingerprints, extraction summary and blockers. Show it before asking for human acceptance. After an explicit response only:

```
bun /installed/prepr-prepare-reviewer/scripts/prepare.ts /fresh/prepr-source accept /project DRAFT_ID SHOWN_DIGEST accept
```

Use reject to preserve prior active state. During setup, pass `{ "id":"DRAFT_ID", "digest":"SHOWN_DIGEST", "decision":"accept" }` in the setup request's acceptances array instead of activating independently. Matching data files are not proof of human consent; the invoking assistant must obtain the actual response. A changed digest or unresolved blocker rejects activation. No automatic acceptance flag exists.

Drafts, accepted copies and registry live under `.archon/prepr-reviewers/` and are excluded locally. Original sources and kept profile YAML are never rewritten. Approval is local operational state bound to content/project and a scope marker in local Git metadata (which is not shipped with reviewer packages), not a cryptographic identity claim; users who can modify all trusted local state can modify that state. Do not import approval assertions from reviewer packages or tracked repository files.
