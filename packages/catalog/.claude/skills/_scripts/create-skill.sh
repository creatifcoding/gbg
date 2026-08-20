#!/bin/bash
# Catalog skill scaffolding
# Usage: ./create-skill.sh <skill-name> "<description>" "<triggers>"

set -e

SKILL_NAME="${1:?Error: skill name required}"
DESCRIPTION="${2:?Error: description required}"
TRIGGERS="${3:?Error: triggers required (comma-separated)}"

SKILLS_DIR="$(dirname "$0")/.."
SKILL_DIR="${SKILLS_DIR}/${SKILL_NAME}"

if [ -d "$SKILL_DIR" ]; then
    echo "Error: Skill '${SKILL_NAME}' already exists at ${SKILL_DIR}"
    exit 1
fi

mkdir -p "$SKILL_DIR"

TRIGGER_YAML=""
IFS=',' read -ra TRIGGER_ARRAY <<< "$TRIGGERS"
for trigger in "${TRIGGER_ARRAY[@]}"; do
    TRIGGER_YAML="${TRIGGER_YAML}  - \"${trigger}\"\n"
done

cat > "${SKILL_DIR}/SKILL.md" << EOF
---
name: ${SKILL_NAME}
description: ${DESCRIPTION}
model_invoked: true
triggers:
$(echo -e "$TRIGGER_YAML")---

# ${SKILL_NAME}

## Canonical sources

- \`src/lib/catalog/\`

## Patterns

## Anti-patterns

## Related

- \`catalog-file-organization\`
EOF

echo "Created skill: ${SKILL_DIR}/SKILL.md"
echo "Update SKILL_REGISTRY.md"
