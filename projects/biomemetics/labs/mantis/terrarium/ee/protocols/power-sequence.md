# Power, mate-order, and interrupted-pinch protocol

Status: `UNVERIFIED`; procedure draft only. No pass limits are selected yet.

Instrument B27 and B50 contact motion, S1, S2, Q1 gate/output, branch voltage,
current, serializer mute/lock, SDA/SCL/UID, and P08. Exercise nominal docking,
fast/slow pinch, release before lift, partial B27/B50 mate, binder release,
bounce, stuck-low logic, and power-source ramps.

A test may pass only after the selected parts define numeric discharge voltage,
time, inrush, contact-order, and backfeed limits. Captures must show:

- S1 or S2 causes video mute, Q1 off, discharge, and low-speed isolation before
  the associated contacts move;
- ground makes before and breaks after VIN/signal contacts at B27 and B50;
- an interrupted pinch stays branch-off until a clean full remate starts a new
  bounded training window; and
- guarded external rail VIN may remain energized without energizing any moving
  carriage contact or backfeeding an unpowered device.

Record raw captures, fixture/part revisions, calibration, limits, deviations,
and an independent review in an `EvidenceRecord`. Do not replace missing
thresholds with a visual judgment.
