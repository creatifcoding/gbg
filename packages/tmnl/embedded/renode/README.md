# Renode Telemetry Harness

TMNL Renode scripts for wiring UART telemetry into the host via TCP sockets (nc).

## nRF52840 UART Socket Script (Recommended)

Script: `embedded/renode/nrf52840/nrf52840-telemetry.resc`

This script uses Renode's built-in `@platforms/cpus/nrf52840.repl` and defaults to a
public Zephyr Shell ELF from Renode (can be overridden).

Headless tmux workflow (recommended):

```bash
embedded/renode/scripts/renode-init.sh
tmux attach -t tmnl-renode
```

Manual headless run (UART socket on port 5501):

```bash
renode --disable-gui -e '$uartPort=5501; i @embedded/renode/nrf52840/nrf52840-telemetry.resc'
```

Override UART/device/bin/port:

```bash
renode --disable-gui -e '$uartDevice=sysbus.uart0;$uartPort=5501;$bin=@/path/to/firmware.elf; i @embedded/renode/nrf52840/nrf52840-telemetry.resc'
```

Local firmware (recommended for high-rate telemetry):

```
embedded/firmware/nrf52840-telemetry/README.md
```

Attach to UART socket:

```bash
nc 127.0.0.1 5501
```

Attach to monitor:

```bash
nc 127.0.0.1 1234
```

Send monitor commands via tmux helper:

```bash
embedded/renode/scripts/renode-send-keys.sh "machine Reset"
```

Environment overrides (tmux workflow):

```bash
export TMNL_RENODE_SESSION=tmnl-renode
export TMNL_RENODE_SCRIPT=embedded/renode/nrf52840/nrf52840-telemetry.resc
export TMNL_RENODE_UART_PORT=5501
export TMNL_RENODE_FIRMWARE=embedded/firmware/nrf52840-telemetry/build/zephyr/zephyr.elf
export TMNL_RENODE_MONITOR_ADDR=127.0.0.1:1234
```

---

## ESP32-H2 PTY Script (Not Supported)

Script: `embedded/renode/esp32h2/esp32h2-telemetry.resc`

This script uses PTY (`CreateUartPtyTerminal`) and is not supported for TMNL.
If you must resurrect it, convert it to `CreateServerSocketTerminal` first.

```
connector Connect $uartDevice uart_pty
```
