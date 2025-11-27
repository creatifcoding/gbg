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
          ]
        );
        LD_LIBRARY_PATH = lib.optionalString isLinux (
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
          ]
          ++ lib.optionals isDarwin [ iconv ];

        buildInputs =
          with pkgs;
          lib.optionals isLinux [
            pkgsCross.mingwW64.stdenv.cc
            pkgsCross.mingwW64.windows.pthreads
          ];

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
      };
    };
}
