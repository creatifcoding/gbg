---
name: infra-up
description: Start TMNL Docker infrastructure containers (adopted from Claude /infra:up). Supports starting a service, service group, core defaults, or full stack with optional build.
allowed-tools: [Bash, Read]
---

# Infra Up

Start Docker containers for TMNL infrastructure.

This is the pi-skill adoption of the Claude plugin command:
- Source command: `../../../.claude/plugins/local/infra/commands/up.md`
- Source script: `../../../.claude/plugins/local/infra/scripts/infra-up.sh`

## When to Use

- User asks to start local TMNL infrastructure
- User wants only one service started (`postgres`, `electric`, etc.)
- User wants a service group started (`core`, `cluster`, `collab`, `access`)
- User wants full stack start (optionally with image build)

## Command

```bash
./.pi/skills/infra-up/scripts/infra-up.sh [OPTIONS]
```

## Options

- `--service <name>` - Start one service
- `--group <name>` - Start a service group (`core`, `cluster`, `collab`, `access`)
- `--build` - Build images before start
- `--all` - Start all services (default behavior without this flag is core only)
- `-h, --help` - Show help

## Service Groups

| Group | Services |
|-------|----------|
| `core` | `postgres durable-streams electric` |
| `cluster` | `search-cluster-coordinator search-cluster-sources ingestion-cluster` |
| `collab` | `y-sweet nats` |
| `access` | `ssh ngrok` |

## Usage Patterns

### Start Core (Default)

```bash
./.pi/skills/infra-up/scripts/infra-up.sh
```

### Start One Service

```bash
./.pi/skills/infra-up/scripts/infra-up.sh --service postgres
```

### Start Cluster Group

```bash
./.pi/skills/infra-up/scripts/infra-up.sh --group cluster
```

### Build and Start Everything

```bash
./.pi/skills/infra-up/scripts/infra-up.sh --all --build
```

## Agent Execution Protocol

1. Use user intent to choose flags.
2. Execute the script.
3. Report resulting `docker compose ps` status table.
4. If startup fails, report exact failing command/error and suggest next diagnostic command(s).

## Notes

- Script auto-discovers `docker/docker-compose.yml` from repo roots/parent dirs.
- Works from repo root or nested working directories.
- Uses `docker compose` (plugin-style CLI).
