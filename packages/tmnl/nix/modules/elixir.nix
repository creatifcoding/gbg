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
      inherit (pkgs.stdenv) isDarwin isLinux;

      beamPkgs = pkgs.beam.packagesWith pkgs.beam.interpreters.erlang;

      elixirPkg = if pkgs ? elixir then pkgs.elixir else beamPkgs.elixir;
      erlangPkg = if pkgs ? erlang then pkgs.erlang else pkgs.beam.interpreters.erlang;
      rebar3Pkg = if pkgs ? rebar3 then pkgs.rebar3 else beamPkgs.rebar3;

      elixirAppDir = "$FLAKE_ROOT/ava-elixir";
    in
    {
      devShells.tmnl-elixir = pkgs.mkShell {
        name = "tmnl-elixir";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs =
          [
            erlangPkg
            elixirPkg
            rebar3Pkg
            pkgs.rustup
            pkgs.rustc
            pkgs.cargo
            pkgs.pkg-config
            pkgs.openssl
          ]
          ++ lib.optionals isLinux [ pkgs.inotify-tools ]
          ++ lib.optionals isDarwin [ pkgs.iconv ];

        shellHook = ''
          echo "[tmnl-elixir] Elixir/Erlang + Rustler environment layered over tmnl-core."
          echo "  app dir: ${elixirAppDir}"
          mkdir -p .nix-mix .nix-hex
          export MIX_HOME="$PWD/.nix-mix"
          export HEX_HOME="$PWD/.nix-hex"
          export PATH="$MIX_HOME/bin:$HEX_HOME/bin:$PATH"
          export LANG=C.UTF-8
          export ERL_AFLAGS="-kernel shell_history enabled"

          # Avoid nixpkgs-provided Hex in ERL_LIBS conflicting with local Hex archives.
          # We want Mix/Hex to use project-scoped MIX_HOME/HEX_HOME artifacts.
          unset ERL_LIBS
        '';
      };

      mission-control.scripts = {
        elixir-deps = {
          description = "Fetch Elixir deps and optionally refresh deps.nix.";
          category = "Elixir";
          exec = ''
            set -euo pipefail
            if [ ! -d "${elixirAppDir}" ]; then
              echo "[tmnl elixir-deps] Missing ${elixirAppDir}. Create app first." >&2
              exit 1
            fi

            cd "${elixirAppDir}"
            if [ ! -f mix.exs ]; then
              echo "[tmnl elixir-deps] mix.exs not found in ${elixirAppDir}" >&2
              exit 1
            fi

            if ! mix hex.info >/dev/null 2>&1; then
              echo "[tmnl elixir-deps] bootstrapping Hex/Rebar"
              mix local.hex --force
              mix local.rebar --force
            fi

            echo "[tmnl elixir-deps] mix deps.get"
            mix deps.get

            if mix help deps.nix >/dev/null 2>&1; then
              echo "[tmnl elixir-deps] mix deps.nix"
              mix deps.nix
            else
              echo "[tmnl elixir-deps] deps_nix task unavailable; skipping deps.nix generation"
            fi
          '';
        };

        elixir-test = {
          description = "Run Elixir test suite.";
          category = "Elixir";
          exec = ''
            set -euo pipefail
            cd "${elixirAppDir}"
            [ -f mix.exs ] || { echo "[tmnl elixir-test] mix.exs not found" >&2; exit 1; }
            echo "[tmnl elixir-test] mix test"
            mix test
          '';
        };

        elixir-build = {
          description = "Compile Elixir app in prod mode.";
          category = "Elixir";
          exec = ''
            set -euo pipefail
            cd "${elixirAppDir}"
            [ -f mix.exs ] || { echo "[tmnl elixir-build] mix.exs not found" >&2; exit 1; }
            echo "[tmnl elixir-build] MIX_ENV=prod mix compile"
            MIX_ENV=prod mix compile
          '';
        };

        elixir-init-app = {
          description = "Scaffold AVA Elixir control-plane app (idempotent).";
          category = "Elixir";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"

            if [ -d ava-elixir ]; then
              echo "[tmnl elixir-init-app] ava-elixir already exists; skipping scaffold"
              exit 0
            fi

            echo "[tmnl elixir-init-app] mix new ava-elixir --sup --app ava_elixir --module AvaElixir"
            mix new ava-elixir --sup --app ava_elixir --module AvaElixir
          '';
        };
      };
    };
}
