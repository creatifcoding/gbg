# GetByShell Library — Health Check Generator
#
# Generates a writeShellScript that polls a Vite dev server until it responds.
# Used as ExecStartPre for Tauri services.
#
# Usage:
#   mkHealthCheck { inherit pkgs; name = "bar"; port = 1421; timeout = 30; }
#   → derivation: /nix/store/...-tmnl-bar-vite-health
{ pkgs, name, port, timeout ? 30 }:

pkgs.writeShellScript "tmnl-${name}-vite-health" ''
  attempts=$((${toString timeout} * 2))
  for _i in $(${pkgs.coreutils}/bin/seq 1 "$attempts"); do
    ${pkgs.curl}/bin/curl -s http://localhost:${toString port} > /dev/null 2>&1 && exit 0
    ${pkgs.coreutils}/bin/sleep 0.5
  done
  echo "Vite did not start on :${toString port} within ${toString timeout}s" >&2
  exit 1
''
