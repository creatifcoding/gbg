{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      dockerNetwork = "effect-sui-localnet";
      pgContainer = "effect-sui-postgres";
      localnetContainer = "effect-sui-localnet";
      defaultToolsTag = "08500756541c6fd66c81a59d1af1d819e997a189";
      localnetHelpers = ''
        export EFFECT_SUI_ROOT="''${EFFECT_SUI_ROOT:-$FLAKE_ROOT}"
        export SUI_CONFIG_DIR="''${SUI_CONFIG_DIR:-$EFFECT_SUI_ROOT/.direnv/sui/config}"
        export SUI_DATA_DIR="''${SUI_DATA_DIR:-$EFFECT_SUI_ROOT/.direnv/sui/data}"
        export TMPDIR="''${TMPDIR:-$EFFECT_SUI_ROOT/.direnv/tmp}"
        export SUI_TOOLS_TAG="''${SUI_TOOLS_TAG:-${defaultToolsTag}}"

        show_localnet_help () {
          cat <<'EOF'
Effect-Sui localnet command

Usage:
  effect-sui sui-localnet <subcommand> [args...]

Subcommands:
  help                         Show this help
  env-init                     Create isolated local Sui config/data directories
  up                           Start Docker-backed localnet (alias for up-docker)
  up-docker                    Start Docker localnet + Postgres indexer + GraphQL
  up-host                      Start host `sui start`; requires host sui on PATH
  status                       Probe Docker containers, JSON-RPC, GraphQL, faucet URL
  logs                         Follow Docker localnet logs
  down                         Stop Docker-backed localnet containers/network
  faucet <0x-address>          Request local faucet gas for an address
  fork-up [args...]            Start experimental sui-fork if available
  fork-status [args...]        Check experimental sui-fork if available
EOF
        }

        localnet_env_init () {
          mkdir -p "$SUI_CONFIG_DIR" "$SUI_DATA_DIR" "$TMPDIR"
          cat > "$SUI_CONFIG_DIR/localnet-client.yaml" <<'YAML'
---
keystore:
  File: ./sui.keystore
envs:
  - alias: localnet
    rpc: 'http://127.0.0.1:9000'
    ws: ~
active_env: localnet
active_address: '0x0000000000000000000000000000000000000000000000000000000000000000'
YAML
          test -f "$SUI_CONFIG_DIR/sui.keystore" || echo '[]' > "$SUI_CONFIG_DIR/sui.keystore"
          echo "[sui-localnet:env-init] SUI_CONFIG_DIR=$SUI_CONFIG_DIR"
          echo "[sui-localnet:env-init] SUI_DATA_DIR=$SUI_DATA_DIR"
        }

        localnet_up_host () {
          if ! command -v sui >/dev/null 2>&1; then
            echo "[sui-localnet:up-host] host 'sui' binary not found. Use: effect-sui sui-localnet up-docker" >&2
            exit 127
          fi
          localnet_env_init
          export SUI_INDEXER_DATABASE_URL="''${SUI_INDEXER_DATABASE_URL:-postgres://postgres:postgrespw@127.0.0.1:5432/sui_indexer_v2}"
          mkdir -p "$TMPDIR"
          echo "[sui-localnet:up-host] Starting host Sui localnet"
          echo "  database: $SUI_INDEXER_DATABASE_URL"
          RUST_LOG="''${RUST_LOG:-off,sui_node=info}" sui start \
            --network.config "$SUI_CONFIG_DIR" \
            --with-faucet=0.0.0.0:9123 \
            --force-regenesis \
            --with-indexer="$SUI_INDEXER_DATABASE_URL" \
            --with-graphql=0.0.0.0:9125 \
            --fullnode-rpc-port 9000
        }

        localnet_up_docker () {
          if ! docker info >/dev/null 2>&1; then
            echo "[sui-localnet:up-docker] Docker daemon is not available." >&2
            exit 1
          fi
          echo "[sui-localnet:up-docker] Using mysten/sui-tools:$SUI_TOOLS_TAG"

          docker network inspect ${dockerNetwork} >/dev/null 2>&1 || docker network create ${dockerNetwork} >/dev/null
          docker rm -f ${localnetContainer} ${pgContainer} >/dev/null 2>&1 || true

          echo "[sui-localnet:up-docker] Starting Postgres"
          docker run -d \
            --name ${pgContainer} \
            --network ${dockerNetwork} \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgrespw \
            -e POSTGRES_DB=sui_indexer_v2 \
            postgres:16 \
            -c max_connections=500 >/dev/null

          echo "[sui-localnet:up-docker] Waiting for Postgres readiness"
          for i in $(seq 1 60); do
            if docker exec ${pgContainer} pg_isready -U postgres -d sui_indexer_v2 >/dev/null 2>&1; then
              break
            fi
            sleep 1
            if [ "$i" = "60" ]; then
              echo "Postgres did not become ready" >&2
              docker logs ${pgContainer} >&2 || true
              exit 1
            fi
          done

          echo "[sui-localnet:up-docker] Starting Sui localnet"
          docker run -d \
            --name ${localnetContainer} \
            --network ${dockerNetwork} \
            -p 9000:9000 \
            -p 9123:9123 \
            -p 9124:9124 \
            -p 9125:9125 \
            "mysten/sui-tools:$SUI_TOOLS_TAG" \
            sui start \
              --with-faucet=0.0.0.0:9123 \
              --force-regenesis \
              --with-graphql=0.0.0.0:9125 \
              --with-indexer=postgres://postgres:postgrespw@${pgContainer}:5432/sui_indexer_v2 >/dev/null

          echo "[sui-localnet:up-docker] Containers started"
          echo "  fullnode: http://127.0.0.1:9000"
          echo "  faucet:   http://127.0.0.1:9123"
          echo "  graphql:  http://127.0.0.1:9125/graphql"
          echo "  logs:     effect-sui sui-localnet logs"
        }

        localnet_status () {
          export SUI_FULLNODE_URL="''${SUI_FULLNODE_URL:-http://127.0.0.1:9000}"
          export SUI_FAUCET_URL="''${SUI_FAUCET_URL:-http://127.0.0.1:9123}"
          export SUI_GRAPHQL_URL="''${SUI_GRAPHQL_URL:-http://127.0.0.1:9125/graphql}"

          echo "[sui-localnet:status] Docker containers"
          docker ps --filter name=${localnetContainer} --filter name=${pgContainer} --format '  {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
          echo ""
          echo "[sui-localnet:status] Fullnode total transaction blocks"
          curl -fsS "$SUI_FULLNODE_URL" \
            -H 'Content-Type: application/json' \
            --data '{"jsonrpc":"2.0","id":1,"method":"sui_getTotalTransactionBlocks","params":[]}' || true
          echo ""
          echo "[sui-localnet:status] GraphQL health probe"
          curl -fsS "''${SUI_GRAPHQL_URL%/graphql}/health" || true
          echo ""
          echo "[sui-localnet:status] Faucet endpoint: $SUI_FAUCET_URL"
        }

        localnet_logs () {
          docker logs -f ${localnetContainer}
        }

        localnet_down () {
          docker rm -f ${localnetContainer} ${pgContainer} >/dev/null 2>&1 || true
          docker network rm ${dockerNetwork} >/dev/null 2>&1 || true
          echo "[sui-localnet:down] stopped ${localnetContainer}, ${pgContainer}"
        }

        localnet_faucet () {
          if [ "$#" -lt 1 ]; then
            echo "Usage: effect-sui sui-localnet faucet <0x-address>" >&2
            exit 64
          fi
          export SUI_FAUCET_URL="''${SUI_FAUCET_URL:-http://127.0.0.1:9123}"
          curl -fsS "$SUI_FAUCET_URL/gas" \
            -H 'Content-Type: application/json' \
            --data "{ \"FixedAmountRequest\": { \"recipient\": \"$1\" } }"
        }

        fork_up () {
          if ! command -v sui-fork >/dev/null 2>&1; then
            echo "[sui-localnet:fork-up] sui-fork not found. Build it from ../../submodules/sui when forked-chain tests become necessary." >&2
            exit 127
          fi
          sui-fork start "$@"
        }

        fork_status () {
          if ! command -v sui-fork >/dev/null 2>&1; then
            echo "[sui-localnet:fork-status] sui-fork not found." >&2
            exit 127
          fi
          sui-fork status "$@"
        }
      '';
    in
    {
      mission-control.scripts = {
        sui-localnet = {
          description = "Localnet toolbox: up/status/logs/down/faucet/env-init/fork.";
          category = "Sui";
          exec = ''
            set -euo pipefail
            ${localnetHelpers}
            subcommand="''${1:-help}"
            if [ "$#" -gt 0 ]; then shift; fi
            case "$subcommand" in
              help|-h|--help) show_localnet_help ;;
              env-init) localnet_env_init "$@" ;;
              up|up-docker) localnet_up_docker "$@" ;;
              up-host) localnet_up_host "$@" ;;
              status) localnet_status "$@" ;;
              logs) localnet_logs "$@" ;;
              down) localnet_down "$@" ;;
              faucet) localnet_faucet "$@" ;;
              fork-up) fork_up "$@" ;;
              fork-status) fork_status "$@" ;;
              *)
                echo "[sui-localnet] unknown subcommand: $subcommand" >&2
                show_localnet_help >&2
                exit 64
                ;;
            esac
          '';
        };

        sui-e2e = {
          description = "Run Effect-Sui localnet e2e tests.";
          category = "Sui";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            bun run test:e2e
          '';
        };
      };
    };
}
