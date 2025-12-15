#!/bin/bash
# SessionStart hook: Bootstrap Nix in Claude Code Remote environment
# Note: Due to gVisor sandbox limitations, only nix evaluation works (not builds)

set -e

log() {
    echo "[nix-setup] $*" >&2
}

# Only run in Claude Code Remote environment
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
    log "Not in Claude Code Remote, skipping Nix setup"
    exit 0
fi

# Check if nix is already in PATH
if command -v nix &>/dev/null; then
    log "Nix already in PATH: $(nix --version)"
    exit 0
fi

# Function to find nix binary in store
find_nix_binary() {
    if [ -d /nix/store ]; then
        # Search for nix binary in determinate-nix or standard nix packages
        find /nix/store -path '*/bin/nix' -type f -executable 2>/dev/null \
            | grep -E 'determinate-nix-[0-9]|nix-[0-9]' \
            | head -1
    fi
}

# Check if nix store already has binaries from a previous partial install
NIX_BIN=$(find_nix_binary)

if [ -z "$NIX_BIN" ]; then
    log "Installing Nix (evaluation-only mode due to gVisor)..."

    # Use Determinate Systems installer - it will crash but leave usable binaries
    # Don't uninstall existing partial installs - we want to keep the binaries
    curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix 2>/dev/null \
        | sh -s -- install linux --no-confirm --init none 2>&1 || true

    # Find the installed binary
    NIX_BIN=$(find_nix_binary)
fi

if [ -z "$NIX_BIN" ]; then
    log "ERROR: Nix installation failed - no binary found in /nix/store"
    exit 1
fi

NIX_DIR=$(dirname "$NIX_BIN")
log "Found Nix at $NIX_DIR"

# Persist nix in PATH for this session
if [ -n "$CLAUDE_ENV_FILE" ]; then
    log "Adding Nix to session PATH via CLAUDE_ENV_FILE"
    cat >> "$CLAUDE_ENV_FILE" << EOF
export PATH="$NIX_DIR:\$PATH"
export NIX_PATH="nixpkgs=flake:nixpkgs"
EOF
else
    log "CLAUDE_ENV_FILE not available, PATH not persisted"
fi

# Verify
if "$NIX_BIN" --version &>/dev/null; then
    log "SUCCESS: $("$NIX_BIN" --version)"
    log "Note: nix eval/flake commands work; nix build/develop fail due to gVisor"
else
    log "ERROR: Nix binary exists but failed to execute"
    exit 1
fi

exit 0
