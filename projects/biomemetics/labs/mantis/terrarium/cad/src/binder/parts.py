from __future__ import annotations

from carriage.csg import Box, SolidSpec
from carriage.contract import d
from carriage.kinematics import BinderSample


def unique_binder_parts(contract: dict) -> list[SolidSpec]:
    key = d(contract, "binder.b50_key_offset").value
    latch = SolidSpec(
        solid_id="B28-universal-latch-shoe",
        bom_id="B28",
        title="universal latch shoe",
        kind="printed-part",
        volume_class="binder",
        status="ref",
        frame="part.B28",
        unique_part=True,
        adds=(Box(0, 0, 0, 24.0, 14.0, 10.0), Box(6.0, 14.0, 2.0, 12.0, 8.0, 6.0)),
        notes="Carries binder moment around B50. Contacts are not the load path.",
    )
    housing = SolidSpec(
        solid_id="B29-camera-binder-housing",
        bom_id="B29",
        title="camera SerDes binder housing",
        kind="printed-part",
        volume_class="binder",
        status="ref",
        frame="part.B29",
        unique_part=True,
        adds=(Box(0, 0, 0, 40.0, 36.0, 22.0),),
        cuts=(Box(3.0, 3.0, 3.0, 34.0, 30.0, 19.0),),
        notes="Camera/serializer PCB envelope is UNVERIFIED. Service and thermal space inside the cut.",
    )
    fpc = SolidSpec(
        solid_id="B34-fpc-clamp",
        bom_id="B34",
        title="internal camera-to-serializer FPC clamp",
        kind="printed-part",
        volume_class="binder",
        status="ref",
        frame="part.B34",
        unique_part=True,
        adds=(Box(0, 0, 0, 16.0, 8.0, 3.0),),
        notes="Local CSI strain relief. Length/orientation UNVERIFIED (B37).",
    )
    carriage_half = SolidSpec(
        solid_id="B50-carriage-half-proxy",
        bom_id="B50",
        title="keyed B50 carriage half proxy",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="part.B50",
        unique_part=True,
        metal=True,
        adds=(Box(0, 0, 0, 18.0, 28.0, 4.0), Box(18.0, key, 0.0, 3.0, 4.0, 4.0)),
        notes="C01-C12 mirror required nets. Series, pinout, SI launch UNVERIFIED. Not a sourced connector.",
    )
    binder_half = SolidSpec(
        solid_id="B50-binder-half-proxy",
        bom_id="B50",
        title="keyed B50 binder half proxy",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="part.B50",
        unique_part=True,
        metal=True,
        adds=(Box(0, 0, 0, 18.0, 28.0, 4.0), Box(-3.0, key, 0.0, 3.0, 4.0, 4.0)),
        notes="Key blocks reverse mate. Partial click cannot clear the key.",
    )
    return [latch, housing, fpc, carriage_half, binder_half]


def posed_binder(contract: dict, sample: BinderSample) -> list[SolidSpec]:
    w = d(contract, "carriage.envelope.width").value
    depth = d(contract, "carriage.envelope.depth").value
    sep = sample.b50_separation_mm
    mate_x = w
    key = d(contract, "binder.b50_key_offset").value
    carriage_half = SolidSpec(
        solid_id="B50-carriage-posed",
        bom_id="B50",
        title="B50 carriage half",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="carriage.local",
        metal=True,
        adds=(
            Box(mate_x - 4.0, 7.0, 8.0, 4.0, 28.0, 4.0),
            Box(mate_x - 3.0, 7.0 + key, 8.0, 2.0, 4.0, 4.0),
        ),
        notes="Stays with the carriage. Load bypasses these faces via B28.",
    )
    binder_half = SolidSpec(
        solid_id="B50-binder-posed",
        bom_id="B50",
        title="B50 binder half",
        kind="conductor-proxy",
        volume_class="conductor",
        status="unverified",
        frame="carriage.local",
        metal=True,
        adds=(
            Box(mate_x + sep, 7.0, 8.0, 4.0, 28.0, 4.0),
            Box(mate_x + sep + 1.0, 7.0 + key, 8.0, 2.0, 4.0, 4.0),
        ),
        notes="Separates only after BRANCH_SAFE.",
    )
    latch = SolidSpec(
        solid_id="B28-latch-posed",
        bom_id="B28",
        title="universal latch shoe",
        kind="printed-part",
        volume_class="binder",
        status="ref",
        frame="carriage.local",
        adds=(
            Box(mate_x - 6.0, 10.0, 14.0, 24.0, 14.0, 10.0),
            Box(mate_x + 4.0 + sep, 12.0, 16.0, 12.0, 8.0, 6.0),
        ),
        notes="Moment path around B50. Partial click remains S2-open path; B50 stays keyed.",
    )
    pin_out = 10.0 if sample.release_allowed else 0.0
    block = SolidSpec(
        solid_id="B28-release-block-pin",
        bom_id="B28",
        title="binder release block pin",
        kind="blocker",
        volume_class="service",
        status="target",
        frame="carriage.local",
        adds=(Box(mate_x + 2.0 + pin_out, 16.0, 18.0, 4.0, 4.0, 8.0),),
        notes="Retracts only at PINCH_SAFE or later. Firmware cannot move this pin.",
    )
    housing = SolidSpec(
        solid_id="B29-housing-posed",
        bom_id="B29",
        title="camera binder housing",
        kind="printed-part",
        volume_class="binder",
        status="ref",
        frame="carriage.local",
        adds=(Box(mate_x + 4.0 + sep, 3.0, 4.0, 40.0, 36.0, 22.0),),
    )
    cam = d(contract, "camera.module_keepout").value
    camera_ko = SolidSpec(
        solid_id="KO-camera-module",
        bom_id="B36",
        title="camera module keep-out",
        kind="keep-out",
        volume_class="binder",
        status="unverified",
        frame="carriage.local",
        adds=(Box(mate_x + 8.0 + sep, 5.0, 6.0, cam, cam - 8.0, 8.0),),
        notes="B36 exact module/revision/STEP absent. Not an invented SKU outline.",
    )
    csi = d(contract, "csi.local_bend_keepout").value
    csi_ko = SolidSpec(
        solid_id="KO-local-csi-bend",
        bom_id="B37",
        title="local CSI bend/strain-relief keep-out",
        kind="keep-out",
        volume_class="binder",
        status="unverified",
        frame="carriage.local",
        adds=(Box(mate_x + 10.0 + sep, 8.0, 14.0, csi, 18.0, 6.0),),
        notes="Raw MIPI remains inside the binder. Not routed onto B50 or B27.",
    )
    thermal = SolidSpec(
        solid_id="KO-binder-thermal",
        bom_id="B29",
        title="binder thermal/service keep-out",
        kind="keep-out",
        volume_class="binder",
        status="unverified",
        frame="carriage.local",
        adds=(Box(mate_x + 6.0 + sep, 4.0, 20.0, 36.0, 32.0, 8.0),),
        notes="Thermal rise UNVERIFIED. Space reserved; not a measured budget.",
    )
    s2 = SolidSpec(
        solid_id="IF-S2-actuator",
        bom_id="B48",
        title="S2 actuator envelope",
        kind="interlock-interface",
        volume_class="service",
        status="unverified",
        frame="carriage.local",
        adds=(
            Box(
                mate_x - 2.0,
                depth / 2.0 - 4.0,
                4.0,
                d(contract, "s2.actuator_envelope").value,
                8.0,
                8.0,
            ),
        ),
        notes="UNVERIFIED. #24 unmet. First binder travel changes this channel while B50 stays seated.",
    )
    return [
        carriage_half,
        binder_half,
        latch,
        block,
        housing,
        camera_ko,
        csi_ko,
        thermal,
        s2,
    ]
