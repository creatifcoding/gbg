# shell.nix - Legacy fallback for users without flake support
#
# Usage: nix-shell
#
# For full functionality, use: nix develop

{ pkgs ? import <nixpkgs> {} }:

let
  # Note: This is a minimal fallback. For full ESP-IDF + QEMU support,
  # use the flake: `nix develop`
  #
  # The flake provides:
  # - ESP-IDF v5.x from mirrexagon/nixpkgs-esp-dev
  # - QEMU Espressif fork with ESP32-S3 support
  # - Xtensa toolchain
  #
  # This shell.nix only provides basic build tools.
in

pkgs.mkShell {
  name = "esp32s3-qemu-fallback";

  buildInputs = with pkgs; [
    # Basic build tools
    cmake
    ninja
    python3
    python3Packages.pip
    python3Packages.virtualenv
    git
    curl
    wget

    # Serial tools (for real hardware)
    picocom

    # Graphics libraries (for QEMU SDL)
    SDL2
    SDL2_image
  ];

  shellHook = ''
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║  ESP32-S3 Development Shell (FALLBACK MODE)                      ║"
    echo "╠══════════════════════════════════════════════════════════════════╣"
    echo "║  WARNING: This is a minimal fallback shell.                      ║"
    echo "║                                                                   ║"
    echo "║  For full ESP-IDF + QEMU support, use the Nix flake:             ║"
    echo "║                                                                   ║"
    echo "║    nix develop                                                    ║"
    echo "║                                                                   ║"
    echo "║  Or if your Nix doesn't have flakes enabled:                      ║"
    echo "║                                                                   ║"
    echo "║    nix --experimental-features 'nix-command flakes' develop      ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""

    # Check if ESP-IDF is installed manually
    if [ -n "$IDF_PATH" ]; then
      echo "ESP-IDF found at: $IDF_PATH"
    else
      echo "ESP-IDF not found. Set IDF_PATH or use 'nix develop' for full environment."
    fi
  '';
}
