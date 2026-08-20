# Test limits and source register (EE-01)

All limits below are `UNVERIFIED` until Analog GMSL channel specs and a
measured coupon exist. Issue 23 does not qualify a channel.

| Limit | Value | Status | Source |
| --- | --- | --- | --- |
| GMSL forward | 3 or 6 Gbps class | UNVERIFIED | SOURCES.md MAX96717/MAX96724 capability only |
| Differential target | 100 ohm | target | BUS.md |
| CSI connector | 22 pos, 0.5 mm | sourced mechanical | Particle cameras page |
| Qwiic | 3.3 V I2C | sourced | Particle Tachyon datasheet |
| Rail pitch | 2.54 mm | target | params.json |
| Contact land | 1.5 mm | target | params.json |
| Fuse F1 | 2 A | target | BOM.md B44 |
| Video while rolling | forbidden | lock | GOAL.md |

Second reviewer identity for pin-pad: `UNVERIFIED` (not assigned on this leaf).
