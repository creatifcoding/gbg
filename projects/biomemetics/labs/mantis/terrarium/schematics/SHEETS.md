# Schematic index — working draft B / issue 41

All sheets are A3 landscape, millimetres, third-angle where physical projection
applies, and carry `THEORETICAL - VERIFY AGAINST STEP / FIRST ARTICLE` in the
title block. Every working-draft view is `NTS - DO NOT SCALE`; numeric
dimensions are annotations measured from draft CAD/EE or locked contracts, not
shop-scale print ratios.

Revision `B-41`. Sole implementer for [gbg#41](https://github.com/creatifcoding/gbg/issues/41).
Write set: this directory (SVG + PDF). Never merge.

## Base recorded this run

| Ref | SHA / note |
|---|---|
| Preferred base | `cursor/mantis-cad-02-carriage-9635` |
| Base SHA | `cdd523c55a630962c399a812c9347be6f7fb9334` |
| Why this base | Carriage/binder solids (#29) plus inherited theoretical sheets. Frame/rail/B20 live on sibling PR 34. |
| Lab merge-base | `feat/mantis-biomemetics-lab` @ `1e6683272e4e15d50dd90b60fd3f7c0f3dd5bbb3` |
| Lab tip (not used) | `e435400442ce4fe099073ebd0e384d12a3aca09e` — later KICAD-PLAN manifest fix; no #29 geometry |
| Operator waiver | Attested CAD-02 model recorded in `cad/src/carriage/MODEL-ATTESTATION.md`. This drawing pass follows that waiver. |

## Measured sources (read-only)

| Issue | PR | SHA | What was measured |
|---|---:|---|---|
| #28 CAD-01 | 34 | `fe8f875a80b37a1003f05f3a0190fbe2f0417842` | Unique-part OCCT bboxes: B01 24 cube; B02 250×24×24; B03 22×24×24; B04 250×5.2×12; B10 250×250×6; B18 250/500×38×16; B20 −8..250 / −8..250 / 0..500; B51 8×38×17.5; assembly −43..258 / −43..250 / −8..508. Rail offset 5, B52 lip 1.5, slot 0.4, land t 0.2, dock pad 18. |
| #29 CAD-02 | 36 | `cdd523c55a630962c399a812c9347be6f7fb9334` | B22 60×42×28; B23 8×12×22; B24 36×32×6; B28 24×14×10; B29 40×36×22; B50 18×28×4 key 4. Pinch `q` 0 / 1.0 / 2.2 / 4.0 / 5.0 TARGET. Lift throw 2.2, clearance 1.8 CALCULATED. Binder `r` 1.0 / 2.0 / 3.5 TARGET. Camera keep-out 32 and CSI keep-out 12 are UNVERIFIED envelopes, not a SKU. |
| #23 EE-01 | 37 | `750872f4c10317a0e9f9900501882968531d332d` | P01–P12 / C01–C12 net names. No camera SKU. No B27/B50 series. CSI pin photos stay in the KiCad library; **this set does not reprint pin numbers**. |
| #24 EE-02 | 38 | `2324e7e521a306e5f9605c04e08a4223b7c77212` | `net-map.json` nodes VIN_RAIL / VIN_FUSED / VIN_SHARED / INTERLOCK_OK = S1 AND S2 / Q1_EN never from P08. Parts remain UNVERIFIED envelopes. |
| #25 EE-03 | 39 | `977b272a3e32ed9e9eda7a1b44b545770352c972` | camera-tx / carriage / rail-rx partition. Raw MIPI local. GMSL on P09–P12 / C09–C12 only. |
| #26 EE-04 | 40 | `a9918b32ebac41b03f0ba55fd189c73bc7df05e7` | Coupon list (2x-thru, B27-only, B50-only, full channel). `LAB COUPON — NOT FOR ANIMAL USE`. |

CAD-02 does **not admit** PR 34 STEP. Sheets cite CAD-01 bboxes as draft-measured geometry with provenance, not as a released parent frame.

## Sheet claims

| Sheet | Scale | Claim illustrated / review question | Principal unverified items |
|---|---|---|---|
| S00 Cover / theory | NTS | Exterior rail/brick and protected animal boundary; measured-source SHAs | all custom first-article geometry |
| S01 Orthographic assembly | NTS | 250 × 250 × 500 envelope, third-angle, CAD-01 assembly bbox, molt datum | finished joint and gasket closure |
| S02 Exploded assembly | NTS | CAD-01 unique parts grouped with CAD-02 carriage/binder | fastener and retainer selections |
| S03 Perimeter blocks | NTS | CAD-01 B01/B02/B03 bboxes, 250-to-500 joint, cassette 3.20 TARGET, B51 | block section, groove, coupler, end-stop PN |
| S04 Rail + strip | NTS | 38×16 channel, B20 barrier, 12-contact split, V-dock pitch 125 CALCULATED | SI geometry and contact series |
| S05 Carriage mechanism | NTS | CAD-02 five-state pinch, two-stage pawls, MIPI not on pogos | spring, pogo series, S1 switch PN, forces |
| S06 Universal latch + binder | NTS | B28/B29/B50 envelopes, `r` travels, release pin, S2 | connector, pull-off, wear key, timing |
| S07 Camera SerDes load | NTS | Local MIPI → MAX96717 → B50 → pogo GMSL2; no camera SKU outline | carrier PCB, FPC, binder thermals |
| S08 Electrical/video diagram | NTS | EE-24 protected rail, S1/S2/Q1, UID, GMSL2. **Not a release schematic.** | KiCad circuit, Tachyon driver, MPNs |
| S09 SerDes/Particle brick | NTS | Tachyon 85×56×18.5 and M1 121×220×69 from datasheets this run; GPIO 68 | carrier, OS integration, CSI pinout (not drawn) |
| S10 Husbandry interference | NTS | **B20 keep-out** from CAD-01 bbox; no metal in wet volume; molt; door; drain | seals, airflow, nymph tests |
| S11 Detail blow-ups | NTS | pogo travel, wipe/dock, spring pocket, CSI keep-out, magnet, splice | every tolerance marked TARGET/UNVERIFIED |

## Look reference (screenshots)

`docs/variant` screenshots were requested if they had already landed on another
PR. As of this run they are **absent** on PRs 32–40. See
[`LOOK-REFERENCE.md`](LOOK-REFERENCE.md). Screenshots are look reference only
and are never dimensional authority.

## Vendor docs fetched 2026-08-20

- [Particle Tachyon datasheet](https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/) — 85 × 56 × 18.5 mm
- [Particle Tachyon cameras](https://developer.particle.io/tachyon/device-details/cameras) — 22-pin 0.5 mm CSI; IMX519 AF and S5K3P9SX listed; GPIO 68; **no pin table copied onto these sheets**
- [Particle M1 enclosure](https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/) — M1ENCLEA 121 × 220 × 69 mm
- Analog Devices MAX96717 / MAX96724 family capability only; suffix UNVERIFIED

## Release-blocking validation

- Select and source the exact Particle-supported camera module revision; then import vendor STEP together with Tachyon and selected spring-contact models.
- Regenerate true-scale orthographic and section sheets from released CAD; keep concept sheets NTS.
- Close the 100 ohm V-dock channel, including B27 and B50, using field-solver/S-parameters, then pass 3/6 Gbps eye and BER testing.
- Capture a real KiCad circuit before calling S08 an electrical schematic.
- Prove S1/S2/Q1 power-off-before-motion sequencing under the fastest possible pinch and binder release.
- Print cassette, slide, pogo-bore, latch, and block-joint coupons before full parts.
- Perform wet-volume, nymph-gap, screen-sag, door-swing, and molt-zone inspection before introducing an animal.

## Rebuild

```text
python3 terrarium/schematics/generate.py
python3 terrarium/schematics/build_pdf.py
python3 terrarium/schematics/export_hitl.py
```

Inkscape is required for the combined PDF and for HITL PNG rasters. There is no raster fallback for the shop PDF. HITL PNGs are LOOK/THEORY screenshots for readability; see `HITL.md`.
The sibling generator `terrarium/cad/generate_schematics.py` is outside this
write set and is not the #41 source.
