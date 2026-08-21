# ERC waivers (issue 25 camera-tx)

Status: `UNVERIFIED`. `kicad-cli` is not in this runtime.

| Item | Disposition |
| --- | --- |
| kicad-cli ERC not run | Waiver: tool absent. |
| MAX96717 footprint has no pads | Expected. analog.com PDF timed out. Do not invent a pad map. |
| CAM_3V3 / VDD_SER not tied to V_BRANCH | Intentional. 12 V branch is not a CSI/SerDes core rail. Local MPN UNVERIFIED. |
| IMX519 pins 17/18/20/21 no-connect | Serializer control pins absent from #23 envelope. |
| UNVERIFIED footprints | #23 envelopes; do not fabricate. |
