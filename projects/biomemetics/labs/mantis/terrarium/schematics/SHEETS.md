# Schematic index - working draft B

All sheets are A3 landscape, millimetres, third-angle where physical projection
applies, and carry `THEORETICAL - VERIFY AGAINST STEP / FIRST ARTICLE` in the
title block. Every working-draft view is `NTS - DO NOT SCALE`; numeric
dimensions are annotations only.

| Sheet | Scale | Claim illustrated / review question | Principal unverified items |
|---|---|---|---|
| S00 Cover / theory | NTS | Exterior rail/brick and protected animal boundary | all custom first-article geometry |
| S01 Orthographic assembly | NTS | 250 x 250 x 500 envelope, third-angle arrangement, upper-third datum | finished joint and gasket closure |
| S02 Exploded assembly | NTS | functional service order and external electronics | fastener and retainer selections |
| S03 Perimeter blocks | NTS | corner/edge/splice/cassette logic, 250-to-500 joint, and captive route end stop | block section, groove, coupler, end-stop retention |
| S04 Rail + strip | NTS | 12-contact split and four point-to-point GMSL2 docks per 500 mm | all SI geometry and contact series |
| S05 Carriage mechanism | NTS | safe-lift-roll-lock kinematics and split contact carrier | spring, cam, roller, travel, forces |
| S06 Universal latch + binder | NTS | common bind datum, B50 handoff, S2, and load path | connector, pull-off, wear key, interlock timing |
| S07 Camera SerDes load | NTS | tetherless IMX519 -> MAX96717 -> B50 -> pogo GMSL2 topology | carrier PCB, internal FPC, binder thermals |
| S08 Electrical/video functional diagram | NTS | protected rail supply, local Q1, S1/S2, UID, GMSL2 and MAX96724 | release KiCad circuit and Tachyon driver |
| S09 SerDes/Particle brick | NTS | MAX96724-to-Tachyon CSI and optional M1 external placement | carrier and OS integration |
| S10 Husbandry interference | NTS | no metal in wet volume, molt keep-out, vents, door and drain | seals, airflow, nymph tests |
| S11 Detail blow-ups | NTS | pogo bore, wipe/dock, spring pocket, FPC relief, magnet and splice | every tolerance marked TARGET/UNVERIFIED |

## Release-blocking validation

- Select and source the exact Particle-supported IMX519 module revision; then import its vendor STEP together with Particle Tachyon and selected spring-contact models.
- Regenerate true-scale orthographic and section sheets from released CAD; keep concept sheets NTS.
- Close the 100 ohm V-dock channel, including B27 and B50, using field-solver/S-parameters, then pass 3/6 Gbps eye and BER testing.
- Capture a real KiCad circuit before calling S08 an electrical schematic.
- Prove S1/S2/Q1 power-off-before-motion sequencing under the fastest possible pinch and binder release.
- Run temperature-rise and fuse-coordination tests at the target rail current.
- Print cassette, slide, pogo-bore, latch, and block-joint coupons before full parts.
- Perform wet-volume, nymph-gap, screen-sag, door-swing, and molt-zone inspection before introducing an animal.

## Primary technical sources checked 2026-08-20

- [Particle Tachyon datasheet](https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/)
- [Particle Tachyon camera documentation](https://developer.particle.io/tachyon/device-details/cameras)
- [Particle M1 enclosure datasheet](https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/)
- [Analog Devices MAX96717](https://www.analog.com/en/products/max96717.html)
- [Analog Devices MAX96724](https://www.analog.com/en/products/max96724.html)

No exact camera-module SKU, spring-contact series, B50 connector, or rail launch
is selected in working draft B.
