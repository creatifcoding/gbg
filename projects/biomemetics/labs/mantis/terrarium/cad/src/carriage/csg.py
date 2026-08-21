from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Sequence


Status = Literal["locked", "ref", "target", "calculated", "unverified"]
SolidKind = Literal[
    "printed-part",
    "keep-out",
    "conductor-proxy",
    "interlock-interface",
    "blocker",
    "declaration",
]
VolumeClass = Literal[
    "animal",
    "wet",
    "external",
    "conductor",
    "service",
    "binder",
]


@dataclass(frozen=True)
class Box:
    xmin: float
    ymin: float
    zmin: float
    dx: float
    dy: float
    dz: float

    @property
    def xmax(self) -> float:
        return self.xmin + self.dx

    @property
    def ymax(self) -> float:
        return self.ymin + self.dy

    @property
    def zmax(self) -> float:
        return self.zmin + self.dz

    def aabb(self) -> tuple[float, float, float, float, float, float]:
        return (self.xmin, self.ymin, self.zmin, self.xmax, self.ymax, self.zmax)

    def volume(self) -> float:
        if self.dx <= 0 or self.dy <= 0 or self.dz <= 0:
            return 0.0
        return self.dx * self.dy * self.dz

    def translated(self, dx: float, dy: float, dz: float) -> Box:
        return Box(self.xmin + dx, self.ymin + dy, self.zmin + dz, self.dx, self.dy, self.dz)


@dataclass(frozen=True)
class CylinderZ:
    x: float
    y: float
    zmin: float
    height: float
    diameter: float

    def aabb(self) -> tuple[float, float, float, float, float, float]:
        r = self.diameter / 2.0
        return (
            self.x - r,
            self.y - r,
            self.zmin,
            self.x + r,
            self.y + r,
            self.zmin + self.height,
        )

    def as_box(self) -> Box:
        r = self.diameter / 2.0
        return Box(self.x - r, self.y - r, self.zmin, self.diameter, self.diameter, self.height)

    def translated(self, dx: float, dy: float, dz: float) -> CylinderZ:
        return CylinderZ(self.x + dx, self.y + dy, self.zmin + dz, self.height, self.diameter)


@dataclass(frozen=True)
class Dim:
    name: str
    value: float
    unit: str
    status: Status
    source: str


Primitive = Box | CylinderZ


@dataclass(frozen=True)
class SolidSpec:
    solid_id: str
    bom_id: str
    title: str
    kind: SolidKind
    volume_class: VolumeClass
    status: Status
    frame: str
    adds: tuple[Primitive, ...]
    cuts: tuple[Primitive, ...] = ()
    metal: bool = False
    unique_part: bool = False
    notes: str = ""

    def add_boxes(self) -> tuple[Box, ...]:
        return tuple(p if isinstance(p, Box) else p.as_box() for p in self.adds)

    def aabb(self) -> tuple[float, float, float, float, float, float]:
        boxes = self.add_boxes()
        if not boxes:
            return (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        return (
            min(box.xmin for box in boxes),
            min(box.ymin for box in boxes),
            min(box.zmin for box in boxes),
            max(box.xmax for box in boxes),
            max(box.ymax for box in boxes),
            max(box.zmax for box in boxes),
        )

    def translated(self, dx: float, dy: float, dz: float) -> SolidSpec:
        return SolidSpec(
            solid_id=self.solid_id,
            bom_id=self.bom_id,
            title=self.title,
            kind=self.kind,
            volume_class=self.volume_class,
            status=self.status,
            frame=self.frame,
            adds=tuple(p.translated(dx, dy, dz) for p in self.adds),
            cuts=tuple(p.translated(dx, dy, dz) for p in self.cuts),
            metal=self.metal,
            unique_part=self.unique_part,
            notes=self.notes,
        )

    def nominal_volume(self) -> float:
        added = sum(
            (p.volume() if isinstance(p, Box) else p.as_box().volume()) for p in self.adds
        )
        cut = sum(
            (p.volume() if isinstance(p, Box) else p.as_box().volume()) for p in self.cuts
        )
        return max(0.0, added - cut)


def overlap_volume(
    a: tuple[float, float, float, float, float, float],
    b: tuple[float, float, float, float, float, float],
) -> float:
    dx = min(a[3], b[3]) - max(a[0], b[0])
    dy = min(a[4], b[4]) - max(a[1], b[1])
    dz = min(a[5], b[5]) - max(a[2], b[2])
    if dx <= 0 or dy <= 0 or dz <= 0:
        return 0.0
    return dx * dy * dz


def aabb_overlap(
    a: tuple[float, float, float, float, float, float],
    b: tuple[float, float, float, float, float, float],
    *,
    tol: float = 1e-9,
) -> bool:
    return overlap_volume(a, b) > tol


def union_aabb(
    boxes: Iterable[tuple[float, float, float, float, float, float]],
) -> tuple[float, float, float, float, float, float] | None:
    items = list(boxes)
    if not items:
        return None
    return (
        min(item[0] for item in items),
        min(item[1] for item in items),
        min(item[2] for item in items),
        max(item[3] for item in items),
        max(item[4] for item in items),
        max(item[5] for item in items),
    )


def metal_in_forbidden(
    solids: Sequence[SolidSpec], forbidden: set[str]
) -> list[str]:
    hits = []
    for solid in solids:
        if solid.metal and solid.volume_class in forbidden:
            hits.append(solid.solid_id)
        if solid.volume_class in {"animal", "wet"} and solid.metal:
            hits.append(solid.solid_id)
    return hits
