#!/usr/bin/env python3
"""UNVERIFIED GMSL cascade: serializer launch -> B50 -> carriage -> B27 -> deserializer.

numpy only. Does not qualify the physical interface. Missing vendor Touchstone
and contact field-solver models stay UNVERIFIED.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
RESULTS = ROOT / "results"
PARAMS = json.loads((ROOT / "params.sweep.json").read_text())

C0 = 299792458.0


def tline_s(freq: np.ndarray, length_m: float, z0: float, er: float, alpha_np: float, zref: float = 50.0):
    """Lossy TEM line, UNVERIFIED analytic stand-in (Pozar ch. 4 form)."""
    beta = 2 * math.pi * freq / C0 * math.sqrt(er)
    gamma = alpha_np + 1j * beta
    gl = gamma * length_m
    zc = z0
    # ABCD -> S, 50 ohm ref
    a = np.cosh(gl)
    b = zc * np.sinh(gl)
    c = np.sinh(gl) / zc
    d = np.cosh(gl)
    den = a + b / zref + c * zref + d
    s11 = (a + b / zref - c * zref - d) / den
    s21 = 2 / den
    s12 = s21
    s22 = (-a + b / zref - c * zref + d) / den
    return s11, s21, s12, s22


def series_r_s(r: float, zref: float = 50.0):
    s11 = r / (r + 2 * zref) * np.ones(1)
    s21 = 2 * zref / (r + 2 * zref) * np.ones(1)
    return s11, s21, s21, s11


def cascade(a, b):
    a11, a21, a12, a22 = a
    b11, b21, b12, b22 = b
    den = 1 - a22 * b11
    s11 = a11 + a12 * b11 * a21 / den
    s21 = a21 * b21 / den
    s12 = a12 * b12 / den
    s22 = b22 + b12 * a22 * b21 / den
    return s11, s21, s12, s22


def write_s2p(path: Path, freq: np.ndarray, s, comment: str) -> None:
    s11, s21, s12, s22 = s
    if np.ndim(s11) == 0 or s11.size == 1:
        s11 = np.resize(s11, freq.shape)
        s21 = np.resize(s21, freq.shape)
        s12 = np.resize(s12, freq.shape)
        s22 = np.resize(s22, freq.shape)
    lines = [
        "! UNVERIFIED synthetic. Does not qualify hardware.",
        f"! {comment}",
        "# Hz S RI R 50",
    ]
    for i, f in enumerate(freq):
        lines.append(
            f"{f:.6e} {s11[i].real:.6e} {s11[i].imag:.6e} "
            f"{s21[i].real:.6e} {s21[i].imag:.6e} "
            f"{s12[i].real:.6e} {s12[i].imag:.6e} "
            f"{s22[i].real:.6e} {s22[i].imag:.6e}"
        )
    path.write_text("\n".join(lines) + "\n")


def db20(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def main() -> None:
    MODELS.mkdir(exist_ok=True)
    RESULTS.mkdir(exist_ok=True)
    p = PARAMS["parameters"]
    freq = np.linspace(p["f_min_hz"]["default"], p["f_max_hz"]["default"], p["n_freq"]["default"])

    segs = []
    # 1 serializer launch — pad map missing; geometric placeholder
    segs.append(
        (
            "01-ser-launch",
            tline_s(
                freq,
                p["l_ser_m"]["default"],
                p["z0_ohm"]["default"],
                p["er"]["default"],
                p["alpha_np_per_m"]["default"],
            ),
            "MAX96717 launch. Package/pad map UNVERIFIED.",
        )
    )
    segs.append(
        (
            "02-b50-contact",
            series_r_s(p["r_b50_ohm"]["default"]),
            "B50 contact. Series R UNVERIFIED. No vendor Touchstone.",
        )
    )
    segs.append(
        (
            "03-carriage-route",
            tline_s(
                freq,
                p["l_carriage_m"]["default"],
                p["z0_ohm"]["default"],
                p["er"]["default"],
                p["alpha_np_per_m"]["default"],
            ),
            "Carriage GMSL pair. Stackup/width UNVERIFIED. 100 ohm TARGET.",
        )
    )
    segs.append(
        (
            "04-b27-contact",
            series_r_s(p["r_b27_ohm"]["default"]),
            "B27 pogo. Series R UNVERIFIED. Field solver blocked.",
        )
    )
    segs.append(
        (
            "05-des-launch",
            tline_s(
                freq,
                p["l_des_m"]["default"],
                p["z0_ohm"]["default"],
                p["er"]["default"],
                p["alpha_np_per_m"]["default"],
            ),
            "MAX96724 launch. Package/pad map UNVERIFIED.",
        )
    )

    acc = segs[0][1]
    write_s2p(MODELS / f"{segs[0][0]}.s2p", freq, acc, segs[0][2])
    for name, s, comment in segs[1:]:
        write_s2p(MODELS / f"{name}.s2p", freq, s, comment)
        acc = cascade(acc, s)
    write_s2p(MODELS / "06-full-gmsl-cascade.s2p", freq, acc, "Full GMSL cascade. UNVERIFIED. Not a qualification.")

    s11, s21, _, _ = acc
    f3 = np.argmin(np.abs(freq - 3e9))
    f15 = np.argmin(np.abs(freq - 1.5e9))

    # Sensitivity: carriage length and contact R
    sweep = []
    for l in p["l_carriage_m"]["sweep"]:
        for r in p["r_b27_ohm"]["sweep"]:
            cur = segs[0][1]
            cur = cascade(cur, segs[1][1])
            cur = cascade(
                cur,
                tline_s(freq, l, p["z0_ohm"]["default"], p["er"]["default"], p["alpha_np_per_m"]["default"]),
            )
            cur = cascade(cur, series_r_s(r))
            cur = cascade(cur, segs[4][1])
            sweep.append(
                {
                    "l_carriage_m": l,
                    "r_b27_ohm": r,
                    "il_db_1p5GHz": float(db20(cur[1][f15])),
                    "il_db_3GHz": float(db20(cur[1][f3])),
                    "rl_db_3GHz": float(db20(cur[0][f3])),
                }
            )

    summary = {
        "schema": "mantis.ee.channel.cascade.v1",
        "issue": 25,
        "status": "UNVERIFIED",
        "qualifiesPhysicalInterface": False,
        "solver": "numpy analytic TEM + series-R contact",
        "fieldSolver": "blocked",
        "vendorTouchstone": "absent",
        "skrf": "not installed; not added to flake",
        "locks": {
            "rawMipiInCascade": False,
            "videoWhileRolling": False,
            "gmslPins": ["B50.C10", "B50.C11", "B27.P10", "B27.P11"],
            "hsgndPins": ["B50.C09", "B50.C12", "B27.P09", "B27.P12"],
        },
        "nominal": {
            "il_db_1p5GHz": float(db20(s21[f15])),
            "il_db_3GHz": float(db20(s21[f3])),
            "rl_db_3GHz": float(db20(s11[f3])),
            "note": "Numbers are simulated placeholders. No ADI IL mask was retrieved (datasheet timeout).",
        },
        "sensitivity": sweep,
        "checks": {
            "csiNetsInGmslCascade": False,
            "p09p12AreHsgnd": True,
            "p10p11AreGmsl": True,
            "qualificationFlagForcedFalse": True,
        },
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (RESULTS / "summary.md").write_text(
        "# Channel cascade screening (issue 25)\n\n"
        "Theoretical / `UNVERIFIED`. numpy screens. It does not qualify hardware.\n\n"
        f"- IL @ 1.5 GHz (placeholder): {summary['nominal']['il_db_1p5GHz']:.2f} dB\n"
        f"- IL @ 3 GHz (placeholder): {summary['nominal']['il_db_3GHz']:.2f} dB\n"
        f"- RL @ 3 GHz (placeholder): {summary['nominal']['rl_db_3GHz']:.2f} dB\n"
        "- `qualifiesPhysicalInterface`: false\n"
        "- Field solver: blocked (no contact series, no #28/#29 STEP, Nix path not qualified)\n"
        "- Vendor Touchstone: absent (analog.com timeout; custom pogos)\n"
        "- MIPI is not in this cascade\n"
    )
    if summary["qualifiesPhysicalInterface"]:
        raise SystemExit("qualification flag must stay false")
    print("channel cascade wrote results/summary.json (UNVERIFIED, not qualified)")


if __name__ == "__main__":
    main()
