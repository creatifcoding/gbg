# DRAFT shop pack

This directory is a **DRAFT** index of CAD files that already exist on the
stacked chain:

`PR 34 (CAD-01 STEP) → PR 36 (CAD-02 carriage) → PR 45 (theoretical sheets) → PR 58 (projected sheets)`

onto `feat/mantis-biomemetics-lab` (PR 20).

It is **not** SHOP-RELEASE. It is **not** QUALIFIED. It is **not** first-article.
Do not order parts from it. Do not energize anything from it.

## What this pack is

A generated catalog (`manifest.json`) of STEP, SVG, PNG, and PDF plus SHA-256
and an honesty class. Classes are only:

| Class | Meaning |
| --- | --- |
| `draft-measured` | OCCT hidden-line / STEP from CAD-01 SHA `fe8f875a` (PR 34 / #28). Still draft. CAD-02 does not admit it as a released parent. |
| `theoretical` | CAD-02 carriage/binder OCCT (PR 36/58). B27 and B50 are proxies. Unverified. |
| `diagram` | Not scale geometry. S08/S09, overlays, and HITL Look rasters. |

HITL PNGs under `terrarium/schematics/hitl/` have `role: look`. A PNG is not
geometry. It does not prove scale, fit, clearance, or safety.

## What this pack is not

- Not a rebuild of STEP. Existing solids were hashed in place. FreeCADCmd was
  not on PATH; that is a recorded blocker, not a license to invent solids.
- Not a rewrite of `terrarium/MANIFEST.sha256` (ADR-003). Stacked S00–S11 hashes
  differ from that immutable draft-B baseline. That mismatch is listed, not
  papered over.
- Not KiCad. S08 is a review diagram.
- Not a camera SKU, B27/B50 series, connector pinout, or GPS record. Those stay
  UNVERIFIED. None were invented.

## Rebuild the index only

From `projects/biomemetics/labs/mantis`:

```text
python3 terrarium/shop/build_index.py
python3 terrarium/shop/build_index.py --check
```

`--check` verifies committed digests. It does not export STEP and it does not
mint `MANIFEST.sha256`.

See `ACTIVITY.md` for the stack, tooling gap, and remaining UNVERIFIED items.
