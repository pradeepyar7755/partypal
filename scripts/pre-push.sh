#!/usr/bin/env bash
#
# Pre-push hook: Runs golden tests before allowing push to main or staging.
# If golden tests fail, the push is blocked.
#
# Install: cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
#

set -e

PROTECTED_BRANCHES="main staging"
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# Only gate pushes to protected branches
for branch in $PROTECTED_BRANCHES; do
    if [ "$CURRENT_BRANCH" = "$branch" ]; then
        echo ""
        echo "🛡️  Pre-push gate: pushing to '$branch' — running golden tests..."
        echo ""

        # Run golden tests
        if ! npx vitest run tests/golden/ --reporter=verbose 2>&1; then
            echo ""
            echo "❌ PUSH BLOCKED: Golden tests failed."
            echo "   Fix the failing tests before pushing to '$branch'."
            echo ""
            exit 1
        fi

        # Run lint check
        if ! npx tsc --noEmit 2>&1; then
            echo ""
            echo "❌ PUSH BLOCKED: TypeScript errors found."
            echo "   Fix type errors before pushing to '$branch'."
            echo ""
            exit 1
        fi

        echo ""
        echo "✅ All checks passed. Pushing to '$branch'."
        echo ""
        break
    fi
done

exit 0
