{
  pkgs,
}:

let
  python = pkgs.python3.withPackages (ps: [ ps.jsonschema ]);
in
pkgs.writeShellApplication {
  name = "mantis";
  runtimeInputs = [
    python
    pkgs.coreutils
    pkgs.git
    pkgs.jq
    pkgs.gnused
  ];
  text = ''
    find_lab_root() {
      local dir
      dir="$(pwd)"
      while true; do
        if [[ -f "$dir/workspace.json" && -f "$dir/flake.nix" ]]; then
          printf '%s\n' "$dir"
          return 0
        fi
        if [[ -f "$dir/projects/biomemetics/labs/mantis/workspace.json" ]]; then
          printf '%s\n' "$dir/projects/biomemetics/labs/mantis"
          return 0
        fi
        if [[ "$dir" == "/" ]]; then
          return 1
        fi
        dir="$(dirname "$dir")"
      done
    }

    if [[ -n "''${MANTIS_LAB_ROOT:-}" ]]; then
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

    exec python3 -m mantis_environment.cli "$@"
  '';
  meta = {
    description = "Mantis lab environment dispatcher (doctor/check/export/evidence)";
  };
}
