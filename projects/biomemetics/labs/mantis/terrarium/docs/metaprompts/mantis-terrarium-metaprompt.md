# Mantis terrarium — metaprompt (Particle frame)

> Working prompt adapted from the originating design conversation.
>
> **Implementation override (2026-08-20):** the camera carriage is tetherless.
> The old phrase “MIPI does not ride pogos” still means that **raw MIPI CSI
> remains local** to the camera/serializer and receiver/compute ends. Video is
> serialized near the camera and crosses the rail only at indexed,
> controlled-impedance high-speed pogo docks while stationary. Continuous
> guarded external contacts carry power and low-speed control; “sealed” means
> separated from the animal/wet volume, not a claimed ingress rating.
> Pinch-to-reposition is
> break-before-move: quiesce video, remove the local carriage load branch,
> release/lift contacts, then roll. Protected VIN lands remain inaccessible in
> the guarded external channel behind the wet-side barrier. This supersedes tethered camera flex, “pogos
> carry power + ID only,” and “video excluded from the rail” interpretations. The
> indexed high-speed channel remains theoretical until SI, eye/BER, bounce, ESD,
> thermal, contamination, and wear evidence passes review.

Paste this into a strong CAD / EE / design agent. Hand it photos of the live mantis. It infers species. It does not wait for a Latin name.

This is a lab artifact for specimendb, not a catalog Specimen. Do not invent GPS, taxon-as-fact, or a new intake card unless a photo is actually dropped.

**Frame lock (2026-08-20):** the cage is Particle-based. Compute is a real Particle brick on a printed 250 / 500 perimeter. The rail is custom: rolling pogo carriages on a strip electrode, pinch-to-reposition, universal load latch. Particle does not sell this rail — design it. Do not invent Particle SKUs.

No frame photos arrived with the lock. If a later photo of extrusion / blocks shows up, match that geometry. Until then, the perimeter is printed/cut 250 mm blocks on 500 mm spans.

---

## Prompt

You are a senior product designer + mechanical engineer + EE + invertebrate husbandry tech. Design a **super-advanced modular terrarium** for one live praying mantis.

**Base platform is Particle** (https://www.particle.io/). Cameras, multifunction loads, and cloud/OTA ride Particle hardware. The cage frame is a **block perimeter** you design, innervated by a **rolling pogo-pin rail**. A friend prints on **Bambu** and cuts on a **laser or CNC router**.

You do not get a confirmed species. You get photos. That is enough.

### 0. Particle stack (ascertain, do not invent)

Use only hardware Particle actually sells or documents. Prices move; look them up.

| Role | Real part | Notes |
|---|---|---|
| Brain | **Tachyon** 5G SBC (Dragonwing QCM6490, 12 TOPS Hexagon, Pi-sized, 40-pin HAT, Qwiic 3.3 V I2C, 2× USB-C) | Dual 4-lane MIPI CSI. Store ~$349 / $399 (4/8 GB). |
| Cameras | **Sony IMX519 AF** and/or **Samsung S5K3P9SX** on Tachyon CSI | 22-pin 0.5 mm FPC. **Not** old 15-pin Pi camera cables. Pi camera modules are **not** supported (closed firmware). Dual cam: CSI1 + DSI/CSI2, GPIO 68 HIGH for second CSI. |
| Compute brick shell (optional) | **M1 Enclosure** (IP67, carrier for Tachyon/Muon/Pi-compat) | This is the **brain box**, not the animal cage. CSI flex exits via M20 glands. ~$70. |
| Multifunction / cheap node | **Muon** (M-SoM, LTE-M/Wi-Fi/BLE/GNSS, LoRaWAN on the board) or **Photon 2** | Rail MCU, sensors, mist, vents. Talks to Tachyon on the bus. |
| Cloud | Particle device cloud / OTA | Tachyon is Linux; Muon/Photon are Device OS. Do not invent a Particle “multiplex protocol.” |

Do **not** use: invented Particle cameras, Pi HQ cam as “supported,” metal mesh, copper inside the animal volume.

### 1. Infer, then size

1. From the photo(s), infer order → family → genus → species. Each rank gets a confidence (`high` / `med` / `low`) and the visual evidence.
2. Mark taxon as **guess**. Never present a binomial as fact.
3. Estimate body length now and adult length for that guess. Cite a source if you cannot read length from the photo.
4. Conservative envelope (low confidence or unknown adult):
   - small-to-mid arboreal mantis, design for **adult 8 cm**
   - interior **≥ 3× body length tall, ≥ 2× wide, ≥ 2× deep**
   - snap interior to the **250 mm module grid** (see §3). Default **250 × 250 × 500 mm** exterior module; interior after frame thickness still meets the 3× / 2× rule.
5. Solo animal. Never communal.

If the photo is not a mantis, stop.

### 2. Hard husbandry (do not violate)

- **Hang-molt:** textured or mesh **ceiling**. Smooth acrylic lids kill. **Upper third clear.**
- **No metal mesh** in the animal volume. Tarsal claws break. Ceiling/vents = plastic, fiberglass, or polyester screen, framed, replaceable.
- **Mesh aperture** nymph-safe, default **≤ 0.8 mm**. L1–L3 must be fruit-fly-proof.
- **Cross-ventilation:** low intake + high exhaust. Adjustable vent area for the inferred humidity band (temperate 40–60%, tropical 60–80%, arid 30–45%).
- **Front or side door.** Not top-opening. Dual latch. Nymph cannot walk the hinge gap.
- **Room temp** 22–26 °C. Heat-mat pass only. No forced HVAC.
- **False bottom** + drain + 20–30 mm tray. Paper towel still fits.
- **Perches** removable. No glue-in branches.
- **Wet-zone plastics:** PETG or ASA. PLA = dry jigs only.
- **No copper, no metal mesh, no pogo, no electrode strip inside the animal volume.** The rail innervates the **outside** of the perimeter blocks. Sealed channel. Animal sees plastic.
- **Escape:** every seam, magnet, gland, and rail cutout gets a nymph check.

Cite the 3× height rule and no-metal-mesh. Safer number wins.

### 3. Frame: 250 modular / 500 buildout

This is the cage frame. Particle bricks hang on it. It is not the M1 box.

- **Module pitch = 250 mm.** A block is a 250 mm edge (or 250 mm face cassette).
- **Span / buildout = 500 mm.** Long members and first adult tower are 500 mm class (two 250 blocks, or one 500 member).
- Perimeter is a **block system**: corner blocks + edge blocks + optional mid-span blocks. Faces are cassettes that drop into the blocks (view / mesh / hide / door).
- Knock-down. No welded 80/20 required. Optional adapter that *can* take 2020 later.
- First buildout: one 250 × 250 × 500 tower, front door, mesh ceiling, two vent cassettes, one camera load, one sensor load. Grow by adding 250 blocks; the rail continues.

If a later photo of a commercial frame is supplied, retarget block geometry to that photo. Do not invent a brand.

### 4. Innervated perimeter — rolling pogo rail

The frame is electrified on the **outside**.

**Rail**
- Continuous rail on at least the top front and one vertical front edge (camera + door). Prefer a full perimeter loop so any face can take a load.
- **Strip electrode** in the rail channel: power, ground, data. Gold-plated or ENIG flex / spring copper **under a cover**, not bare in the room, not inside the cage.
- **Rollable pogo carriage:** housing rides the rail on rollers or a dovetail. A **pogo array** springs down onto the strip. Carriage can travel the full span.
- **Pinch to loosen:** squeeze the housing → pogos lift / clamp opens → slide to a new station → release to lock and make contact. One hand. No tools. Nymph-proof from the inside.
- Stations every **25 mm** or continuous. Detents optional.

**Bus (multiplex — real, not invented Particle)**
- Local rail protocol is **I2C @ 3.3 V** (Tachyon Qwiic-native) plus **5–12 V power** on separate conductors.
- Working draft contact map: continuous `VIN-A`, `VIN-B`, `GND-A`, `GND-B`, `SDA`, `SCL`, `UID`, `FAULT_N/IRQ`; indexed high-speed `HSGND`, `GMSL+`, `GMSL-`, `HSGND`. The differential cell is a **100 ohm TARGET**, not a characterized result.
- Each load has a **unique I2C address** and a tiny EEPROM / ID chip so the brain can enumerate what is parked where.
- If more than ~4 I2C devices, put a **TCA9548A** (or equal) mux in a corner block. Do not invent a Particle mux chip.
- Tachyon is the I2C master. Muon or Photon 2 may sit as a rail supervisor (GPIO, mist, vents) on the same bus or UART to Tachyon.
- Write `BUS.md`: pin order, voltages, max current per rail, short-circuit, hot-plug, what happens if a carriage is pinched mid-travel.

**Universal latch + binder housings**
- The carriage has one **universal latch**. Every **load module** lives in a **binder housing** that clicks onto that latch (camera, LED, mist, sensor, unused cap).
- Latch is the same for all loads. Housing carries the function. Think “one shoe, many tools.”
- Camera load: binder housing holds the CSI module, a short strain-relieved 22-pin 0.5 mm raw-MIPI path, MAX96717 serializer, local conversion, and protection. Serialized GMSL2, power, low-speed control, and identity cross the stationary rail dock; raw MIPI never does. MAX96724 converts GMSL2 back to a short compute-local CSI path at Tachyon.
- The removable binder is a second keyed electrical interface, distinct from the rail pogo interface. Give it its own contact ID namespace, SI launches, mate-order analysis, and normally-open S2 mate interlock. Do not invent a connector series or pinout.
- Q1 switches only the local carriage load branch. It may enable only when carriage S1 and binder S2 are both fully mated, and only for a bounded training window. P08 is diagnostic, never safety authority. Binder release is mechanically blocked until `PINCH-SAFE`.
- Optional sealed interconnect: **Binder M8** (the connector brand) on wet/outdoor loads. Do not require it for v1 indoor.
- Loads to design as housings: **camera** (required), **temp+RH**, **LED bar**, **mist nozzle**, **blank/cap**. Same latch.

**Power**
- USB-C PD into Tachyon, or Tachyon + 9300 mAh pack inside the M1 brick.
- Rail VIN from a fused tap on that supply. State the fuse. No mains in the frame.

### 5. What must exist

1. 250 / 500 block perimeter + face cassettes.
2. Rolling pogo rail + pinch housing + strip electrode + `BUS.md`.
3. Universal latch + binder housings (camera first).
4. Tachyon brick mount (M1 optional) **outside** the animal volume, aimed so CSI cameras look in through a view cassette or a printed gland. Dual-cam capable.
5. Front door, feeding port, mesh ceiling, cross vents, false-bottom drain, removable perches.
6. Sensor load on the rail (air temp+RH, not the heat mat).
7. LED load and mist-boss load, capped if unpopulated.
8. Knock-down packing list.

Skip if they fight the molt zone: servo vents, load cell, decorative orchid PLA, automatic pump.

### 6. Fabrication split (friend has Bambu; also laser / router)

Friend’s contract:

> Depending on what thing, it would be STL, STEP or SLDPRT, for 3D things.
> Laser cut or Routered things would be SVG, DXF or other line drawing files.

Emit **both** sides.

**Printed (Bambu, 0.4 mm nozzle):**
- Every unique part **STL** (binary, mm) and **STEP** (AP214/AP242). STEP is the CAD original.
- **No SLDPRT** unless you actually have SolidWorks. Say so.
- Default **PETG**, 0.2 mm, 4 walls, 25% gyroid. ASA if sun/heat.
- Call out pogo bore, magnet pocket, rail dovetail, and pinch-spring tolerances with numbers. No “print and pray.”
- One part, one file.

**Cut:**
- Panels, gasket, mesh frames, electrode cover, door: **SVG and DXF** (mm).
- Layers: `cut`, `score`, `engrave`, `ignore`. Kerf default **0.15 mm**.
- Stock: 3 mm cast acrylic view, 3 or 6 mm floor. Screen is fabric in a frame — the laser does not cut window screen.

**Also:**
- `BOM.md` — Particle SKUs (Tachyon, camera module, optional M1 / Muon / Photon 2), pogos (part number, travel, current), strip stock, magnets, M3 heat-sets, screen, acrylic.
- `ASSEMBLY.md`, `PRINT.md`, `CUT.md`, `BUS.md`, `PARTICLE.md` (what is store-bought vs printed; CSI cable warning; GPIO 68 for cam 2).
- `PARAMS.md` — `pitch_mm=250`, `span_mm=500`, `body_mm`, interior W/D/H, mesh_mm, vent_area, pogo_pitch, strip_count.
- `HUSBANDRY.md` — inferred species, confidence, humidity band.
- Isometric + exploded (SVG or PDF). One drawing of the rail pinch + latch.

### 7. How to work

- Parametric first. **CadQuery or OpenSCAD.** Dumb-STL-only fails the STEP requirement.
- Look up current Particle store/docs. If a camera/SKU is not documented, do not use it.
- Electrical stays outside the cage. **Raw MIPI** does not ride the rail; only serialized video may cross a locked indexed high-speed pogo dock.
- If no photo: design the 250 × 250 × 500 envelope and list what you still need. Do not invent a species.

### 8. Out of scope

- Invented GPS, locality, or Specimen id.
- Invented Particle cameras or a Particle multiplex protocol.
- Full Device OS / Linux app (emit bus map + a short GStreamer still-capture command from Particle’s own camera docs, not a product firmware).
- Live plants required. Prey housed in the cage. Metal mesh. Copper in the wet volume. Sealed glass aquarium as the animal box.

### 9. Done when

The friend can print the 250/500 perimeter, cut the faces, snap the pogo rail on,
click a camera SerDes binder housing onto a rolling carriage, park a Tachyon
(optional M1) on the brick mount, and have a front-opening, mesh-ceiling,
cross-vented cage that enumerates loads on I2C and carries serialized video only
while safely docked — without asking what file type to use.

```
mantis-terrarium/
  README.md
  HUSBANDRY.md
  PARAMS.md
  BOM.md
  ASSEMBLY.md
  PRINT.md
  CUT.md
  BUS.md
  PARTICLE.md
  cad/
  step/
  stl/
  cut/
  drawings/
```

---

## Lab notes (not part of the paste)

- Species inferred from photo, marked guess.
- `20260819-001` is the cup arthropod, not this mantis.
- Particle = brain + cameras + cloud. Printed 250/500 blocks = the frame. Rolling pogo rail = innervation. M1 is not the terrarium.
- Friend files: STL + STEP; SVG + DXF. SLDPRT skipped.
- No frame photo was attached with “These would be the frame.” Assumed Particle bricks + the block perimeter described here.
