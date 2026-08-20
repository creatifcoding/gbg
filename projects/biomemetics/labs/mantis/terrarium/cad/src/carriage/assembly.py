from __future__ import annotations

from binder.parts import posed_binder, unique_binder_parts
from carriage.contract import load_contract
from carriage.csg import SolidSpec
from carriage.kinematics import sample_binder, sample_pinch
from carriage.parts import posed_carriage, unique_carriage_parts


def unique_printed_and_proxy(contract: dict) -> list[SolidSpec]:
    parts = [*unique_carriage_parts(contract), *unique_binder_parts(contract)]
    by_id = {part.solid_id: part for part in parts}
    return list(by_id.values())


def posed_solids(
    contract: dict, *, q: float = 0.0, r: float = 0.0, x_roll: float = 0.0
) -> list[SolidSpec]:
    pinch = sample_pinch(q, contract)
    binder = sample_binder(r, pinch.state, contract)
    return [
        *posed_carriage(contract, q, x_roll=x_roll),
        *posed_binder(contract, binder),
    ]


def load_model(
    *, q: float = 0.0, r: float = 0.0, x_roll: float = 0.0
) -> dict:
    contract = load_contract()
    unique = unique_printed_and_proxy(contract)
    world = posed_solids(contract, q=q, r=r, x_roll=x_roll)
    return {
        "contract": contract,
        "unique": unique,
        "world": world,
        "pinch": sample_pinch(q, contract),
        "binder": sample_binder(r, sample_pinch(q, contract).state, contract),
    }
