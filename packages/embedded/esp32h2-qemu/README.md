# ESP32-H2 QEMU Development Environment

Nix flake for **ESP32-H2** (RISC-V) development with QEMU emulation. Primary target: **M5NanoH2**.

## ⚠️ Important: ESP32-H2 vs ESP32-S3

| Feature          | ESP32-H2 (this flake)   | ESP32-S3 (sibling flake) |
| ---------------- | ----------------------- | ------------------------ |
| **Architecture** | RISC-V 32-bit           | Xtensa LX7               |
| **Cores**        | 1 @ 96MHz               | 2 @ 240MHz               |
| **WiFi**         | ❌ **NONE**             | ✅ WiFi 4                |
| **BLE**          | ✅ BLE 5.0              | ✅ BLE 5.0               |
| **802.15.4**     | ✅ Zigbee/Thread/Matter | ❌                       |
| **Flash**        | 4MB                     | 8-16MB                   |
| **PSRAM**        | ❌                      | ✅ Up to 8MB             |
| **QEMU**         | `qemu-system-riscv32`   | `qemu-system-xtensa`     |
| **GDB**          | `riscv32-esp-elf-gdb`   | `xtensa-esp32s3-elf-gdb` |

**M5NanoH2 uses ESP32-H2.** If you have an M5Stamp-S3 or similar, use the `esp32s3-qemu` flake.

## M5NanoH2 Pinout

| Pin | Function     | Notes                            |
| --- | ------------ | -------------------------------- |
| G3  | IR TX        | NEC protocol capable             |
| G4  | Blue LED     | Active high                      |
| G9  | Button       | Boot strapping, active low       |
| G10 | RGB Power EN | **Must be HIGH to power WS2812** |
| G11 | RGB Data     | WS2812B data line                |
| G1  | Grove White  | I2C SDA / GPIO                   |
| G2  | Grove Yellow | I2C SCL / GPIO                   |

### RGB LED Power Sequence

The WS2812 RGB LED requires a specific power-up sequence:

```c
// 1. Enable power to RGB LED via G10
gpio_set_level(GPIO_NUM_10, 1);
vTaskDelay(pdMS_TO_TICKS(10));  // Allow stabilization

// 2. Now send data to G11 (requires RMT driver for real WS2812)
rmt_transmit(led_chan, led_encoder, &color, sizeof(color), &tx_config);
```

## Quick Start

```bash
# Enter development shell
nix develop

# Build hello-world
hello

# Run in QEMU
qemu-run
```

## Available Commands

| Command       | Description                    |
| ------------- | ------------------------------ |
| `hello`       | Build hello-world project      |
| `qemu-run`    | Run in QEMU (headless, RISC-V) |
| `qemu-gdb`    | Run in QEMU with GDB server    |
| `gdb-connect` | Connect RISC-V GDB to QEMU     |
| `menuconfig`  | ESP-IDF Kconfig menu           |
| `set-target`  | Set IDF target to esp32h2      |
| `clean`       | Full clean build directory     |
| `flash`       | Flash to real hardware         |
| `monitor`     | Serial monitor                 |

## Project Structure

```
esp32h2-qemu/
├── flake.nix           # Nix flake definition
├── shell.nix           # Legacy shell fallback
├── nix/
│   └── qemu-espressif.nix  # QEMU-Espressif build
├── hello-world/
│   ├── CMakeLists.txt
│   ├── sdkconfig.defaults
│   └── main/
│       ├── CMakeLists.txt
│       └── main.c
└── README.md
```

## Hello World Demo

The included demo exercises:

- **Blue LED** (G4) — Heartbeat blink at 1Hz
- **Button** (G9) — Press detection with debounce
- **RGB LED** (G10/G11) — Power sequencing + color cycle (stub)
- **IR TX** (G3) — NEC command on button press (stub)
- **UART** — Status output every 5s

### Output Example

```
╔══════════════════════════════════════════════════════════════════╗
║  ESP32-H2 QEMU Hello World                                       ║
║  Target: M5NanoH2 (ESP32-H2FH4S)                                 ║
╠══════════════════════════════════════════════════════════════════╣
║  Chip: esp32h2 (RISC-V) with 1 CPU core @ 96MHz
║  Features: IEEE 802.15.4 (Zigbee/Thread/Matter) BLE 5.0 [NO WiFi]
║  Flash: 4MB embedded
╚══════════════════════════════════════════════════════════════════╝
```

## Debugging

```bash
# Terminal 1: Start QEMU with GDB server
qemu-gdb

# Terminal 2: Connect GDB
gdb-connect

# In GDB
(gdb) break app_main
(gdb) continue
```

## Real Hardware

```bash
# Flash to M5NanoH2 connected via USB
flash

# Monitor serial output
monitor
```

## ESP32-H2 Limitations in QEMU

| Feature        | QEMU Support                        |
| -------------- | ----------------------------------- |
| UART           | ✅ Full                             |
| GPIO           | ⚠️ Basic (no electrical simulation) |
| Timer/FreeRTOS | ✅ Full                             |
| WS2812B (RMT)  | ❌ Timing-critical, needs real HW   |
| IR TX (RMT)    | ❌ Timing-critical, needs real HW   |
| BLE            | ❌ No radio emulation               |
| IEEE 802.15.4  | ❌ No radio emulation               |

## References

- [M5NanoH2 Documentation](https://docs.m5stack.com/en/core/M5NanoH2)
- [ESP32-H2 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-h2_datasheet_en.pdf)
- [QEMU Espressif Fork](https://github.com/espressif/qemu)
- [ESP-IDF v5.x](https://docs.espressif.com/projects/esp-idf/en/latest/esp32h2/)
