---
description: "View service logs"
argument-hint: "<service> [--follow] [--tail N]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-logs.sh:*)"]
---

# View Logs

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-logs.sh" $ARGUMENTS
```

View logs for a specific service.

## Options

- `<service>` - Service name (required)
- `--follow` or `-f` - Follow log output
- `--tail <n>` - Show last N lines (default: 100)
- `-h, --help` - Show help

## Examples

```bash
/infra:logs postgres               # Last 100 lines
/infra:logs postgres --tail 50     # Last 50 lines
/infra:logs postgres --follow      # Follow live
/infra:logs postgres -f            # Follow (short)
```
