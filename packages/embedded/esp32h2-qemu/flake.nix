{
  description = "ESP32-H2 (M5NanoH2) QEMU Emulation Environment with ESP-IDF v5.x";

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

        # QEMU Espressif with RISC-V support
        qemu-esp = qemu-espressif.packages.${system}.qemu-espressif or
          (pkgs.callPackage ./nix/qemu-espressif.nix { });

        # ESP-IDF v5.4 (latest stable as of 2025)
        esp-idf = pkgs.esp-idf-full;

        # RISC-V toolchain for ESP32-H2
        riscv-toolchain = pkgs.esp-idf-esp32h2;

        # Common build inputs for ESP32-H2 development
        buildInputs = with pkgs; [
          # ESP-IDF and toolchain
          esp-idf
          riscv-toolchain

          # QEMU Espressif (RISC-V)
          qemu-esp

          # Build tools
          cmake
          ninja
          python3
          python3Packages.pip
          python3Packages.virtualenv

          # Debug tools
          gdb

          # Graphics support (for QEMU framebuffer - limited on H2)
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

        # M5NanoH2 ESP32-H2 configuration
        esp32h2Config = {
          target = "esp32h2";
          flashSize = "4MB";
          flashMode = "dio";
          flashFreq = "48m";
          # QEMU machine type for ESP32-H2 (RISC-V)
          qemuMachine = "esp32h2";
          # Memory: 320KB SRAM (no PSRAM on H2)
          qemuMemory = "320K";
        };

        # Shell aliases for common operations
        shellAliases = ''
          # Build the hello-world project
          alias hello='cd $PWD/hello-world && idf.py build'

          # Flash to QEMU (headless) - RISC-V 32-bit
          alias qemu-run='qemu-system-riscv32 \
            -nographic \
            -machine ${esp32h2Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio'

          # Run with graphics (SDL2 - limited on H2, no display peripheral)
          alias qemu-graphics='qemu-system-riscv32 \
            -machine ${esp32h2Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio \
            -display sdl'

          # GDB debug session
          alias qemu-gdb='qemu-system-riscv32 \
            -nographic \
            -machine ${esp32h2Config.qemuMachine} \
            -drive file=hello-world/build/hello-world.bin,if=mtd,format=raw \
            -serial mon:stdio \
            -s -S'

          # Start GDB client (RISC-V)
          alias gdb-connect='riscv32-esp-elf-gdb \
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

          # Set target to ESP32-H2
          alias set-target='cd $PWD/hello-world && idf.py set-target esp32h2'
        '';

      in {
        packages = {
          default = qemu-esp;
          qemu-espressif = qemu-esp;
        };

        devShells = {
          default = pkgs.mkShell {
            name = "esp32h2-qemu";

            inherit buildInputs;

            shellHook = ''
              echo ""
              echo "╔══════════════════════════════════════════════════════════════════╗"
              echo "║  ESP32-H2 QEMU Development Environment                           ║"
              echo "║  Target: M5NanoH2 (ESP32-H2FH4S) — RISC-V 32-bit @ 96MHz         ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  Hardware:                                                        ║"
              echo "║    • SoC: ESP32-H2 (RISC-V single-core)                          ║"
              echo "║    • Flash: 4MB                                                   ║"
              echo "║    • Wireless: IEEE 802.15.4 (Zigbee/Thread/Matter), BLE 5.0     ║"
              echo "║    • NO WiFi on this chip!                                        ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  M5NanoH2 Pinout:                                                 ║"
              echo "║    G3  = IR TX          G9  = Button (boot)                      ║"
              echo "║    G4  = Blue LED       G10 = RGB Power EN                       ║"
              echo "║    G1  = Grove White    G11 = RGB Data (WS2812)                  ║"
              echo "║    G2  = Grove Yellow                                             ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  Commands:                                                        ║"
              echo "║    hello        - Build hello-world project                       ║"
              echo "║    qemu-run     - Run in QEMU (headless)                          ║"
              echo "║    qemu-gdb     - Run in QEMU with GDB server                     ║"
              echo "║    gdb-connect  - Connect GDB to QEMU (RISC-V)                    ║"
              echo "║    menuconfig   - ESP-IDF configuration menu                      ║"
              echo "║    set-target   - Set IDF target to esp32h2                       ║"
              echo "║    clean        - Full clean of build directory                   ║"
              echo "╠══════════════════════════════════════════════════════════════════╣"
              echo "║  Real Hardware:                                                   ║"
              echo "║    flash        - Flash to /dev/ttyUSB0                           ║"
              echo "║    monitor      - Serial monitor                                  ║"
              echo "╚══════════════════════════════════════════════════════════════════╝"
              echo ""

              # Set IDF environment variables
              export IDF_PATH="${esp-idf}"
              export IDF_TARGET="esp32h2"

              # Ensure Python can find IDF tools
              export PATH="${esp-idf}/tools:$PATH"

              # Set up aliases
              ${shellAliases}

              # Initialize hello-world if CMakeLists.txt exists but no build dir
              if [ -f "$PWD/hello-world/CMakeLists.txt" ] && [ ! -d "$PWD/hello-world/build" ]; then
                echo "Initializing hello-world project for ESP32-H2..."
                (cd $PWD/hello-world && idf.py set-target esp32h2)
              fi
            '';
          };

          # Minimal shell without graphics dependencies
          headless = pkgs.mkShell {
            name = "esp32h2-qemu-headless";

            buildInputs = with pkgs; [
              esp-idf
              riscv-toolchain
              qemu-esp
              cmake
              ninja
              python3
              gdb
              git
            ];

            shellHook = ''
              echo "ESP32-H2 QEMU (headless mode) — RISC-V Target"
              export IDF_PATH="${esp-idf}"
              export IDF_TARGET="esp32h2"
              ${shellAliases}
            '';
          };
        };

        # Apps for direct execution
        apps = {
          qemu = {
            type = "app";
            program = "${qemu-esp}/bin/qemu-system-riscv32";
          };
        };
      }
    );
}
