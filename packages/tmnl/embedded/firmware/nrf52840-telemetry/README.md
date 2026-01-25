# nRF52840 Telemetry Firmware (Zephyr)

Minimal Zephyr app that emits newline-delimited JSON over UART at a fixed rate.
Built for Renode's nRF52840 platform and designed for high-frequency telemetry.

## Layout

```
embedded/firmware/nrf52840-telemetry/
├── west.yml
└── app/
    ├── CMakeLists.txt
    ├── prj.conf
    └── src/main.c
```

## Build (Zephyr + west)

This app uses Zephyr's standard west workflow. Install the Zephyr SDK, then:

```bash
cd embedded/firmware/nrf52840-telemetry
python -m venv .venv
. .venv/bin/activate
pip install west

west init -l .
west update
west zephyr-export

west build -b nrf52840dk_nrf52840 app
```

Helper script (uses nix tmnl-embedded shell + uv venv):

```bash
embedded/firmware/nrf52840-telemetry/scripts/build.sh
```

The ELF lands at:

```
embedded/firmware/nrf52840-telemetry/build/zephyr/zephyr.elf
```

## Run in Renode

```bash
TMNL_RENODE_FIRMWARE=embedded/firmware/nrf52840-telemetry/build/zephyr/zephyr.elf \
  embedded/renode/scripts/renode-init.sh
```

Attach to UART:

```bash
nc 127.0.0.1 5501
```

## Telemetry Rate

The default rate is 20,000 lines/sec (50 us interval).
Edit `app/src/main.c` and adjust `TMNL_TELEMETRY_INTERVAL_US` as needed.
