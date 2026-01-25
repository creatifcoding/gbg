---
description: "Rebuild and restart a service"
argument-hint: "<service> [--no-cache]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-rebuild.sh:*)"]
---

# Rebuild Service

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-rebuild.sh" $ARGUMENTS
```

Rebuilds and restarts a specific service container.

## Options

- `<service>` - Service name (required)
- `--no-cache` - Build without cache (clean rebuild)
- `-h, --help` - Show help

## Process

1. Stops the service
2. Removes the container
3. Rebuilds the image
4. Starts the service
5. Shows status

## Examples

```bash
/infra:rebuild search-cluster-coordinator           # Rebuild with cache
/infra:rebuild search-cluster-coordinator --no-cache # Clean rebuild
/infra:rebuild durable-streams                      # Rebuild durable-streams
```
