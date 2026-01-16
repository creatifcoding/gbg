#!/usr/bin/env bash
# CTL Setup Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/gbg/gbg/main/packages/ctl/setup.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/gbg/gbg/main/packages/ctl/setup.sh | zsh
#
# Environment variables:
#   CTL_INSTALL_DIR  - Installation directory (default: ~/.local/bin)
#   CTL_VERSION      - Version to install (default: latest)
#   CTL_METHOD       - Force install method: nix, bun, binary (default: auto-detect)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[info]${NC} $*"; }
success() { echo -e "${GREEN}[success]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
die() { error "$@"; exit 1; }

# Configuration
REPO_URL="https://github.com/gbg/gbg"
REPO_RAW="https://raw.githubusercontent.com/gbg/gbg/main/packages/ctl"
INSTALL_DIR="${CTL_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${CTL_VERSION:-latest}"
METHOD="${CTL_METHOD:-auto}"

# Detect OS and architecture
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="darwin" ;;
    *)       die "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)             die "Unsupported architecture: $ARCH" ;;
  esac

  info "Detected platform: $PLATFORM-$ARCH"
}

# Check if command exists
has() { command -v "$1" &>/dev/null; }

# Detect best install method
detect_method() {
  if [ "$METHOD" != "auto" ]; then
    info "Using forced method: $METHOD"
    return
  fi

  if has nix; then
    METHOD="nix"
    info "Detected Nix - will use nix profile install"
  elif has bun; then
    METHOD="bun"
    info "Detected Bun - will compile from source"
  else
    METHOD="binary"
    info "No Nix or Bun - will download pre-built binary"
  fi
}

# Install via Nix
install_nix() {
  info "Installing via Nix..."

  # Clone or update repo
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap "rm -rf $tmp_dir" EXIT

  info "Cloning repository..."
  git clone --depth 1 "$REPO_URL" "$tmp_dir/gbg"

  cd "$tmp_dir/gbg/packages/ctl"

  info "Building with Nix..."
  nix profile install .#default

  success "Installed via Nix profile"
}

# Install via Bun (compile from source)
install_bun() {
  info "Installing via Bun..."

  # Clone or update repo
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap "rm -rf $tmp_dir" EXIT

  info "Cloning repository..."
  git clone --depth 1 "$REPO_URL" "$tmp_dir/gbg"

  cd "$tmp_dir/gbg/packages/ctl"

  info "Installing dependencies..."
  bun install --frozen-lockfile

  info "Compiling binary..."
  bun build --compile --minify src/cli/index.ts --outfile ctl

  # Install
  mkdir -p "$INSTALL_DIR"
  mv ctl "$INSTALL_DIR/ctl"
  chmod +x "$INSTALL_DIR/ctl"

  success "Installed to $INSTALL_DIR/ctl"
}

# Install pre-built binary
install_binary() {
  info "Downloading pre-built binary..."

  local binary_url="$REPO_RAW/releases/ctl-$PLATFORM-$ARCH"

  # Check if release exists
  if ! curl -fsSL --head "$binary_url" &>/dev/null; then
    warn "Pre-built binary not found at $binary_url"
    warn "Falling back to source compilation..."

    # Try to install bun and compile
    if ! has bun; then
      info "Installing Bun..."
      curl -fsSL https://bun.sh/install | bash
      export PATH="$HOME/.bun/bin:$PATH"
    fi

    install_bun
    return
  fi

  mkdir -p "$INSTALL_DIR"
  curl -fsSL "$binary_url" -o "$INSTALL_DIR/ctl"
  chmod +x "$INSTALL_DIR/ctl"

  success "Installed to $INSTALL_DIR/ctl"
}

# Verify installation
verify_install() {
  if has ctl; then
    local version
    version="$(ctl --version 2>/dev/null || echo 'unknown')"
    success "CTL installed successfully! Version: $version"
  elif [ -x "$INSTALL_DIR/ctl" ]; then
    success "CTL installed to $INSTALL_DIR/ctl"
    warn "Make sure $INSTALL_DIR is in your PATH"
    echo ""
    echo "Add to your shell config:"
    echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  else
    die "Installation verification failed"
  fi
}

# Main
main() {
  echo ""
  echo "  ██████╗████████╗██╗     "
  echo " ██╔════╝╚══██╔══╝██║     "
  echo " ██║        ██║   ██║     "
  echo " ██║        ██║   ██║     "
  echo " ╚██████╗   ██║   ███████╗"
  echo "  ╚═════╝   ╚═╝   ╚══════╝"
  echo ""
  echo " Effect CLI Framework"
  echo ""

  detect_platform
  detect_method

  case "$METHOD" in
    nix)    install_nix ;;
    bun)    install_bun ;;
    binary) install_binary ;;
    *)      die "Unknown method: $METHOD" ;;
  esac

  verify_install

  echo ""
  info "Run 'ctl --help' to get started"
}

main "$@"
