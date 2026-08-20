# De-embed procedure (issue 26)

Status: `UNVERIFIED` procedure. PROTO-FAB DRAFT. Not measured SI.

Consumes the #25 de-embed plan without rewriting it. Planes 1 and 6 stay
blocked until SerDes pad maps exist.

## Preconditions (all must be true)

1. Human approval recorded for this coupon revision.
2. RF adapter MPN selected (SMA / 2.92 or equivalent). Until then SOLT is
   blocked. Do not invent an adapter footprint.
3. VNA/TDR identity, calibration kit identity, and torque recorded.
4. Fixture SHA from `fab/prototype/outputs/planning/manifest.sha256`.
5. Current-limited power off unless the case explicitly needs bias. This
   procedure is passive-first.

## Method

2x-thru plus OSL at the B50 plane. Do not claim IPC-2581/ODB++ from this
procedure.

| Step | Structure | Action | Stop if |
| --- | --- | --- | --- |
| 1 | OSL open | Measure at declared B50 plane | Adapter MPN missing |
| 2 | OSL short | R_SHORT stuffed only after MPN selected | Short geometry guessed |
| 3 | OSL load | R_LOAD TARGET 100 ohm; MPN UNVERIFIED | Part not selected |
| 4 | 2x-thru B50 | Full 12-net including P01–P08 adjacency | GMSL-only subset used |
| 5 | 2x-thru B27 | Same, with P09/P12 RF returns present | Returns omitted |
| 6 | Carriage route | Line coupon, TARGET 100 ohm | Stackup still UNVERIFIED: record as screening only |
| 7 | Full channel | ser courtyard → B50 → carriage → B27 → B19 → rx courtyard | Any intervening net omitted |
| 8 | Ser / rx package planes | Do not de-embed | Pad map still UNVERIFIED |

## Reduction

Record raw S-parameters/TDR, cal kit, fixture revision, limits and their
source digests, uncertainty, and deviations. Simulation from #25 may reject a
geometry; it cannot PASS this procedure.

Negative evidence is valid. Missing instruments are an external-lab or
procurement blocker, not a simulated PASS.
