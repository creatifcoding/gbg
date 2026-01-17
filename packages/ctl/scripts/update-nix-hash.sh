#!/usr/bin/env bash
# Update the Nix node_modules hash after dependency changes
#
# Usage: ./scripts/update-nix-hash.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PKG_DIR"

echo "==> Resetting hash to force rebuild..."
sed -i 's/outputHash = "sha256-[^"]*"/outputHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="/' nix/package.nix

echo "==> Building to get new hash..."
NEW_HASH=$(nix build 2>&1 | grep "got:" | awk '{print $2}' || echo "")

if [ -z "$NEW_HASH" ]; then
  echo "ERROR: Failed to get new hash from nix build"
  exit 1
fi

echo "==> New hash: $NEW_HASH"
echo "==> Updating nix/package.nix..."

sed -i "s|outputHash = \"sha256-[^\"]*\"|outputHash = \"$NEW_HASH\"|" nix/package.nix

echo "==> Verifying build..."
nix build

echo "==> Verifying binary..."
./result/bin/ctl --version

echo ""
echo "Done! New hash applied: $NEW_HASH"
echo ""
echo "To deploy:"
echo "  nix profile upgrade packages/ctl"
