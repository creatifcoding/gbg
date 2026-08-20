from __future__ import annotations

from boundary.parts import boundary_world_solids, unique_boundary_parts
from frame.contract import load_contract
from frame.csg import SolidSpec
from frame.parts import frame_world_solids, unique_frame_parts
from rail.parts import rail_world_solids, unique_rail_parts


def unique_printed_and_cut(contract: dict) -> list[SolidSpec]:
    parts = [
        *unique_frame_parts(contract),
        *unique_rail_parts(contract),
        *unique_boundary_parts(contract),
    ]
    by_id = {part.solid_id: part for part in parts}
    return list(by_id.values())


def world_solids(contract: dict) -> list[SolidSpec]:
    return [
        *frame_world_solids(contract),
        *rail_world_solids(contract),
        *boundary_world_solids(contract),
    ]


def load_model() -> dict:
    contract = load_contract()
    world = world_solids(contract)
    unique = unique_printed_and_cut(contract)
    b20 = [solid for solid in world if solid.solid_id == "B20-animal-wet-barrier"]
    return {
        "contract": contract,
        "world": world,
        "unique": unique,
        "b20": b20,
    }
