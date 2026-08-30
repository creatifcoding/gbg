#!/usr/bin/env bash
# Cursor Cloud: install puts the official Paper Desktop AppImage on PATH as `paper-mcp`.
# Cloud agents use headless MCP (PAPER_HEADLESS_MCP=true), not the headed board window.
# MCP is http://127.0.0.1:29979/mcp. It has no cookie session and 401s without a bearer.
# Agents need a Paper bearer (env/secret). This script does not invent a token.
#
# This repo is a flake (`.envrc` → `use flake`, `nix/devshell.nix`). Paper Desktop
# is not a flake output. Cursor cloud VMs do not ship `nix`. Missing FUSE uses
# APPIMAGE_EXTRACT_AND_RUN on this same AppImage.
set -euo pipefail

PAPER_URL="https://download.paper.design/linux/appImage"
MIN_BYTES=10485760

if sudo -n true >/dev/null 2>&1; then
  PAPER_LIB=/usr/local/lib/paper
  PAPER_BIN_DIR=/usr/local/bin
  as_root() { sudo "$@"; }
else
  PAPER_LIB="${HOME}/.local/lib/paper"
  PAPER_BIN_DIR="${HOME}/.local/bin"
  as_root() { "$@"; }
  mkdir -p "${PAPER_BIN_DIR}"
fi

PAPER_APPIMAGE="${PAPER_LIB}/Paper.AppImage"
PAPER_MCP_BIN="${PAPER_BIN_DIR}/paper-mcp"
PAPER_BIN="${PAPER_BIN_DIR}/paper"

if command -v nix >/dev/null 2>&1; then
  echo "install-paper: nix is on PATH; leave fuse to the flake or host"
else
  echo "install-paper: no nix on this VM (repo flake is unused here)"
fi

as_root mkdir -p "${PAPER_LIB}"

need_download=1
if [[ -x "${PAPER_APPIMAGE}" ]]; then
  size="$(wc -c < "${PAPER_APPIMAGE}")"
  magic="$(head -c 4 "${PAPER_APPIMAGE}" || true)"
  if [[ "${size}" -ge "${MIN_BYTES}" && "${magic}" == $'\x7fELF' ]]; then
    need_download=0
  fi
fi

if [[ "${need_download}" -eq 1 ]]; then
  tmp="$(mktemp "${TMPDIR:-/tmp}/Paper.AppImage.XXXXXX")"
  cleanup() { rm -f "${tmp}"; }
  trap cleanup EXIT
  curl -fL --retry 4 --retry-delay 4 --retry-all-errors -o "${tmp}" "${PAPER_URL}"
  size="$(wc -c < "${tmp}")"
  magic="$(head -c 4 "${tmp}" || true)"
  if [[ "${size}" -lt "${MIN_BYTES}" || "${magic}" != $'\x7fELF' ]]; then
    echo "install-paper: download is not a usable AppImage (${size} bytes)" >&2
    exit 1
  fi
  as_root mv "${tmp}" "${PAPER_APPIMAGE}"
  trap - EXIT
  as_root chmod 755 "${PAPER_APPIMAGE}"
fi

# paper-mcp is the cloud launcher: headless MCP, no board window, no open-file requirement.
as_root tee "${PAPER_MCP_BIN}" >/dev/null <<EOF
#!/usr/bin/env bash
set -euo pipefail
APPIMAGE="${PAPER_APPIMAGE}"
export PAPER_HEADLESS_MCP=true
# AppImage FUSE needs libfuse.so.2. /dev/fuse or fusermount3 alone is not enough.
if [[ ! -c /dev/fuse ]] || ! grep -q 'libfuse.so.2' <<<"\$(ldconfig -p 2>/dev/null)"; then
  export APPIMAGE_EXTRACT_AND_RUN=1
fi
exec "\${APPIMAGE}" --no-sandbox --disable-gpu --headless "\$@"
EOF
as_root chmod 755 "${PAPER_MCP_BIN}"

# Keep `paper` as an alias to the same headless MCP launcher so PATH is unambiguous.
as_root rm -f "${PAPER_BIN}"
as_root ln -sfn "${PAPER_MCP_BIN}" "${PAPER_BIN}"

if ! command -v paper-mcp >/dev/null 2>&1; then
  echo "install-paper: ${PAPER_MCP_BIN} is not on PATH" >&2
  exit 1
fi

echo "install-paper: paper-mcp -> ${PAPER_MCP_BIN} (AppImage ${PAPER_APPIMAGE})"
