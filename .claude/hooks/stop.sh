#!/usr/bin/env bash
#
# Lime Stop Hook — Session Logger
# Non-blocking. Logs session end and warns about uncommitted changes.
# Always exits 0.
#

if [[ "${LIME_HOOKS_DISABLED:-0}" == "1" ]]; then
    exit 0
fi

LIME_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STATE_DIR="$LIME_ROOT/.claude/session-state"
SESSION_LOG="$STATE_DIR/sessions.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$STATE_DIR"

# Log session
echo "[$TIMESTAMP] session-end" >> "$SESSION_LOG" 2>/dev/null || true

# Keep log to 200 lines
if [[ -f "$SESSION_LOG" ]]; then
    tail -200 "$SESSION_LOG" > "$SESSION_LOG.tmp" 2>/dev/null && mv "$SESSION_LOG.tmp" "$SESSION_LOG" 2>/dev/null || true
fi

# Warn about uncommitted .tsx/.ts changes
CHANGED=$(git -C "$LIME_ROOT" diff --name-only 2>/dev/null | grep -cE '\.(tsx?|css)$' || echo "0")
STAGED=$(git -C "$LIME_ROOT" diff --cached --name-only 2>/dev/null | grep -cE '\.(tsx?|css)$' || echo "0")

if [[ "$CHANGED" -gt 0 ]] || [[ "$STAGED" -gt 0 ]]; then
    echo "[Lime] $((CHANGED + STAGED)) frontend file(s) changed. Run npm run build to verify before marking done."
fi

exit 0
