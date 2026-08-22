#!/usr/bin/env bash
# Cursor Cloud: install puts the official Paper Desktop AppImage on PATH as `paper`.
# Paper MCP is http://127.0.0.1:29979/mcp and needs a signed-in Desktop with a file open.
# Sign-in is a one-time environment/snapshot step; this script does not fake a session.
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

pkg_installed() {
  dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q 'install ok installed'
}

ensure_pkg() {
  local pkg="$1"
  if pkg_installed "$pkg"; then
    return 0
  fi
  as_root apt-get update -qq
  as_root apt-get install -y --no-install-recommends "$pkg"
}

ensure_one_pkg() {
  local pkg
  for pkg in "$@"; do
    if pkg_installed "$pkg"; then
      return 0
    fi
  done
  as_root apt-get update -qq
  for pkg in "$@"; do
    if as_root apt-get install -y --no-install-recommends "$pkg"; then
      return 0
    fi
  done
  echo "install-paper: none of $* could be installed; AppImage extract-and-run remains the fallback" >&2
  return 0
}

# AppImage runtime wants FUSE 2. Ubuntu 24.04 ships libfuse2t64. fuse3 is a last resort.
export DEBIAN_FRONTEND=noninteractive
ensure_one_pkg libfuse2t64 libfuse2 fuse3
ensure_pkg xvfb
ensure_one_pkg fonts-liberation fonts-dejavu-core fonts-noto-core

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
