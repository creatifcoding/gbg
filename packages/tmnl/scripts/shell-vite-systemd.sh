#!/run/current-system/sw/bin/bash

# Enter the Nix devShell and run Vite for the shell frontend.
# Called by systemd — all stdout/stderr goes to journald.

PROJECT_DIR="/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl"

cd "$PROJECT_DIR"

exec /run/current-system/sw/bin/nix develop "path:${PROJECT_DIR}#tmnl-tauri" --command \
  /run/current-system/sw/bin/bash -c "cd '$PROJECT_DIR' && exec bunx vite --config vite.config.shell.ts"
