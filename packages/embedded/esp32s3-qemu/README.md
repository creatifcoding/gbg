# ESP32-S3 QEMU Development Environment

Nix flake for emulating the **M5Stamp-S3** boards (ESP32-S3FN8) using Espressif's official QEMU fork with ESP-IDF v5.x.

## Features

- **ESP-IDF v5.x** - Latest stable ESP-IDF from `mirrexagon/nixpkgs-esp-dev`
- **QEMU Espressif** - Official Espressif QEMU fork with ESP32-S3 support
- **Xtensa Toolchain** - Pre-configured for ESP32-S3 (LX7 dual-core)
- **M5NanoH2 Stubs** - GPIO definitions for M5Stack hardware
- **SDL2 Graphics** - Optional framebuffer emulation

## Quick Start

```bash
# Enter development environment
nix develop

# Build the hello-world project
hello

# Run in QEMU (headless)
qemu-run

# Run with SDL2 display
qemu-graphics

# Exit QEMU: Ctrl+A then X
```

## Target Hardware

| Board      | SoC         | Flash | Key Features                 |
| ---------- | ----------- | ----- | ---------------------------- |
| M5NanoH2   | ESP32-S3FN8 | 8MB   | Ultra-compact, limited GPIOs |
| M5Stamp-S3 | ESP32-S3FN8 | 8MB   | More GPIOs, RGB LED, Button  |

### ESP32-S3 Specs

- **CPU**: Xtensa LX7 dual-core @ 240MHz
- **SRAM**: 512KB
- **PSRAM**: Up to 8MB (optional)
- **Flash**: 8MB SPI
- **WiFi**: 2.4GHz 802.11 b/g/n (not emulated in QEMU)
- **Bluetooth**: BLE 5.0 (not emulated in QEMU)

## Shell Commands

### Build & Run

| Command         | Description                           |
| --------------- | ------------------------------------- |
| `hello`         | Build the hello-world project         |
| `qemu-run`      | Run in QEMU (headless, UART to stdio) |
| `qemu-graphics` | Run in QEMU with SDL2 display         |
| `clean`         | Full clean of build directory         |
| `menuconfig`    | Open ESP-IDF configuration menu       |
| `set-target`    | Set IDF target to esp32s3             |

### Debugging

| Command       | Description                            |
| ------------- | -------------------------------------- |
| `qemu-gdb`    | Run QEMU with GDB server (port 1234)   |
| `gdb-connect` | Connect xtensa-esp32s3-elf-gdb to QEMU |

### Real Hardware

| Command   | Description           |
| --------- | --------------------- |
| `flash`   | Flash to /dev/ttyUSB0 |
| `monitor` | Serial monitor        |

## Project Structure

```
esp32s3-qemu/
├── flake.nix                 # Nix flake (main entry)
├── flake.lock               # Locked dependencies
├── shell.nix                # Legacy nix-shell fallback
├── nix/
│   └── qemu-espressif.nix   # QEMU package (fallback)
├── hello-world/
│   ├── CMakeLists.txt       # ESP-IDF project
│   ├── sdkconfig.defaults   # QEMU-optimized config
│   └── main/
│       ├── CMakeLists.txt
│       └── main.c           # Demo with GPIO stubs
└── README.md
```

## QEMU Limitations

The Espressif QEMU fork supports:

✅ CPU emulation (Xtensa LX7)
✅ UART (console I/O)
✅ GPIO (basic toggling)
✅ Timers / FreeRTOS
✅ Flash emulation
✅ GDB debugging

❌ WiFi / Bluetooth (not emulated)
❌ WS2812B / RMT (hardware-specific)
❌ ADC / DAC (limited)
❌ USB (partial)

## Development Shells

### Default (Full)

```bash
nix develop
```

Includes ESP-IDF, QEMU, Xtensa toolchain, SDL2, and all debug tools.

### Headless

```bash
nix develop .#headless
```

Minimal shell without graphics dependencies.

## Debugging with GDB

1. Start QEMU with GDB server:

   ```bash
   qemu-gdb
   ```

2. In another terminal, connect GDB:

   ```bash
   gdb-connect
   ```

3. GDB commands:
   ```gdb
   (gdb) break app_main
   (gdb) continue
   (gdb) info registers
   (gdb) bt
   ```

## Adding Custom Components

1. Create a new component directory:

   ```bash
   mkdir -p hello-world/components/my_component
   ```

2. Add `CMakeLists.txt`:

   ```cmake
   idf_component_register(
       SRCS "my_component.c"
       INCLUDE_DIRS "include"
   )
   ```

3. Rebuild:
   ```bash
   hello
   ```

## Framebuffer (Virtual Display)

For virtual display support, add the `esp_lcd_qemu_rgb` component:

```bash
cd hello-world
idf.py add-dependency "espressif/esp_lcd_qemu_rgb"
```

Then use the QEMU virtual RGB LCD driver in your code.

## Troubleshooting

### "QEMU not found"

The flake depends on `github:SFrijters/nix-qemu-espressif`. If unavailable, the fallback `nix/qemu-espressif.nix` will be used. You may need to update the source hash.

### "No such file: hello-world.bin"

Build the project first:

```bash
hello
```

### "idf.py: command not found"

Ensure you're in the Nix shell:

```bash
nix develop
```

### QEMU crashes on startup

Try the headless mode first to rule out SDL issues:

```bash
qemu-run
```

## References

- [Espressif QEMU Fork](https://github.com/espressif/qemu)
- [ESP-IDF QEMU Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/tools/qemu.html)
- [mirrexagon/nixpkgs-esp-dev](https://github.com/mirrexagon/nixpkgs-esp-dev)
- [M5Stamp-S3 Documentation](https://docs.m5stack.com/en/core/StampS3)
- [M5NanoH2 Documentation](https://docs.m5stack.com/en/core/M5NanoC6)

## License

MIT
