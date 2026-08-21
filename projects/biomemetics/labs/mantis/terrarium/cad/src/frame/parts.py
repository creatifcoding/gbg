from __future__ import annotations

from frame.contract import d
from frame.csg import Box, SolidSpec


def unique_frame_parts(contract: dict) -> list[SolidSpec]:
    band = d(contract, "frame.band").value
    pitch = d(contract, "frame.module_pitch").value
    panel = d(contract, "panel.stock_thickness").value
    seat = d(contract, "cassette.seat_clearance").value
    pocket_inset = d(contract, "cassette.pocket_inset").value
    pocket_h = d(contract, "cassette.pocket_height").value
    pocket_z = d(contract, "cassette.pocket_z").value
    edge_inset = d(contract, "edge.inner_shell_inset").value
    corner_inset = d(contract, "corner.inner_shell_inset").value
    coupler = d(contract, "b03.coupler_length").value
    pocket_t = panel + seat

    corner = SolidSpec(
        solid_id="B01-corner-block",
        bom_id="B01",
        title="PETG/ASA corner block",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="part.B01",
        unique_part=True,
        adds=(Box(0, 0, 0, band, band, band),),
        cuts=(
            Box(corner_inset, corner_inset, 0, band, band, band),
            Box(4, pocket_inset, 0, pocket_t, 10, band),
            Box(pocket_inset, 4, 0, 10, pocket_t, band),
        ),
        notes="Eight corners on the 250/500 tower. Discrete 24 mm cube REF from frame.band.",
    )
    edge = SolidSpec(
        solid_id="B02-edge-250",
        bom_id="B02",
        title="250 mm edge member",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="part.B02",
        unique_part=True,
        adds=(Box(0, 0, 0, pitch, band, band),),
        cuts=(
            Box(
                edge_inset,
                edge_inset,
                edge_inset,
                pitch - 2 * edge_inset,
                band - 2 * edge_inset,
                band,
            ),
            Box(0, pocket_inset, pocket_z, pitch, pocket_t, pocket_h),
        ),
        notes="Also placed as a mid-span 250 member in each 500 vertical.",
    )
    splice = SolidSpec(
        solid_id="B03-splice-250-500",
        bom_id="B03",
        title="250-to-500 splice/alignment block",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="part.B03",
        unique_part=True,
        adds=(Box(0, 0, 0, coupler, band, band),),
        notes="Length is the 22 REF COUPLER annotation on S03, not a scaled drawing.",
    )
    retainer = SolidSpec(
        solid_id="B04-cassette-retainer",
        bom_id="B04",
        title="cassette retainer/gasket carrier",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="part.B04",
        unique_part=True,
        adds=(Box(0, 0, 0, pitch, pocket_t + 2, pocket_h + 2),),
        cuts=(Box(4, 1, 1, pitch - 8, pocket_t, pocket_h),),
        notes="Seat is stock 3.00 LOCK plus 0.20 TARGET clearance.",
    )
    ceiling = SolidSpec(
        solid_id="B10-ceiling-mesh-frame",
        bom_id="B10",
        title="two-piece ceiling mesh frame",
        kind="printed-part",
        volume_class="screen",
        status="ref",
        frame="part.B10",
        unique_part=True,
        metal=False,
        adds=(Box(0, 0, 0, pitch, pitch, 6),),
        cuts=(Box(band, band, 0, pitch - 2 * band, pitch - 2 * band, 6),),
        notes="Non-metal screen aperture <=0.80 mm LOCK lives in the frame opening. No metal mesh.",
    )
    return [corner, edge, splice, retainer, ceiling]


def frame_world_solids(contract: dict) -> list[SolidSpec]:
    pitch = d(contract, "frame.module_pitch").value
    span = d(contract, "frame.first_span").value
    band = d(contract, "frame.band").value
    coupler = d(contract, "b03.coupler_length").value
    solids: list[SolidSpec] = []

    corners = (
        (0.0, 0.0, 0.0),
        (pitch - band, 0.0, 0.0),
        (0.0, pitch - band, 0.0),
        (pitch - band, pitch - band, 0.0),
        (0.0, 0.0, span - band),
        (pitch - band, 0.0, span - band),
        (0.0, pitch - band, span - band),
        (pitch - band, pitch - band, span - band),
    )
    for index, (x, y, z) in enumerate(corners, start=1):
        solids.append(
            SolidSpec(
                solid_id=f"B01-corner-{index:02d}",
                bom_id="B01",
                title="corner block instance",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(x, y, z, band, band, band),),
            )
        )

    z_levels = (0.0, span - band)
    for z in z_levels:
        tag = "bottom" if z == 0.0 else "top"
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-{tag}-front",
                bom_id="B02",
                title="250 mm edge member",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(0, 0, z, pitch, band, band),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-{tag}-back",
                bom_id="B02",
                title="250 mm edge member",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(0, pitch - band, z, pitch, band, band),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-{tag}-left",
                bom_id="B02",
                title="250 mm edge member",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(0, 0, z, band, pitch, band),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-{tag}-right",
                bom_id="B02",
                title="250 mm edge member",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(pitch - band, 0, z, band, pitch, band),),
            )
        )

    verticals = (
        (0.0, 0.0, "front-left"),
        (pitch - band, 0.0, "front-right"),
        (0.0, pitch - band, "back-left"),
        (pitch - band, pitch - band, "back-right"),
    )
    mid_z = pitch
    for x, y, name in verticals:
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-lower-{name}",
                bom_id="B02",
                title="250 mm vertical edge",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(x, y, band, band, band, mid_z - band),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B02-midspan-{name}",
                bom_id="B02",
                title="mid-span 250 mm edge at 500 span joint",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(x, y, mid_z, band, band, band),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B03-splice-{name}",
                bom_id="B03",
                title="250-to-500 splice",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(x, y, mid_z - coupler / 2.0, band, band, coupler),),
            )
        )
        solids.append(
            SolidSpec(
                solid_id=f"B02-edge-upper-{name}",
                bom_id="B02",
                title="250 mm vertical edge",
                kind="printed-part",
                volume_class="external",
                status="ref",
                frame="frame.world",
                adds=(Box(x, y, mid_z + band, band, band, span - band - (mid_z + band)),),
            )
        )
    return solids
