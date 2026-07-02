#!/usr/bin/env bash
# install.sh — one-line installer for the vibecoded-app-security Claude Skill.
#
# Usage:
#   ./install.sh                 # installs to ~/.claude/skills (personal, all projects)
#   ./install.sh --project       # installs to ./.claude/skills (this repo only, commit it)
#   ./install.sh --dir <path>    # installs to a custom skills directory
#
# Or, as a true one-liner once this repo is on GitHub:
#   curl -fsSL https://raw.githubusercontent.com/<you>/vibecoded-app-security/main/install.sh | bash

set -euo pipefail

REPO_URL="https://github.com/<you>/vibecoded-app-security.git"
SKILL_NAME="vibecoded-app-security"
TARGET_DIR="$HOME/.claude/skills"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      TARGET_DIR="./.claude/skills"
      shift
      ;;
    --dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$TARGET_DIR"
DEST="$TARGET_DIR/$SKILL_NAME"

if [ -d "$DEST" ]; then
  echo "Existing install found at $DEST — updating..."
  git -C "$DEST" pull --ff-only
else
  echo "Installing $SKILL_NAME into $DEST ..."
  git clone --depth 1 "$REPO_URL" "$DEST"
  rm -rf "$DEST/.git"
fi

echo ""
echo "Done. $SKILL_NAME is installed at:"
echo "  $DEST"
echo ""
echo "Claude Code picks it up automatically on your next session (restart if this"
echo "is a brand-new top-level skills directory). For claude.ai, zip this folder"
echo "and upload it under Settings > Capabilities > Skills instead — claude.ai"
echo "doesn't read the local filesystem."
echo ""
echo "Want the standalone scanner as a CLI command too?"
echo "  npx github:<you>/vibecoded-app-security /path/to/your/project"
