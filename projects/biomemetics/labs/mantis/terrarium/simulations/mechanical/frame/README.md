# Frame/rail/B20 mechanical checks

Calculated DRAFT checks for gbg#28. Simulation here is not measurement.

```text
python3 terrarium/simulations/mechanical/frame/check.py
```

The report records bbox, solid count, minimum rail wall, B20 span, conductor/animal overlap, and whether FreeCADCmd emitted STEP. A blocked STEP export does not waive the parametric FreeCAD Part source. OpenSCAD is not accepted as STEP authority.

Physical coupons are specified in `coupons.md`. Do not file those coupons as passed tests.
