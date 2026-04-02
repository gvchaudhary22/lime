#!/usr/bin/env bash
#
# Lime Pre-Commit Hook — BLOCKING
# Runs: npm run build (must pass) + secret scan (blocks on find)
# Set LIME_HOOKS_DISABLED=1 to skip.
#

set -euo pipefail

GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'
FAIL_COUNT=0
WARN_COUNT=0

fail() {
    echo -e "${RED}[FAIL]${RESET} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

info() {
    echo -e "${GREEN}[OK]${RESET} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${RESET} $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

if [[ "${LIME_HOOKS_DISABLED:-0}" == "1" ]]; then
    echo "Lime hooks disabled (LIME_HOOKS_DISABLED=1), skipping."
    exit 0
fi

LIME_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

echo "=== Lime Pre-Commit Validation ==="
echo ""

# ---------------------------------------------------------------------------
# 1. npm run build — BLOCKING
# ---------------------------------------------------------------------------
echo "--- Build Check ---"
if (cd "$LIME_ROOT" && npm run build 2>&1); then
    info "npm run build passed"
else
    fail "npm run build FAILED — fix TypeScript/build errors before committing"
fi

echo ""

# ---------------------------------------------------------------------------
# 2. Secret scan — BLOCKING
# ---------------------------------------------------------------------------
echo "--- Secret Scan ---"
STAGED_FILES=$(git -C "$LIME_ROOT" diff --cached --name-only 2>/dev/null || true)

SECRET_PATTERNS='(AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{48}|ghp_[a-zA-Z0-9]{36}|xoxb-[0-9]+-[a-zA-Z0-9]+|AIza[0-9A-Za-z\-_]{35}|[Pp]assword\s*=\s*["\x27][^"'\'']{8,})'
SECRETS_FOUND=0

if [[ -n "$STAGED_FILES" ]]; then
    while IFS= read -r file; do
        # Skip test files, .md, .example
        if [[ "$file" =~ \.(md|example|txt)$ ]] || [[ "$file" =~ (__tests__|\.test\.) ]]; then
            continue
        fi
        FULL_PATH="$LIME_ROOT/$file"
        if [[ -f "$FULL_PATH" ]]; then
            MATCHES=$(grep -inE "$SECRET_PATTERNS" "$FULL_PATH" 2>/dev/null || true)
            if [[ -n "$MATCHES" ]]; then
                fail "Possible secret in $file"
                echo "    $MATCHES" | head -3
                SECRETS_FOUND=1
            fi
        fi
    done <<< "$STAGED_FILES"
    if [[ "$SECRETS_FOUND" -eq 0 ]]; then
        info "No secrets detected in staged files"
    fi
else
    info "No staged files to scan"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo -e "${RED}=== BLOCKED: $FAIL_COUNT gate(s) failed. Fix errors above. ===${RESET}"
    exit 1
elif [[ "$WARN_COUNT" -gt 0 ]]; then
    echo -e "${YELLOW}=== $WARN_COUNT warning(s) — build gates passed. ===${RESET}"
else
    echo -e "${GREEN}=== All checks passed ===${RESET}"
fi

exit 0
