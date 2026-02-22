#!/usr/bin/env bash
#
# Generate a new MCP skill from template
#
# Usage:
#   ./new-mcp-skill.sh <server-name> "<description>"
#
# Example:
#   ./new-mcp-skill.sh perplexity "AI-powered web search and research"
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$(dirname "$SCRIPT_DIR")/../../"
TEMPLATE="$SCRIPT_DIR/../templates/skill-template.md"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server-name> \"<description>\""
  echo ""
  echo "Example:"
  echo "  $0 perplexity \"AI-powered web search and research\""
  exit 1
fi

SERVER_NAME="$1"
DESCRIPTION="$2"
SKILL_DIR="$SKILLS_DIR/$SERVER_NAME"

if [[ -d "$SKILL_DIR" ]]; then
  echo "Error: Skill directory already exists: $SKILL_DIR"
  exit 1
fi

# Create skill directory
mkdir -p "$SKILL_DIR"

# Generate SKILL.md
cat > "$SKILL_DIR/SKILL.md" << EOF
---
name: $SERVER_NAME
description: $DESCRIPTION
---

# ${SERVER_NAME^} MCP

$DESCRIPTION

## When to Use

- TODO: Add use case 1
- TODO: Add use case 2
- TODO: Add use case 3

## Tools

The \`$SERVER_NAME\` MCP provides these tools (prefixed with \`${SERVER_NAME}_\`):

| Tool | Description |
|------|-------------|
| \`${SERVER_NAME}_tool1\` | TODO: Description |
| \`${SERVER_NAME}_tool2\` | TODO: Description |

> **Note**: Run \`/mcp\` in pi to see actual tool names after connecting.

## Usage Patterns

### Basic Usage

\`\`\`
Use ${SERVER_NAME}_tool1 for "example query"
\`\`\`

## Best Practices

1. **TODO** — Add best practice 1
2. **TODO** — Add best practice 2

---

*Generated from template. Update with actual tool names and patterns.*
EOF

echo "Created skill: $SKILL_DIR/SKILL.md"
echo ""
echo "Next steps:"
echo "  1. Add MCP server to .pi/mcp.json"
echo "  2. Start pi and run /mcp to see tool names"
echo "  3. Update $SKILL_DIR/SKILL.md with actual tools"
