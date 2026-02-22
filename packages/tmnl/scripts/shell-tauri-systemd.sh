#!/run/current-system/sw/bin/bash

# Enter the Nix devShell and run the Tauri shell binary.
# Called by systemd — all stdout/stderr goes to journald.

PROJECT_DIR="/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl"

cd "$PROJECT_DIR"

export RUST_LOG="${RUST_LOG:-tmnl_shell=debug,tmnl_shared=debug}"
export GDK_BACKEND=wayland

exec /run/current-system/sw/bin/nix develop "path:${PROJECT_DIR}#tmnl-tauri" --command \
  /run/current-system/sw/bin/bash -c "cd '$PROJECT_DIR/src-shell-tauri' && exec cargo tauri dev --config tauri.conf.json"
