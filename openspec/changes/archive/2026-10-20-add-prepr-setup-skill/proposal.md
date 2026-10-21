## Why

Installing Prepr currently requires users to obtain the workflow manually, prepare its runtime and launcher, and write machine-specific reviewer profiles. A reusable setup skill should guide a new user from a remote source to a configured project without starting a review.

## What Changes

- Add a portable `prepr-setup` skill suitable for installation in Codex or Claude Code, with focused supporting resources where deterministic installation benefits from them.
- Fetch Prepr from `https://github.com/imviancagrace/prepr.git`, branch `main`, recording the actual resolved commit and never substituting a local development checkout.
- Detect required tools and versions; obtain permission before installing missing or insufficient prerequisites, and preserve existing working installations.
- Install the complete workflow into a selected Git project and configure two user-selected reviewer skills, launchers, and compatible model settings.
- On reinvocation, ask whether to keep existing reviewer configuration or configure a new pair; preserve current configuration until a replacement validates.
- Verify installation without invoking any Archon Prepr workflow, then provide local, branch, and preview commands for the user to run.

## Capabilities

### New Capabilities

- `prepr-setup`: Remote-source project installation, authorized prerequisite preparation, reviewer configuration, repeat-run handling, and setup-only handoff.

### Modified Capabilities

None. Existing review scope, readiness, debate, and report behavior remains governed by `review-debate-workflow`.

## Impact

Adds a distributable skill under `skills/prepr-setup/`, installation helpers/references as needed, setup acceptance coverage, and README instructions. It touches project workflow files and local reviewer configuration only when the installed skill is later invoked. Requires remote access to Prepr; the source is currently private, so repository authorization is a prerequisite. Actual marketplace submission and changing repository visibility are outside this change; platform packaging metadata is included only where needed for supported installation and verified against current official documentation during implementation.
