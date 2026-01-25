#!/bin/bash
set -euo pipefail

COMMAND="${1:-}"

# Generate help content
generate_help() {
  case "$COMMAND" in
    up)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                        /infra:up                                 ║
╠══════════════════════════════════════════════════════════════════╣
║  Start Docker containers for TMNL infrastructure.                ║
╚══════════════════════════════════════════════════════════════════╝

USAGE
  /infra:up [OPTIONS]

OPTIONS
  --service <name>   Start specific service
  --group <name>     Start service group
  --build            Build images before starting
  --all              Start all services (default: core only)
  -h, --help         Show this help

SERVICE GROUPS
  core      postgres, durable-streams, electric
  cluster   search-cluster-coordinator, search-cluster-sources, ingestion-cluster
  collab    y-sweet, nats
  access    ssh, ngrok

EXAMPLES
  /infra:up                          # Start core services
  /infra:up --service postgres       # Start only postgres
  /infra:up --group cluster          # Start Effect Cluster nodes
  /infra:up --all --build            # Build and start everything

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
    down)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                       /infra:down                                ║
╠══════════════════════════════════════════════════════════════════╣
║  Stop Docker containers for TMNL infrastructure.                 ║
╚══════════════════════════════════════════════════════════════════╝

USAGE
  /infra:down [OPTIONS]

OPTIONS
  --service <name>   Stop specific service
  --group <name>     Stop service group
  --volumes          Also remove volumes (⚠️  DATA LOSS!)
  --all              Stop all services
  -h, --help         Show this help

SERVICE GROUPS
  core      postgres, durable-streams, electric
  cluster   search-cluster-coordinator, search-cluster-sources, ingestion-cluster
  collab    y-sweet, nats
  access    ssh, ngrok

EXAMPLES
  /infra:down                        # Stop core services
  /infra:down --service postgres     # Stop only postgres
  /infra:down --all                  # Stop everything
  /infra:down --all --volumes        # Stop and remove all data

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
    status)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                      /infra:status                               ║
╠══════════════════════════════════════════════════════════════════╣
║  Check container status and health.                              ║
╚══════════════════════════════════════════════════════════════════╝

USAGE
  /infra:status [OPTIONS]

OPTIONS
  --service <name>   Check specific service
  --watch            Continuously monitor (5s interval)
  -h, --help         Show this help

OUTPUT
  NAME       Container name
  STATUS     Up/Exited/Created + uptime
  HEALTH     healthy/unhealthy/starting
  PORTS      Exposed port mappings

EXAMPLES
  /infra:status                      # All containers
  /infra:status --service postgres   # Just postgres
  /infra:status --watch              # Live monitoring

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
    logs)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                       /infra:logs                                ║
╠══════════════════════════════════════════════════════════════════╣
║  View service logs.                                              ║
╚══════════════════════════════════════════════════════════════════╝

USAGE
  /infra:logs <service> [OPTIONS]

ARGUMENTS
  <service>          Service name (required)

OPTIONS
  --follow, -f       Follow log output (live tail)
  --tail <n>         Show last N lines (default: 100)
  -h, --help         Show this help

EXAMPLES
  /infra:logs postgres               # Last 100 lines
  /infra:logs postgres --tail 50     # Last 50 lines
  /infra:logs postgres --follow      # Follow live
  /infra:logs postgres -f            # Follow (short form)

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
    rebuild)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                      /infra:rebuild                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Rebuild and restart a service container.                        ║
╚══════════════════════════════════════════════════════════════════╝

USAGE
  /infra:rebuild <service> [OPTIONS]

ARGUMENTS
  <service>          Service name (required)

OPTIONS
  --no-cache         Build without cache (clean rebuild)
  -h, --help         Show this help

PROCESS
  1. Stops the service
  2. Removes the container
  3. Rebuilds the image
  4. Starts the service
  5. Shows status

EXAMPLES
  /infra:rebuild durable-streams              # Rebuild with cache
  /infra:rebuild durable-streams --no-cache   # Clean rebuild
  /infra:rebuild search-cluster-coordinator   # Rebuild cluster node

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
    *)
      cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║              TMNL Infrastructure Plugin                          ║
╠══════════════════════════════════════════════════════════════════╣
║  Docker container management for the TMNL stack.                 ║
╚══════════════════════════════════════════════════════════════════╝

COMMANDS
  /infra:up        Start containers
  /infra:down      Stop containers
  /infra:status    Check health
  /infra:logs      View logs
  /infra:rebuild   Rebuild service
  /infra:help      This help

SERVICE GROUPS
  ┌──────────┬─────────────────────────────────────────────────────┐
  │ core     │ postgres, durable-streams, electric                 │
  │ cluster  │ search-cluster-coordinator, search-cluster-sources, │
  │          │ ingestion-cluster                                   │
  │ collab   │ y-sweet, nats                                       │
  │ access   │ ssh, ngrok                                          │
  └──────────┴─────────────────────────────────────────────────────┘

SERVICES
  ┌─────────────────────────┬───────┬──────────────────────────────┐
  │ Service                 │ Port  │ Purpose                      │
  ├─────────────────────────┼───────┼──────────────────────────────┤
  │ postgres                │ 5432  │ PostGIS + TimescaleDB        │
  │ durable-streams         │ 3030  │ Event streaming              │
  │ electric                │ 3000  │ Real-time Postgres sync      │
  │ search-cluster-coord    │ 8100  │ Effect Cluster coordinator   │
  │ search-cluster-sources  │ 8101  │ Effect Cluster data nodes    │
  │ ingestion-cluster       │ 8102  │ Data ingestion RPC           │
  │ nats                    │ 4222  │ Message broker               │
  │ minio                   │ 9000  │ S3 object storage            │
  │ y-sweet                 │ 8080  │ Yjs document sync            │
  │ ngrok                   │ 4040  │ Secure tunneling             │
  └─────────────────────────┴───────┴──────────────────────────────┘

QUICK START
  /infra:up                    Start core services
  /infra:status                Check what's running
  /infra:logs postgres -f      Follow postgres logs

DETAILED HELP
  /infra:help up               Help for /infra:up
  /infra:help down             Help for /infra:down
  /infra:help status           Help for /infra:status
  /infra:help logs             Help for /infra:logs
  /infra:help rebuild          Help for /infra:rebuild

───────────────────────────────────────────────────────────────────
Press q to close
EOF
      ;;
  esac
}

# Check if we're in a zellij session
if [[ -n "${ZELLIJ:-}" ]]; then
  # Create a floating pane with the help content
  generate_help | zellij run --floating --close-on-exit -- less -R
else
  # Fallback: just print to stdout with less
  if command -v less &>/dev/null; then
    generate_help | less -R
  else
    generate_help
  fi
fi
