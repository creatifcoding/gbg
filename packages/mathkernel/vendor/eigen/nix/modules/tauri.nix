{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      devShells.tmnl-tauri = pkgs.mkShell {
        name = "tmnl-tauri";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
        PKG_CONFIG_PATH = lib.concatStringsSep ":" (
          [
            "${pkgs.openssl.dev}/lib/pkgconfig"
          ]
          ++ lib.optionals isLinux [
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
          ]
        );
        LD_LIBRARY_PATH = lib.optionalString isLinux (
          lib.makeLibraryPath [
            pkgs.stdenv.cc.cc.lib  # libstdc++.so.6 (64-bit) — DuckDB, native Node addons
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
            pkgs.gtk-layer-shell  # wlr-layer-shell for TMNL Bar
          ]
        );
        LIBRARY_PATH = lib.optionalString isLinux (
          lib.makeLibraryPath [
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
            pkgs.gtk-layer-shell  # wlr-layer-shell for TMNL Bar
          ]
        );
        CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS = lib.optionalString isLinux (
          "-L ${pkgs.pkgsCross.mingwW64.windows.pthreads}/lib"
        );

        nativeBuildInputs =
          with pkgs;
          [
            rustup
            lldb_18
            pkg-config
            openssl
            frida-tools
          ]
          ++ lib.optionals isLinux [
            gtk3
            webkitgtk_4_1
            cargo-tauri
            glib
            cairo
            pango
            harfbuzz
            atk
            libsoup_3
            librsvg
            zlib
            gtk-layer-shell  # wlr-layer-shell protocol for TMNL Bar panel
          ]
          ++ lib.optionals isDarwin [ iconv ];

        # MinGW cross-compile toolchain for Windows target.
        # These MUST NOT go in buildInputs — that leaks mingw C++ headers
        # (pthread.h, process.h) into native g++ include paths, breaking
        # any crate with C++ build deps (tokenizers/esaxx-rs, ort, etc.).
        #
        # Instead, the mingw linker + pthreads lib paths are injected ONLY
        # into the Windows cross-compile target via CARGO_TARGET env vars
        # and a wrapper script. Native builds never see them.
        CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = lib.optionalString isLinux
          "${pkgs.pkgsCross.mingwW64.stdenv.cc}/bin/x86_64-w64-mingw32-gcc";

        buildInputs = [ ];  # Intentionally empty — no cross-compile header pollution

        shellHook = ''
          echo "[tmnl-tauri] Tauri development environment with GTK/WebKit dependencies layered over tmnl-core."
        '';
      };

      mission-control.scripts = {
        tauri-dev = {
          description = "Run TMNL Tauri app in dev mode.";
          category = "Tauri";
          exec = ''
            set -euo pipefail

            # Detect WSLg and apply WebKitGTK compositing workaround
            if [ -n "''${WSL_DISTRO_NAME:-}" ]; then
              echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
              export WEBKIT_DISABLE_COMPOSITING_MODE=1
            fi

            # Enable Rust debug logging for window pooling
            export RUST_LOG="''${RUST_LOG:-tmnl=debug}"
            echo "[tmnl tauri-dev] RUST_LOG=$RUST_LOG"

            cd "$FLAKE_ROOT"
            echo "[tmnl tauri-dev] bun run tauri:dev"
            bun run tauri:dev
          '';
        };

        tauri-dev-windows = {
          description = "Run TMNL Tauri app in dev mode for Windows.";
          category = "Tauri";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl tauri-dev-windows] bun run tauri:dev:windows"
            bun run tauri:dev:windows
          '';
        };

        tauri-dev-both = {
          description = "Run TMNL Tauri app in dev mode for both platforms.";
          category = "Tauri";
          exec = ''
            set -euo pipefail

            # Detect WSLg and apply WebKitGTK compositing workaround
            if [ -n "''${WSL_DISTRO_NAME:-}" ]; then
              echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
              export WEBKIT_DISABLE_COMPOSITING_MODE=1
            fi

            # Enable Rust debug logging for window pooling
            export RUST_LOG="''${RUST_LOG:-tmnl=debug}"
            echo "[tmnl tauri-dev-both] RUST_LOG=$RUST_LOG"

            cd "$FLAKE_ROOT"
            echo "[tmnl tauri-dev-both] bun run tauri:dev:both"
            bun run tauri:dev:both
          '';
        };

        tauri-build = {
          description = "Build TMNL Tauri app for production.";
          category = "Tauri";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl tauri-build] bun run tauri:build"
            bun run tauri:build
          '';
        };

        # Shell (getbyshell) commands moved to nix/modules/getbyshell/
        # Use: getbyshell-install, getbyshell-start, getbyshell-stop, etc.
      };
    };
}
