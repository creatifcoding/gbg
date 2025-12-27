{
  description = "ESP32-S3 (M5Stamp-S3) QEMU Emulation Environment with ESP-IDF v5.x";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # ESP-IDF Nix overlay from mirrexagon
    nixpkgs-esp-dev = {
      url = "github:mirrexagon/nixpkgs-esp-dev";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # QEMU Espressif fork (Nix package)
    qemu-espressif = {
      url = "github:SFrijters/nix-qemu-espressif";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, nixpkgs-esp-dev, qemu-espressif }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            nixpkgs-esp-dev.overlays.default
          ];
          # ESP-IDF toolchain has CVE-2024-23342 in ecdsa dependency
          # This is acceptable for local development/emulation
          config.permittedInsecurePackages = [
            "python3.13-ecdsa-0.19.1"
          ];
        };

        # QEMU Espressif with SDL2/GTK support
        qemu-esp = qemu-espressif.packages.${system}.qemu-espressif or
          (pkgs.callPackage ./nix/qemu-espressif.nix { });

        # ESP-IDF v5.4 (latest stable as of 2025)
        esp-idf = pkgs.esp-idf-full;

        # Xtensa toolchain for ESP32-S3 (LX7 cores)
        xtensa-toolchain = pkgs.esp-idf-esp32s3;

        # Common build inputs for ESP32-S3 development
        buildInputs = with pkgs; [
          # ESP-IDF and toolchain
          esp-idf
          xtensa-toolchain

          # QEMU Espressif
          qemu-esp

          # Build tools
          cmake
          ninja
          python3
          python3Packages.pip
          python3Packages.virtualenv

          # Debug tools
          gdb

          # Graphics support (for QEMU framebuffer)
          SDL2
          SDL2_image

          # Serial tools (for real hardware)
          picocom
          esptool

          # Utilities
          git
          curl
          wget
        ];

        # M5NanoH2 / ESP32-S3 configuration
        esp32s3Config = {
          target = "esp32s3";
          flashSize = "8MB";
          flashMode = "dio";
          flashFreq = "80m";
          # QEMU machine type for ESP32-S3
          qemuMachine = "esp32s3";
          # Memory: 512KB SRAM + 8MB PSRAM (S3 typical)
          qemuMemory = "512K";
        };

        # Shell aliases for common operations
        shellAliases = ''
          # Build the hello-world project
          alias hello='cd $PWD/hello-world && idf.py build'

          # Flash to QEMU (headless)
          alias qemu-run='qemu-system-xtensa \
            -nographic \
            -machine ${esp32s3Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio'

          # Run with graphics (SDL2 framebuffer)
          alias qemu-graphics='qemu-system-xtensa \
            -machine ${esp32s3Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio \
            -display sdl'

          # GDB debug session
          alias qemu-gdb='qemu-system-xtensa \
            -nographic \
            -machine ${esp32s3Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio \
            -s -S'

          # Start GDB client
          alias gdb-connect='xtensa-esp32s3-elf-gdb \
            -ex "target remote :1234" \
            hello-world/build/hello-world.elf'

          # Clean build
          alias clean='cd $PWD/hello-world && idf.py fullclean'

          # Monitor output (for real hardware)
          alias monitor='idf.py -p /dev/ttyUSB0 monitor'

          # Flash to real hardware
          alias flash='idf.py -p /dev/ttyUSB0 flash'

          # menuconfig
          alias menuconfig='cd $PWD/hello-world && idf.py menuconfig'

          # Set target to ESP32-S3
          alias set-target='cd $PWD/hello-world && idf.py set-target esp32s3'
        '';

      in {
        packages = {
          default = qemu-esp;
          qemu-espressif = qemu-esp;
        };

        devShells = {
          default = pkgs.mkShell {
            name = "esp32s3-qemu";

            inherit buildInputs;

            shellHook = ''
              echo ""
              echo "╔══════════════════════════════════════════════════════════════════╗"
              echo "║  ESP32-S3 QEMU Development Environment                           ║"
              echo "║  Target: M5Stamp-S3 / M5Stack Core S3 (ESP32-S3FN8)              ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  Commands:                                                        ║"
              echo "║    hello        - Build hello-world project                       ║"
              echo "║    qemu-run     - Run in QEMU (headless)                          ║"
              echo "║    qemu-graphics- Run in QEMU with SDL2 display                   ║"
              echo "║    qemu-gdb     - Run in QEMU with GDB server                     ║"
              echo "║    gdb-connect  - Connect GDB to QEMU                             ║"
              echo "║    menuconfig   - ESP-IDF configuration menu                      ║"
              echo "║    set-target   - Set IDF target to esp32s3                       ║"
              echo "║    clean        - Full clean of build directory                   ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  Real Hardware:                                                   ║"
              echo "║    flash        - Flash to /dev/ttyUSB0                           ║"
              echo "║    monitor      - Serial monitor                                  ║"
              echo "╚══════════════════════════════════════════════════════════════════╝"
              echo ""

              # Set IDF environment variables
              export IDF_PATH="${esp-idf}"
              export IDF_TARGET="esp32s3"

              # Ensure Python can find IDF tools
              export PATH="${esp-idf}/tools:$PATH"

              # Set up aliases
              ${shellAliases}

              # Initialize hello-world if CMakeLists.txt exists but no build dir
              if [ -f "$PWD/hello-world/CMakeLists.txt" ] && [ ! -d "$PWD/hello-world/build" ]; then
                echo "Initializing hello-world project..."
                (cd $PWD/hello-world && idf.py set-target esp32s3)
              fi
            '';
          };

          # Minimal shell without graphics dependencies
          headless = pkgs.mkShell {
            name = "esp32s3-qemu-headless";

            buildInputs = with pkgs; [
              esp-idf
              xtensa-toolchain
              qemu-esp
              cmake
              ninja
              python3
              gdb
              git
            ];

            shellHook = ''
              echo "ESP32-S3 QEMU (headless mode)"
              export IDF_PATH="${esp-idf}"
              export IDF_TARGET="esp32s3"
              ${shellAliases}
            '';
          };
        };

        # Apps for direct execution
        apps = {
          qemu = {
            type = "app";
            program = "${qemu-esp}/bin/qemu-system-xtensa";
          };
        };
      }
    );
}
