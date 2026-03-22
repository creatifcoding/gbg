# GetByShell Library — Shared Runtime Environment
#
# Computes PATH, PKG_CONFIG_PATH, LD_LIBRARY_PATH, etc. once for all surfaces.
# Same deps as the previous hand-rolled default.nix, but parameterized.
#
# Usage:
#   let shared = import ./shared-env.nix { inherit pkgs lib; extraPkgs = []; extraPkgConfigPaths = []; };
#   in shared.env  # → list of "KEY=VALUE" strings
{ pkgs, lib, extraPkgs ? [], extraPkgConfigPaths ? [] }:

let
  # ── Runtime packages (Tauri + GTK + layer-shell stack) ─────────
  runtimePkgs = with pkgs; [
    bun
    rustup
    cargo-tauri
    pkg-config
    openssl
    stdenv.cc
    gtk3
    webkitgtk_4_1
    glib
    cairo
    pango
    harfbuzz
    atk
    libsoup_3
    librsvg
    zlib
    gtk-layer-shell
    curl
    coreutils
    bash
  ] ++ extraPkgs;

  runtimePath = lib.makeBinPath runtimePkgs;

  pkgConfigPath = lib.concatStringsSep ":" ([
    "${pkgs.openssl.dev}/lib/pkgconfig"
    "${pkgs.gtk3.dev}/lib/pkgconfig"
    "${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig"
    "${pkgs.glib.dev}/lib/pkgconfig"
    "${pkgs.cairo.dev}/lib/pkgconfig"
    "${pkgs.pango.dev}/lib/pkgconfig"
    "${pkgs.harfbuzz.dev}/lib/pkgconfig"
    "${pkgs.gdk-pixbuf.dev}/lib/pkgconfig"
    "${pkgs.librsvg.dev}/lib/pkgconfig"
    "${pkgs.atk.dev}/lib/pkgconfig"
    "${pkgs.libsoup_3.dev}/lib/pkgconfig"
    "${pkgs.gtk-layer-shell.dev}/lib/pkgconfig"
  ] ++ extraPkgConfigPaths);

  ldLibraryPath = lib.makeLibraryPath [
    pkgs.stdenv.cc.cc.lib
    pkgs.gtk3
    pkgs.webkitgtk_4_1
    pkgs.glib
    pkgs.cairo
    pkgs.pango
    pkgs.harfbuzz
    pkgs.librsvg
    pkgs.atk
    pkgs.libsoup_3
    pkgs.zlib
    pkgs.gtk-layer-shell
  ];

  libraryPath = lib.makeLibraryPath [
    pkgs.gtk3
    pkgs.webkitgtk_4_1
    pkgs.glib
    pkgs.cairo
    pkgs.pango
    pkgs.harfbuzz
    pkgs.librsvg
    pkgs.atk
    pkgs.libsoup_3
    pkgs.zlib
    pkgs.gtk-layer-shell
  ];

in
{
  # The shared environment as a list of "KEY=VALUE" strings.
  # Passed to systemd Service.Environment.
  env = [
    "PATH=${runtimePath}:/home/getbygenius/.bun/bin:/home/getbygenius/.cargo/bin"
    "PKG_CONFIG_PATH=${pkgConfigPath}"
    "LD_LIBRARY_PATH=${ldLibraryPath}"
    "LIBRARY_PATH=${libraryPath}"
    "RUST_SRC_PATH=${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}"
    "GDK_BACKEND=wayland"
  ];

  # Exposed for consumers that need individual values.
  inherit runtimePkgs runtimePath pkgConfigPath ldLibraryPath libraryPath;
}
