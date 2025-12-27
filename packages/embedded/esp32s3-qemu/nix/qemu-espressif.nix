# QEMU Espressif Fork
# Builds QEMU with ESP32/ESP32-S3/ESP32-C3 support
#
# Based on: https://github.com/espressif/qemu
# Reference: https://github.com/SFrijters/nix-qemu-espressif

{ lib
, stdenv
, fetchFromGitHub
, python3
, pkg-config
, glib
, zlib
, pixman
, ninja
, meson
, flex
, bison
, perl
, libgcrypt
, SDL2
, SDL2_image
, gtk3
, libaio
, libslirp
, enableSDL ? true
, enableGTK ? false
}:

let
  # Latest stable ESP QEMU release
  version = "9.2.2";
  espVersion = "esp-develop-${version}-20250817";
in

stdenv.mkDerivation {
  pname = "qemu-espressif";
  inherit version;

  src = fetchFromGitHub {
    owner = "espressif";
    repo = "qemu";
    rev = espVersion;
    # NOTE: You'll need to update this hash after first build attempt
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    fetchSubmodules = true;
  };

  nativeBuildInputs = [
    python3
    pkg-config
    ninja
    meson
    flex
    bison
    perl
  ];

  buildInputs = [
    glib
    zlib
    pixman
    libgcrypt
    libslirp
  ] ++ lib.optionals enableSDL [
    SDL2
    SDL2_image
  ] ++ lib.optionals enableGTK [
    gtk3
  ] ++ lib.optionals stdenv.isLinux [
    libaio
  ];

  configureFlags = [
    # Build only Xtensa (ESP32/S2/S3) and RISC-V (ESP32-C3/C6) targets
    "--target-list=xtensa-softmmu,riscv32-softmmu"

    # Enable features
    "--enable-gcrypt"
    "--enable-slirp"

    # Disable features we don't need
    "--disable-werror"
    "--disable-docs"
    "--disable-guest-agent"
    "--disable-guest-agent-msi"
  ] ++ lib.optionals enableSDL [
    "--enable-sdl"
    "--enable-sdl-image"
  ] ++ lib.optionals (!enableSDL) [
    "--disable-sdl"
  ] ++ lib.optionals enableGTK [
    "--enable-gtk"
  ] ++ lib.optionals (!enableGTK) [
    "--disable-gtk"
  ] ++ lib.optionals stdenv.isLinux [
    "--enable-linux-aio"
  ];

  # Build with ninja
  buildPhase = ''
    runHook preBuild
    ninja -C build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp build/qemu-system-xtensa $out/bin/
    cp build/qemu-system-riscv32 $out/bin/

    # Copy ESP-specific machine definitions if present
    if [ -d "pc-bios/esp32" ]; then
      mkdir -p $out/share/qemu
      cp -r pc-bios/esp32* $out/share/qemu/
    fi

    runHook postInstall
  '';

  # Skip check phase (QEMU tests are slow and may require KVM)
  doCheck = false;

  meta = with lib; {
    description = "QEMU with Espressif ESP32/ESP32-S3/ESP32-C3 support";
    homepage = "https://github.com/espressif/qemu";
    license = licenses.gpl2Plus;
    platforms = platforms.unix;
    maintainers = [ ];
  };
}
