#!/bin/sh
# Nonmutating bootstrap checks; works before Git or Bun is installed.
set -eu
case "$(uname -s)" in
  Darwin|Linux) ;;
  *) echo 'Unsupported shell platform. Follow prerequisites.md; do not install automatically.' >&2; exit 1 ;;
esac
for selected in "$@"; do
  case "$selected" in codex|claude) ;; *) echo 'Choose launcher codex or claude.' >&2; exit 1 ;; esac
done
for tool in git bun archon "$@"; do
  if command -v "$tool" >/dev/null 2>&1; then
    if version=$("$tool" --version 2>/dev/null); then printf '%s: %s\n' "$tool" "$version";
    else printf '%s: unavailable or version check failed\n' "$tool"; fi
  else printf '%s: missing\n' "$tool"; fi
done
printf '%s\n' 'No tools installed. Archon must be >=0.11.1; verify versions before approval.'
