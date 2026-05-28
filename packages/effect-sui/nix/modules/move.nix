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
      defaultToolsTag = "08500756541c6fd66c81a59d1af1d819e997a189";
      moveHelpers = ''
        export SUI_TOOLS_TAG="''${SUI_TOOLS_TAG:-${defaultToolsTag}}"
        export EFFECT_SUI_MOVE_ROOT="''${EFFECT_SUI_MOVE_ROOT:-$FLAKE_ROOT/move}"
        export EFFECT_SUI_MOVE_DEFAULT="''${EFFECT_SUI_MOVE_DEFAULT:-$EFFECT_SUI_MOVE_ROOT/fixtures/counter}"
        export SUI_MOVE_BUILD_ENV="''${SUI_MOVE_BUILD_ENV:-testnet}"
        export SUI_CLIENT_ENV="''${SUI_CLIENT_ENV:-$SUI_MOVE_BUILD_ENV}"
        export SUI_CONFIG_DIR="''${SUI_CONFIG_DIR:-$FLAKE_ROOT/.direnv/sui/config}"
        export SUI_CLIENT_CONFIG="''${SUI_CLIENT_CONFIG:-$SUI_CONFIG_DIR/move-client.yaml}"

        ensure_sui_client_config () {
          mkdir -p "$SUI_CONFIG_DIR"
          test -f "$SUI_CONFIG_DIR/sui.keystore" || echo '[]' > "$SUI_CONFIG_DIR/sui.keystore"
          if [ ! -f "$SUI_CLIENT_CONFIG" ]; then
            cat > "$SUI_CLIENT_CONFIG" <<YAML
---
keystore:
  File: "$SUI_CONFIG_DIR/sui.keystore"
envs:
  - alias: testnet
    rpc: 'https://fullnode.testnet.sui.io:443'
    ws: ~
  - alias: mainnet
    rpc: 'https://fullnode.mainnet.sui.io:443'
    ws: ~
  - alias: localnet
    rpc: 'http://127.0.0.1:9000'
    ws: ~
active_env: testnet
active_address: '0x0000000000000000000000000000000000000000000000000000000000000000'
YAML
          fi
        }

        show_move_help () {
          cat <<'EOF'
Effect-Sui Move authoring command

Usage:
  effect-sui sui-move <subcommand> [args...]

Subcommands:
  list                         List Move packages under move/fixtures and move/packages
  new <name>                   Scaffold move/packages/<name>
  build [package|path] [args]   Build a Move package
  test [package|path] [args]    Run Move unit tests
  bytecode [package|path]       Print --dump-bytecode-as-base64 JSON for publish helpers
  clean [package|path]          Remove a package build/ directory
  shell                         Open an interactive mysten/sui-tools shell
  codegen [args...]             Run future @mysten/codegen bridge

Defaults:
  package/path defaults to move/fixtures/counter
  SUI_MOVE_BUILD_ENV defaults to testnet, matching TS SDK e2e prepublish
EOF
        }

        docker_sui () {
          if ! docker info >/dev/null 2>&1; then
            echo "[effect-sui:move] Docker daemon is not available and host 'sui' is not on PATH." >&2
            exit 1
          fi
          docker_home="$FLAKE_ROOT/.direnv/sui/docker-home"
          mkdir -p "$docker_home"
          docker run --rm \
            --user "$(id -u):$(id -g)" \
            -e HOME="$docker_home" \
            -v "$FLAKE_ROOT:$FLAKE_ROOT" \
            -w "$FLAKE_ROOT" \
            "mysten/sui-tools:$SUI_TOOLS_TAG" \
            sui "$@"
        }

        run_sui () {
          if command -v sui >/dev/null 2>&1; then
            sui "$@"
          else
            docker_sui "$@"
          fi
        }

        resolve_move_pkg () {
          input="''${1:-}"
          if [ -z "$input" ]; then
            input="$EFFECT_SUI_MOVE_DEFAULT"
          fi

          candidates=()
          case "$input" in
            /*) candidates+=("$input") ;;
            *)
              candidates+=("$input")
              candidates+=("$FLAKE_ROOT/$input")
              candidates+=("$EFFECT_SUI_MOVE_ROOT/$input")
              candidates+=("$EFFECT_SUI_MOVE_ROOT/packages/$input")
              candidates+=("$EFFECT_SUI_MOVE_ROOT/fixtures/$input")
              ;;
          esac

          for candidate in "''${candidates[@]}"; do
            if [ -f "$candidate/Move.toml" ]; then
              (cd "$candidate" && pwd)
              return 0
            fi
          done

          echo "[effect-sui:move] Move package not found: $input" >&2
          echo "[effect-sui:move] Expected a directory containing Move.toml." >&2
          echo "[effect-sui:move] Try: effect-sui sui-move list" >&2
          exit 66
        }

        move_list () {
          if [ ! -d "$EFFECT_SUI_MOVE_ROOT" ]; then
            echo "[sui-move:list] no move root: $EFFECT_SUI_MOVE_ROOT"
            return 0
          fi
          (cd "$EFFECT_SUI_MOVE_ROOT" && find . -mindepth 2 -maxdepth 4 -name Move.toml -printf '%P\n') \
            | sed 's#/Move.toml$##' \
            | sort
        }

        move_new () {
          if [ "$#" -lt 1 ]; then
            echo "Usage: effect-sui sui-move new <name>" >&2
            exit 64
          fi
          raw_name="$1"
          package_name="$(printf '%s' "$raw_name" | tr '-' '_')"
          if [ -z "$package_name" ]; then
            echo "[sui-move:new] invalid Move package/module name: $raw_name" >&2
            exit 64
          fi
          case "$package_name" in
            *[!A-Za-z0-9_]* )
              echo "[sui-move:new] invalid Move package/module name: $raw_name" >&2
              echo "[sui-move:new] Use letters, numbers, underscores, or hyphens." >&2
              exit 64
              ;;
            *) true ;;
          esac
          package_dir="$EFFECT_SUI_MOVE_ROOT/packages/$package_name"
          if [ -e "$package_dir" ]; then
            echo "[sui-move:new] package already exists: $package_dir" >&2
            exit 73
          fi
          mkdir -p "$package_dir/sources" "$package_dir/tests"
          cat > "$package_dir/Move.toml" <<EOF
[package]
name = "$package_name"
version = "0.0.1"
edition = "2024.beta"

[addresses]
$package_name = "0x0"
EOF
          cat > "$package_dir/sources/$package_name.move" <<EOF
module $package_name::$package_name;

public struct Marker has key {
    id: UID,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Marker { id: object::new(ctx) })
}
EOF
          echo "[sui-move:new] created $package_dir"
          echo "[sui-move:new] build: effect-sui sui-move build packages/$package_name"
        }

        move_build () {
          pkg="$(resolve_move_pkg "''${1:-}")"
          if [ "$#" -gt 0 ]; then shift; fi
          ensure_sui_client_config
          echo "[sui-move:build] package: $pkg"
          echo "[sui-move:build] build-env: $SUI_MOVE_BUILD_ENV"
          run_sui move --client.config "$SUI_CLIENT_CONFIG" --client.env "$SUI_CLIENT_ENV" --build-env "$SUI_MOVE_BUILD_ENV" --path "$pkg" build "$@"
        }

        move_test () {
          pkg="$(resolve_move_pkg "''${1:-}")"
          if [ "$#" -gt 0 ]; then shift; fi
          ensure_sui_client_config
          echo "[sui-move:test] package: $pkg"
          run_sui move --client.config "$SUI_CLIENT_CONFIG" --client.env "$SUI_CLIENT_ENV" --path "$pkg" test "$@"
        }

        move_bytecode () {
          pkg="$(resolve_move_pkg "''${1:-}")"
          if [ "$#" -gt 0 ]; then shift; fi
          ensure_sui_client_config
          echo "[sui-move:bytecode] package: $pkg" >&2
          echo "[sui-move:bytecode] build-env: $SUI_MOVE_BUILD_ENV" >&2
          run_sui move --client.config "$SUI_CLIENT_CONFIG" --client.env "$SUI_CLIENT_ENV" --build-env "$SUI_MOVE_BUILD_ENV" --path "$pkg" build --dump-bytecode-as-base64 "$@"
        }

        move_clean () {
          pkg="$(resolve_move_pkg "''${1:-}")"
          rm -rf "$pkg/build"
          echo "[sui-move:clean] removed $pkg/build"
        }

        move_shell () {
          if ! docker info >/dev/null 2>&1; then
            echo "[sui-move:shell] Docker daemon is not available." >&2
            exit 1
          fi
          docker_home="$FLAKE_ROOT/.direnv/sui/docker-home"
          mkdir -p "$docker_home"
          docker run --rm -it \
            --user "$(id -u):$(id -g)" \
            -e HOME="$docker_home" \
            -v "$FLAKE_ROOT:$FLAKE_ROOT" \
            -w "$FLAKE_ROOT" \
            "mysten/sui-tools:$SUI_TOOLS_TAG" \
            bash
        }

        move_codegen () {
          cd "$FLAKE_ROOT"
          if ! bunx --bun --package @mysten/codegen sui-ts-codegen --help >/dev/null 2>&1; then
            echo "[sui-move:codegen] @mysten/codegen is not installed/resolved yet. Add it when Move fixtures land." >&2
            exit 69
          fi
          bunx --bun --package @mysten/codegen sui-ts-codegen generate "$@"
        }
      '';
    in
    {
      mission-control.scripts = {
        sui-move = {
          description = "Move authoring toolbox: list/new/build/test/bytecode/clean/shell/codegen.";
          category = "Move";
          exec = ''
            set -euo pipefail
            ${moveHelpers}
            subcommand="''${1:-help}"
            if [ "$#" -gt 0 ]; then shift; fi
            case "$subcommand" in
              help|-h|--help) show_move_help ;;
              list) move_list "$@" ;;
              new) move_new "$@" ;;
              build) move_build "$@" ;;
              test) move_test "$@" ;;
              bytecode) move_bytecode "$@" ;;
              clean) move_clean "$@" ;;
              shell) move_shell "$@" ;;
              codegen) move_codegen "$@" ;;
              *)
                echo "[sui-move] unknown subcommand: $subcommand" >&2
                show_move_help >&2
                exit 64
                ;;
            esac
          '';
        };
      };
    };
}
