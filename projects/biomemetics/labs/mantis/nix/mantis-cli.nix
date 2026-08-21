{
  pkgs,
}:

let
  python = pkgs.python3.withPackages (
    ps: with ps; [
      jsonschema
      pypdf
    ]
  );
in
pkgs.writeShellScriptBin "mantis" ''
  set -euo pipefail

  is_lab_root() {
    [[ -f "$1/workspace.json" && -f "$1/flake.nix" ]]
  }

  find_lab_root() {
    local dir
    dir="$(pwd)"
    while true; do
      if is_lab_root "$dir"; then
        printf '%s\n' "$dir"
        return 0
      fi
      if is_lab_root "$dir/projects/biomemetics/labs/mantis"; then
        printf '%s\n' "$dir/projects/biomemetics/labs/mantis"
        return 0
      fi
      if [[ "$dir" == "/" ]]; then
        return 1
      fi
      dir="$(dirname "$dir")"
    done
  }

  # nix develop --command from the gbg repo root previously exported
  # MANTIS_LAB_ROOT=$PWD. That path is not the lab; ignore it and rediscover.
  if [[ -n "''${MANTIS_LAB_ROOT:-}" ]] && is_lab_root "$MANTIS_LAB_ROOT"; then
    lab_root="$MANTIS_LAB_ROOT"
  else
    lab_root="$(find_lab_root)" || {
      echo "mantis: cannot find the lab root (workspace.json + flake.nix)" >&2
      echo "Run from projects/biomemetics/labs/mantis or set MANTIS_LAB_ROOT." >&2
      exit 66
    }
  fi

  export MANTIS_LAB_ROOT="$lab_root"
  export PYTHONPATH="$lab_root/scripts/environment/py''${PYTHONPATH:+:$PYTHONPATH}"
  export PYTHONNOUSERSITE=1
  export PIP_NO_INDEX=1
  export PIP_DISABLE_PIP_VERSION_CHECK=1

  # Use the pinned dispatcher interpreter. Do not put it first on PATH so
  # narrow shells keep their own python/rustc/kicad-cli as workflow tools.
  exec ${python}/bin/python3 -m mantis_environment.cli "$@"
''
