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

        # ── Shell (getbyshell) — systemd-managed layer-shell panel ──────

        shell-install = {
          description = "Install getbyshell systemd user services (symlink + enable)";
          category = "Shell";
          exec = ''
            set -euo pipefail
            UNIT_DIR="$FLAKE_ROOT/packages/tmnl/systemd"
            SD_DIR="$HOME/.config/systemd/user"
            mkdir -p "$SD_DIR"

            ln -sf "$UNIT_DIR/tmnl-shell-vite.service" "$SD_DIR/tmnl-shell-vite.service"
            ln -sf "$UNIT_DIR/tmnl-shell.service" "$SD_DIR/tmnl-shell.service"
            systemctl --user daemon-reload
            systemctl --user enable tmnl-shell-vite.service tmnl-shell.service
            echo "✓ getbyshell services installed"
          '';
        };

        shell-start = {
          description = "Start getbyshell (Vite + Tauri) via systemd";
          category = "Shell";
          exec = ''
            set -euo pipefail
            systemctl --user start tmnl-shell-vite.service
            echo "⏳ Waiting for Vite on :1421..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1421 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-shell.service
            echo "✓ getbyshell started → shell-logs to tail"
          '';
        };

        shell-stop = {
          description = "Stop getbyshell services";
          category = "Shell";
          exec = ''
            systemctl --user stop tmnl-shell.service 2>/dev/null || true
            systemctl --user stop tmnl-shell-vite.service 2>/dev/null || true
            echo "✓ getbyshell stopped"
          '';
        };

        shell-restart = {
          description = "Restart getbyshell services";
          category = "Shell";
          exec = ''
            set -euo pipefail
            systemctl --user stop tmnl-shell.service 2>/dev/null || true
            systemctl --user stop tmnl-shell-vite.service 2>/dev/null || true
            sleep 1
            systemctl --user start tmnl-shell-vite.service
            echo "⏳ Waiting for Vite on :1421..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1421 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-shell.service
            echo "✓ getbyshell restarted → shell-logs to tail"
          '';
        };

        shell-logs = {
          description = "Tail getbyshell journald logs (Vite + Tauri + Effect Logger)";
          category = "Shell";
          exec = ''
            journalctl --user -u tmnl-shell -u tmnl-shell-vite -f --no-hostname
          '';
        };

        shell-status = {
          description = "Show getbyshell service status";
          category = "Shell";
          exec = ''
            echo "═══ Vite ═══"
            systemctl --user status tmnl-shell-vite.service --no-pager 2>/dev/null || echo "(not running)"
            echo ""
            echo "═══ Shell ═══"
            systemctl --user status tmnl-shell.service --no-pager 2>/dev/null || echo "(not running)"
          '';
        };
      };
    };
}
