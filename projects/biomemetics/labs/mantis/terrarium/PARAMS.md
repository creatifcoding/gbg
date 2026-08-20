# PARAMS - working draft B

| Parameter | Value | Status |
|---|---:|---|
| exterior width / depth / height | 250 / 250 / 500 mm | LOCK |
| module pitch / first span | 250 / 500 mm | LOCK |
| conservative adult body | 80 mm | REF; no photo |
| minimum husbandry W / D / H | 160 / 160 / 240 mm | CALCULATED |
| frame band | 24 mm | REF |
| nominal clear W / D / H | 202 / 202 / 427 mm | CALCULATED before detailed gasket closure |
| false-bottom tray | 25 mm | REF inside 20-30 mm LOCK range |
| upper-third clear height | at least 142 mm | CALCULATED |
| acrylic face stock | 3.00 mm | LOCK |
| cassette seat | stock + 0.20 mm | TARGET |
| nymph-visible door gap | <=0.50 mm plus labyrinth | TARGET |
| screen aperture | <=0.80 mm, nonmetal | LOCK |
| rail envelope | 38 W x 16 H mm | REF |
| carriage envelope | 60 W x 42 D x 28 H mm | REF |
| mechanical detent pitch | 25 mm | REF; detents optional in source prompt |
| low-speed continuous lands | P01-P08 | ARCH LOCK B-DRAFT |
| high-speed dock lands | P09-P12 = G / HSD+ / HSD- / G | ARCH LOCK B-DRAFT |
| binder electrical handoff | separate B50, logical C01-C12 mirror | ARCH LOCK; physical pinout UNVERIFIED |
| spring-contact pitch | 2.54 mm nominal | TARGET; HSD insert may force change |
| nominal rail VIN | 12 V DC | TARGET from separate upstream DC/DC |
| rail fuse | 2 A | TARGET pending load budget |
| rail I2C | 3.3 V, 100 kHz | TARGET |
| GMSL2 forward/reverse | 3 or 6 Gbps / 187.5 Mbps | VERIFIED device capability; rail channel unverified |
| GMSL2 differential channel | 100 ohm point-to-point | TARGET |
| high-speed docks per 500 mm rail | 4 | REF architecture |
| pogo working compression | 0.60 mm | TARGET |
| released lift above lands | >=1.20 mm | TARGET |
| pinch input / force | 5 mm / 15-25 N | TARGET |
| carriage retention | >=25 N axial, 0.5 N-m moment | TARGET |
| camera binder pull-off | >=40 N | TARGET |
| power enable interlocks | S1 carriage AND S2 binder, both normally open | ARCH LOCK; parts/timing UNVERIFIED |

The camera carriage may mechanically park at 25 mm reference detents, but video
is available only at designated V1-V4 high-speed docks in working draft B. The
active MAX96724 input identifies the dock. The load UID identifies the load,
not its position.
