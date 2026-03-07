#!/usr/bin/env bash
#
# PartyPal Agent Pipeline Orchestrator
# Wires agents together with human gates at key checkpoints.
#
# Usage:
#   ./scripts/pipeline.sh                  # Interactive mode (prompts at gates)
#   ./scripts/pipeline.sh --ticket <file>  # Start from a specific ticket file
#   ./scripts/pipeline.sh --skip-triage    # Skip triage, go straight to dev
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$PROJECT_DIR/.agents"
PROMPTS_DIR="$AGENTS_DIR/prompts"
REPORTS_DIR="$AGENTS_DIR/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helpers ────────────────────────────────────────────────

banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${BOLD}  $1${NC}${CYAN}$(printf '%*s' $((46 - ${#1})) '')║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

step() {
    echo -e "${BLUE}▸${NC} ${BOLD}$1${NC}"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
}

gate() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  HUMAN GATE: $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    read -p "  Approve? [y/n] " answer
    case "$answer" in
        y|Y|yes)
            echo "$(date +%Y-%m-%dT%H:%M:%S) GATE_APPROVED: $1" >> "$REPORTS_DIR/audit.log"
            return 0
            ;;
        *)
            echo "$(date +%Y-%m-%dT%H:%M:%S) GATE_REJECTED: $1" >> "$REPORTS_DIR/audit.log"
            fail "Pipeline stopped at gate: $1"
            exit 1
            ;;
    esac
}

# ── Parse Args ────────────────────────────────────────────

TICKET_FILE=""
SKIP_TRIAGE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --ticket) TICKET_FILE="$2"; shift 2 ;;
        --skip-triage) SKIP_TRIAGE=true; shift ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# ── Pipeline ────────────────────────────────────────────────

banner "PartyPal Agent Pipeline"

echo -e "  Project:  ${BOLD}$PROJECT_DIR${NC}"
echo -e "  Reports:  ${BOLD}$REPORTS_DIR${NC}"
echo -e "  Started:  ${BOLD}$(date)${NC}"
echo ""

# ── Stage 1: Triage ────────────────────────────────────────

if [ "$SKIP_TRIAGE" = false ]; then
    banner "Stage 1: Bug Triage / Feature Prioritization"

    if [ -n "$TICKET_FILE" ]; then
        step "Processing ticket: $TICKET_FILE"
        TICKET_CONTENT=$(cat "$TICKET_FILE")
    else
        # Check inbox for unprocessed tickets
        INBOX_FILES=$(find "$AGENTS_DIR/inbox" -name "*.md" 2>/dev/null | head -5)
        if [ -z "$INBOX_FILES" ]; then
            warn "No tickets in .agents/inbox/"
            echo "  Drop .md files in .agents/inbox/ to process them."
            echo "  Or use --ticket <file> to specify a ticket."
            echo ""
            read -p "  Enter a bug/feature description (or 'skip'): " TICKET_CONTENT
            if [ "$TICKET_CONTENT" = "skip" ]; then
                SKIP_TRIAGE=true
            fi
        else
            echo "  Found tickets in inbox:"
            echo "$INBOX_FILES" | while read f; do
                echo "    - $(basename "$f")"
            done
            TICKET_FILE=$(echo "$INBOX_FILES" | head -1)
            TICKET_CONTENT=$(cat "$TICKET_FILE")
            step "Processing: $(basename "$TICKET_FILE")"
        fi
    fi

    if [ "$SKIP_TRIAGE" = false ] && [ -n "$TICKET_CONTENT" ]; then
        # Determine if bug or feature
        if echo "$TICKET_CONTENT" | grep -qi "bug\|error\|crash\|broken\|fail\|fix"; then
            step "Detected: Bug Report → Running Bug Triage Agent"
            TRIAGE_REPORT="$REPORTS_DIR/triage_${TIMESTAMP}.md"
            echo "# Bug Triage Report — $(date)" > "$TRIAGE_REPORT"
            echo "" >> "$TRIAGE_REPORT"
            echo "## Input" >> "$TRIAGE_REPORT"
            echo "$TICKET_CONTENT" >> "$TRIAGE_REPORT"
            echo "" >> "$TRIAGE_REPORT"
            echo "## Analysis" >> "$TRIAGE_REPORT"
            echo "_Run: claude --prompt-file $PROMPTS_DIR/bug-triage.md with the input above_" >> "$TRIAGE_REPORT"
            success "Triage report: $TRIAGE_REPORT"
        else
            step "Detected: Feature Request → Running Feature Prioritization Agent"
            PRIORITY_REPORT="$REPORTS_DIR/priority_${TIMESTAMP}.md"
            echo "# Feature Prioritization Report — $(date)" > "$PRIORITY_REPORT"
            echo "" >> "$PRIORITY_REPORT"
            echo "## Input" >> "$PRIORITY_REPORT"
            echo "$TICKET_CONTENT" >> "$PRIORITY_REPORT"
            echo "" >> "$PRIORITY_REPORT"
            echo "## Analysis" >> "$PRIORITY_REPORT"
            echo "_Run: claude --prompt-file $PROMPTS_DIR/feature-prioritize.md with the input above_" >> "$PRIORITY_REPORT"
            success "Priority report: $PRIORITY_REPORT"
        fi

        gate "Review the triage/priority report before proceeding to development"
    fi
fi

# ── Stage 2: Development ──────────────────────────────────

banner "Stage 2: Development Agent"

step "The Dev Agent will now implement the approved ticket."
echo "  Run: claude --prompt-file $PROMPTS_DIR/dev-agent.md"
echo ""
echo "  This agent has file access and can modify your codebase."
echo "  It will follow all PartyPal conventions from CLAUDE.md."
echo ""

gate "Review the code changes before proceeding to code review"

# ── Stage 3: Code Review ──────────────────────────────────

banner "Stage 3: Code Review Agent"

step "Running code review on current diff..."
REVIEW_REPORT="$REPORTS_DIR/review_${TIMESTAMP}.md"

# Capture the current diff
DIFF=$(cd "$PROJECT_DIR" && git diff HEAD 2>/dev/null || echo "No diff available")

if [ "$DIFF" = "No diff available" ] || [ -z "$DIFF" ]; then
    warn "No diff to review. Checking staged changes..."
    DIFF=$(cd "$PROJECT_DIR" && git diff --cached 2>/dev/null || echo "No staged changes")
fi

echo "# Code Review Report — $(date)" > "$REVIEW_REPORT"
echo "" >> "$REVIEW_REPORT"
echo "## Diff" >> "$REVIEW_REPORT"
echo '```diff' >> "$REVIEW_REPORT"
echo "$DIFF" >> "$REVIEW_REPORT"
echo '```' >> "$REVIEW_REPORT"
echo "" >> "$REVIEW_REPORT"
echo "## Review" >> "$REVIEW_REPORT"
echo "_Run: claude --prompt-file $PROMPTS_DIR/code-review.md with the diff above_" >> "$REVIEW_REPORT"

success "Review report: $REVIEW_REPORT"

gate "Review the code review report before proceeding to tests"

# ── Stage 4: Testing ──────────────────────────────────────

banner "Stage 4: Testing Agent"

step "Running golden tests..."
cd "$PROJECT_DIR"

TEST_REPORT="$REPORTS_DIR/tests_${TIMESTAMP}.md"
echo "# Test Report — $(date)" > "$TEST_REPORT"
echo "" >> "$TEST_REPORT"

if npx vitest run tests/golden/ --reporter=verbose 2>&1 | tee -a "$TEST_REPORT"; then
    success "Golden tests passed"
    echo "" >> "$TEST_REPORT"
    echo "## Result: ALL GOLDEN TESTS PASSED" >> "$TEST_REPORT"
else
    fail "Golden tests FAILED — deployment blocked"
    echo "" >> "$TEST_REPORT"
    echo "## Result: GOLDEN TESTS FAILED — DEPLOYMENT BLOCKED" >> "$TEST_REPORT"
    exit 1
fi

step "Running full test suite..."
if npx vitest run --reporter=verbose 2>&1 | tee -a "$TEST_REPORT"; then
    success "All tests passed"
else
    fail "Test suite FAILED — deployment blocked"
    echo "" >> "$TEST_REPORT"
    echo "## Result: TEST SUITE FAILED — DEPLOYMENT BLOCKED" >> "$TEST_REPORT"
    echo "$(date +%Y-%m-%dT%H:%M:%S) BLOCKED: Full test suite failed" >> "$REPORTS_DIR/audit.log"
    exit 1
fi

success "Test report: $TEST_REPORT"

# ── Stage 5: Sandbox Deploy ──────────────────────────────

banner "Stage 5: Sandbox Deploy"

step "Deploying to Vercel preview..."
DEPLOY_REPORT="$REPORTS_DIR/deploy_${TIMESTAMP}.md"
echo "# Deploy Report — $(date)" > "$DEPLOY_REPORT"

if command -v vercel &> /dev/null; then
    DEPLOY_URL=$(cd "$PROJECT_DIR" && vercel deploy 2>&1 | tail -1)
    echo "## Deploy URL" >> "$DEPLOY_REPORT"
    echo "$DEPLOY_URL" >> "$DEPLOY_REPORT"
    echo "" >> "$DEPLOY_REPORT"
    success "Deployed: $DEPLOY_URL"

    # Run smoke tests
    step "Running smoke tests..."
    echo "## Smoke Tests" >> "$DEPLOY_REPORT"

    ENDPOINTS=("/" "/login" "/dashboard" "/rsvp" "/vendors" "/budget" "/contact" "/privacy")
    PASSED=0
    FAILED=0

    for endpoint in "${ENDPOINTS[@]}"; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${DEPLOY_URL}${endpoint}" 2>/dev/null || echo "000")
        if [ "$STATUS" = "200" ]; then
            success "$endpoint → $STATUS"
            echo "- $endpoint → $STATUS ✓" >> "$DEPLOY_REPORT"
            PASSED=$((PASSED + 1))
        else
            fail "$endpoint → $STATUS"
            echo "- $endpoint → $STATUS ✗" >> "$DEPLOY_REPORT"
            FAILED=$((FAILED + 1))
        fi
    done

    echo "" >> "$DEPLOY_REPORT"
    echo "## Summary: $PASSED passed, $FAILED failed" >> "$DEPLOY_REPORT"
else
    warn "Vercel CLI not installed. Install with: npm i -g vercel"
    echo "## Skipped — Vercel CLI not installed" >> "$DEPLOY_REPORT"
fi

success "Deploy report: $DEPLOY_REPORT"

# ── Stage 6: Shiproom ────────────────────────────────────

banner "Stage 6: Shiproom Review"

SHIP_REPORT="$REPORTS_DIR/shiproom_${TIMESTAMP}.md"

# Gather all reports
echo "# Shiproom Review — $(date)" > "$SHIP_REPORT"
echo "" >> "$SHIP_REPORT"

# Git summary
echo "## Changes" >> "$SHIP_REPORT"
cd "$PROJECT_DIR"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')" >> "$SHIP_REPORT"
echo "Files changed: $(git diff --stat HEAD 2>/dev/null | tail -1 || echo 'N/A')" >> "$SHIP_REPORT"
echo "" >> "$SHIP_REPORT"

# Collect all stage reports
for stage in triage priority review tests deploy; do
    STAGE_FILE=$(ls "$REPORTS_DIR/${stage}_${TIMESTAMP}.md" 2>/dev/null || true)
    if [ -n "$STAGE_FILE" ]; then
        echo "## $(echo $stage | tr '[:lower:]' '[:upper:]') Report" >> "$SHIP_REPORT"
        echo "" >> "$SHIP_REPORT"
        cat "$STAGE_FILE" >> "$SHIP_REPORT"
        echo "" >> "$SHIP_REPORT"
    fi
done

echo "" >> "$SHIP_REPORT"
echo "## Decision" >> "$SHIP_REPORT"
echo "_Awaiting human review_" >> "$SHIP_REPORT"

success "Shiproom report: $SHIP_REPORT"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Pipeline complete. Review: $SHIP_REPORT${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

gate "SHIP to production?"

echo ""
success "Approved for shipping."
echo "  Next steps:"
echo "    1. git add -A && git commit"
echo "    2. git push origin main"
echo "    3. Vercel will auto-deploy to production"
echo ""
