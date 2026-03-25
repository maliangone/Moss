#!/bin/bash
# =============================================================================
# Moss AI Agent Platform — User Workspace Provisioning
#
# Usage: ./create-user.sh <username> [department]
#
# Creates an isolated workspace for a new user with:
#   - Private data/output directories (chmod 700)
#   - Personal .claude/ config with skill storage
#   - Department-specific CLAUDE.md context
# =============================================================================

set -euo pipefail

PERSISTENT_DIR="/persistent"
SHARED_DIR="${PERSISTENT_DIR}/shared"

usage() {
    echo "Usage: $0 <username> [department]"
    echo ""
    echo "Arguments:"
    echo "  username    - User identifier (e.g., zhangsan, alice)"
    echo "  department  - Optional: marketing, finance, legal, operations, production, it"
    echo ""
    echo "Example:"
    echo "  $0 zhangsan marketing"
    echo "  $0 alice it"
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

USERNAME="$1"
DEPARTMENT="${2:-general}"
USER_DIR="${PERSISTENT_DIR}/users/${USERNAME}"

# Validate username (alphanumeric + underscore/hyphen only)
if ! [[ "$USERNAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Username must contain only letters, numbers, underscores, or hyphens."
    exit 1
fi

# Check if user already exists
if [ -d "$USER_DIR" ]; then
    echo "WARNING: User '${USERNAME}' already exists at ${USER_DIR}"
    echo "Skipping creation. Use --force to recreate."
    exit 0
fi

echo "Creating workspace for user '${USERNAME}' (department: ${DEPARTMENT})..."

# Create directory structure
mkdir -p "${USER_DIR}/data"
mkdir -p "${USER_DIR}/output"
mkdir -p "${USER_DIR}/.claude/skills"
mkdir -p "${USER_DIR}/.claude/projects"

# Set permissions — only the owner can access
chmod 700 "$USER_DIR"

# Generate per-user CLAUDE.md with department context
cat > "${USER_DIR}/.claude/CLAUDE.md" << USERMD
# Personal Settings — ${USERNAME}

## Department
${DEPARTMENT}

## Department-Specific Context
$(case "$DEPARTMENT" in
    marketing)
        echo "I work in the Marketing department. When I mention 'campaigns', I'm referring to digital marketing campaigns. Default analysis should focus on ROI, conversion rates, customer acquisition cost (CAC), and channel performance."
        ;;
    finance)
        echo "I work in the Finance department. Focus on financial metrics: revenue, margin, cash flow, budget variance. Use conservative interpretations. Always include confidence intervals for forecasts."
        ;;
    legal)
        echo "I work in the Legal department. Focus on compliance risk indicators, regulatory metrics, and contract analysis. Be conservative and precise in all interpretations."
        ;;
    operations)
        echo "I work in the Operations department. Focus on operational efficiency: OEE, cycle time, throughput, yield rate, inventory turnover. Include trend analysis with historical comparisons."
        ;;
    production)
        echo "I work in the Production department. Focus on manufacturing metrics: defect rates, SPC analysis, AOI inspection data, production scheduling efficiency, and quality control."
        ;;
    it)
        echo "I work in the IT department. I have technical background. You can show more technical details in analysis when appropriate."
        ;;
    *)
        echo "General user. Provide clear, business-focused analysis with actionable insights."
        ;;
esac)

## Output Preferences
- Save all output files to ./output/
- Use Chinese for chart labels and report text
USERMD

echo "  Created: ${USER_DIR}/"
echo "  Created: ${USER_DIR}/data/"
echo "  Created: ${USER_DIR}/output/"
echo "  Created: ${USER_DIR}/.claude/skills/"
echo "  Created: ${USER_DIR}/.claude/CLAUDE.md (department: ${DEPARTMENT})"
echo ""
echo "Workspace ready. User can upload files to: ${USER_DIR}/data/"
echo "Analysis outputs will be saved to: ${USER_DIR}/output/"
