from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Sequence


Status = Literal["locked", "ref", "target", "calculated", "unverified"]
SolidKind = Literal[
    "printed-part",
    "keep-out",
    "barrier",
    "conductor-proxy",
    "cut-profile",
    "declaration",
]
VolumeClass = Literal[
    "animal",
    "wet",
    "molt",
    "external",
    "conductor",
    "service",
    "screen",
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

    def expanded(self, margin: float) -> Box:
        return Box(
            self.xmin - margin,
            self.ymin - margin,
            self.zmin - margin,
            self.dx + 2 * margin,
            self.dy + 2 * margin,
            self.dz + 2 * margin,
        )


@dataclass(frozen=True)
class CylinderZ:
    x: float
    y: float
    zmin: float
    height: float
    diameter: float

    def aabb(self) -> tuple[float, float, float, float, float, float]:
        r = self.diameter / 2.0
        return (self.x - r, self.y - r, self.zmin, self.x + r, self.y + r, self.zmin + self.height)

    def as_box(self) -> Box:
        r = self.diameter / 2.0
        return Box(self.x - r, self.y - r, self.zmin, self.diameter, self.diameter, self.height)


@dataclass(frozen=True)
class Dim:
    name: str
    value: float
    unit: str
    status: Status
    source: str


@dataclass(frozen=True)
class SolidSpec:
    solid_id: str
    bom_id: str
    title: str
    kind: SolidKind
    volume_class: VolumeClass
    status: Status
    frame: str
    adds: tuple[Box, ...]
    cuts: tuple[Box | CylinderZ, ...] = ()
    metal: bool = False
    unique_part: bool = False
    notes: str = ""

    def add_boxes(self) -> tuple[Box, ...]:
        return self.adds

    def cut_boxes(self) -> tuple[Box, ...]:
        boxes: list[Box] = []
        for cut in self.cuts:
            boxes.append(cut if isinstance(cut, Box) else cut.as_box())
        return tuple(boxes)

    def aabb(self) -> tuple[float, float, float, float, float, float]:
        boxes = list(self.adds)
        if not boxes:
            return (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        xmin = min(box.xmin for box in boxes)
        ymin = min(box.ymin for box in boxes)
        zmin = min(box.zmin for box in boxes)
        xmax = max(box.xmax for box in boxes)
        ymax = max(box.ymax for box in boxes)
        zmax = max(box.zmax for box in boxes)
        return (xmin, ymin, zmin, xmax, ymax, zmax)

    def nominal_volume(self) -> float:
        added = sum(box.volume() for box in self.adds)
        cut = sum(box.volume() for box in self.cut_boxes())
        return max(0.0, added - cut)


def aabb_overlap(
    a: tuple[float, float, float, float, float, float],
    b: tuple[float, float, float, float, float, float],
    *,
    tol: float = 1e-9,
) -> bool:
    return (
        a[0] < b[3] - tol
        and a[3] > b[0] + tol
        and a[1] < b[4] - tol
        and a[4] > b[1] + tol
        and a[2] < b[5] - tol
        and a[5] > b[2] + tol
    )


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


def union_aabb(
    boxes: Iterable[tuple[float, float, float, float, float, float]],
) -> tuple[float, float, float, float, float, float] | None:
    items = list(boxes)
    if not items:
        return None
    xmin = min(item[0] for item in items)
    ymin = min(item[1] for item in items)
    zmin = min(item[2] for item in items)
    xmax = max(item[3] for item in items)
    ymax = max(item[4] for item in items)
    zmax = max(item[5] for item in items)
    return (xmin, ymin, zmin, xmax, ymax, zmax)


def conductor_animal_overlap(
    conductors: Sequence[SolidSpec],
    keepouts: Sequence[SolidSpec],
    *,
    expand: float,
) -> float:
    volume = 0.0
    expanded = []
    for keepout in keepouts:
        for box in keepout.adds:
            expanded.append(box.expanded(expand).aabb())
    for conductor in conductors:
        for box in conductor.adds:
            aabb = box.aabb()
            for keepout_aabb in expanded:
                volume += overlap_volume(aabb, keepout_aabb)
    return volume
