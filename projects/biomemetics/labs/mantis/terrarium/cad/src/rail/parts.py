from __future__ import annotations

from frame.contract import d
from frame.csg import Box, CylinderZ, SolidSpec


def _rail_local(contract: dict, length: float, *, bom_suffix: str) -> tuple[SolidSpec, ...]:
    rail_w = d(contract, "rail.envelope.width").value
    rail_h = d(contract, "rail.envelope.height").value
    wall = d(contract, "rail.side_wall").value
    field_w = contract["contactFieldWidth"]
    field_y = (rail_w - field_w) / 2.0
    guard_t = d(contract, "rail.guard_lip_thickness").value
    slot = d(contract, "b52.slot_clearance").value
    stop_l = d(contract, "b51.end_stop_length").value
    bore = d(contract, "b51.service_bore_diameter").value
    cavity_w = rail_w - 2 * wall
    return (
        SolidSpec(
            solid_id=f"B18-rail-channel-{bom_suffix}",
            bom_id="B18",
            title=f"external hybrid rail channel {bom_suffix}",
            kind="printed-part",
            volume_class="external",
            status="ref",
            frame="part.B18",
            unique_part=True,
            adds=(Box(0, 0, 0, length, rail_w, rail_h),),
            cuts=(
                Box(0, wall, 4, length, cavity_w, rail_h - 4),
                Box(0, field_y - 1, 0, length, field_w + 2, 5),
            ),
            notes="Rail stays on the outside of the 250/500 perimeter.",
        ),
        SolidSpec(
            solid_id=f"B52-access-guard-{bom_suffix}",
            bom_id="B52",
            title=f"external rail access-slot guard {bom_suffix}",
            kind="printed-part",
            volume_class="service",
            status="ref",
            frame="part.B52",
            unique_part=True,
            adds=(
                Box(0, 0, 0, length, max(0.0, field_y - slot), guard_t),
                Box(
                    0,
                    field_y + field_w + slot,
                    0,
                    length,
                    max(0.0, rail_w - (field_y + field_w + slot)),
                    guard_t,
                ),
            ),
            notes="Leaves ENIG lands contactable only inside the captive external carriage envelope. No animal-side metal mesh.",
        ),
        SolidSpec(
            solid_id="B51-end-stop",
            bom_id="B51",
            title="captive rail route end stop",
            kind="printed-part",
            volume_class="service",
            status="unverified",
            frame="part.B51",
            unique_part=True,
            adds=(Box(0, 0, 0, stop_l, rail_w, rail_h + guard_t),),
            cuts=(CylinderZ(stop_l / 2.0, rail_w / 2.0, 0.0, rail_h + guard_t, bore),),
            notes="M3 service bore diameter is study geometry. Fastener PN is absent.",
        ),
    )


def unique_rail_parts(contract: dict) -> list[SolidSpec]:
    pitch = d(contract, "frame.module_pitch").value
    span = d(contract, "frame.first_span").value
    parts_250 = _rail_local(contract, pitch, bom_suffix="250")
    parts_500 = _rail_local(contract, span, bom_suffix="500")
    seen: dict[str, SolidSpec] = {}
    for part in (*parts_250, *parts_500):
        seen[part.solid_id] = part
    return list(seen.values())


def b21_declaration() -> SolidSpec:
    return SolidSpec(
        solid_id="B21-routes-separate",
        bom_id="B21",
        title="top and vertical carriage routes are independent",
        kind="declaration",
        volume_class="external",
        status="ref",
        frame="frame.world",
        adds=(),
        notes=(
            "No B21 corner electrical/mechanical transition solid is authored. "
            "A carriage does not turn a corner. Top-front and front-left vertical "
            "routes terminate with their own B51 stops. Exact junction hardware remains UNVERIFIED."
        ),
    )


def rail_world_solids(contract: dict) -> list[SolidSpec]:
    pitch = d(contract, "frame.module_pitch").value
    span = d(contract, "frame.first_span").value
    rail_w = d(contract, "rail.envelope.width").value
    rail_h = d(contract, "rail.envelope.height").value
    offset = d(contract, "rail.offset_from_frame").value
    wall = d(contract, "rail.side_wall").value
    field_w = contract["contactFieldWidth"]
    field_y = (rail_w - field_w) / 2.0
    land_w = d(contract, "rail.contact_land_width").value
    pitch_c = d(contract, "rail.contact_pitch").value
    land_t = d(contract, "b19.land_thickness").value
    dock_len = d(contract, "b19.dock_pad_length").value
    dock_pitch = contract["videoDockPitch"]
    dock_count = int(d(contract, "rail.video_dock_count_per_span").value)
    guard_t = d(contract, "rail.guard_lip_thickness").value
    slot = d(contract, "b52.slot_clearance").value
    stop_l = d(contract, "b51.end_stop_length").value
    extra = 4.0
    y0 = -rail_w - offset
    x0 = -rail_w - offset
    top_z = span - rail_h
    solids: list[SolidSpec] = [
        SolidSpec(
            solid_id="B18-top-front-250",
            bom_id="B18",
            title="top-front external rail 250 mm",
            kind="printed-part",
            volume_class="external",
            status="ref",
            frame="rail.top_front",
            adds=(Box(0, y0, top_z, pitch, rail_w, rail_h),),
            notes="Outside the animal volume. +X along the front lintel.",
        ),
        SolidSpec(
            solid_id="B18-front-left-vertical-500",
            bom_id="B18",
            title="front-left vertical external rail 500 mm",
            kind="printed-part",
            volume_class="external",
            status="ref",
            frame="rail.front_left_vertical",
            adds=(Box(x0, y0, 0, rail_w, rail_w, span),),
            notes="Independent of the top-front route. Carriage does not turn this corner.",
        ),
        SolidSpec(
            solid_id="B52-top-front",
            bom_id="B52",
            title="top-front access guard",
            kind="printed-part",
            volume_class="service",
            status="ref",
            frame="rail.top_front",
            adds=(
                Box(0, y0, span, pitch, max(0.0, field_y - slot), guard_t),
                Box(
                    0,
                    y0 + field_y + field_w + slot,
                    span,
                    pitch,
                    max(0.0, rail_w - (field_y + field_w + slot)),
                    guard_t,
                ),
            ),
        ),
        SolidSpec(
            solid_id="B52-vertical",
            bom_id="B52",
            title="vertical access guard",
            kind="printed-part",
            volume_class="service",
            status="ref",
            frame="rail.front_left_vertical",
            adds=(
                Box(x0, y0, 0, max(0.0, field_y - slot), rail_w, span),
                Box(
                    x0 + field_y + field_w + slot,
                    y0,
                    0,
                    max(0.0, rail_w - (field_y + field_w + slot)),
                    rail_w,
                    span,
                ),
            ),
        ),
    ]

    top_stops = (
        ("B51-top-front-start", -stop_l, y0, top_z),
        ("B51-top-front-end", pitch, y0, top_z),
    )
    for solid_id, x, y, z in top_stops:
        solids.append(
            SolidSpec(
                solid_id=solid_id,
                bom_id="B51",
                title="captive end stop",
                kind="printed-part",
                volume_class="service",
                status="unverified",
                frame="rail.top_front",
                adds=(Box(x, y, z, stop_l, rail_w, rail_h + guard_t),),
            )
        )
    vert_stops = (
        ("B51-vertical-start", x0, y0, -stop_l),
        ("B51-vertical-end", x0, y0, span),
    )
    for solid_id, x, y, z in vert_stops:
        solids.append(
            SolidSpec(
                solid_id=solid_id,
                bom_id="B51",
                title="captive end stop",
                kind="printed-part",
                volume_class="service",
                status="unverified",
                frame="rail.front_left_vertical",
                adds=(Box(x, y, z, rail_w, rail_w, stop_l),),
            )
        )

    conductors: list[Box] = []
    for i in range(8):
        conductors.append(
            Box(0, y0 + field_y + i * pitch_c, top_z + 5, pitch, land_w, land_t)
        )
        conductors.append(
            Box(x0 + field_y + i * pitch_c, y0, 5, land_w, rail_w, span - 10)
        )
    for dock in range(dock_count):
        cx = dock_pitch / 2.0 + dock * dock_pitch - dock_len / 2.0
        cz = dock_pitch / 2.0 + dock * dock_pitch - dock_len / 2.0
        for i in range(8, 12):
            conductors.append(
                Box(cx, y0 + field_y + i * pitch_c, top_z + 5, dock_len, land_w, land_t)
            )
            conductors.append(
                Box(x0 + field_y + i * pitch_c, y0, cz, land_w, rail_w, dock_len)
            )
    solids.append(
        SolidSpec(
            solid_id="B19-conductor-proxy",
            bom_id="B19",
            title="P01-P12 land proxy (not a sourced stack-up)",
            kind="conductor-proxy",
            volume_class="conductor",
            status="unverified",
            frame="frame.world",
            metal=True,
            adds=tuple(conductors),
            notes="UNVERIFIED electrode geometry. Animal-side copper is prohibited. Lands stay in the external rail cavity.",
        )
    )
    solids.append(b21_declaration())
    solids.append(
        SolidSpec(
            solid_id="KO-carriage-untethered-top",
            bom_id="B22",
            title="untethered camera carriage keep-out along top-front route",
            kind="keep-out",
            volume_class="service",
            status="ref",
            frame="rail.top_front",
            adds=(
                Box(
                    0,
                    y0 - extra - d(contract, "carriage.envelope.depth").value,
                    span,
                    pitch,
                    d(contract, "carriage.envelope.depth").value + extra + rail_w,
                    d(contract, "carriage.envelope.height").value,
                ),
            ),
            notes="No trailing cable solid. Video while rolling is out of v1. Carriage need not turn the corner.",
        )
    )
    solids.append(
        SolidSpec(
            solid_id="KO-carriage-untethered-vertical",
            bom_id="B22",
            title="untethered camera carriage keep-out along vertical route",
            kind="keep-out",
            volume_class="service",
            status="ref",
            frame="rail.front_left_vertical",
            adds=(
                Box(
                    x0 - extra - d(contract, "carriage.envelope.depth").value,
                    y0 - extra - d(contract, "carriage.envelope.depth").value,
                    0,
                    d(contract, "carriage.envelope.depth").value + extra + rail_w,
                    d(contract, "carriage.envelope.depth").value + extra + rail_w,
                    span,
                ),
            ),
        )
    )
    return solids
