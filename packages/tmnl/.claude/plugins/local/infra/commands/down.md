---
description: "Stop infrastructure containers"
argument-hint: "[--service NAME] [--group NAME] [--volumes] [--all]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-down.sh:*)"]
---

# Stop Infrastructure

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-down.sh" $ARGUMENTS
```

Stops Docker containers for the TMNL stack.

## Options

- `--service <name>` - Stop specific service
- `--group <name>` - Stop service group (core, cluster, collab, access)
- `--volumes` - Also remove volumes (data loss!)
- `--all` - Stop all services
- `-h, --help` - Show help

## Examples

```bash
/infra:down                        # Stop core services
/infra:down --service postgres     # Stop only postgres
/infra:down --all                  # Stop everything
/infra:down --all --volumes        # Stop and remove all data
```
