#!/usr/bin/env bash
#
# Individual agent runners — thin wrappers that invoke Claude Code
# with the appropriate system prompt for each agent role.
#
# Usage: ./scripts/agent.sh <agent-name> [input]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROMPTS_DIR="$PROJECT_DIR/.agents/prompts"
REPORTS_DIR="$PROJECT_DIR/.agents/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
    echo ""
    echo -e "${BOLD}PartyPal Agent Runner${NC}"
    echo ""
    echo "Usage: $0 <agent> [options]"
    echo ""
    echo "Agents:"
    echo "  triage       Bug Triage Agent — classify and prioritize bugs"
    echo "  prioritize   Feature Prioritization Agent — score and rank features"
    echo "  dev          Development Agent — write code for approved tickets"
    echo "  review       Code Review Agent — review diffs for safety/quality"
    echo "  test         Testing Agent — run tests and generate new ones"
    echo "  sandbox      Sandbox Deploy Agent — deploy preview + smoke tests"
    echo "  shiproom     Shiproom Review Agent — pre-ship summary and risk flags"
    echo "  pipeline     Full pipeline — all agents in sequence with gates"
    echo ""
    echo "Options:"
    echo "  --input <file>   Input file (ticket, diff, etc.)"
    echo "  --message <msg>  Inline input message"
    echo ""
    echo "Examples:"
    echo "  $0 triage --input .agents/inbox/bug-login.md"
    echo "  $0 review    # reviews current git diff"
    echo "  $0 test      # runs golden + unit tests"
    echo "  $0 pipeline  # full pipeline with human gates"
    echo ""
    exit 1
}

[ $# -lt 1 ] && usage

AGENT="$1"
shift

INPUT_FILE=""
INPUT_MSG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --input) INPUT_FILE="$2"; shift 2 ;;
        --message) INPUT_MSG="$2"; shift 2 ;;
        *) echo "Unknown: $1"; usage ;;
    esac
done

case "$AGENT" in
    triage)
        echo -e "${BOLD}Running Bug Triage Agent...${NC}"
        if [ -n "$INPUT_FILE" ]; then
            echo "Input: $INPUT_FILE"
            echo "Prompt file: $PROMPTS_DIR/bug-triage.md"
            echo ""
            echo -e "${YELLOW}Run:${NC} claude -p \"$(cat "$INPUT_FILE")\" --system-prompt \"$(cat "$PROMPTS_DIR/bug-triage.md")\""
        elif [ -n "$INPUT_MSG" ]; then
            echo -e "${YELLOW}Run:${NC} claude -p \"$INPUT_MSG\" --system-prompt \"$(cat "$PROMPTS_DIR/bug-triage.md")\""
        else
            echo "Provide input: --input <file> or --message <text>"
            exit 1
        fi
        ;;

    prioritize)
        echo -e "${BOLD}Running Feature Prioritization Agent...${NC}"
        if [ -n "$INPUT_FILE" ]; then
            echo -e "${YELLOW}Run:${NC} claude -p \"$(cat "$INPUT_FILE")\" --system-prompt \"$(cat "$PROMPTS_DIR/feature-prioritize.md")\""
        elif [ -n "$INPUT_MSG" ]; then
            echo -e "${YELLOW}Run:${NC} claude -p \"$INPUT_MSG\" --system-prompt \"$(cat "$PROMPTS_DIR/feature-prioritize.md")\""
        else
            echo "Provide input: --input <file> or --message <text>"
            exit 1
        fi
        ;;

    dev)
        echo -e "${BOLD}Running Development Agent...${NC}"
        echo "This agent modifies code. It will follow CLAUDE.md conventions."
        echo ""
        echo -e "${YELLOW}Run:${NC} claude --system-prompt \"\$(cat $PROMPTS_DIR/dev-agent.md)\""
        echo "  Then describe the ticket/task interactively."
        ;;

    review)
        echo -e "${BOLD}Running Code Review Agent...${NC}"
        DIFF=$(cd "$PROJECT_DIR" && git diff HEAD 2>/dev/null || echo "")
        [ -z "$DIFF" ] && DIFF=$(cd "$PROJECT_DIR" && git diff --cached 2>/dev/null || echo "")
        if [ -z "$DIFF" ]; then
            echo -e "${YELLOW}No diff found. Stage or commit changes first.${NC}"
            exit 1
        fi
        DIFF_FILE="$REPORTS_DIR/diff_${TIMESTAMP}.patch"
        echo "$DIFF" > "$DIFF_FILE"
        echo "Diff saved: $DIFF_FILE"
        echo ""
        echo -e "${YELLOW}Run:${NC} claude -p \"Review this diff: \$(cat $DIFF_FILE)\" --system-prompt \"\$(cat $PROMPTS_DIR/code-review.md)\""
        ;;

    test)
        echo -e "${BOLD}Running Testing Agent...${NC}"
        echo ""
        echo "Step 1: Golden tests (must all pass)"
        cd "$PROJECT_DIR"
        npx vitest run tests/golden/ --reporter=verbose || {
            echo -e "${RED}Golden tests failed — fix before proceeding${NC}"
            exit 1
        }
        echo ""
        echo "Step 2: Full test suite"
        npx vitest run --reporter=verbose
        echo ""
        echo -e "${GREEN}Testing complete.${NC}"
        ;;

    sandbox)
        echo -e "${BOLD}Running Sandbox Deploy Agent...${NC}"
        if ! command -v vercel &> /dev/null; then
            echo -e "${RED}Vercel CLI not installed. Run: npm i -g vercel${NC}"
            exit 1
        fi
        cd "$PROJECT_DIR"
        echo "Building..."
        npm run build
        echo "Deploying preview..."
        DEPLOY_URL=$(vercel deploy 2>&1 | tail -1)
        echo -e "${GREEN}Preview: $DEPLOY_URL${NC}"
        echo ""
        echo "Smoke testing..."
        for ep in "/" "/login" "/dashboard" "/rsvp" "/vendors" "/budget"; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${DEPLOY_URL}${ep}" 2>/dev/null || echo "000")
            if [ "$STATUS" = "200" ]; then
                echo -e "  ${GREEN}✓${NC} ${ep} → ${STATUS}"
            else
                echo -e "  ${RED}✗${NC} ${ep} → ${STATUS}"
            fi
        done
        ;;

    shiproom)
        echo -e "${BOLD}Running Shiproom Review Agent...${NC}"
        cd "$PROJECT_DIR"
        echo ""
        echo "Gathering pipeline data..."
        echo "  Branch: $(git branch --show-current 2>/dev/null)"
        echo "  Changes: $(git diff --stat HEAD 2>/dev/null | tail -1)"
        echo ""
        echo "  Latest reports in $REPORTS_DIR:"
        ls -lt "$REPORTS_DIR"/*.md 2>/dev/null | head -5 | while read line; do
            echo "    $line"
        done
        echo ""
        echo -e "${YELLOW}Run:${NC} claude --system-prompt \"\$(cat $PROMPTS_DIR/shiproom.md)\" -p \"Generate shiproom report from the latest pipeline data.\""
        ;;

    pipeline)
        exec "$SCRIPT_DIR/pipeline.sh" "$@"
        ;;

    *)
        echo "Unknown agent: $AGENT"
        usage
        ;;
esac
