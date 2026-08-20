# Electrical power-control screening (issue 24)

Theoretical / `UNVERIFIED`. ngspice screens the S1/S2/Q1 interlock. It does not
qualify hardware. Values are parameter sweeps because no S1/S2/Q1/F1 MPN is
selected.

```text
python3 run_fault_model.py
```

Requires `ngspice`. Writes `decks/*.cir` and `results/summary.json`. Raw `.dat`
traces are local and gitignored.

## Cases

| Deck | Claim |
| --- | --- |
| 00 | Nominal seat / train / pinch-safe discharge before B27 lift |
| 01 | Partial mate and interrupted pinch stay branch-off |
| 02 | Bounce / S1-S2 disagreement |
| 03 | Brownout inhibits; recovery with mates held |
| 04 | S1 welded: Q1 still enabled at commanded lift (hazard) |
| 04b | S1 stuck-open stays off |
| 04c | S2 welded during B50 move (hazard) |
| 05 | Q1A short: Q1B still isolates |
| 05b | Q1 open stays unavailable |
| 05c | Both Q1 channels shorted (dual-fault hazard) |
| 06 | Output short latches off |
| 07b | S2 opens and branch discharges before B50 move |
| 07c | Open discharge: V_BRANCH stays above v_safe (lift predicate false) |
| 08 | Unpowered SDA backfeed blocked; P08 cannot enable Q1 |
| 09 | Repeated detach / remate |

Hazard demos are passing screening when the unsafe condition is observed. They
are not a license to ship a single-NO S1/S2.
