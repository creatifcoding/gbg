# Source register — working draft B

Checked 2026-08-20. A source supports only the bounded claim listed here. It
does not validate the custom rail, carrier electronics, animal safety, or a
physical fit.

## Primary technical sources

| Source | Bounded use in this project | Explicit limit |
| --- | --- | --- |
| [Particle Tachyon datasheet](https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/) | Board dimensions 85 × 56 × 18.5 mm; two accessible four-lane CSI interfaces; Qwiic is 3.3 V I2C; USB-C and battery power options | Does not establish MAX96724 driver/device-tree support or a rail power budget |
| [Particle Tachyon camera documentation](https://developer.particle.io/tachyon/device-details/cameras) | Sony IMX519 autofocus and Samsung S5K3P9SX are supported sensor modules; connectors are 22-position, 0.5 mm pitch; raw Raspberry Pi camera compatibility must not be assumed; GPIO 68 selects camera mode on the shared DSI/CSI connector | Does not identify a durable orderable IMX519 SKU or provide this binder's mechanical outline |
| [Particle M1 enclosure datasheet](https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/) | M1ENCLEA identity, 121 × 220 × 69 mm envelope, IP67 claim, two M20 bulkhead holes, and carrier compatibility | Does not validate the custom external terrarium mount or moving rail |
| [Analog Devices MAX96717 product page and Rev. 7 datasheet](https://www.analog.com/en/products/max96717.html) | Four-lane CSI-2 input, GMSL2 serializer role, 3/6 Gbps forward and 187.5 Mbps reverse link capabilities | Device capability only; camera carrier, power tree, thermal design, and pogo channel are unverified |
| [Analog Devices MAX96724 product page and Rev. 5 datasheet](https://www.analog.com/en/products/max96724.html) | Four independently configurable GMSL inputs, CSI-2 outputs, 3/6 Gbps links, and 50 Ω coax or 100 Ω STP channel options | Does not qualify a spring-contact dock; ADI's GMSL channel specification and a measured coupon remain required |
| [Texas Instruments TCA9548A product page and Rev. H datasheet](https://www.ti.com/product/TCA9548A) | Candidate eight-channel bidirectional I2C switch with reset and hot-insertion support | Optional device capability only; no carrier, address map, or need is released |

The exact B36 camera module is intentionally not selected. `B0371` survives
only in the immutable historical Release A ZIP; current sources treat the
module SKU, revision, outline, and connector orientation as `UNVERIFIED`.

## Husbandry sources

These are keeper/veterinary guidance, not taxonomic evidence. Species-specific
requirements override general guidance after a real animal is observed and
reviewed.

| Source | Bounded use in this project |
| --- | --- |
| [PanTerra Pets general mantis care](https://www.panterrapets.com/pages/care) | General 3× body-length height, 2× width, individual housing, grippable ceiling, and clear molt space |
| [Royal Veterinary Center praying mantis care sheet](https://royalveterinarycenter.com/en/care-sheets/praying-mantis) | Rough/mesh ceiling, airflow, and species-dependent temperature/humidity framing |
| [Mantis Mayhem housing guidance](https://mantismayhem.com/pages/praying-mantis-housing) | Conservative avoidance of metal mesh because it may damage delicate feet |

The 0.8 mm screen aperture and 0.5 mm visible-gap target are design locks, not
published biological measurements. They require prey/instar escape testing and
an inspection of the actual screen, seams, door, drain, and glands.
