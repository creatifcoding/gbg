# Fuse / current-limit / thermal coordination (issue 24)

Status: `UNVERIFIED` calculation on TARGET values. No selected F1 or eFuse MPN,
so there is no I²t curve and no thermal rise evidence.

| Quantity | Value | Status | Source |
| --- | ---: | --- | --- |
| VIN | 12 V | target | `terrarium/PARAMS.md` rail VIN |
| F1 | 2 A | target | BOM B44 (read only; not edited) |
| Local I_LIM | 0.5 / 1.0 / 1.5 A | UNVERIFIED sweep | `params.sweep.json` |
| Q1 R_on | 50 mΩ/channel | UNVERIFIED sweep | no MPN |
| C_LOAD | 10 / 47 / 100 µF | UNVERIFIED sweep | no MPN |

Coordination inequality used for screening:

```text
I_LIM_max  <  I_F1_target
1.5 A      <  2 A
```

That is only a current ranking. It is not melting-time coordination, let-through
energy, or thermal design. Shop release stays blocked until a sourced F1 I²t
curve, eFuse trip curve, and measured temperature rise exist.

ngspice output-short case 06 latches Q1 off when I_SNS exceeds I_LIM. That is a
screening assertion, not a fuse qualification.
