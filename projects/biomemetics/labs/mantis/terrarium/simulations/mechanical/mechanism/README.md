# Mechanism simulation

Calculated pinch/binder kinematics for gbg#29. Maturity DRAFT. Evidence class theoretical/UNVERIFIED.

```text
python3 terrarium/simulations/mechanical/mechanism/check.py
```

The check owns:

- state order on one pinch coordinate and one binder coordinate;
- interval stack with print compensation applied only to printed travels;
- B27 land clearance before translation;
- B50 seated until BRANCH_SAFE;
- binder blocked unless PINCH_SAFE;
- no animal-side metal.

It does not own S1/S2/Q1 nets (#24 unmet). It does not import PR 34 STEP.

Gmsh/CalculiX screening is specified and **blocked**: no sourced PETG/ASA card.
