#!/usr/bin/env python3
"""Emit ngspice decks, run screening cases, assert S1/S2/Q1 hardware interlock.

Issue 24. Theoretical / UNVERIFIED. ngspice screens; it does not qualify.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DECKS = ROOT / "decks"
RESULTS = ROOT / "results"
MODEL = "models/power_control.inc"
NGSPICE = shutil.which("ngspice")

HI, LO = 3.3, 0.0
V_SAFE = 1.0


def pwl(points: list[tuple[float, float]]) -> str:
    body = " ".join(f"{t} {v}" for t, v in points)
    return f"PWL({body})"


def step(t_on: float, t_off: float | None = None, *, end: float = 0.04) -> str:
    pts = [(0.0, LO)]
    if t_on > 0:
        pts.append((t_on - 20e-6, LO))
    pts.append((t_on, HI))
    if t_off is not None:
        pts.append((t_off - 20e-6, HI))
        pts.append((t_off, LO))
        pts.append((end, LO))
    else:
        pts.append((end, HI))
    return pwl(pts)


def dc(v: float) -> str:
    return f"DC {v}"


# Shared mate timeline: ground-first, then VIN, then S1, then S2.
# Break-before-move: S1 opens, discharge, then B27 VIN/GND open.
NOMINAL_CTRL = {
    "s1_ctrl": step(0.005, 0.015),
    "s2_ctrl": step(0.006),
    "p03_make": step(0.002, 0.020),
    "p04_make": step(0.002, 0.020),
    "p01_make": step(0.003, 0.020),
    "p02_make": step(0.003, 0.020),
    "b50_gnd_make": step(0.002),
    "b50_vin_make": step(0.003),
}

DEFAULT_FAULTS = {
    "q1a_short": dc(LO),
    "q1b_short": dc(LO),
    "q1_open": dc(LO),
    "dchg_open": dc(LO),
    "p08_force": dc(LO),
    "load_short": dc(LO),
}

VECTORS = [
    "v(q1_en)",
    "v(v_branch)",
    "v(interlock_ok)",
    "v(remate_req)",
    "v(latch)",
    "v(iso_en)",
    "v(p08_diag)",
    "v(sda_rail)",
    "v(sda_br)",
    "v(vin_shared)",
    "v(s1_ctrl)",
    "v(s2_ctrl)",
    "v(i_sns)",
    "v(oc)",
]


CASES: list[dict] = [
    {
        "id": "00-nominal-seat-train-admit",
        "title": "Nominal seat / train / admit then pinch-safe lift",
        "tstop": 0.035,
        "ctrl": NOMINAL_CTRL,
        "asserts": [
            {"t": 0.001, "v(q1_en)": "<1.5", "v(v_branch)": f"<{V_SAFE}", "note": "absent: branch off"},
            {"t": 0.004, "v(q1_en)": "<1.5", "note": "contacts making, S1/S2 still open"},
            {"t": 0.012, "v(q1_en)": ">2.5", "v(v_branch)": ">10", "v(iso_en)": ">2.5", "note": "seated train window"},
            {"t": 0.016, "v(q1_en)": "<1.5", "v(iso_en)": "<1.5", "note": "S1 opened: Q1 forced off before lift"},
            {"t": 0.019, "v(v_branch)": f"<{V_SAFE}", "note": "discharged before B27 contact lift"},
            {"t": 0.022, "v(q1_en)": "<1.5", "v(v_branch)": f"<{V_SAFE}", "note": "rolling: branch off"},
        ],
    },
    {
        "id": "01-slow-partial-interrupted-pinch",
        "title": "Slow/partial mate and interrupted pinch (no lift)",
        "tstop": 0.030,
        "ctrl": {
            "s1_ctrl": pwl(
                [
                    (0, LO),
                    (0.008, LO),
                    (0.0085, HI),
                    (0.015, HI),
                    (0.0155, LO),
                    (0.017, LO),
                    (0.0175, HI),
                    (0.030, HI),
                ]
            ),
            "s2_ctrl": step(0.009),
            "p03_make": step(0.004),
            "p04_make": dc(LO),  # one return open: partial
            "p01_make": step(0.006),
            "p02_make": dc(LO),  # one VIN open: partial share
            "b50_gnd_make": step(0.004),
            "b50_vin_make": step(0.006),
        },
        "asserts": [
            {"t": 0.005, "v(q1_en)": "<1.5", "note": "partial/slow mate, S1 still open"},
            {"t": 0.012, "v(q1_en)": ">2.5", "note": "S1 and S2 closed; one of P01/P04 open is not a software waiver"},
            {"t": 0.016, "v(q1_en)": "<1.5", "note": "first pinch travel opens S1"},
            {
                "t": 0.020,
                "v(q1_en)": "<1.5",
                "note": "interrupted pinch: S1 re-closed without contact lift; remate required",
            },
        ],
    },
    {
        "id": "02-s1-s2-bounce-disagreement",
        "title": "S1/S2 bounce and disagreement",
        "tstop": 0.025,
        "ctrl": {
            "s1_ctrl": pwl(
                [
                    (0, LO),
                    (0.005, LO),
                    (0.0052, HI),
                    (0.0054, LO),
                    (0.0056, HI),
                    (0.0058, LO),
                    (0.0060, HI),
                    (0.012, HI),
                    (0.0122, LO),
                    (0.025, LO),
                ]
            ),
            "s2_ctrl": step(0.004, 0.018),
            "p03_make": step(0.002),
            "p04_make": step(0.002),
            "p01_make": step(0.003),
            "p02_make": step(0.003),
            "b50_gnd_make": step(0.002),
            "b50_vin_make": step(0.003),
        },
        "asserts": [
            {"t": 0.0054, "v(q1_en)": "<1.5", "v(s1_ctrl)": "<1.5", "note": "bounce low: S1 open keeps EN off"},
            {"t": 0.010, "v(s2_ctrl)": ">2.5", "note": "S2 closed while S1 bouncing/settling"},
            {"t": 0.016, "v(q1_en)": "<1.5", "v(s1_ctrl)": "<1.5", "v(s2_ctrl)": ">2.5", "note": "S1 open S2 closed: AND off"},
        ],
    },
    {
        "id": "03-brownout-recovery",
        "title": "VIN brownout and recovery with mates held",
        "tstop": 0.030,
        "params": {"v_in": 12},
        "ctrl": {
            **{k: v for k, v in NOMINAL_CTRL.items() if k != "s1_ctrl"},
            "s1_ctrl": step(0.005),
            "p03_make": step(0.002),
            "p04_make": step(0.002),
            "p01_make": step(0.003),
            "p02_make": step(0.003),
        },
        "vin": "PWL(0 12 0.010 12 0.012 5 0.018 5 0.020 12 0.030 12)",
        "asserts": [
            {"t": 0.008, "v(q1_en)": ">2.5", "v(vin_shared)": ">10", "note": "pre-brownout enabled"},
            {"t": 0.015, "v(q1_en)": "<1.5", "note": "UVLO inhibits EN during brownout"},
            {"t": 0.025, "v(q1_en)": ">2.5", "note": "VIN recover, mates still closed, no OC latch"},
        ],
    },
    {
        "id": "04-stuck-switch",
        "title": "S1/S2 stuck-open (safe) and S1 stuck-closed during pinch (hazard)",
        "tstop": 0.025,
        "ctrl": {
            "s1_ctrl": dc(HI),  # welded/stuck-closed
            "s2_ctrl": step(0.006),
            "p03_make": step(0.002, 0.018),
            "p04_make": step(0.002, 0.018),
            "p01_make": step(0.003, 0.018),
            "p02_make": step(0.003, 0.018),
            "b50_gnd_make": step(0.002),
            "b50_vin_make": step(0.003),
        },
        "asserts": [
            {"t": 0.012, "v(q1_en)": ">2.5", "note": "stuck-closed S1 still enables with S2"},
            {
                "t": 0.0179,
                "v(q1_en)": ">2.5",
                "expect_hazard": True,
                "note": "HAZARD: S1 welded, Q1 still enabled at commanded B27 lift; single NO S1 cannot break-before-move",
            },
        ],
        "companion": {
            "id": "04b-s1-stuck-open",
            "title": "S1 stuck-open remains branch-off",
            "tstop": 0.015,
            "ctrl": {
                "s1_ctrl": dc(LO),
                "s2_ctrl": step(0.006),
                "p03_make": step(0.002),
                "p04_make": step(0.002),
                "p01_make": step(0.003),
                "p02_make": step(0.003),
                "b50_gnd_make": step(0.002),
                "b50_vin_make": step(0.003),
            },
            "asserts": [
                {"t": 0.010, "v(q1_en)": "<1.5", "v(v_branch)": f"<{V_SAFE}", "note": "stuck-open S1: no enable"}
            ],
        },
    },
    {
        "id": "05-q1-open-short",
        "title": "Q1A short (Q1B isolates) and Q1 open",
        "tstop": 0.025,
        "ctrl": NOMINAL_CTRL,
        "faults": {"q1a_short": dc(HI)},
        "asserts": [
            {"t": 0.012, "v(q1_en)": ">2.5", "v(v_branch)": ">10", "note": "Q1A shorted; Q1B still follows EN"},
            {"t": 0.019, "v(v_branch)": f"<{V_SAFE}", "note": "Q1B still isolates after S1 opens"},
        ],
        "companion": {
            "id": "05b-q1-open",
            "title": "Q1 open stays unavailable/safe",
            "tstop": 0.015,
            "ctrl": NOMINAL_CTRL,
            "faults": {"q1_open": dc(HI)},
            "asserts": [
                {"t": 0.012, "v(q1_en)": "<1.5", "v(v_branch)": f"<{V_SAFE}", "note": "q1_open inhibits EN"}
            ],
        },
    },
    {
        "id": "05c-q1-assembly-short",
        "title": "Both Q1 channels shorted (dual-fault hazard)",
        "tstop": 0.025,
        "ctrl": NOMINAL_CTRL,
        "faults": {"q1a_short": dc(HI), "q1b_short": dc(HI)},
        "asserts": [
            {
                "t": 0.019,
                "v(v_branch)": f">{V_SAFE}",
                "expect_hazard": True,
                "note": "HAZARD: both isolation channels shorted; dual fault, not a single-fault PASS",
            }
        ],
    },
    {
        "id": "06-output-short-oc",
        "title": "Output short / overcurrent latches off",
        "tstop": 0.025,
        "ctrl": {
            "s1_ctrl": step(0.005),
            "s2_ctrl": step(0.006),
            "p03_make": step(0.002),
            "p04_make": step(0.002),
            "p01_make": step(0.003),
            "p02_make": step(0.003),
            "b50_gnd_make": step(0.002),
            "b50_vin_make": step(0.003),
        },
        "faults": {"load_short": step(0.010)},
        "asserts": [
            {"t": 0.008, "v(q1_en)": ">2.5", "note": "enabled before short"},
            {"t": 0.016, "v(q1_en)": "<1.5", "v(latch)": ">2.5", "note": "OC fault latch forces Q1 off"},
        ],
    },
    {
        "id": "07-discharge-before-move",
        "title": "Discharge before B27 lift and before B50 release",
        "tstop": 0.028,
        "ctrl": {
            "s1_ctrl": step(0.005),
            "s2_ctrl": step(0.006, 0.018),
            "p03_make": step(0.002, 0.016),
            "p04_make": step(0.002, 0.016),
            "p01_make": step(0.003, 0.016),
            "p02_make": step(0.003, 0.016),
            "b50_gnd_make": step(0.002, 0.022),
            "b50_vin_make": step(0.003, 0.022),
        },
        "asserts": [
            {"t": 0.0155, "v(q1_en)": "<1.5", "note": "placeholder removed; see 07b"},
        ],
        "fix_timeline": True,
    },
    {
        "id": "08-unpowered-backfeed",
        "title": "Unpowered low-speed backfeed isolation; P08 cannot enable",
        "tstop": 0.020,
        "ctrl": {
            "s1_ctrl": dc(LO),
            "s2_ctrl": dc(LO),
            "p03_make": dc(LO),
            "p04_make": dc(LO),
            "p01_make": dc(LO),
            "p02_make": dc(LO),
            "b50_gnd_make": dc(LO),
            "b50_vin_make": dc(LO),
        },
        "faults": {"p08_force": dc(HI)},
        "params": {"v_in": 0},
        "extra": ["V_SDA_INJ sda_br 0 DC 3.3"],
        "asserts": [
            {"t": 0.010, "v(q1_en)": "<1.5", "v(iso_en)": "<1.5", "note": "unpowered, isolated"},
            {"t": 0.010, "v(sda_rail)": "<0.5", "v(sda_br)": ">2.5", "note": "backfeed on branch does not appear on rail"},
            {"t": 0.010, "v(q1_en)": "<1.5", "note": "P08 force cannot turn Q1 on"},
        ],
    },
    {
        "id": "09-repeated-detach-remate",
        "title": "Repeated detach / remate stays branch-off while moving",
        "tstop": 0.040,
        "ctrl": {
            "s1_ctrl": pwl(
                [
                    (0, LO),
                    (0.005, LO),
                    (0.0052, HI),
                    (0.012, HI),
                    (0.0122, LO),
                    (0.022, LO),
                    (0.0222, HI),
                    (0.030, HI),
                    (0.0302, LO),
                    (0.040, LO),
                ]
            ),
            "s2_ctrl": pwl(
                [
                    (0, LO),
                    (0.006, LO),
                    (0.0062, HI),
                    (0.031, HI),
                    (0.0312, LO),
                    (0.040, LO),
                ]
            ),
            "p03_make": pwl([(0, LO), (0.002, LO), (0.0022, HI), (0.016, HI), (0.0162, LO), (0.020, LO), (0.0202, HI), (0.034, HI), (0.0342, LO), (0.040, LO)]),
            "p04_make": pwl([(0, LO), (0.002, LO), (0.0022, HI), (0.016, HI), (0.0162, LO), (0.020, LO), (0.0202, HI), (0.034, HI), (0.0342, LO), (0.040, LO)]),
            "p01_make": pwl([(0, LO), (0.003, LO), (0.0032, HI), (0.016, HI), (0.0162, LO), (0.021, LO), (0.0212, HI), (0.034, HI), (0.0342, LO), (0.040, LO)]),
            "p02_make": pwl([(0, LO), (0.003, LO), (0.0032, HI), (0.016, HI), (0.0162, LO), (0.021, LO), (0.0212, HI), (0.034, HI), (0.0342, LO), (0.040, LO)]),
            "b50_gnd_make": step(0.002, 0.036),
            "b50_vin_make": step(0.003, 0.036),
        },
        "asserts": [
            {"t": 0.010, "v(q1_en)": ">2.5", "note": "first seat"},
            {"t": 0.014, "v(q1_en)": "<1.5", "note": "first pinch"},
            {"t": 0.018, "v(v_branch)": f"<{V_SAFE}", "note": "first lift discharged"},
            {"t": 0.026, "v(q1_en)": ">2.5", "note": "second seat after lift"},
            {"t": 0.032, "v(q1_en)": "<1.5", "note": "second pinch / binder release starts"},
            {"t": 0.038, "v(q1_en)": "<1.5", "v(v_branch)": f"<{V_SAFE}", "note": "detached: off"},
        ],
    },
    {
        "id": "07b-s2-binder-release",
        "title": "S2 opens before B50 contact move (break-before-binder-release)",
        "tstop": 0.025,
        "ctrl": {
            "s1_ctrl": step(0.005),
            "s2_ctrl": step(0.006, 0.014),
            "p03_make": step(0.002),
            "p04_make": step(0.002),
            "p01_make": step(0.003),
            "p02_make": step(0.003),
            "b50_gnd_make": step(0.002, 0.018),
            "b50_vin_make": step(0.003, 0.018),
        },
        "asserts": [
            {"t": 0.012, "v(q1_en)": ">2.5", "note": "seated, binder mated"},
            {"t": 0.015, "v(q1_en)": "<1.5", "v(iso_en)": "<1.5", "note": "S2 open: Q1 off before B50 move"},
            {"t": 0.017, "v(v_branch)": f"<{V_SAFE}", "note": "discharged before binder contacts move"},
        ],
    },
    {
        "id": "07c-discharge-open-blocks-lift",
        "title": "Open discharge: V_BRANCH still above v_safe so lift predicate is false",
        "tstop": 0.020,
        "params": {"r_load": 1e6},
        "ctrl": NOMINAL_CTRL,
        "faults": {"dchg_open": dc(HI)},
        "asserts": [
            {"t": 0.012, "v(q1_en)": ">2.5", "note": "enabled"},
            {
                "t": 0.019,
                "v(v_branch)": f">{V_SAFE}",
                "v(q1_en)": "<1.5",
                "expect_hazard": True,
                "note": "HAZARD if lift proceeds: discharge open leaves branch charged; permit-lift must stay false",
            },
        ],
    },
    {
        "id": "04c-s2-welded-binder",
        "title": "S2 welded during binder contact move (hazard)",
        "tstop": 0.022,
        "ctrl": {
            "s1_ctrl": step(0.005),
            "s2_ctrl": dc(HI),
            "p03_make": step(0.002),
            "p04_make": step(0.002),
            "p01_make": step(0.003),
            "p02_make": step(0.003),
            "b50_gnd_make": step(0.002, 0.016),
            "b50_vin_make": step(0.003, 0.016),
        },
        "asserts": [
            {
                "t": 0.018,
                "v(q1_en)": ">2.5",
                "expect_hazard": True,
                "note": "HAZARD: S2 welded, B50 already moving, Q1 still on; single NO S2 cannot break-before-binder-release",
            }
        ],
    },
]


def flatten_cases(cases: list[dict]) -> list[dict]:
    out: list[dict] = []
    for case in cases:
        companion = case.pop("companion", None)
        if case.get("fix_timeline"):
            # Replace the placeholder 07 with the binder+lift pair already added as 07b.
            continue
        out.append(case)
        if companion:
            out.append(companion)
    return out


def emit_deck(case: dict) -> Path:
    DECKS.mkdir(parents=True, exist_ok=True)
    lines = [
        f"* {case['id']}: {case['title']}",
        "* Issue 24 UNVERIFIED screening deck. Not qualification.",
        f".title {case['id']}",
        f".include {MODEL}",
    ]
    for key, val in case.get("params", {}).items():
        lines.append(f".param {key}={val}")
    lines.append(f"V_VIN vin_src 0 {case.get('vin', 'DC {v_in}')}")
    ctrl = {**DEFAULT_FAULTS, **case.get("ctrl", {}), **case.get("faults", {})}
    for node, src in ctrl.items():
        lines.append(f"V_{node.upper()} {node} 0 {src}")
    for extra in case.get("extra", []):
        lines.append(extra)
    tstop = case.get("tstop", 0.03)
    lines += [
        f".tran 20u {tstop}",
        ".control",
        "run",
        "set wr_singlescale",
        "set wr_vecnames",
        f"wrdata results/{case['id']}.dat " + " ".join(VECTORS),
        "quit",
        ".endc",
        ".end",
        "",
    ]
    path = DECKS / f"{case['id']}.cir"
    path.write_text("\n".join(lines))
    return path


def parse_dat(path: Path) -> dict[str, list[float]]:
    text = path.read_text(errors="replace").strip().splitlines()
    if not text:
        raise RuntimeError(f"empty {path}")
    # ngspice wr_vecnames: first line names, then rows of numbers
    header = text[0].split()
    cols: list[list[float]] = []
    start = 0
    names: list[str]
    try:
        [float(x) for x in header]
        names = ["time"] + [f"c{i}" for i in range(1, len(header))]
        start = 0
    except ValueError:
        names = header
        start = 1
    data = {n.lower(): [] for n in names}
    for line in text[start:]:
        parts = line.split()
        if len(parts) < 2:
            continue
        for name, raw in zip(names, parts):
            data[name.lower()].append(float(raw))
    if "time" not in data:
        first = names[0].lower()
        data["time"] = data[first]
    return data


def interp(ts: list[float], vs: list[float], t: float) -> float:
    if t <= ts[0]:
        return vs[0]
    if t >= ts[-1]:
        return vs[-1]
    lo, hi = 0, len(ts) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ts[mid] <= t:
            lo = mid
        else:
            hi = mid
    t0, t1 = ts[lo], ts[hi]
    v0, v1 = vs[lo], vs[hi]
    if t1 == t0:
        return v0
    return v0 + (v1 - v0) * (t - t0) / (t1 - t0)


def col(data: dict[str, list[float]], name: str) -> list[float]:
    key = name.lower().replace("(", "").replace(")", "")
    for cand in (name.lower(), key, name.lower().replace("v(", "v(")):
        if cand in data:
            return data[cand]
    # wrdata may name v(q1_en) as v(q1_en) or q1_en
    for k, v in data.items():
        compact = k.replace("(", "").replace(")", "").replace("v", "", 1) if k.startswith("v") else k
        if compact.replace("v", "") == name.lower().replace("v(", "").replace(")", "") or k.endswith(
            name.lower().split("(")[-1].rstrip(")")
        ):
            return v
    raise KeyError(f"{name} not in {list(data)[:12]}")


def find_vec(data: dict[str, list[float]], spec: str) -> list[float]:
    spec_l = spec.lower()
    if spec_l in data:
        return data[spec_l]
    tail = spec_l.replace("v(", "").replace("i(", "").replace(")", "")
    for k, v in data.items():
        if k == "time":
            continue
        if tail in k.lower().replace("(", "").replace(")", ""):
            return v
    raise KeyError(spec)


def check(op: str, left: float, right: float) -> bool:
    if op.startswith("<"):
        return left < float(op[1:])
    if op.startswith(">"):
        return left > float(op[1:])
    raise ValueError(op)


def run_case(case: dict) -> dict:
    emit_deck(case)
    dat = RESULTS / f"{case['id']}.dat"
    log = RESULTS / f"{case['id']}.log"
    if dat.exists():
        dat.unlink()
    cmd = [NGSPICE, "-b", "-o", str(log), str(DECKS / f"{case['id']}.cir")]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    record: dict = {
        "id": case["id"],
        "title": case["title"],
        "ngspice_rc": proc.returncode,
        "asserts": [],
        "ok": True,
        "hazard_demonstrated": False,
    }
    if proc.returncode != 0 or not dat.exists():
        record["ok"] = False
        record["error"] = (proc.stderr or "")[-500:]
        record["log_tail"] = log.read_text(errors="replace")[-800:] if log.exists() else ""
        return record
    data = parse_dat(dat)
    ts = data["time"]
    for spec in case["asserts"]:
        t = spec["t"]
        row = {"t": t, "note": spec.get("note", ""), "expect_hazard": bool(spec.get("expect_hazard"))}
        failed = False
        for key, op in spec.items():
            if key in {"t", "note", "expect_hazard"}:
                continue
            series = find_vec(data, key)
            value = interp(ts, series, t)
            row[key] = value
            if not check(op, value, 0):
                failed = True
                row["fail"] = f"{key}={value} not {op}"
        if spec.get("expect_hazard"):
            # Hazard cases PASS the screening when the unsafe condition is observed.
            row["disposition"] = "hazard-demonstrated" if not failed else "hazard-not-observed"
            if failed:
                record["ok"] = False
            else:
                record["hazard_demonstrated"] = True
        else:
            if failed:
                record["ok"] = False
        record["asserts"].append(row)
    return record


def main() -> int:
    if not NGSPICE:
        print("ngspice not found", file=sys.stderr)
        return 2
    RESULTS.mkdir(parents=True, exist_ok=True)
    cases = flatten_cases([dict(c) for c in CASES])
    summary = {
        "schema": "mantis.ee.power-control.sim-summary.v1",
        "issue": 24,
        "status": "UNVERIFIED",
        "solver": "ngspice",
        "qualification": False,
        "cases": [],
    }
    rc = 0
    for case in cases:
        record = run_case(case)
        summary["cases"].append(record)
        flag = "PASS" if record["ok"] else "FAIL"
        haz = " HAZARD-DEMO" if record.get("hazard_demonstrated") else ""
        print(f"{flag}{haz}  {case['id']}")
        if not record["ok"]:
            rc = 1
            fails = [a.get("fail") for a in record.get("asserts", []) if a.get("fail")]
            if fails:
                print("   ", "; ".join(fails))
            elif record.get("log_tail"):
                print(record["log_tail"][-400:])
    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    lines = [
        "# Issue 24 ngspice screening summary",
        "",
        "Status: `UNVERIFIED`. ngspice does not qualify hardware. #23 parts remain envelopes.",
        "",
        "| Case | Result | Hazard demo |",
        "| --- | --- | --- |",
    ]
    for rec in summary["cases"]:
        lines.append(
            f"| `{rec['id']}` | {'PASS' if rec['ok'] else 'FAIL'} | "
            f"{'yes' if rec.get('hazard_demonstrated') else 'no'} |"
        )
    (RESULTS / "summary.md").write_text("\n".join(lines) + "\n")
    return rc


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
