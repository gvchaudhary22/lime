#!/usr/bin/env bash
#
# Lime Pre-Tool-Use Hook — Safety Guard
# Blocks: destructive bash commands, .env writes, --no-verify bypasses.
# Reads: TOOL_NAME, TOOL_INPUT from env (set by Claude Code).
# Exits 1 to block, 0 to allow.
#

if [[ "${LIME_HOOKS_DISABLED:-0}" == "1" ]]; then
    exit 0
fi

TOOL="${TOOL_NAME:-}"
INPUT="${TOOL_INPUT:-}"

# Only check Bash and Write/Edit tools
if [[ "$TOOL" == "Bash" ]]; then
    # Block --no-verify (bypass hooks)
    if echo "$INPUT" | grep -qE '\-\-no-verify'; then
        echo "[BLOCKED] --no-verify is not allowed. Hooks must run." >&2
        exit 1
    fi
    # Block rm -rf on project root
    if echo "$INPUT" | grep -qE 'rm\s+-rf\s+(/|\./)'; then
        echo "[BLOCKED] Destructive rm -rf on root detected." >&2
        exit 1
    fi
    # Block git push --force to main/master
    if echo "$INPUT" | grep -qE 'git push.*(--force|-f)\s+(origin\s+)?(main|master)'; then
        echo "[BLOCKED] Force push to main/master is not allowed." >&2
        exit 1
    fi
fi

if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then
    # Block writing .env files with actual secrets
    FILE_PATH="${TOOL_FILE_PATH:-}"
    if echo "$FILE_PATH" | grep -qE '\.env$'; then
        if echo "$INPUT" | grep -qiE '(SECRET|PASSWORD|API_KEY|TOKEN)\s*=\s*[A-Za-z0-9+/]{8,}'; then
            echo "[BLOCKED] Writing secrets to .env file is not allowed." >&2
            exit 1
        fi
    fi
fi

exit 0
