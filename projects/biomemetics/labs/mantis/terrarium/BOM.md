# Provisional BOM / balloon register

Quantities are first-tower estimates. No item marked `UNVERIFIED` may be released to fabrication without its selected part drawing or test evidence.

| ID | Item | Qty | Status / note |
|---|---|---:|---|
| B01 | PETG/ASA corner block | 8 | REF |
| B02 | 250 mm edge member | 16 | REF |
| B03 | 250-to-500 splice/alignment block | 4 | REF |
| B04 | cassette retainer/gasket carrier | set | REF |
| B05 | 3 mm cast-acrylic view cassette | set | REF |
| B06 | 3 mm cast-acrylic front door | 1 | REF |
| B07 | printed door labyrinth surround | 1 | REF |
| B08 | external polymer hinge set | 2 | REF |
| B09 | independent mechanical door latch | 2 | LOCK count / REF design |
| B10 | two-piece ceiling mesh frame | 1 | REF |
| B11 | <=0.8 mm plastic/fiberglass/polyester screen | set | LOCK constraint |
| B12 | low-intake vent cassette | 1 | REF |
| B13 | high-exhaust vent cassette | 1 | REF |
| B14 | perforated false bottom | 1 | REF |
| B15 | 20-30 mm drain tray | 1 | REF |
| B16 | drain plug plus insect baffle | 1 | REF |
| B17 | removable perch socket/cap | set | REF |
| B18 | external 38 mm hybrid rail channel | route set | REF |
| B19 | P01-P08 continuous electrode flex plus V-dock pads | route set | UNVERIFIED stack-up |
| B20 | continuous structural rail wall / wet-side barrier | route set | REF; animal-volume boundary, not an insulating film over contacts |
| B21 | rail splice and corner electrical junction | set | REF; carriage does not turn corner |
| B22 | carriage outer shell | 1+ | REF |
| B23 | opposed pinch levers and cams | 2/carriage | REF |
| B24 | split floating contact carrier | 1/carriage | REF; HSD cell vertically seats |
| B25 | normally locked carriage spring | 1/carriage | UNVERIFIED rate/PN |
| B26 | polymer roller and axle set | 4/carriage | UNVERIFIED PN |
| B27 | 12-position spring contact array | 1/carriage | power pins and HSD cell UNVERIFIED |
| B28 | universal latch shoe | 1/carriage | REF |
| B29 | camera SerDes binder housing | 1 | REF |
| B30 | temperature/RH binder housing | 1 | REF |
| B31 | LED-bar binder housing | 1 | REF |
| B32 | mist-nozzle binder housing | 1 | REF |
| B33 | blank/cap binder housing | 1 | REF |
| B34 | internal camera-to-serializer FPC clamp | 1 | REF |
| B35 | external Tachyon/M1 brick mount | 1 | UNVERIFIED geometry |
| B36 | Particle-supported Sony IMX519 autofocus camera module | 1 | Exact orderable module, revision, outline, connector orientation, and STEP `UNVERIFIED`; legacy B0371 is not a release selection |
| B37 | internal camera FPC, exact assembly | 1 | UNVERIFIED length/orientation |
| B38 | M3 fasteners and heat-set inserts | set | UNVERIFIED selected PN/pocket |
| B39 | optional captured alignment magnets | set | UNVERIFIED; never primary latch |
| B40 | gasket stock | set | UNVERIFIED material/compression |
| B41 | M20 plugs/glands for M1 nonmoving cables | set | verified M1 feature; no moving CSI tether |
| B42 | Particle Tachyon | 1 | Vendor-documented 85 x 56 x 18.5 mm; exact revision CAD still required |
| B43 | Particle M1 enclosure | 0-1 | M1ENCLEA; vendor-documented 121 x 220 x 69 mm |
| B44 | fused rail power tap | 1 | 2 A TARGET, final budget UNVERIFIED |
| B45 | Analog Devices MAX96717 camera serializer carrier | 1 | device verified; carrier design UNVERIFIED |
| B46 | Analog Devices MAX96724 quad deserializer carrier | 1 | device verified; Tachyon integration UNVERIFIED |
| B47 | four 100 ohm V-dock point-to-point flex/STP channels | 1 set | SI stack and routing UNVERIFIED |
| B48 | local supervisor, normally-open S1 carriage-mate switch, normally-open S2 binder-mate switch, per-carriage Q1 current-limited load switch, discharge, and bus isolation | 1/carriage | exact parts, mate order, timeout, polarity, and timing `UNVERIFIED`; P08 is not safety authority |
| B49 | optional TCA9548A I2C switch carrier | 0-1 | device documented; address, reset, hot-insertion behavior, carrier, and need remain `UNVERIFIED` |
| B50 | separate keyed 12-net carriage-to-binder connector/contact system | 1/carriage + 1/binder | `C01`-`C12` mirror required nets; series, pin geometry, controlled-impedance launch, mate order, current, hot-unplug behavior, and durability `UNVERIFIED` |
| B51 | captive rail route end stop with deliberate M3 service removal | 2/independent route | geometry, fastener retention, drop/handling protocol, and proof load `UNVERIFIED` |
| B52 | external rail access-slot guard / labyrinth wiper | route set | leaves ENIG lands contactable only inside captive external carriage envelope; environmental ingress rating `UNVERIFIED`, not hermetic |

The requested rolling rail and binder handoff are custom; Particle does not sell
B18-B29 or B44-B52.
