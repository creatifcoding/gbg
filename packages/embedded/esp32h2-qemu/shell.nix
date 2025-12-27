# Legacy shell.nix for compatibility
# Prefer: nix develop
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "esp32h2-qemu-legacy";

  buildInputs = with pkgs; [
    # Note: This won't include ESP-IDF without the flake overlay
    # Use `nix develop` instead for full functionality
    cmake
    ninja
    python3
    git
  ];

  shellHook = ''
    echo "⚠️  Legacy shell.nix detected"
    echo "For full ESP32-H2 development environment, use:"
    echo "  nix develop"
    echo ""
  '';
}
