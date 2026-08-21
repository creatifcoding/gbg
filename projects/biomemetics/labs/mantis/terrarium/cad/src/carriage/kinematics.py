"""Pinch as one generalized coordinate. Speed-independent two-stage blocker.

Electrical S1/S2/Q1 parts are unmet (#24). This module owns mechanical travel
only. Interlock interfaces stay UNVERIFIED.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from carriage.contract import d, load_contract


PinchState = Literal[
    "LOCKED",
    "S1_OPEN",
    "PINCH_SAFE",
    "CONTACTS_CLEAR",
    "ROLLING",
]
BinderState = Literal[
    "BINDER_BLOCKED",
    "PINCH_SAFE",
    "S2_OPEN",
    "BRANCH_SAFE",
    "BINDER_FREE",
]

PINCH_ORDER: tuple[PinchState, ...] = (
    "LOCKED",
    "S1_OPEN",
    "PINCH_SAFE",
    "CONTACTS_CLEAR",
    "ROLLING",
)
BINDER_ORDER: tuple[BinderState, ...] = (
    "BINDER_BLOCKED",
    "PINCH_SAFE",
    "S2_OPEN",
    "BRANCH_SAFE",
    "BINDER_FREE",
)


@dataclass(frozen=True)
class Interval:
    lo: float
    hi: float
    name: str
    status: str

    def contains(self, value: float) -> bool:
        return self.lo - 1e-12 <= value <= self.hi + 1e-12


@dataclass(frozen=True)
class PinchSample:
    q: float
    state: PinchState
    s1_open: bool
    pinch_safe: bool
    carrier_lift_mm: float
    lift_pawl_engaged: bool
    translation_unlocked: bool
    contacts_on_land: bool
    pogo_clearance_mm: float


@dataclass(frozen=True)
class BinderSample:
    r: float
    pinch_state: PinchState
    state: BinderState
    release_allowed: bool
    s2_open: bool
    b50_seated: bool
    b50_separation_mm: float


def _thresholds(contract: dict) -> dict[str, float]:
    return {
        "q_s1": d(contract, "carriage.s1_open_travel").value,
        "q_safe": d(contract, "carriage.pinch_safe_travel").value,
        "q_clear": d(contract, "carriage.contacts_clear_travel").value,
        "q_roll": d(contract, "carriage.pinch_input_travel").value,
        "throw": d(contract, "carriage.lift_cam_throw").value,
        "need": contract["clearanceLiftMm"],
        "r_s2": d(contract, "binder.s2_open_travel").value,
        "r_safe": d(contract, "binder.branch_safe_travel").value,
        "r_free": d(contract, "binder.free_travel").value,
        "sep": d(contract, "binder.unmate_clearance").value,
    }


def pinch_state(q: float, contract: dict | None = None) -> PinchState:
    contract = contract or load_contract()
    t = _thresholds(contract)
    if q < t["q_s1"]:
        return "LOCKED"
    if q < t["q_safe"]:
        return "S1_OPEN"
    if q < t["q_clear"]:
        return "PINCH_SAFE"
    if q < t["q_roll"]:
        return "CONTACTS_CLEAR"
    return "ROLLING"


def _carrier_lift(q: float, t: dict[str, float]) -> float:
    # Hardware lift pawl: z remains 0 until PINCH_SAFE. Not a timed cam.
    if q <= t["q_safe"]:
        return 0.0
    span = t["q_clear"] - t["q_safe"]
    if span <= 0:
        return t["throw"]
    frac = min(1.0, (q - t["q_safe"]) / span)
    return t["throw"] * frac


def sample_pinch(q: float, contract: dict | None = None) -> PinchSample:
    contract = contract or load_contract()
    t = _thresholds(contract)
    state = pinch_state(q, contract)
    lift = _carrier_lift(q, t)
    clearance = t["need"]
    contacts_on_land = lift < 1e-9
    pogo_clearance = max(0.0, lift - d(contract, "pogo.working_compression").value)
    return PinchSample(
        q=q,
        state=state,
        s1_open=q + 1e-12 >= t["q_s1"],
        pinch_safe=q + 1e-12 >= t["q_safe"],
        carrier_lift_mm=lift,
        lift_pawl_engaged=q + 1e-12 < t["q_safe"],
        translation_unlocked=state == "ROLLING" and lift + 1e-12 >= clearance,
        contacts_on_land=contacts_on_land,
        pogo_clearance_mm=pogo_clearance,
    )


def pinch_allows_binder_release(state: PinchState) -> bool:
    return PINCH_ORDER.index(state) >= PINCH_ORDER.index("PINCH_SAFE")


def binder_state(r: float, pinch: PinchState, contract: dict | None = None) -> BinderState:
    contract = contract or load_contract()
    if not pinch_allows_binder_release(pinch):
        return "BINDER_BLOCKED"
    t = _thresholds(contract)
    if r < t["r_s2"]:
        return "PINCH_SAFE"
    if r < t["r_safe"]:
        return "S2_OPEN"
    if r < t["r_free"]:
        return "BRANCH_SAFE"
    return "BINDER_FREE"


def sample_binder(
    r: float, pinch: PinchState, contract: dict | None = None
) -> BinderSample:
    contract = contract or load_contract()
    t = _thresholds(contract)
    allowed = pinch_allows_binder_release(pinch)
    clamped_r = r if allowed else 0.0
    state = binder_state(clamped_r, pinch, contract)
    seated = clamped_r + 1e-12 <= t["r_safe"]
    if seated:
        sep = 0.0
    else:
        span = t["r_free"] - t["r_safe"]
        frac = min(1.0, (clamped_r - t["r_safe"]) / span) if span > 0 else 1.0
        sep = t["sep"] * frac
    return BinderSample(
        r=clamped_r,
        pinch_state=pinch,
        state=state,
        release_allowed=allowed,
        s2_open=allowed and clamped_r + 1e-12 >= t["r_s2"],
        b50_seated=seated,
        b50_separation_mm=sep,
    )


def interval_stack(contract: dict | None = None) -> dict[str, Interval]:
    contract = contract or load_contract()
    comp = d(contract, "carriage.print_compensation").value
    printed = {
        "carriage.s1_open_travel",
        "carriage.pinch_safe_travel",
        "carriage.contacts_clear_travel",
        "carriage.pinch_input_travel",
        "carriage.lift_cam_throw",
        "binder.s2_open_travel",
        "binder.branch_safe_travel",
        "binder.free_travel",
    }
    names = (
        *printed,
        "pogo.working_compression",
        "pogo.released_contact_lift_min",
    )
    stacked = {}
    for name in names:
        dim = d(contract, name)
        # Pogo stroke is a selected-contact property. No PN exists, so do not
        # invent a manufacturing interval. Print compensation applies to printed
        # travels only.
        half = comp if name in printed else 0.0
        stacked[name] = Interval(dim.value - half, dim.value + half, name, dim.status)
    return stacked


def stack_invariants(contract: dict | None = None) -> list[str]:
    contract = contract or load_contract()
    stacked = interval_stack(contract)
    failures: list[str] = []
    s1 = stacked["carriage.s1_open_travel"]
    safe = stacked["carriage.pinch_safe_travel"]
    clear = stacked["carriage.contacts_clear_travel"]
    roll = stacked["carriage.pinch_input_travel"]
    throw = stacked["carriage.lift_cam_throw"]
    need = (
        stacked["pogo.working_compression"].hi
        + stacked["pogo.released_contact_lift_min"].hi
    )
    if s1.hi + 1e-12 >= safe.lo:
        failures.append(
            f"worst-case S1_OPEN [{s1.lo:.3f},{s1.hi:.3f}] overlaps PINCH_SAFE "
            f"[{safe.lo:.3f},{safe.hi:.3f}]"
        )
    if safe.hi + 1e-12 >= clear.lo:
        failures.append("worst-case PINCH_SAFE overlaps CONTACTS_CLEAR")
    if clear.hi + 1e-12 >= roll.lo:
        failures.append("worst-case CONTACTS_CLEAR overlaps ROLLING")
    if throw.lo + 1e-12 < need:
        failures.append(
            f"worst-case lift throw {throw.lo:.3f} mm < required clearance {need:.3f} mm"
        )
    b_s2 = stacked["binder.s2_open_travel"]
    b_safe = stacked["binder.branch_safe_travel"]
    b_free = stacked["binder.free_travel"]
    if b_s2.hi + 1e-12 >= b_safe.lo:
        failures.append("worst-case S2_OPEN overlaps BRANCH_SAFE")
    if b_safe.hi + 1e-12 >= b_free.lo:
        failures.append("worst-case BRANCH_SAFE overlaps BINDER_FREE")
    return failures


def sample_path(
    contract: dict | None = None, *, step: float = 0.05
) -> list[PinchSample]:
    contract = contract or load_contract()
    q_max = d(contract, "carriage.pinch_input_travel").value
    samples = []
    q = 0.0
    while q <= q_max + 1e-12:
        samples.append(sample_pinch(q, contract))
        q = round(q + step, 6)
    if samples[-1].q < q_max:
        samples.append(sample_pinch(q_max, contract))
    return samples


def path_invariants(contract: dict | None = None) -> list[str]:
    contract = contract or load_contract()
    failures: list[str] = []
    previous: PinchSample | None = None
    seen: set[PinchState] = set()
    for sample in sample_path(contract):
        seen.add(sample.state)
        if sample.carrier_lift_mm > 1e-9 and not sample.s1_open:
            failures.append(f"q={sample.q:.3f}: lift before S1_OPEN")
        if sample.carrier_lift_mm > 1e-9 and sample.lift_pawl_engaged:
            failures.append(f"q={sample.q:.3f}: lift while pawl engaged")
        if sample.translation_unlocked and sample.carrier_lift_mm + 1e-12 < contract["clearanceLiftMm"]:
            failures.append(f"q={sample.q:.3f}: rolling before contacts clear")
        if sample.translation_unlocked and sample.contacts_on_land:
            failures.append(f"q={sample.q:.3f}: high-speed wipe — contacts on land while rolling")
        if previous is not None:
            prev_i = PINCH_ORDER.index(previous.state)
            cur_i = PINCH_ORDER.index(sample.state)
            if cur_i < prev_i:
                failures.append(
                    f"q={sample.q:.3f}: pinch state reversed on increasing q"
                )
            if cur_i - prev_i > 1:
                failures.append(f"q={sample.q:.3f}: skipped pinch state")
        previous = sample
    missing = [state for state in PINCH_ORDER if state not in seen]
    if missing:
        failures.append("path never reaches " + ", ".join(missing))
    return failures


def binder_path_invariants(contract: dict | None = None) -> list[str]:
    contract = contract or load_contract()
    failures: list[str] = []
    r_max = d(contract, "binder.free_travel").value
    for pinch in PINCH_ORDER:
        r = 0.0
        previous: BinderSample | None = None
        while r <= r_max + 1e-12:
            sample = sample_binder(r, pinch, contract)
            if not pinch_allows_binder_release(pinch):
                if sample.r > 1e-12 or not sample.b50_seated or sample.state != "BINDER_BLOCKED":
                    failures.append(
                        f"pinch={pinch} r={r:.3f}: binder moved while blocked"
                    )
            else:
                if sample.b50_separation_mm > 1e-9 and not sample.s2_open:
                    failures.append(f"pinch={pinch} r={r:.3f}: B50 motion before S2_OPEN")
                if sample.state == "BINDER_FREE" and sample.b50_seated:
                    failures.append(f"pinch={pinch} r={r:.3f}: BINDER_FREE still seated")
                if previous is not None:
                    prev_i = BINDER_ORDER.index(previous.state)
                    cur_i = BINDER_ORDER.index(sample.state)
                    if cur_i < prev_i:
                        failures.append(
                            f"pinch={pinch} r={r:.3f}: binder state reversed"
                        )
            previous = sample
            r = round(r + 0.05, 6)
    return failures
