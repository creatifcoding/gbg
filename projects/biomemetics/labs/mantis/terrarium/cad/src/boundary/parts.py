from __future__ import annotations

from frame.contract import d
from frame.csg import Box, SolidSpec


def unique_boundary_parts(contract: dict) -> list[SolidSpec]:
    clear_w = d(contract, "animal.clear.width").value
    clear_h = d(contract, "animal.clear.height").value
    panel = d(contract, "panel.stock_thickness").value
    return [
        SolidSpec(
            solid_id="B05-view-cassette",
            bom_id="B05",
            title="3 mm cast-acrylic view cassette",
            kind="cut-profile",
            volume_class="external",
            status="ref",
            frame="part.B05",
            unique_part=True,
            adds=(Box(0, 0, 0, clear_w, panel, clear_h),),
            notes="Nominal cut profile. Kerf-compensated derivative is named separately.",
        ),
        SolidSpec(
            solid_id="B06-front-door",
            bom_id="B06",
            title="3 mm cast-acrylic front door",
            kind="cut-profile",
            volume_class="external",
            status="ref",
            frame="part.B06",
            unique_part=True,
            adds=(Box(0, 0, 0, clear_w, panel, clear_h),),
        ),
        SolidSpec(
            solid_id="B07-door-labyrinth",
            bom_id="B07",
            title="printed door labyrinth surround",
            kind="printed-part",
            volume_class="external",
            status="target",
            frame="part.B07",
            unique_part=True,
            adds=(Box(0, 0, 0, clear_w + 12, 8, clear_h + 12),),
            cuts=(
                Box(6, 0, 6, clear_w, 8, clear_h),
            ),
            notes="Nymph-visible door gap TARGET <=0.50 mm plus labyrinth.",
        ),
        SolidSpec(
            solid_id="B12-low-intake-vent",
            bom_id="B12",
            title="low-intake vent cassette",
            kind="printed-part",
            volume_class="external",
            status="ref",
            frame="part.B12",
            unique_part=True,
            metal=False,
            adds=(Box(0, 0, 0, 80, 12, 80),),
            notes="Non-metal screen. Aperture <=0.80 mm LOCK.",
        ),
        SolidSpec(
            solid_id="B13-high-exhaust-vent",
            bom_id="B13",
            title="high-exhaust vent cassette",
            kind="printed-part",
            volume_class="external",
            status="ref",
            frame="part.B13",
            unique_part=True,
            metal=False,
            adds=(Box(0, 0, 0, 80, 12, 80),),
        ),
        SolidSpec(
            solid_id="B14-false-bottom",
            bom_id="B14",
            title="perforated false bottom",
            kind="printed-part",
            volume_class="wet",
            status="ref",
            frame="part.B14",
            unique_part=True,
            metal=False,
            adds=(
                Box(
                    0,
                    0,
                    0,
                    d(contract, "animal.clear.width").value,
                    d(contract, "animal.clear.depth").value,
                    3,
                ),
            ),
        ),
    ]


def boundary_world_solids(contract: dict) -> list[SolidSpec]:
    pitch = d(contract, "frame.module_pitch").value
    span = d(contract, "frame.first_span").value
    band = d(contract, "frame.band").value
    clear_w = d(contract, "animal.clear.width").value
    clear_d = d(contract, "animal.clear.depth").value
    clear_h = d(contract, "animal.clear.height").value
    tray = d(contract, "false_bottom.tray_depth").value
    offset = d(contract, "rail.offset_from_frame").value
    rail_w = d(contract, "rail.envelope.width").value
    wall = d(contract, "rail.side_wall").value
    pocket = d(contract, "cassette.pocket_inset").value
    molt = d(contract, "husbandry.upper_third_clear").value
    gap = d(contract, "door.nymph_visible_gap_max").value
    aperture = d(contract, "husbandry.screen.aperture_max").value
    y_rail0 = -rail_w - offset
    x_rail0 = -rail_w - offset
    animal_z0 = band + tray
    front_b20 = Box(0, y_rail0 + rail_w - wall, 0, pitch, offset + wall + pocket, span)
    left_b20 = Box(x_rail0 + rail_w - wall, 0, 0, offset + wall + pocket, pitch, span)
    corner_b20 = Box(
        x_rail0 + rail_w - wall,
        y_rail0 + rail_w - wall,
        0,
        offset + wall + pocket,
        offset + wall + pocket,
        span,
    )
    return [
        SolidSpec(
            solid_id="B20-animal-wet-barrier",
            bom_id="B20",
            title="continuous structural rail wall / wet-side barrier",
            kind="barrier",
            volume_class="external",
            status="ref",
            frame="frame.world",
            unique_part=True,
            metal=False,
            adds=(front_b20, left_b20, corner_b20),
            notes=(
                "Fused across joints, splices, ends, door, and cassette seats on the "
                "front and left external faces. Not an insulating film over contacts. "
                "No animal-side copper, pogo, or metal mesh."
            ),
        ),
        SolidSpec(
            solid_id="KO-animal-volume",
            bom_id="B20",
            title="animal volume keep-out",
            kind="keep-out",
            volume_class="animal",
            status="calculated",
            frame="frame.world",
            adds=(Box(band, band, animal_z0, clear_w, clear_d, clear_h),),
        ),
        SolidSpec(
            solid_id="KO-wet-volume",
            bom_id="B15",
            title="wet / drain-tray keep-out",
            kind="keep-out",
            volume_class="wet",
            status="ref",
            frame="frame.world",
            adds=(Box(band, band, band, clear_w, clear_d, tray),),
        ),
        SolidSpec(
            solid_id="KO-hang-molt-ceiling",
            bom_id="B11",
            title="upper-third hang-molt keep-out",
            kind="keep-out",
            volume_class="molt",
            status="calculated",
            frame="frame.world",
            adds=(
                Box(
                    band,
                    band,
                    animal_z0 + clear_h - molt,
                    clear_w,
                    clear_d,
                    molt,
                ),
            ),
            notes="Textured or mesh ceiling. Smooth acrylic lids are prohibited. No metal mesh.",
        ),
        SolidSpec(
            solid_id="KO-ceiling-screen",
            bom_id="B11",
            title="non-metal ceiling screen keep-out",
            kind="keep-out",
            volume_class="screen",
            status="locked",
            frame="frame.world",
            metal=False,
            adds=(Box(band, band, span - band, clear_w, clear_d, band),),
            notes=f"Aperture <= {aperture} mm LOCK. Polymer/fiberglass/polyester only.",
        ),
        SolidSpec(
            solid_id="KO-nymph-door-gap",
            bom_id="B07",
            title="nymph-visible door gap keep-out",
            kind="keep-out",
            volume_class="animal",
            status="target",
            frame="frame.world",
            adds=(Box(band, 0, animal_z0, clear_w, gap, clear_h),),
        ),
        SolidSpec(
            solid_id="KO-door-swing",
            bom_id="B06",
            title="front door swing keep-out",
            kind="keep-out",
            volume_class="service",
            status="ref",
            frame="frame.world",
            adds=(Box(0, -clear_w, band, pitch, clear_w, span - 2 * band),),
        ),
        SolidSpec(
            solid_id="KO-false-bottom-drain",
            bom_id="B16",
            title="drain and insect-baffle keep-out",
            kind="keep-out",
            volume_class="wet",
            status="unverified",
            frame="frame.world",
            adds=(Box(pitch / 2.0 - 10, pitch / 2.0 - 10, 0, 20, 20, band + tray),),
            notes="Drain hardware PN is absent. Envelope only.",
        ),
        SolidSpec(
            solid_id="KO-pcb-envelope-unverified",
            bom_id="B48",
            title="PCB / B27 / B50 mating envelope proxy",
            kind="keep-out",
            volume_class="service",
            status="unverified",
            frame="rail.top_front",
            adds=(
                Box(
                    0,
                    y_rail0,
                    span - d(contract, "rail.envelope.height").value,
                    pitch,
                    rail_w,
                    d(contract, "rail.envelope.height").value + 12,
                ),
            ),
            notes="KiCad board envelopes, hole datums, and mating planes remain UNVERIFIED until #23 sources parts. Proxy is the rail envelope plus 12 mm REF height zone.",
        ),
    ]
