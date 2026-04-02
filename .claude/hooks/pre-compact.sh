#!/usr/bin/env bash
#
# Lime Pre-Compact Hook — Context Snapshot
# Saves session state before context compaction.
# Non-blocking — always exits 0.
#

set -euo pipefail

if [[ "${LIME_HOOKS_DISABLED:-0}" == "1" ]]; then
    exit 0
fi

LIME_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SNAPSHOT_DIR="$LIME_ROOT/.claude/session-state"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SNAPSHOT_FILE="$SNAPSHOT_DIR/pre-compact-$(date -u +%Y%m%d-%H%M%S).md"

mkdir -p "$SNAPSHOT_DIR"

{
  echo "# Lime Pre-Compact Snapshot — $TIMESTAMP"
  echo ""
  echo "## Git Status"
  git -C "$LIME_ROOT" status --short 2>/dev/null || echo "(no git status)"
  echo ""
  echo "## Modified Frontend Files"
  git -C "$LIME_ROOT" diff --name-only 2>/dev/null | grep -E '\.(tsx?|css)$' || echo "(none)"
  echo ""
  echo "## Staged Files"
  git -C "$LIME_ROOT" diff --cached --name-only 2>/dev/null || echo "(none)"
  echo ""
  echo "## Last 5 Commits"
  git -C "$LIME_ROOT" log --oneline -5 2>/dev/null || echo "(no log)"
} > "$SNAPSHOT_FILE" 2>/dev/null

# Keep only last 10 snapshots
ls -t "$SNAPSHOT_DIR"/pre-compact-*.md 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

echo "[Lime] Pre-compact snapshot saved: $(basename "$SNAPSHOT_FILE")"
exit 0
