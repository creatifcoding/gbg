---
description: "Start infrastructure containers"
argument-hint: "[--service NAME] [--group NAME] [--build] [--all]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-up.sh:*)"]
---

# Start Infrastructure

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-up.sh" $ARGUMENTS
```

Starts Docker containers for the TMNL stack.

## Options

- `--service <name>` - Start specific service (postgres, durable-streams, electric, etc.)
- `--group <name>` - Start service group (core, cluster, collab, access)
- `--build` - Build images before starting
- `--all` - Start all services (default: core only)
- `-h, --help` - Show help

## Service Groups

| Group | Services |
|-------|----------|
| **core** | postgres, durable-streams, electric |
| **cluster** | search-cluster-coordinator, search-cluster-sources, ingestion-cluster |
| **collab** | y-sweet, nats |
| **access** | ssh, ngrok |

## Examples

```bash
/infra:up                          # Start core services
/infra:up --service postgres       # Start only postgres
/infra:up --group cluster          # Start Effect Cluster nodes
/infra:up --all --build            # Build and start everything
```
