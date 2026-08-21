# Schematic index — projected draft B / issue 41

All sheets are A3 landscape, millimetres, third-angle where physical projection
applies. Title block remains `DRAFT CAD` / `THEORETICAL` because this is **not**
shop-release (#31) and **not** first-article. The DRAFT shop index lives in
`terrarium/shop/` (hashed STEP/SVG/PNG/PDF only; SHOP-RELEASE is not claimed).

Physical views are OCCT `HLRBRep` hidden-line projections of STEP solids at a
stated scale with a millimetre scale bar. Diagram-only views stay `NTS - DO NOT SCALE`.

Revision `B-41P`. Stacked onto `feat/mantis-biomemetics-lab` (PR 20): PR 34 and
PR 36 are already merged there; PR 58 merged into PR 45; this tree is that
chain plus a DRAFT shop index. Carriage/binder STEP is the existing PR 58 OCCT
export. Do not regenerate STEP for the index.

## Base recorded this run

| Ref | SHA / note |
|---|---|
| Lab integration | `feat/mantis-biomemetics-lab` @ `e3ef24199ae1593becc6d2de2c1208cfda125eda` |
| CAD-02 merge on lab | PR 36 @ `c5ad7648cb160a4391238ccd57983970d6132225` |
| CAD-01 STEP (unchanged blobs) | `fe8f875a80b37a1003f05f3a0190fbe2f0417842` PR 34 / #28 |
| Operator waiver | Attested CAD-02 model in `cad/src/carriage/MODEL-ATTESTATION.md` |

CAD-02 still does **not admit** PR 34 STEP as a released parent. Frame/rail/B20
views are labeled **DRAFT-MEASURED** from that SHA.

## Sheet claims

| Sheet | Scale | Kind | What is on the sheet |
|---|---|---|---|
| S00 Cover / theory | 1:8 | **Projected** | PR 34 assembly isometric HLR + theory notes |
| S01 Orthographic assembly | 1:5 | **Projected** | Third-angle HLR of PR 34 assembly STEP + B20 keep-out |
| S02 Exploded assembly | AS NOTED | **Projected** (grouped unique parts) | Unique-part HLR, not one fused explode |
| S03 Perimeter blocks | 2:1 / 1:2 | **Projected** | B01/B02/B03/B51/B04 unique-part HLR |
| S04 Rail + strip | 2:1 / 1:2 | **Projected** + diagram overlay | B18 section cut HLR; P01–P12 overlay is a diagram (no B19 STEP) |
| S05 Carriage mechanism | 2:1 / 5:1 | **Projected** | CAD-02 OCCT posed q=0 / q=5 + B27/B25 |
| S06 Universal latch + binder | 2:1 / 5:1 | **Projected** | B28/B29/B50/B34 unique-part HLR |
| S07 Camera SerDes load | 2:1 / DIAGRAM | **Mixed** | B29/B50 HLR; camera SKU remains UNVERIFIED diagram |
| S08 Electrical/video diagram | NTS | **Diagram** | EE-24 net-map review diagram. Not a release schematic |
| S09 SerDes/Particle brick | NTS | **Diagram** (+ 1:8 mount HLR) | Tachyon/M1 datasheet envelopes. No brick STEP |
| S10 Husbandry interference | 1:5 | **Projected** | B20 keep-out HLR, assembly, door, vents |
| S11 Detail blow-ups | 5:1 / NTS | **Mixed** | B27/B25/B34/B03 projected; wipe + magnet stay diagrams |

Failed projections this run: **none**. Carriage/binder STEP export via OCCT (OCP)
succeeded; FreeCADCmd was not on PATH.

## Tooling honesty

- Flake pins Nix `freecad`. This environment had no `freecad` apt candidate and
  no Nix store. Projections use `cadquery-ocp` `HLRBRep` (same OpenCASCADE hidden-line
  kernel family). Carriage STEP is OCCT from CAD-02 `SolidSpec` CSG, not hand-drawn.
- Inkscape builds the vector PDF and HITL PNGs. No raster fallback for the shop PDF.

## Rebuild

From `projects/biomemetics/labs/mantis`:

```text
python3 terrarium/schematics/export_carriage_step.py
python3 terrarium/schematics/project_step.py
python3 terrarium/schematics/generate.py
python3 terrarium/schematics/build_pdf.py
python3 terrarium/schematics/export_hitl.py
```

`export_carriage_step.py` needs `cadquery-ocp`. Inkscape is required for PDF and HITL.
HITL Look is visual aesthetic only. A PNG does not prove geometry or safety. See `HITL.md`.

## Out of scope / remaining unknowns

- Not #31 SHOP-RELEASE. Not first-article.
- S08 is a review diagram; KiCad on #24/#25 remains circuit authority.
- B27/B50 series, S1/S2/Q1 MPNs, camera module SKU, and SI qualification are UNVERIFIED.
- Do not use this set as animal-side copper/pogo/mesh permission.
