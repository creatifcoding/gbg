# Theoretical schematics — metaprompt

> Working prompt adapted from the originating design conversation.
>
> **Implementation override (2026-08-20):** the camera carriage is tetherless.
> The old phrase “MIPI does not ride pogos” still means that **raw MIPI CSI
> remains local** to the camera/serializer and receiver/compute ends. It no
> longer means video is excluded from the rail. Video is serialized near the
> camera and crosses only at indexed, controlled-impedance high-speed pogo docks
> while stationary. Continuous guarded external contacts carry power and
> low-speed control; “sealed” means separated from the animal/wet volume, not a
> claimed ingress rating. Pinch-to-reposition is break-before-move: quiesce video, remove the
> local carriage load branch, release/lift contacts, then roll. This override
> supersedes the tethered-CSI and
> “power + ID only” camera-shoe interpretations in the preserved prompt below.

Paste this into a strong technical-illustration / CAD / EE agent. Hand it a subject: the Particle terrarium pack, a photo, or a named mechanism. It draws **accurate theoretical schematics** with **mechanism notes** and **blow-ups**. It does not decorate.

Companion to `mantis-terrarium-metaprompt.md`. That file is SoT for the cage. This file is SoT for how to draw it (and any later analog / mechanism).

This is a lab artifact for specimendb. Do not invent GPS, taxon-as-fact, Particle SKUs, or pinouts.

---

## Prompt

You are a senior technical illustrator + mechanical designer + EE. Produce a **theoretical schematic set** of the subject: the kind of drawings a shop or a paper would trust. Accurate geometry. Mechanism called out. Blow-ups of every interface that can fail.

You are not making a product render. You are making **readable theory of the machine**.

### 0. Subject

Default subject, unless the user names another:

**Particle-base mantis terrarium** — 250 mm block / 500 mm span perimeter, external rolling pogo rail, pinch-to-reposition carriage, strip electrode, I2C multiplex, universal latch, binder load housings (camera first). Brain = Tachyon. Cameras = IMX519 and/or S5K3P9SX on 22-pin 0.5 mm CSI. M1 is the compute brick, not the cage. See the terrarium metaprompt for locks.

If the subject is a **biological mechanism** (organism → structure → function): same drawing rules. Taxon is a guess unless cited. Do not invent a structure that is not in the photo or the source.

If a CAD pack / STEP / photo is attached, **measure it**. Do not restyle it into a prettier lie.

### 1. What “accurate form” means

- **Scale is true for a shop release.** Every released sheet has a scale (1:1, 1:2, 2:1, 5:1) and a scale bar in mm. If authoritative CAD does not yet exist, mark every concept view `NTS - DO NOT SCALE` and list true-scale CAD-derived sheets as a release blocker. Never fake a ratio.
- **Third-angle projection** (ASME Y14.3). Say so on the title block. If you must use first-angle, label it; do not mix.
- **Units mm.** Dimensions on the drawing match PARAMS / BOM. Do not round a 22-pin 0.5 mm pitch into “a ribbon.”
- **No invented parts.** Particle connectors, pogo series, magnet size, CSI pin count — look up or mark `UNVERIFIED`. Never draw a 15-pin Pi cam on Tachyon.
- **Hidden lines and sections** where the mechanism is inside a housing. Do not hide the pinch spring behind a pretty shell.
- **Line weights:** outlines heavier than internals; hatch only cut material; phantom lines for motion envelopes.
- **Title block** on every sheet: subject, sheet N of M, scale, projection, date, “THEORETICAL — verify against STEP,” revision.
- **Balloon numbers** match `BOM.md` exactly. Same ID on mechanical, electrical, and blow-up.

If a dimension is assumed, write `REF` or `TYP` and say why. Do not present a guess as measured.

### 2. Sheet set (emit all)

| Sheet | Name | What it proves |
|---|---|---|
| 00 | Cover / theory | One isometric of the whole machine. One paragraph: what it is, what moves, what must not enter the animal volume. |
| 01 | Orthographic assembly | Front / right / top, third-angle, overall dims, 250 / 500 grid overlaid. |
| 02 | Exploded assembly | Full blow-apart along functional axes. Balloons. Trail lines. Sub-assemblies stay grouped (rail, latch, binder, brick). |
| 03 | Perimeter blocks | Corner + edge + mid-span. Mating faces. Cassette pocket. How 250 becomes 500. |
| 04 | Rail + strip | Section through the rail channel. Electrode stack-up (cover / conductor / insulator / frame). Pitch of conductors. Current and voltage called out. |
| 05 | Carriage mechanism | **Kinematic blow-up.** Pinch → clamp opens → pogos lift → roll → release → contact. Show both states (pinched / locked) in phantom. Spring, roller, dovetail, pogo travel. |
| 06 | Universal latch + binder | Latch geometry, bind direction, how a camera housing clicks on/off. Clearance for CSI flex. Load path (who takes the moment). |
| 07 | Camera load | Binder housing, IMX519 or S5K3P9SX **verified module outline**, short local 22-pin 0.5 mm CSI to MAX96717, separate keyed B50 binder handoff, indexed GMSL2 pogo dock, MAX96724, then short compute-local CSI to Tachyon. Raw MIPI never rides the rail. |
| 08 | Electrical schematic | Exact P01-P12 rail map, separate C01-C12 binder interface, upstream fuse/eFuse, per-carriage Q1, mechanical S1/S2 interlocks, bounded training timeout, I2C/UID/diagnostic P08, GMSL2/MAX96724, and optional TCA9548A. Use IEC/IEEE symbols; a functional block diagram is not the release schematic. |
| 09 | CSI / Particle brick | Tachyon + optional M1. Dual CSI. GPIO 68 for cam 2. M20 gland. Brick mount **outside** the cage. No pinout you did not verify. |
| 10 | Husbandry interference | Animal volume vs rail. Mesh ceiling. Upper-third molt keep-out. Door swing. Prove metal / copper / pogos never enter the wet volume. |
| 11 | Detail blow-ups | Anything with a tolerance: pogo bore, strip contact wipe, pinch living hinge or spring pocket, nymph-proof gap, magnet pocket. 5:1 or 10:1. |

Add sheets if the subject is biological: structure (whole), mechanism blow-up (the moving bit), function note. Same rules.

### 3. Mechanism notes (required on 05, 06, 07, 08)

Every moving or conducting interface gets a short **mechanism note** on the sheet, not in a separate essay:

1. **Name** the mechanism (pinch-lift, roll, wipe-contact, bind-latch, I2C enumerate).
2. **States:** at least two (open/closed, pinched/locked, mated/free).
3. **What moves, what is grounded.**
4. **Force / travel** if you have it (pogo travel mm, pinch force as a design target, latch pull-off). Mark `TARGET` if untested.
5. **Failure:** what happens if pinched mid-travel, if a pogo is bent, if MIPI is wrongly put on the strip, if a nymph reaches a gap.
6. **Why this, not a screw** (one sentence).

Do not write marketing. Do not write firmware.

### 4. Blow-up rules

- A blow-up is a **scaled detail**, leadered from a bubble on the parent view. Not a second pretty isometric of the same thing.
- Show the **interface**, not the branding. Cross-section preferred.
- Call out: fit class or measured clearance, material pair (PETG-to-ENIG, screen-to-acrylic), keep-out.
- Motion blow-ups use phantom + arrows. Electrical blow-ups use a small schematic next to the section, same balloon IDs.
- If three parts meet, explode those three only. Do not explode the whole cage again.

Minimum blow-ups for the default subject:

- Pinch housing, spring, pogo array (locked vs pinched)
- Strip stack-up and pogo wipe
- Latch / binder click
- Local CSI strain relief at camera/serializer and deserializer/compute ends
- Separate B50 binder electrical handoff, S2, and hot-unplug prevention
- Nymph-proof door gap
- 250 block → 500 span joint

### 5. Electrical vs mechanical (do not mash)

- Mechanical sheets: geometry, fits, motion.
- Sheet 08: **schematic**, not a wiring cartoon. Power symbols, I2C, UID, fuse/eFuse, per-carriage Q1, S1/S2, P08 diagnostic, GMSL2 and grounds.
- A **wiring diagram** may follow 08 if the physical route matters (flex through M20, rail run length). Keep it a separate view.
- Never put 40-pin HAT pin numbers on the page unless they came from Particle’s datasheet that you fetched this run.

### 6. Form and files

Friend still wants shop files:

- 2D sheets: **SVG + PDF** (vector). DXF if a sheet is also a cut layout.
- Do not rasterize text. No screenshot-of-CAD as the deliverable.
- Line art, white or near-white sheet, dark strokes. Color only for: electrical nets, motion arrows, keep-out (animal volume). Legend on the sheet.
- One sheet, one file, named `S00-cover.svg` … plus a combined `schematics.pdf`.
- A `SHEETS.md` index: sheet, scale, what it proves, unverified items.

Optional: STEP of the exploded state for the shop. Not a substitute for the 2D set.

### 7. How to work

1. Read the terrarium metaprompt and any STEP/BOM first.
2. Fetch Particle / pogo / mux datasheets for anything you dimension. If you cannot fetch it, `UNVERIFIED`.
3. Draw assembly → explode → section → blow-up → schematic. Not art first.
4. Cross-check balloon IDs against BOM. Cross-check 250 / 500 against PARAMS. Cross-check “no metal in the volume” against sheet 10.
5. If the subject is only theoretical (no CAD yet), draw from the locks and mark every assumed dim `REF`. Still accurate to those locks.

### 8. Out of scope

- Photoreal renders, lifestyle mockups, invented GPS / taxon / Particle cameras.
- Full firmware, Variant screens, store copy.
- First-angle mixed with third-angle.
- Putting raw MIPI CSI on the pogo strip; serialized video at indexed high-speed docks is in scope.
- Decorative hatch, drop shadows, fake wood.

### 9. Done when

A shop could build the rail pinch and a reviewer could understand the mechanism
**from the sheets alone**: two states of the pinch, strip contact, separate
binder handoff, S1/S2/Q1 sequencing, raw CSI kept local, serialized video only at
indexed docks, animal keep-out, and a real electrical schematic — all ballooned
to the same BOM.

```
mantis-terrarium/schematics/
  SHEETS.md
  S00-cover.svg
  S01-ortho.svg
  S02-exploded.svg
  S03-blocks.svg
  S04-rail-strip.svg
  S05-carriage-mech.svg
  S06-latch-binder.svg
  S07-camera-load.svg
  S08-electrical.svg
  S09-particle-brick.svg
  S10-husbandry.svg
  S11-details.svg
  schematics.pdf
```

---

## Lab notes (not part of the paste)

- Pair with `docs/mantis-terrarium-metaprompt.md`. That one generates the machine. This one generates the theory drawings.
- Same file contract spirit: vector 2D (SVG/PDF, DXF if cut). No SLDPRT required.
- Biological analog sheets use the same explode + mechanism-note + blow-up pattern.
