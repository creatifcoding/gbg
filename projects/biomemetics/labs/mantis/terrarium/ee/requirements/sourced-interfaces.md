# Sourced interfaces (EE-01)

Retrieved 2026-08-20. #21/#22 are not landed; missing runtime contracts stay
UNVERIFIED.

## Locked path

Untethered carriage. Raw MIPI stays at the camera serializer and at Tachyon.
P01-P08 power/control. B27 P09-P12 serialized video. B50 C01-C12 binder
mirror. Video-while-rolling is out of v1.

## Sourced now

| Item | Exact claim | Limit |
| --- | --- | --- |
| Tachyon CSI1 22p 0.5 mm pinout | Transcribed from Particle `tachyon-csi-pinout.jpg` marked TACHYON V1.2 | Connector MPN UNVERIFIED |
| Tachyon DSI/CSI2 22p 0.5 mm pinout | Transcribed from `tachyon-csi-dsi-pinout.jpg` | GPIO 68 mode; RPi cameras not assumed |
| Qwiic nets | GND / 3.3 V / SDA / SCL; cable housing SHR-04V-S | Board-header MPN UNVERIFIED |
| TCA9548A PW/RGE pins | TI SCPS207H Table 4-1 | Optional B49; selected orderable UNVERIFIED |
| B27/B50 net names | `bus.json` P01-P12 and C-mirror | Contact series UNVERIFIED |

## Stopped (no invented MPN)

| Item | Why |
| --- | --- |
| IMX519 module SKU | Particle lists the sensor, not an orderable module |
| MAX96717 / MAX96724 suffix | analog.com datasheet timeout; family only in SOURCES.md |
| MAX96717 vs MAX96717 | Parent-tree name conflict |
| B27/B50 contact series | Custom; Particle does not sell them |
| S1/S2/Q1 | No part selected |
| 3D STEP/WRL | No vendor model retrieved |
