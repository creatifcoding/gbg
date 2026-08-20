# BUS - hybrid power, control, and video rail (working draft B)

## Contact order

| Pin | Net | Function | Geometry |
|---|---|---|---|
| P01 | VIN-A | 12 V rail power, parallel contact A | continuous land |
| P02 | VIN-B | 12 V rail power, parallel contact B | continuous land |
| P03 | GND-A | power/control return A | continuous land |
| P04 | GND-B | power/control return B | continuous land |
| P05 | SDA | 3.3 V I2C | continuous land |
| P06 | SCL | 3.3 V I2C | continuous land |
| P07 | UID | unique 1-Wire ROM identity | continuous land |
| P08 | FAULT_N/IRQ | non-safety open-drain fault / optional interrupt | continuous land |
| P09 | HSGND | high-speed ground fence | discrete V-dock |
| P10 | GMSL+ | GMSL2 positive | discrete V-dock |
| P11 | GMSL- | GMSL2 negative | discrete V-dock |
| P12 | HSGND | high-speed ground fence | discrete V-dock |

P09-P12 form a **to-be-characterized** high-speed spring-contact cell with a
100 ohm differential-impedance `TARGET`. Their physical pitch, ground-via
fence, pad shape, antipad, dielectric, launch, and spring-contact series remain
`UNVERIFIED`; the 2.54 mm drawing pitch is a packaging target, not a released
transmission-line geometry.

## Camera signal path

`supported IMX519 module (exact SKU TBD) -> local MIPI CSI-2 -> MAX96717 -> B50 C09-C12 -> carriage routing -> locked B27 P09-P12 dock -> MAX96724 -> short 22-position 0.5 mm CSI-2 -> Tachyon`

The carriage has no cable tether. Raw MIPI never becomes a continuous multidrop
rail. Each V-dock is separately routed point-to-point as a 100 ohm target
channel to one MAX96724 input. Working draft B models four V-docks per 500 mm
video rail and one camera carriage; the deserializer architecture can grow
later.

## Separate binder electrical handoff

`P01`-`P12` name the **rail-to-carriage** spring interface only. The removable
binder creates a second separable interface, B50, with keyed contacts
`C01`-`C12` that mirror the twelve required nets. No connector/contact series,
mate order, pin geometry, current rating, controlled-impedance launch, or
durability result is selected; B50 is therefore `UNVERIFIED` and is not a
released pinout.

The complete powered-video channel is
`rail launch -> B27 P09-P12 -> carriage routing -> B50 C09-C12 -> binder launch`.
Signal-integrity, hot-unplug, power, ESD, and wear validation must exercise that
whole path, not B27 alone. S2 is a local normally-open binder-mate switch. Q1 may
enable the camera/serializer branch only when both S1 (carriage fully seated)
and S2 (binder fully mated) are closed. First binder-release travel opens S2,
discharges and isolates the load before B50 contacts move. The latch is
mechanically blocked from release unless the carriage is already in
`PINCH-SAFE`; exact geometry and timing remain `UNVERIFIED`.

## Mate / move state machine

F1 and an upstream electronic limit protect the guarded continuous VIN lands.
Each carriage has its own B48 supervisor and Q1 **after** P01/P02; Q1 switches
the camera/serializer load, not the whole rail. A small protected supervisor may
be alive while seated so it can enforce S1/S2, the training timeout, discharge,
and fault latching. The exact supervisor circuit remains `UNVERIFIED`.

S1 is a local, normally-open mechanical carriage-mate switch. It closes only after the
carriage reaches the fully seated dwell and opens on the first pinch travel.
S1 does not depend on P08, software, UID, I2C, or successful video training.
P08 is diagnostic only and cannot waive the hardware interlock.

1. `ABSENT`: all carriage contacts open; local branch unpowered.
2. `MECHANICALLY-SEATED`: alignment and low-speed contacts settle; S1 is still open and Q1 is off.
3. `POWER-MATED`: full carriage and binder seating close S1 and S2; the local supervisor starts a bounded, current-limited Q1 training window.
4. `TRAINING-WINDOW`: camera and serializer are powered, but video is not admitted until lock and health checks pass.
5. `LINK-TRAINED`: serializer and deserializer report lock; video is admitted.
6. `FAULT-LATCHED`: timeout, wrong dock, overcurrent, UID loss, or invalid contact state turns Q1 off until a clean detach/remate.
7. `PINCH-SAFE`: first pinch travel opens S1, mutes the link, turns Q1 off, discharges the load, and isolates low-speed signals.
8. `LIFTED`: all contacts clear by at least the target lift; only now may rollers translate.

No carriage load power or video is specified while rolling. The protected rail
land may remain energized inside its guarded external channel behind B20, but the carriage load is
off and its pins are physically clear before translation. A mechanical cam
dwell must ensure `PINCH-SAFE` precedes contact lift. Training timeout, mate
order, debounce, discharge, and fail-safe polarity require EVT measurement.

## Fault policy

- No GMSL lock or a bent HSD contact: allow only the bounded training window, then turn Q1 off and latch the fault.
- Wrong dock, UID loss, partial clamp, S1/S2 disagreement, or overcurrent: turn Q1 off without admitting video.
- Overcurrent or short: the local current limiter acts first; F1 is upstream last-resort rail protection.
- SDA/SCL stuck low: isolate the segment; do not re-energize until service.
- Pogo bounce during pinch: local S1/Q1 power-off state dominates software and P08.
- Position: inferred from active MAX96724 port V1-V4, never from UID alone.
- Camera configuration uses the GMSL reverse control channel; the general rail I2C remains for sensor/actuator loads.

## Validation gates

- 3 and 6 Gbps eye/BER and return-loss tests through the complete B27 + B50 locked channel.
- Contact skew, bounce, ESD, contamination, wear, and 10,000-cycle target.
- End-stop retention and worst-case handling/drop protocol on every independent carriage route; service removal must require a deliberate tool action.
- Q1 current limit, fuse coordination, contact temperature rise, and two-contact current sharing.
- I2C capacitance, pull-up tuning, and a measured Qwiic/3.3 V load budget; no rail-current allowance is inferred from the connector alone.
- Serializer/deserializer driver and device-tree integration on the exact Tachyon OS image.
