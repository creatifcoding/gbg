# Research: RF Protocol Decoders

```
Research File:   RF Protocol Decoders
Target Sections: TSG.17 (GNU Radio Bridge — protocol integration subsection)
Author:          Val (sdr-analyst)
Created:         2026-02-18
Sources:         [ADSB], [AIS], [POCSAG], [P25], [DMR], [RTL433], protocol RFCs
```

---

## 1. ADS-B (Automatic Dependent Surveillance — Broadcast)

### 1.1 RF Characteristics

| Parameter | Value |
|-----------|-------|
| Frequency | 1090 MHz |
| Modulation | Pulse Position Modulation (PPM) |
| Data rate | 1 Mbit/s |
| Transmit power | 75-500 W (airborne), ~20 W (ground) |
| Range | ~250 nmi (line of sight dependent) |
| Protocol | Mode S Extended Squitter (DF17/DF18) |

### 1.2 Message Structure (112 bits)

```
┌──────┬────┬─────────────┬──────────────────────────┬───────────────────┐
│  DF  │ CA │ ICAO Address │    Message (ME)          │    PI (CRC-24)   │
│ 5bit │3bit│   24 bits    │       56 bits            │     24 bits      │
└──────┴────┴─────────────┴──────────────────────────┴───────────────────┘
```

- **DF** (Downlink Format): 5 bits. DF=17 is ADS-B from airborne transponder, DF=18 is ADS-B from non-transponder (TIS-B, ADS-R)
- **CA** (Capability): 3 bits. Transponder capability level
- **ICAO Address**: 24 bits. Globally unique aircraft identifier (assigned by ICAO)
- **ME** (Message Encoding): 56 bits. Type-dependent payload
- **PI** (Parity/Interrogator): 24 bits. CRC-24 for error detection

### 1.3 Type Code Reference

The first 5 bits of ME form the Type Code (TC):

| TC | Category | Content | Key Fields |
|----|----------|---------|------------|
| 1-4 | Aircraft Identification | Callsign | 8 chars, 6-bit per char encoding |
| 5-8 | Surface Position | Ground position | CPR lat/lon, ground speed, track |
| 9-18 | Airborne Position (baro) | Air position + baro alt | CPR lat/lon, barometric altitude |
| 19 | Airborne Velocity | Speed/heading/vrate | Ground speed, heading, vertical rate |
| 20-22 | Airborne Position (GNSS) | Air position + GNSS alt | CPR lat/lon, GNSS altitude |
| 23 | Test Message | — | — |
| 24 | Surface System Status | — | — |
| 25-27 | Reserved | — | — |
| 28 | Aircraft Status | Emergency | Emergency/priority codes |
| 29 | Target State & Status | Autopilot info | Selected altitude, baro setting |
| 31 | Operational Status | Version/capability | ADS-B version, capability flags |

### 1.4 CPR (Compact Position Reporting) Decoding

CPR encodes latitude/longitude into 17-bit values using a zone-based scheme:

**Constants:**
```
NZ = 15    (number of latitude zones)
d_lat_even = 360 / (4 * NZ) = 6.0 degrees
d_lat_odd  = 360 / (4 * NZ - 1) = 6.101695 degrees
```

**Global position decode (requires even + odd frame pair):**
```
1. Compute latitude zone index:
   j = floor((59 * lat_cpr_even - 60 * lat_cpr_odd) / 2^17 + 0.5)

2. Compute latitude candidates:
   lat_even = d_lat_even * (mod(j, 60) + lat_cpr_even / 2^17)
   lat_odd  = d_lat_odd  * (mod(j, 59) + lat_cpr_odd / 2^17)

3. Select based on most recent frame (even or odd)

4. Compute NL(lat) — number of longitude zones for this latitude:
   NL(lat) = floor(2*pi / acos(1 - (1-cos(pi/(2*NZ))) / cos(pi*lat/180)^2))

5. Compute longitude:
   if NL > 1:
     d_lon = 360 / NL (even) or 360 / (NL-1) (odd)
   else:
     d_lon = 360
   m = floor((lon_cpr_even * (NL-1) - lon_cpr_odd * NL) / 2^17 + 0.5)
   lon = d_lon * (mod(m, max(NL, 1)) + lon_cpr / 2^17)
```

**Locally unambiguous decode (single frame + reference position):**
```
1. Use reference lat/lon (e.g., receiver position or previous aircraft position)
2. Compute latitude zone from reference: j = floor(ref_lat / d_lat)
3. lat = d_lat * (j + lat_cpr / 2^17)
4. Similarly for longitude using NL(lat)
```

### 1.5 Altitude Decoding

**Barometric altitude (TC 9-18):**
- Q-bit (bit 48 of ME):
  - Q=1: altitude = value * 25 - 1000 (feet, 25-ft resolution)
  - Q=0: Gillham code (100-ft resolution), requires bit interleaving

**GNSS altitude (TC 20-22):**
- Direct encoding in meters or feet (indicated by unit bit)

### 1.6 dump1090 Architecture

dump1090 (by antirez/Salvatore Sanfilippo, maintained by flightaware) is the standard open-source ADS-B decoder:

```
RTL-SDR (2 MSPS CU8)
    │
    ▼
Signal Detection (amplitude envelope threshold)
    │
    ▼
Preamble Detection (8 microsecond pattern: 1010 with specific timing)
    │
    ▼
Bit Extraction (PPM: 1-bit = 10, 0-bit = 01, 1us each)
    │
    ▼
CRC-24 Validation
    │
    ▼
Message Decoding (DF, TC, fields)
    │
    ├──► JSON HTTP API (port 8080)
    ├──► BaseStation format (port 30003, TCP)
    ├──► Raw hex (port 30002, TCP)
    └──► Interactive map (built-in web UI)
```

**dump1090 → NATS bridge:**

```python
#!/usr/bin/env python3
"""Bridge dump1090 JSON output to NATS."""
import asyncio, aiohttp, json, nats

async def main():
    nc = await nats.connect("nats://localhost:4222")

    async with aiohttp.ClientSession() as session:
        while True:
            async with session.get("http://localhost:8080/data/aircraft.json") as resp:
                data = await resp.json()
                for ac in data.get("aircraft", []):
                    msg = json.dumps({
                        "protocol": "adsb",
                        "data": {
                            "icao": ac.get("hex", ""),
                            "callsign": ac.get("flight", "").strip(),
                            "altitude": ac.get("alt_baro"),
                            "lat": ac.get("lat"),
                            "lon": ac.get("lon"),
                            "speed": ac.get("gs"),
                            "heading": ac.get("track"),
                            "verticalRate": ac.get("baro_rate"),
                            "squawk": ac.get("squawk"),
                            "category": ac.get("category"),
                            "rssi": ac.get("rssi"),
                            "seen": ac.get("seen"),
                            "messages": ac.get("messages"),
                        },
                        "frequency": 1090000000,
                    }).encode()
                    await nc.publish("tsingou.signal.sdr.decoded.adsb", msg)
            await asyncio.sleep(1.0)  # Poll interval

asyncio.run(main())
```

---

## 2. AIS (Automatic Identification System)

### 2.1 RF Characteristics

| Parameter | Value |
|-----------|-------|
| Channel A | 161.975 MHz (AIS1) |
| Channel B | 162.025 MHz (AIS2) |
| Modulation | GMSK (Gaussian Minimum Shift Keying) |
| Data rate | 9600 bps |
| Channel spacing | 25 kHz |
| Access | SOTDMA (Self-Organized TDMA) / ITDMA (Incremental TDMA) |

### 2.2 NMEA Sentence Format

```
!AIVDM,1,1,,B,177KQJ5000G?tO`K>RA1wUbN0TKH,0*5C
  │     │ │  │ │                              │ │
  │     │ │  │ │                              │ └─ Checksum
  │     │ │  │ │                              └─── Padding bits
  │     │ │  │ └──────────────────────────────────── Payload (6-bit ASCII)
  │     │ │  └─────────────────────────────────────── Channel (A or B)
  │     │ └────────────────────────────────────────── Sequential message ID
  │     └──────────────────────────────────────────── Fragment count, fragment number
  └────────────────────────────────────────────────── Sentence type
```

### 2.3 6-bit ASCII Encoding

Each character in the payload represents 6 bits of data. Character-to-integer mapping:

```
Chars '0'-'W' (ASCII 48-87):  value = ASCII - 48  (0-39)
Chars '`'-'w' (ASCII 96-119): value = ASCII - 56  (40-63)
```

### 2.4 Message Type Reference (All 27 Types)

| Type | Description | Class | Interval | Key Fields |
|------|-------------|-------|----------|------------|
| 1 | Position Report (Scheduled) | A | 2-10 s | MMSI, nav status, ROT, SOG, lon, lat, COG, heading, timestamp |
| 2 | Position Report (Assigned) | A | 2-10 s | Same as Type 1 |
| 3 | Position Report (Interrogated) | A | Response | Same as Type 1 |
| 4 | Base Station Report | Base | 10 s | MMSI, UTC date/time, position, RAIM |
| 5 | Static & Voyage Data | A | 6 min | MMSI, IMO, callsign, name, ship type, dimensions, draught, ETA, destination |
| 6 | Binary Addressed | Any | — | Dest MMSI, DAC, FID, binary data |
| 7 | Binary Acknowledge | Any | — | Up to 4 MMSI acknowledgments |
| 8 | Binary Broadcast | Any | — | DAC, FID, binary data |
| 9 | SAR Aircraft Position | SAR | 3 s | MMSI, altitude, SOG, position, COG |
| 10 | UTC/Date Inquiry | Any | — | Dest MMSI |
| 11 | UTC/Date Response | Base | — | Same as Type 4 |
| 12 | Addressed Safety | Any | — | Dest MMSI, safety text |
| 13 | Safety Acknowledge | Any | — | Up to 4 MMSI |
| 14 | Safety Broadcast | Any | — | Safety text |
| 15 | Interrogation | Any | — | Message type requests |
| 16 | Assignment Mode | Base | — | Reporting interval assignment |
| 17 | DGNSS Broadcast | Base | — | Differential corrections |
| 18 | Class B Position | B | 30 s | MMSI, SOG, position, COG, heading |
| 19 | Extended Class B Position | B | 30 s | + name, ship type, dimensions |
| 20 | Data Link Management | Base | — | Slot allocation |
| 21 | Aid-to-Navigation | ATON | 3 min | MMSI, type, name, position, dimensions |
| 22 | Channel Management | Base | — | Regional frequency assignments |
| 23 | Group Assignment | Base | — | Area/reporting assignment |
| 24 | Class B Static Data | B | 6 min | Part A: name. Part B: callsign, ship type, dimensions |
| 25 | Single Slot Binary | Any | — | Binary data (single slot) |
| 26 | Multiple Slot Binary | Any | — | Binary data (multiple slots) |
| 27 | Long-Range Position | A/B | 3 min | MMSI, position (for satellite) |

### 2.5 Class A vs Class B Reporting

| Condition | Class A Interval | Class B Interval |
|-----------|-----------------|-----------------|
| At anchor / moored | 3 min | 3 min |
| SOG 0-2 kts, not changing course | 10 s | 3 min |
| SOG 0-14 kts | 10 s | 30 s |
| SOG 0-14 kts, changing course | 3.33 s | 30 s |
| SOG 14-23 kts | 6 s | 30 s |
| SOG 14-23 kts, changing course | 2 s | 30 s |
| SOG >23 kts | 2 s | 30 s |
| SOG >23 kts, changing course | 2 s | 30 s |

### 2.6 MMSI Format

```
MID + unique number = 9 digits

MID (Maritime Identification Digit): 3-digit country code
  201-299: Europe
  301-399: Americas
  401-499: Asia
  501-599: Africa/Oceania
  601-699: Africa

Special MMSIs:
  0-009999999: Coast stations
  111MIDXXXX: SAR aircraft
  970XXYYYYY: AIS SART (Search and Rescue Transmitter)
  972XXXXXX: MOB (Man Overboard) device
  974XXXXXX: EPIRB AIS
```

### 2.7 AIS → NATS Bridge

```python
#!/usr/bin/env python3
"""Bridge AIS decoder (gnuais/rtl_ais) to NATS."""
import asyncio, json, subprocess, nats

async def main():
    nc = await nats.connect("nats://localhost:4222")

    # rtl_ais outputs NMEA sentences to stdout
    proc = await asyncio.create_subprocess_exec(
        "rtl_ais", "-p", "0",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async for line in proc.stdout:
        sentence = line.decode().strip()
        if sentence.startswith("!AIVDM"):
            msg = json.dumps({
                "protocol": "ais",
                "data": {"nmea": sentence},
                "frequency": 162000000,
            }).encode()
            await nc.publish("tsingou.signal.sdr.decoded.ais", msg)

asyncio.run(main())
```

---

## 3. POCSAG (Post Office Code Standardisation Advisory Group)

### 3.1 RF Characteristics

| Parameter | Value |
|-----------|-------|
| Frequencies | Country-dependent (e.g., 152.48 MHz, 157.9 MHz, 466 MHz) |
| Modulation | FSK (2-FSK) |
| Baud rates | 512, 1200, 2400 bps |
| Channel spacing | 25 kHz (typically) |
| Encoding | BCH(31,21) |

### 3.2 Transmission Structure

```
┌─────────────────────────┬─────────┬──────────┬──────────┬─────────────┐
│ Preamble (576+ bits)    │   FSC   │ Batch 1  │ Batch 2  │   ...       │
│ 101010101010...         │ 32 bits │ 16 CW    │ 16 CW    │             │
└─────────────────────────┴─────────┴──────────┴──────────┴─────────────┘

FSC (Frame Sync Codeword): 0x7CD215D8

Batch structure (17 codewords):
  ┌─────┬──────────┬──────────┬──────────┬──────────┐
  │ FSC │ Frame 0  │ Frame 1  │   ...    │ Frame 7  │
  │     │ CW0, CW1 │ CW0, CW1 │         │ CW0, CW1│
  └─────┴──────────┴──────────┴──────────┴──────────┘
```

### 3.3 Codeword Format (32 bits)

**Address codeword (bit 31 = 0):**
```
┌───┬──────────────────┬──────┬──────────────┬───┐
│ 0 │ Address (18 bits)│Func  │  Parity      │EP │
│   │                  │2 bit │  10 bits     │1b │
└───┴──────────────────┴──────┴──────────────┴───┘
```

**Message codeword (bit 31 = 1):**
```
┌───┬──────────────────────────┬──────────────┬───┐
│ 1 │ Message data (20 bits)   │  Parity      │EP │
│   │                          │  10 bits     │1b │
└───┴──────────────────────────┴──────────────┴───┘
```

- **Address**: 18 bits + 3 bits from frame position = 21-bit cap code (0 to 2,097,151)
- **Function**: 00 = numeric, 01 = reserved, 10 = reserved, 11 = alphanumeric
- **Message**: 7-bit ASCII (alphanumeric) or 4-bit BCD (numeric)
- **Parity**: BCH(31,21) error correction code (corrects up to 2 bit errors)
- **EP**: Even parity over bits 0-30

### 3.4 multimon-ng

multimon-ng is the standard multi-protocol decoder for paging and amateur radio:

```bash
# Decode POCSAG from RTL-SDR via rtl_fm
rtl_fm -f 157900000 -s 22050 -g 40 | multimon-ng -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -t raw -

# Output format:
# POCSAG1200: Address: 1234567  Function: 0  Alpha:   Hello World
# POCSAG1200: Address: 1234567  Function: 0  Numeric: 5551234
```

---

## 4. P25 (APCO Project 25)

### 4.1 Phase 1 vs Phase 2

| Feature | Phase 1 | Phase 2 |
|---------|---------|---------|
| Access | FDMA | TDMA (2 slots) |
| Channel width | 12.5 kHz | 12.5 kHz (2 voice channels) |
| Modulation | C4FM (4-level FSK) | H-DQPSK (pi/4 DQPSK) |
| Symbol rate | 4800 symbols/s | 6000 symbols/s |
| Data rate | 9600 bps | 12000 bps |
| Voice codec | IMBE (88-bit, 4.4 kbps) | AMBE+2 (72-bit, 7.2 kbps) |
| Voice capacity | 1 per channel | 2 per channel |
| Backward compatible | N/A | Yes (with Phase 1 equipment) |

### 4.2 P25 Trunking

P25 trunked systems use a control channel for call setup:

```
Control Channel (CC): Always on, broadcasts system info
  │
  ├── Channel Identifier Update: maps channel IDs to frequencies
  ├── Adjacent Status Broadcast: neighbor site info
  ├── Network Status Broadcast: system ID, WACN
  └── Group Voice Channel Grant: assigns voice channel for a talkgroup
       │
       └──► Voice Channel (VC): carries voice + embedded signaling
            ├── Voice frames (IMBE/AMBE+2)
            ├── Link Control Word (LCW): talkgroup, source unit
            └── Encryption Sync: encryption algorithm + key ID
```

### 4.3 Open-Source Decoders

| Decoder | Language | Phase 1 | Phase 2 | Trunking | Platform |
|---------|----------|---------|---------|----------|----------|
| OP25 | Python/C++ | Full | Partial | Yes | Linux |
| DSD | C | Full | No | No | Cross-platform |
| DSD+ | C/C++ | Full | Full | Yes | Windows/Wine |
| sdrtrunk | Java | Full | Full | Yes | Cross-platform |
| trunk-recorder | C++ | Full | Full | Yes | Linux |

---

## 5. DMR (Digital Mobile Radio)

### 5.1 Key Specifications

| Parameter | Value |
|-----------|-------|
| Standard | ETSI TS 102 361 |
| Access | TDMA (2 timeslots) |
| Channel width | 12.5 kHz |
| Modulation | 4FSK (4-state FSK) |
| Symbol rate | 4800 symbols/s |
| Data rate | 9600 bps |
| Voice codec | AMBE+2 (DVSI) |
| Timeslots | TS1, TS2 (independent) |
| Color codes | 0-15 (analogous to CTCSS tones) |

### 5.2 Tiers

| Tier | Type | Use Case |
|------|------|----------|
| Tier I | Unlicensed (dPMR446) | Consumer, low power |
| Tier II | Conventional (licensed) | Business, repeaters |
| Tier III | Trunked | Large organizations, public safety |

### 5.3 MOTOTRBO

Motorola's implementation of DMR Tier II/III with proprietary extensions:
- Enhanced data: XPT (Extended Pseudo Trunking), Capacity Plus, Connect Plus, Capacity Max
- MOTOTRBO repeaters function as standard DMR Tier II
- DSD/DSD+ can decode MOTOTRBO voice

---

## 6. Other Protocols

### 6.1 ACARS (Aircraft Communications Addressing and Reporting System)

| Parameter | Value |
|-----------|-------|
| Frequencies | 129.125, 130.025, 130.425, 130.450, 131.125, 131.450, 131.475, 131.525, 131.550, 131.725, 131.825, 136.700, 136.750, 136.800, 136.900, 136.925 MHz |
| Modulation | AM (Amplitude Modulation) |
| Data | 2400 baud MSK |
| Format | Preamble + SOH + Mode + Address + Ack + Label + Block ID + Text + Suffix + BCS + DEL |

Key message labels:
| Label | Description |
|-------|-------------|
| _d | Departure message |
| AA-AZ | Airline-defined |
| H1 | HF frequency data |
| Q0 | Link test |
| SA | Meteorological report |

Decoder: `acarsdec -r 0 -f 131.550 -f 131.725` (using RTL-SDR device 0)

### 6.2 APRS (Automatic Packet Reporting System)

| Parameter | Value |
|-----------|-------|
| Frequency | 144.390 MHz (North America), 144.800 MHz (Europe) |
| Modulation | AFSK (Audio FSK) at 1200 baud |
| Protocol | AX.25 |
| Mark/Space | 1200 Hz / 2200 Hz |

Decoders: `dire wolf` (most capable), `multimon-ng -a AFSK1200`

### 6.3 ISM Band (rtl_433)

rtl_433 is a universal ISM band decoder supporting 200+ device protocols:

```bash
# Run with RTL-SDR, output JSON
rtl_433 -F json

# Output example:
{"time":"2026-02-18 12:34:56","model":"Acurite-Tower","id":12345,
 "channel":"A","battery_ok":1,"temperature_C":22.3,"humidity":45}
```

Subject mapping for NATS:
```
rtl_433 model → tsingou.signal.sdr.decoded.ism.{model}
```

### 6.4 Iridium

| Parameter | Value |
|-----------|-------|
| Frequency | 1616-1626.5 MHz (L-band) |
| Modulation | QPSK / DE-QPSK |
| Access | FDMA/TDMA |
| Frame | 50 ms TDMA slots |
| Constellation | 66 satellites + 9 spares, ~780 km LEO |

Decoders: `gr-iridium` (GNU Radio blocks) + `iridium-toolkit` (message parser)

---

## 7. Universal Decoder-to-NATS Bridge Architecture

### 7.1 Pattern

All protocol decoders follow the same integration pattern:

```
┌─────────────┐     stdout/TCP     ┌───────────┐     NATS      ┌─────────┐
│ Decoder     │───────────────────►│ Bridge    │──────────────►│ NATS    │
│ (dump1090,  │  (text/JSON/       │ Process   │  tsingou.     │ Server  │
│  multimon,  │   binary)          │ (Python/  │  signal.sdr.  │         │
│  rtl_433,   │                    │  Rust)    │  decoded.     │         │
│  acarsdec)  │                    │           │  {protocol}   │         │
└─────────────┘                    └───────────┘               └─────────┘
```

### 7.2 Bridge Message Envelope

All decoded protocol messages use a common JSON envelope:

```json
{
  "protocol": "adsb",
  "decoderVersion": "dump1090-fa/8.2",
  "data": { ... protocol-specific ... },
  "frequency": 1090000000,
  "signalStrength": -8.5,
  "timestamp": 1708300000.123,
  "rawHex": "8D4840D6202CC371C32CE0576098"
}
```

### 7.3 Systemd Service Units

```ini
# /etc/systemd/system/tsingou-adsb-bridge.service
[Unit]
Description=Tsingou ADS-B NATS Bridge
After=network.target nats-server.service dump1090-fa.service

[Service]
ExecStart=/usr/local/bin/tsingou-adsb-bridge --nats-url nats://localhost:4222
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 7.4 Docker Compose

```yaml
services:
  dump1090:
    image: flightaware/dump1090-fa:latest
    devices:
      - /dev/bus/usb:/dev/bus/usb
    ports:
      - "8080:8080"
      - "30003:30003"

  adsb-bridge:
    build: ./bridges/adsb
    depends_on:
      - dump1090
      - nats
    environment:
      DUMP1090_URL: http://dump1090:8080
      NATS_URL: nats://nats:4222

  rtl-433:
    image: hertzg/rtl_433:latest
    devices:
      - /dev/bus/usb:/dev/bus/usb
    command: ["-F", "json", "-R", "-1"]

  ism-bridge:
    build: ./bridges/ism
    depends_on:
      - rtl-433
      - nats

  nats:
    image: nats:latest
    ports:
      - "4222:4222"
```

---

## 8. Citations

| Key | Reference |
|-----|-----------|
| [ADSB] | "The 1090MHz Riddle", Junzi Sun, TU Delft, https://mode-s.org/decode/ |
| [DUMP1090] | dump1090-fa, FlightAware, https://github.com/flightaware/dump1090 |
| [AIS] | ITU-R M.1371-5 "Technical characteristics for an automatic identification system" |
| [AISDECODE] | "AIS Decoder", Eric Raymond, https://gpsd.gitlab.io/gpsd/AIVDM.html |
| [POCSAG] | ITU-R M.584-2 "Codes and formats for RPC" |
| [MULTIMON] | multimon-ng, https://github.com/EliasOenal/multimon-ng |
| [P25] | TIA-102 series "APCO Project 25" |
| [OP25] | OP25 decoder, https://github.com/boatbod/op25 |
| [DMR] | ETSI TS 102 361 "Digital Mobile Radio" |
| [DSD] | Digital Speech Decoder, https://github.com/szechyjs/dsd |
| [RTL433] | rtl_433, https://github.com/merbanan/rtl_433 |
| [ACARS] | ARINC 618 / ACARS specification |
| [ACARSDEC] | acarsdec, https://github.com/TLeconte/acarsdec |
| [DIREWOLF] | Dire Wolf, https://github.com/wb2osz/direwolf |
| [IRIDIUM] | iridium-toolkit, https://github.com/muccc/iridium-toolkit |
