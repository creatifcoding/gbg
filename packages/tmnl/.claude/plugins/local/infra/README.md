# TMNL Infrastructure Plugin

Claude Code plugin for managing TMNL Docker infrastructure.

## Installation

The plugin is located at `.claude/plugins/local/infra/`.

To test locally without installing:

```bash
claude --plugin-dir .claude/plugins/local/infra
```

## Commands

| Command | Description |
|---------|-------------|
| `/infra:up` | Start infrastructure containers |
| `/infra:down` | Stop infrastructure containers |
| `/infra:status` | Check container health |
| `/infra:logs` | View service logs |
| `/infra:rebuild` | Rebuild and restart a service |
| `/infra:help` | Show help in floating pane (zellij) |

## Usage

### Start Services

```bash
/infra:up                          # Start core services
/infra:up --service postgres       # Start specific service
/infra:up --group cluster          # Start service group
/infra:up --all --build            # Build and start everything
```

### Stop Services

```bash
/infra:down                        # Stop core services
/infra:down --service postgres     # Stop specific service
/infra:down --all                  # Stop everything
/infra:down --all --volumes        # Stop and remove data
```

### Check Status

```bash
/infra:status                      # All containers
/infra:status --service postgres   # Specific service
/infra:status --watch              # Live monitoring
```

### View Logs

```bash
/infra:logs postgres               # Last 100 lines
/infra:logs postgres --tail 50     # Last 50 lines
/infra:logs postgres --follow      # Follow live
```

### Rebuild Service

```bash
/infra:rebuild durable-streams           # Rebuild with cache
/infra:rebuild durable-streams --no-cache # Clean rebuild
```

### Get Help

```bash
/infra:help              # Overview (floating pane in zellij)
/infra:help up           # Help for /infra:up
/infra:help status       # Help for /infra:status
```

## Service Groups

| Group | Services |
|-------|----------|
| **core** | postgres, durable-streams, electric |
| **cluster** | search-cluster-coordinator, search-cluster-sources, ingestion-cluster |
| **collab** | y-sweet, nats |
| **access** | ssh, ngrok |

## Expert Agent

The plugin includes an expert agent for infrastructure troubleshooting. Ask questions like:

- "Why is postgres unhealthy?"
- "How do I debug Electric sync issues?"
- "What's blocking the search cluster?"

## Skill Documentation

The `skills/infrastructure/` directory contains detailed documentation:

### Service Briefings

- `briefings/postgres.md` - PostGIS + TimescaleDB
- `briefings/durable-streams.md` - Event streaming
- `briefings/electric.md` - Real-time sync
- `briefings/search-cluster.md` - Effect Cluster search
- `briefings/ingestion-cluster.md` - Data ingestion
- `briefings/nats.md` - Message broker
- `briefings/minio.md` - Object storage
- `briefings/y-sweet.md` - Yjs sync
- `briefings/ngrok.md` - Remote access

### Journals

- `journals/troubleshooting.md` - Common issues
- `journals/build-issues.md` - Build problems
- `journals/changelog.md` - Infrastructure changes

## Structure

```
.claude/plugins/local/infra/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── agents/
│   └── infra-expert.md          # Expert agent
├── commands/
│   ├── up.md                    # /infra:up
│   ├── down.md                  # /infra:down
│   ├── status.md                # /infra:status
│   ├── logs.md                  # /infra:logs
│   ├── rebuild.md               # /infra:rebuild
│   └── help.md                  # /infra:help
├── scripts/
│   ├── infra-up.sh              # Start script
│   ├── infra-down.sh            # Stop script
│   ├── infra-status.sh          # Status script
│   ├── infra-logs.sh            # Logs script
│   ├── infra-rebuild.sh         # Rebuild script
│   └── infra-help.sh            # Help with zellij floating pane
├── skills/
│   └── infrastructure/
│       ├── SKILL.md             # Main skill
│       ├── briefings/           # Service docs
│       └── journals/            # Runbooks
└── README.md                    # This file
```

## Development

To modify the plugin:

1. Edit command files in `commands/`
2. Update scripts in `scripts/`
3. Add documentation to `skills/infrastructure/`
4. Test with `claude --plugin-dir .claude/plugins/local/infra`
