from __future__ import annotations

from carriage.contract import d
from carriage.csg import Box, CylinderZ, SolidSpec
from carriage.kinematics import sample_pinch


def _contact_ys(contract: dict) -> list[float]:
    count = int(d(contract, "rail.contact_count").value)
    pitch = d(contract, "rail.contact_pitch").value
    land = d(contract, "rail.contact_land_width").value
    field = (count - 1) * pitch + land
    y0 = (d(contract, "carriage.envelope.depth").value - field) / 2.0 + land / 2.0
    return [y0 + i * pitch for i in range(count)]


def unique_carriage_parts(contract: dict) -> list[SolidSpec]:
    w = d(contract, "carriage.envelope.width").value
    depth = d(contract, "carriage.envelope.depth").value
    h = d(contract, "carriage.envelope.height").value
    wall = 3.0
    shell = SolidSpec(
        solid_id="B22-carriage-outer-shell",
        bom_id="B22",
        title="carriage outer shell",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="part.B22",
        unique_part=True,
        adds=(Box(0, 0, 2.0, w, depth, h - 2.0),),
        cuts=(Box(wall, wall, 2.0, w - 2 * wall, depth - 2 * wall, h),),
        notes="Untethered. No trailing cable solid. Envelope 60 x 42 x 28 REF.",
    )
    lever = SolidSpec(
        solid_id="B23-pinch-lever",
        bom_id="B23",
        title="opposed pinch lever and cam",
        kind="printed-part",
        volume_class="service",
        status="ref",
        frame="part.B23",
        unique_part=True,
        adds=(Box(0, 0, 0, 8.0, 12.0, 22.0),),
        notes="Two per carriage. Cam slots sequence S1, lift pawl, then translation pawl.",
    )
    carrier = SolidSpec(
        solid_id="B24-contact-carrier",
        bom_id="B24",
        title="split floating contact carrier",
        kind="printed-part",
        volume_class="service",
        status="ref",
        frame="part.B24",
        unique_part=True,
        adds=(Box(0, 0, 0, 36.0, 32.0, 6.0),),
        notes="HSD cell seats vertically with P01-P08. Split float; series UNVERIFIED.",
    )
    spring_pocket = SolidSpec(
        solid_id="B25-spring-pocket",
        bom_id="B25",
        title="normally locked carriage spring pocket",
        kind="printed-part",
        volume_class="service",
        status="unverified",
        frame="part.B25",
        unique_part=True,
        adds=(Box(0, 0, 0, 10.0, 10.0, 16.0),),
        cuts=(CylinderZ(5.0, 5.0, 0.0, 16.0, 6.0),),
        notes="Spring rate/PN UNVERIFIED. Pocket only; not a sourced spring.",
    )
    roller = SolidSpec(
        solid_id="B26-roller",
        bom_id="B26",
        title="polymer roller",
        kind="printed-part",
        volume_class="service",
        status="unverified",
        frame="part.B26",
        unique_part=True,
        adds=(
            CylinderZ(
                0.0,
                0.0,
                0.0,
                6.0,
                d(contract, "b26.roller_diameter").value,
            ),
        ),
        notes="PN absent. Four per carriage. Load path through rollers/dovetail, not pogos.",
    )
    diameter = d(contract, "pogo.proxy_diameter").value
    barrel = d(contract, "pogo.barrel_length").value
    pitch = d(contract, "rail.contact_pitch").value
    pogos = []
    for i in range(int(d(contract, "rail.contact_count").value)):
        pogos.append(CylinderZ(i * pitch, 0.0, 0.0, barrel, diameter))
    array = SolidSpec(
        solid_id="B27-contact-array-proxy",
        bom_id="B27",
        title="12-position spring contact array proxy",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="part.B27",
        unique_part=True,
        metal=True,
        adds=tuple(pogos),
        notes="UNVERIFIED series/PN (#23). Animal-side copper prohibited. MIPI is not on these contacts.",
    )
    pawl = SolidSpec(
        solid_id="B23-lift-pawl",
        bom_id="B23",
        title="hardware lift pawl",
        kind="printed-part",
        volume_class="service",
        status="target",
        frame="part.B23",
        unique_part=True,
        adds=(Box(0, 0, 0, 4.0, 10.0, 5.0),),
        notes="Positive blocker under B24 until q >= PINCH_SAFE. Not a timed delay.",
    )
    trans = SolidSpec(
        solid_id="B23-translation-pawl",
        bom_id="B23",
        title="hardware translation pawl",
        kind="printed-part",
        volume_class="service",
        status="target",
        frame="part.B23",
        unique_part=True,
        adds=(Box(0, 0, 0, 4.0, 8.0, 6.0),),
        notes="Blocks dovetail/roll until carrier lift >= clearance.",
    )
    return [shell, lever, carrier, spring_pocket, roller, array, pawl, trans]


def posed_carriage(contract: dict, q: float, x_roll: float = 0.0) -> list[SolidSpec]:
    pinch = sample_pinch(q, contract)
    w = d(contract, "carriage.envelope.width").value
    depth = d(contract, "carriage.envelope.depth").value
    h = d(contract, "carriage.envelope.height").value
    lift = pinch.carrier_lift_mm
    roll = x_roll if pinch.translation_unlocked else 0.0
    wall = 3.0
    ys = _contact_ys(contract)
    diameter = d(contract, "pogo.proxy_diameter").value
    barrel = d(contract, "pogo.barrel_length").value
    land_w = d(contract, "rail.contact_land_width").value
    rail_w = d(contract, "rail.envelope.width").value

    shell = SolidSpec(
        solid_id="B22-shell-posed",
        bom_id="B22",
        title="carriage outer shell",
        kind="printed-part",
        volume_class="external",
        status="ref",
        frame="carriage.local",
        adds=(Box(roll, 0.0, 2.0 + lift * 0.0, w, depth, h - 2.0),),
        notes="Shell does not lift; only B24/B27 ride the lift cam after PINCH_SAFE.",
    )
    carrier = SolidSpec(
        solid_id="B24-carrier-posed",
        bom_id="B24",
        title="floating contact carrier",
        kind="printed-part",
        volume_class="service",
        status="ref",
        frame="carriage.local",
        adds=(Box(roll + wall, 5.0, 1.5 + lift, 36.0, 32.0, 6.0),),
    )
    pogos = []
    lands = []
    for i, y in enumerate(ys):
        # Tip at z=0 when lift=0 (on land). Barrel stands in +z.
        pogos.append(
            CylinderZ(roll + w / 2.0 - 14.0, y, lift - 0.15, barrel + 0.15, diameter)
        )
        lands.append(Box(roll - 2.0, y - land_w / 2.0, -0.2, w + 4.0, land_w, 0.2))
    array = SolidSpec(
        solid_id="B27-array-posed",
        bom_id="B27",
        title="B27 contact array posed",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="carriage.local",
        metal=True,
        adds=tuple(pogos),
        notes="P01-P12. Continuous P01-P08 and discrete P09-P12 share the carrier. No animal-side copper.",
    )
    land_plane = SolidSpec(
        solid_id="KO-land-plane-study",
        bom_id="B19",
        title="study land plane (OpenSCAD strip; PR 34 STEP not admitted)",
        kind="conductor-proxy",
        volume_class="conductor",
        status="ref",
        frame="carriage.local",
        metal=True,
        adds=tuple(lands),
        notes="External rail lands. B20 stays the animal/wet barrier; this plane is outside the animal volume.",
    )
    pawl_z = 0.0 if pinch.lift_pawl_engaged else -6.0
    lift_pawl = SolidSpec(
        solid_id="B23-lift-pawl-posed",
        bom_id="B23",
        title="lift pawl",
        kind="blocker",
        volume_class="service",
        status="target",
        frame="carriage.local",
        adds=(Box(roll + wall + 8.0, 12.0, pawl_z, 4.0, 10.0, 5.0),),
        notes="Engaged under B24 until PINCH_SAFE.",
    )
    trans_x = roll + w - 6.0 if not pinch.translation_unlocked else roll + w + 8.0
    trans_pawl = SolidSpec(
        solid_id="B23-translation-pawl-posed",
        bom_id="B23",
        title="translation pawl",
        kind="blocker",
        volume_class="service",
        status="target",
        frame="carriage.local",
        adds=(Box(trans_x, 8.0, 2.0 + lift, 4.0, 8.0, 6.0),),
    )
    roller_d = d(contract, "b26.roller_diameter").value
    rollers = []
    for i, (rx, ry) in enumerate(((8.0, 6.0), (w - 8.0, 6.0), (8.0, depth - 6.0), (w - 8.0, depth - 6.0))):
        rollers.append(
            SolidSpec(
                solid_id=f"B26-roller-{i + 1}",
                bom_id="B26",
                title="polymer roller",
                kind="printed-part",
                volume_class="service",
                status="unverified",
                frame="carriage.local",
                adds=(CylinderZ(roll + rx, ry, 2.0 + (lift if pinch.translation_unlocked else 0.0), 6.0, roller_d),),
            )
        )
    s1 = SolidSpec(
        solid_id="IF-S1-actuator",
        bom_id="B48",
        title="S1 actuator envelope",
        kind="interlock-interface",
        volume_class="service",
        status="unverified",
        frame="carriage.local",
        adds=(
            Box(
                roll + 4.0,
                depth / 2.0 - 4.0,
                8.0,
                d(contract, "s1.actuator_envelope").value,
                8.0,
                8.0,
            ),
        ),
        notes="UNVERIFIED. #24 unmet. Not a switch PN. First pinch travel changes this channel while B27 stays put.",
    )
    slot = d(contract, "b52.slot_clearance").value
    field = (d(contract, "rail.contact_count").value - 1) * d(contract, "rail.contact_pitch").value + land_w
    y_field0 = (depth - field) / 2.0
    b52 = SolidSpec(
        solid_id="KO-B52-study-slot",
        bom_id="B52",
        title="B52 study slot lips (OpenSCAD; PR 34 not admitted)",
        kind="keep-out",
        volume_class="service",
        status="ref",
        frame="carriage.local",
        adds=(
            Box(roll - 4.0, 0.0, -1.5, w + 8.0, max(0.2, y_field0 - slot), 1.5),
            Box(
                roll - 4.0,
                y_field0 + field + slot,
                -1.5,
                w + 8.0,
                max(0.2, depth - (y_field0 + field + slot)),
                1.5,
            ),
        ),
        notes="Guarded external slot. Lands reachable from outside only.",
    )
    stop_l = d(contract, "b51.end_stop_length").value
    b51 = SolidSpec(
        solid_id="KO-B51-study-stop",
        bom_id="B51",
        title="B51 study end stop (OpenSCAD 8 mm; PR 34 not admitted)",
        kind="keep-out",
        volume_class="service",
        status="ref",
        frame="carriage.local",
        adds=(Box(-stop_l, 0.0, 0.0, stop_l, rail_w, d(contract, "rail.envelope.height").value),),
        notes="Route retention interface. Fastener PN UNVERIFIED. Not a copy of PR 34 STEP.",
    )
    mipi = SolidSpec(
        solid_id="KO-no-mipi-on-pogo",
        bom_id="B27",
        title="declaration: MIPI is not on B27",
        kind="declaration",
        volume_class="service",
        status="locked",
        frame="carriage.local",
        adds=(),
        notes="Raw MIPI stays binder-local. B27 P09-P12 are serialized video only.",
    )
    return [
        shell,
        carrier,
        array,
        land_plane,
        lift_pawl,
        trans_pawl,
        *rollers,
        s1,
        b52,
        b51,
        mipi,
    ]
