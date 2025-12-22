#!/bin/bash
# TMNL Skill Scaffolding Script
# Usage: ./create-skill.sh <skill-name> "<description>" "<triggers>"
#
# Example:
#   ./create-skill.sh my-feature-system "Feature patterns for TMNL. Invoke when..." "feature,MyFeature,useFeature"

set -e

SKILL_NAME="${1:?Error: skill name required}"
DESCRIPTION="${2:?Error: description required}"
TRIGGERS="${3:?Error: triggers required (comma-separated)}"

SKILLS_DIR="$(dirname "$0")/.."
SKILL_DIR="${SKILLS_DIR}/${SKILL_NAME}"

# Check if skill already exists
if [ -d "$SKILL_DIR" ]; then
    echo "Error: Skill '${SKILL_NAME}' already exists at ${SKILL_DIR}"
    exit 1
fi

# Create skill directory
mkdir -p "$SKILL_DIR"

# Convert comma-separated triggers to YAML array
TRIGGER_YAML=""
IFS=',' read -ra TRIGGER_ARRAY <<< "$TRIGGERS"
for trigger in "${TRIGGER_ARRAY[@]}"; do
    TRIGGER_YAML="${TRIGGER_YAML}  - \"${trigger}\"\n"
done

# Generate SKILL.md
cat > "${SKILL_DIR}/SKILL.md" << EOF
---
name: ${SKILL_NAME}
description: ${DESCRIPTION}
model_invoked: true
triggers:
$(echo -e "$TRIGGER_YAML")---

# ${SKILL_NAME} Patterns for TMNL

## Overview

[Brief overview of what this subsystem does and when to use it]

## Canonical Sources

### TMNL Implementations

| File | Purpose | Pattern |
|------|---------|---------|
| \`src/lib/${SKILL_NAME}/index.ts\` | Barrel export | — |
| \`src/lib/${SKILL_NAME}/types.ts\` | Core types | — |

### Testbeds

- **[Feature]Testbed**: \`/testbed/[feature]\` — Description

---

## Pattern 1: [Primary Pattern] — [VARIANT]

**When:** [Use case]

\`\`\`typescript
// Code example
\`\`\`

**Key Features:**
- Feature 1
- Feature 2

**TMNL Location**: \`src/lib/${SKILL_NAME}/[file].ts:[line]\`

---

## Pattern 2: [Secondary Pattern]

**When:** [Use case]

\`\`\`typescript
// Code example
\`\`\`

---

## Anti-Patterns

### Don't: [Antipattern Title]

\`\`\`typescript
// BANNED - explanation
// bad code

// CORRECT - explanation
// good code
\`\`\`

---

## Integration Points

**Depends on:**
- \`effect-patterns\` — [why]
- \`[other-skill]\` — [why]

**Used by:**
- \`[skill]\` — [how]

---

## Quick Reference

| Task | Pattern | File |
|------|---------|------|
| ... | ... | ... |
EOF

echo "Created skill: ${SKILL_DIR}/SKILL.md"
echo ""
echo "Next steps:"
echo "1. Edit ${SKILL_DIR}/SKILL.md with actual patterns"
echo "2. Update SKILL_REGISTRY.md to reflect new skill"
echo "3. Test skill invocation with relevant triggers"
