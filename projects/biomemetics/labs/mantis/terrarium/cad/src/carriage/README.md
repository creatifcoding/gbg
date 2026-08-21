# Carriage OCCT source

Working draft B. Maturity DRAFT. Not a shop release. Evidence class: theoretical/UNVERIFIED.

FreeCAD `Part`/OCCT owns released BRep for B22–B27 pinch-lift parts. OpenSCAD remains study and must not emit STEP.

Frame/rail/B20 from gbg#28 / PR 34 is draft-only and **not admitted**. This leaf does not import that STEP.

## Coordinate

`carriage.local`: X along rail, Y toward the animal look direction, Z lift from the land plane. The whole frame is external/service. No animal-side copper, pogo, or metal mesh.

## Pinch coordinate

One bounded input `q` (mm). Hardware two-stage pawls, not a timed cam:

| `q` TARGET | State | Contacts | Translation |
| ---: | --- | --- | --- |
| 0.0 | `LOCKED` | working compression | locked |
| 1.0 | `S1_OPEN` | still seated | locked |
| 2.2 | `PINCH_SAFE` | still seated; lift pawl retracts | locked |
| 4.0 | `CONTACTS_CLEAR` | lift ≥ 1.8 mm calculated | locked |
| 5.0 | `ROLLING` | clear | unlocked |

S1/S2/Q1 electrical parts are unmet (#24). `IF-S1-actuator` is an UNVERIFIED envelope only.

## Export

```text
python3 terrarium/simulations/mechanical/mechanism/check.py
```

Set `FREECADCMD` when FreeCADCmd is on PATH so the same command also writes STEP/STL.
