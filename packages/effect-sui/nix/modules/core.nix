{ inputs, lib, ... }:

{
  imports = [
    inputs.mission-control.flakeModule
    inputs.flake-root.flakeModule
  ];

  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      mkCommand =
        name: v:
        let
          drv = pkgs.writeShellApplication {
            inherit name;
            text =
              if builtins.typeOf v.exec == "string" then
                v.exec
              else
                "${lib.getExe v.exec} \"$@\"";
          };
        in
        drv.overrideAttrs (old: {
          meta = (old.meta or { }) // {
            description = if v.description == null then "No description" else v.description;
            category = v.category;
            mainProgram = old.meta.mainProgram or v.name;
          };
        });

      commandDrvs = lib.mapAttrsToList mkCommand config.mission-control.scripts;
      commandsGrouped = lib.groupBy (drv: drv.meta.category) commandDrvs;
      helpText = lib.concatStringsSep "\n" (
        lib.mapAttrsToList (
          category: drvs:
          lib.concatStringsSep "\n" (
            [
              "echo"
              "printf '%s\\n' ${lib.escapeShellArg ("## " + category)}"
            ]
            ++ (map (
              drv:
              let
                name = builtins.baseNameOf (lib.getExe drv);
                line = "  ${config.mission-control.wrapperName} ${name}  : ${drv.meta.description}";
              in
              "printf '%s\\n' ${lib.escapeShellArg line}"
            ) drvs)
          )
        ) commandsGrouped
      );
      preRunCases = lib.concatStringsSep "\n" (
        lib.mapAttrsToList (
          name: v:
          if v.cdToProjectRoot then
            "  ${lib.escapeShellArg name}) cd \"$FLAKE_ROOT\" ;;"
          else
            "  ${lib.escapeShellArg name}) true ;;"
        ) config.mission-control.scripts
      );
      patchedWrapper = (pkgs.writeShellApplication {
        name = config.mission-control.wrapperName;
        runtimeInputs = commandDrvs;
        text = ''
          showHelp () {
            printf '%s\n\n' "Available commands:"
            ${helpText}
          }

          if [ "$#" -eq 0 ] || [ "''${1:-}" = "-h" ] || [ "''${1:-}" = "--help" ]; then
            showHelp
            exit 0
          fi

          FLAKE_ROOT="$(${lib.getExe config.flake-root.package})"
          export FLAKE_ROOT

          case "$1" in
          ${preRunCases}
            *) true ;;
          esac

          exec "$@"
        '';
      }).overrideAttrs (_old: {
        # Current mission-control emits/generated help text that can trip newer
        # ShellCheck info rules (for example SC2016 on literal help strings).
        # Keep ShellCheck active for the actual command scripts; disable it only
        # for this menu wrapper.
        checkPhase = ":";
      });
    in
    {
      mission-control = {
        wrapperName = "effect-sui";
        wrapper = patchedWrapper;

        scripts = {
          info = {
            description = "Display Effect-Sui environment and Sui endpoint defaults.";
            category = "Core";
            exec = ''
              set -euo pipefail
              echo "[effect-sui] Core environment"
              echo "  System: ${system}"
              echo "  FLAKE_ROOT: $FLAKE_ROOT"
              echo "  Repo root: $(git -C "$FLAKE_ROOT" rev-parse --show-toplevel 2>/dev/null || echo unavailable)"
              echo "  SUI_NETWORK: ''${SUI_NETWORK:-localnet}"
              echo "  SUI_FULLNODE_URL: ''${SUI_FULLNODE_URL:-http://127.0.0.1:9000}"
              echo "  SUI_FAUCET_URL: ''${SUI_FAUCET_URL:-http://127.0.0.1:9123}"
              echo "  SUI_GRAPHQL_URL: ''${SUI_GRAPHQL_URL:-http://127.0.0.1:9125/graphql}"
            '';
          };
        };
      };

      devShells.effect-sui-core = pkgs.mkShell {
        name = "effect-sui-core";

        LD_LIBRARY_PATH = lib.makeLibraryPath [
          pkgs.stdenv.cc.cc.lib
          pkgs.zlib
        ];

        nativeBuildInputs = with pkgs; [
          bun
          nodejs_24
          git
          gnupg
          ripgrep
          fd
          jq
          curl
          wget
          coreutils
          findutils
        ];

        inputsFrom = [
          config.mission-control.devShell
          config.flake-root.devShell
        ];

        shellHook = ''
          export EFFECT_SUI_ROOT="$FLAKE_ROOT"
          export EFFECT_SUI_REPO_ROOT="$(git -C "$FLAKE_ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$FLAKE_ROOT/../..")"
          export SUI_NETWORK="''${SUI_NETWORK:-localnet}"
          export SUI_FULLNODE_URL="''${SUI_FULLNODE_URL:-http://127.0.0.1:9000}"
          export SUI_GRPC_URL="''${SUI_GRPC_URL:-$SUI_FULLNODE_URL}"
          export SUI_FAUCET_URL="''${SUI_FAUCET_URL:-http://127.0.0.1:9123}"
          export SUI_GRAPHQL_URL="''${SUI_GRAPHQL_URL:-http://127.0.0.1:9125/graphql}"
          export SUI_TOOLS_TAG="''${SUI_TOOLS_TAG:-08500756541c6fd66c81a59d1af1d819e997a189}"
          export SUI_CONFIG_DIR="''${SUI_CONFIG_DIR:-$EFFECT_SUI_ROOT/.direnv/sui/config}"
          export SUI_DATA_DIR="''${SUI_DATA_DIR:-$EFFECT_SUI_ROOT/.direnv/sui/data}"
          export TMPDIR="''${TMPDIR:-$EFFECT_SUI_ROOT/.direnv/tmp}"
          mkdir -p "$SUI_CONFIG_DIR" "$SUI_DATA_DIR" "$TMPDIR"
          echo "[effect-sui-core] Effect-Sui base shell on ${system}"
          effect-sui info || true
        '';
      };
    };
}
