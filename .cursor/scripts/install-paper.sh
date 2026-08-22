#!/usr/bin/env bash
# Cursor Cloud: install puts the official Paper Desktop AppImage on PATH as `paper`.
# Paper MCP is http://127.0.0.1:29979/mcp and needs a signed-in Desktop with a file open.
# Sign-in is a one-time environment/snapshot step; this script does not fake a session.
#
# This repo is a flake (`.envrc` → `use flake`, `nix/devshell.nix`). Paper Desktop
# is not a flake output. The official Linux binary is the AppImage. Cursor cloud
# VMs do not ship `nix`; do not apt-get around that. Xvfb and fonts are already
# on the default Ubuntu image. Missing FUSE uses APPIMAGE_EXTRACT_AND_RUN on
# this same AppImage.
set -euo pipefail

PAPER_URL="https://download.paper.design/linux/appImage"
MIN_BYTES=10485760

if sudo -n true >/dev/null 2>&1; then
  PAPER_LIB=/usr/local/lib/paper
  PAPER_BIN=/usr/local/bin/paper
  as_root() { sudo "$@"; }
else
  PAPER_LIB="${HOME}/.local/lib/paper"
  PAPER_BIN="${HOME}/.local/bin/paper"
  as_root() { "$@"; }
  mkdir -p "${HOME}/.local/bin"
fi

PAPER_APPIMAGE="${PAPER_LIB}/Paper.AppImage"

if command -v nix >/dev/null 2>&1; then
  echo "install-paper: nix is on PATH; leave fuse/xvfb/fonts to the flake or host"
else
  echo "install-paper: no nix on this VM (repo flake is unused here)"
fi

if ! command -v Xvfb >/dev/null 2>&1; then
  echo "install-paper: Xvfb is not on PATH; start will log and continue" >&2
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

# Wrapper, not a symlink: the AppImage file stays the install. Extra args pass through.
# If FUSE is missing or unusable, extract-and-run still execs this same AppImage.
as_root tee "${PAPER_BIN}" >/dev/null <<EOF
#!/usr/bin/env bash
set -euo pipefail
APPIMAGE="${PAPER_APPIMAGE}"
export APPIMAGE_EXTRACT_AND_RUN="\${APPIMAGE_EXTRACT_AND_RUN:-1}"
exec "\${APPIMAGE}" --no-sandbox --disable-gpu "\$@"
EOF
as_root chmod 755 "${PAPER_BIN}"

if ! command -v paper >/dev/null 2>&1; then
  echo "install-paper: ${PAPER_BIN} is not on PATH" >&2
  exit 1
fi

echo "install-paper: paper -> ${PAPER_BIN} (AppImage ${PAPER_APPIMAGE})"
