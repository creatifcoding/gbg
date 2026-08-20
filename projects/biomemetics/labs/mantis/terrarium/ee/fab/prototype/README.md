# PROTO-FAB package (issue 26)

**Maturity: `PROTO-FAB` only. UNQUALIFIED. Not a shop release.**

Every board in this package is marked:

`LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE`

and

`PROTO-FAB DRAFT — UNQUALIFIED — NOT A SHOP RELEASE`

Human approval is required before ordering, assembly, energization, fault
injection, or ESD testing. Missing exact parts, models, fab stackup, or safe
probe access block release — those blockers are listed in `blockers.md` and
are not waived here.

## Layout

| Path | Role |
| --- | --- |
| `maturity.json` | Machine-readable class: PROTO-FAB, unqualified |
| `blockers.md` | Release stops |
| `bom.json` | Exact MPN/manufacturer/DNP/variant/status — all UNVERIFIED or DNP |
| `jobsets/` | Planned KiCad jobset; not executed |
| `outputs/planning/` | SHA-256 manifest and export-status (no invented Gerbers) |
| `dfm-record.md` | DFM as planning/blocker, not a pass |
| `cam-review.md` | CAM re-import not performed |
| `bring-up.md` | Bench bring-up |
| `first-power.md` | Current-limited first-power |
| `assembly-drawing.md` | Assembly drawing planning (no PDF without kicad-cli) |

Native source: `../../kicad/fixture/`. Coupons: `../../coupons/`.

IPC-D-356 / IPC-2581 / ODB++ are **not claimed**. The pinned KiCad/fabricator
path is not verified.
