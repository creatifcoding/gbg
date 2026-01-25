---
description: "Check infrastructure health"
argument-hint: "[--service NAME] [--watch]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-status.sh:*)"]
---

# Infrastructure Status

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-status.sh" $ARGUMENTS
```

Shows container status and health checks.

## Options

- `--service <name>` - Check specific service
- `--watch` - Continuously monitor (5s interval)
- `-h, --help` - Show help

## Output

Shows table with:
- Container name
- Status (Up/Exited/Created)
- Health (healthy/unhealthy/starting)
- Ports

## Examples

```bash
/infra:status                      # All containers
/infra:status --service postgres   # Just postgres
/infra:status --watch              # Live monitoring
```
