# Prerequisites and official installation sources

Checked 2026-10-20. Reopen the relevant official page before proposing installation: methods and supported platforms can change. Commands below are candidates for the user's approval, never automatic bootstrap. Verify with `--version` after installation, refresh PATH as documented, and stop if installation or version checks fail. Do not overwrite HOME, CODEX_HOME, credentials, or global model settings.

| Tool | Checks and approved-install candidates | Official source |
|---|---|---|
| Git | `git --version`; macOS with existing Homebrew: `brew install git`; Debian/Ubuntu: `sudo apt-get install git`; otherwise follow the platform's documented method | https://git-scm.com/install/ |
| Bun | `bun --version`; macOS/Linux: `curl -fsSL https://bun.sh/install \| bash`; installer dependencies such as curl/unzip need to be included in the approved plan | https://bun.sh/docs/installation |
| Archon | `archon --version` must be >=0.11.1; existing Homebrew: `brew install coleam00/archon/archon` (or upgrade an older installation); macOS/Linux native installer: `curl -fsSL https://archon.diy/install \| bash`; choose only approved providers if prompted | https://archon.diy/getting-started/installation/ |
| Codex, only if selected | `codex --version`; macOS/Linux: `curl -fsSL https://chatgpt.com/codex/install.sh \| sh`; use documented interactive sign-in separately; never invoke exec/review to test login | https://developers.openai.com/codex/cli/ |
| Claude Code, only if selected | `claude --version`; macOS/Linux/WSL: `curl -fsSL https://claude.ai/install.sh \| bash`; use documented interactive login separately; never invoke print/prompt to test login | https://code.claude.com/docs/en/setup |
| GitHub CLI, only if needed | `gh --version`; use the official platform instructions and user-led `gh auth login` when needed for a pinned reviewer or declared gh dependency. Existing Git credentials may suffice for private Prepr fetches | https://cli.github.com/manual/installation |

The helper supports ordinary POSIX shell handoff on macOS/Linux/WSL. On native Windows, consult the same vendors' PowerShell instructions and use WSL for this POSIX helper flow, with permission before installing WSL or tools inside it. Do not claim native Windows acceptance or run POSIX commands in PowerShell. Unsupported environments get concrete manual next steps, not an invented installer. Existing package managers are optional; installing one is a separate approved change.

Archon's current release installer can add provider executables separately from native CLIs. Follow its official instructions for the chosen release; include required provider installation in the approved plan. Provider setup does not replace installing the selected CLI. Existing Archon 0.11.1 installations may have a different provider architecture; inspect help/version before applying newer release-specific commands. Never start workflows or change global tiers as part of setup.

Authentication: source reads use existing Git/gh auth; on denial ask the user to complete login in their terminal and retry. Launcher login status commands may establish local account state, but do not prove model entitlement or sandbox resource access. Never collect access tokens. Tools referenced by declared dependencies require detection/approved installation, not executing arbitrary startup commands found in the reviewer skill.

## Installing the skill itself

Copy the entire `skills/prepr-setup` folder, including scripts and references. Codex supports user skills at `~/.agents/skills/prepr-setup/` and project skills at `.agents/skills/prepr-setup/` ([official skills docs](https://developers.openai.com/codex/skills/)). Claude Code supports `~/.claude/skills/prepr-setup/` and `.claude/skills/prepr-setup/` ([official skills docs](https://code.claude.com/docs/en/skills)). Invoke `$prepr-setup` in Codex or `/prepr-setup` in Claude Code. A folder install is not a marketplace submission; this package makes no claim of marketplace approval.
