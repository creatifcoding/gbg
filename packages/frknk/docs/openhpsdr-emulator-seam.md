# Hermes/OpenHPSDR Emulator Seam

This is the minimum Quisk-facing seam for a fake Hermes-Lite/OpenHPSDR radio.

Grounding source: `/tmp/quisk-research/quisk/hermes/quisk_hardware.py`,
`/tmp/quisk-research/quisk/quisk.c`, and `/tmp/quisk-research/quisk/microphone.c`.

## Quisk configuration target

Quisk's Hermes-Lite config uses:

```python
use_rx_udp = 10      # Hermes protocol
rx_udp_port = 1024   # typical Hermes/OpenHPSDR port
```

`hermes_board_id == 0x06` is treated as Hermes-Lite in `hermes/quisk_widgets.py`.

## Discovery

Quisk sends a broadcast discovery packet from `hermes/quisk_hardware.py`:

```text
EF FE 02 00 ...
```

The code builds this as `0xEF 0xFE 0x02` plus zero padding and sends it to
`rx_udp_port` on the broadcast address.

For an emulator response, Quisk only requires:

- packet length > 32 bytes;
- bytes `[0] == 0xEF` and `[1] == 0xFE`;
- bytes `[3:9]` are a MAC address;
- byte `[9]` is code version;
- byte `[10]` is board ID.

If config filters are set, Quisk checks:

```text
hermes_code_version >= 0 → response[9] must match
hermes_board_id >= 0     → response[10] must match
```

Cycle-1 emulator default:

```text
MAC        02:00:00:46:52:4b
version    0x01
board ID   0x06  # Hermes-Lite
```

## Optional IP set command

If Quisk discovers a device at one IP but `rx_udp_ip` config specifies another, it sends:

```text
EF FE 03 <mac[6]> <ip[4]> 00 ...
```

Quisk comments that there is no response, contrary to docs. Cycle 1 can log and ignore this
unless we intentionally support fixed-IP simulation.

## Open + start sequence

After discovery, Quisk calls `_quisk.open_rx_udp(ip, port)`. In C this connects a UDP socket
and, for `use_rx_udp == 10`, installs `read_rx_udp10()` as the sample source.

`read_rx_udp10()` gates receiving through `quisk_hermes_is_ready()`:

1. send Stop twice:

   ```text
   EF FE 04 00 00 ...   # 64 bytes
   ```

2. reset TX/control packet sender;
3. send several PC→Hermes TX/control packets with endpoint `0x02`;
4. until data arrives, send Start repeatedly:

   ```text
   EF FE 04 01 00 ...   # 64 bytes
   ```

Cycle-1 emulator response behavior:

- listen for Stop/Start/control packets;
- begin streaming RX frames after Start;
- no TX behavior beyond logging control bytes.

## RX data frame: device → Quisk

Quisk expects exactly **1032 bytes**:

```text
0..1    EF FE
2       01
3       06       # endpoint 6: IQ + mic samples
4..7    sequence # big-endian uint32
8..519  first 512-byte payload block
520..1031 second 512-byte payload block
```

Each 512-byte payload block:

```text
0..2    7F 7F 7F sync
3       C0
4..7    C1 C2 C3 C4
8..511  sample records
```

For one receiver, Quisk calculates:

```c
num_records = 504 / ((multirx_count + 1) * 6 + 2)
            = 504 / 8
            = 63 records per 512-byte block
```

So each 1032-byte frame carries 126 IQ samples for the primary receiver.

Quisk parses each single-receiver sample record as:

```text
3 bytes imaginary component, signed 24-bit big-endian payload shifted into int32 high bits
3 bytes real component, signed 24-bit big-endian payload shifted into int32 high bits
2 bytes ignored/padding/mic-related space
```

Then it assigns:

```c
samp[nSamples] = xr + xi * I;
```

## Control bytes returned by hardware

For each block, Quisk reads C0 and calculates:

```c
dindex = C0 >> 3;
```

If `dindex` is 0..4, C1..C4 are copied into the `hermes_to_pc` array. For `dindex == 0`:

- C1 bit 0 indicates ADC overrange;
- C0 bit 0 is CW key state in CW modes.

Cycle-1 emulator can emit zero control bytes and key-up state.

## PC→Hermes control packets

`microphone.c` builds 1032-byte endpoint `0x02` packets for mic/control data. They contain
control bytes from `quisk_pc_to_hermes`, which Python hardware code updates through
`QS.pc_to_hermes(self.pc2hermes)`.

For cycle 1, the emulator should parse enough to observe:

- sample rate index from C0 index 0 / C1 low bits;
- receiver count from C0 index 0 / C4 bits `[5:3]`;
- Tx frequency from C0 index 1 / C1..C4;
- Rx frequency from C0 index 2 / C1..C4;
- additional RX frequencies from C0 indices 12+.

Do not implement transmit RF in cycle 1.

## Acceptance for first fake radio

1. Quisk discovers emulator as Hermes-Lite board `0x06`.
2. Quisk opens UDP capture without error.
3. Emulator logs Stop/Start/control packets.
4. Emulator streams deterministic CW/noise IQ as endpoint `0x06` frames.
5. Quisk waterfall shows the synthetic signal.
6. No TX/QSK behavior beyond safe no-op logging.
