"""OCCT hidden-line projection helpers (OCP / OpenCASCADE).

FreeCADCmd is not present in this environment. cadquery-ocp exposes the same
HLRBRep kernel the flake-pinned FreeCAD build uses. Views are true millimetre
projections of STEP solids, not invented rectangles.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from OCP.BRep import BRep_Builder
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.Bnd import Bnd_Box
from OCP.TopoDS import TopoDS_Compound
from OCP.GCPnts import GCPnts_QuasiUniformDeflection
from OCP.HLRAlgo import HLRAlgo_Projector
from OCP.HLRBRep import HLRBRep_Algo, HLRBRep_HLRToShape
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_AsIs, STEPControl_Reader, STEPControl_Writer
from OCP.TopAbs import TopAbs_EDGE
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS, TopoDS_Shape
from OCP.gp import gp_Ax2, gp_Dir, gp_Pnt

CAD01_SHA = "fe8f875a80b37a1003f05f3a0190fbe2f0417842"


def load_step(path: Path) -> TopoDS_Shape:
    reader = STEPControl_Reader()
    status = reader.ReadFile(str(path))
    if int(status) != int(IFSelect_RetDone):
        raise RuntimeError(f"STEP read failed: {path}")
    if reader.TransferRoots() < 1:
        raise RuntimeError(f"STEP has no transferable roots: {path}")
    shape = reader.OneShape()
    if shape is None or shape.IsNull():
        raise RuntimeError(f"STEP produced a null shape: {path}")
    return shape


def write_step(shape: TopoDS_Shape, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = STEPControl_Writer()
    if int(writer.Transfer(shape, STEPControl_AsIs)) != 1:
        raise RuntimeError(f"STEP transfer failed: {path}")
    if int(writer.Write(str(path))) != int(IFSelect_RetDone):
        raise RuntimeError(f"STEP write failed: {path}")


def bbox3d(shape: TopoDS_Shape) -> tuple[float, float, float, float, float, float]:
    box = Bnd_Box()
    BRepBndLib.Add_s(shape, box)
    xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
    return (xmin, ymin, zmin, xmax, ymax, zmax)


def make_box(xmin: float, ymin: float, zmin: float, dx: float, dy: float, dz: float) -> TopoDS_Shape | None:
    if dx <= 0 or dy <= 0 or dz <= 0:
        return None
    return BRepPrimAPI_MakeBox(gp_Pnt(xmin, ymin, zmin), dx, dy, dz).Shape()


def make_cyl_z(x: float, y: float, zmin: float, height: float, diameter: float) -> TopoDS_Shape:
    axis = gp_Ax2(gp_Pnt(x, y, zmin), gp_Dir(0, 0, 1))
    return BRepPrimAPI_MakeCylinder(axis, diameter / 2.0, height).Shape()


def fuse_all(shapes: Iterable[TopoDS_Shape]) -> TopoDS_Shape:
    items = [shape for shape in shapes if shape is not None and not shape.IsNull()]
    if not items:
        raise RuntimeError("no solids to fuse")
    body = items[0]
    for extra in items[1:]:
        body = BRepAlgoAPI_Fuse(body, extra).Shape()
    return body


def compound_all(shapes: Iterable[TopoDS_Shape]) -> TopoDS_Shape:
    items = [shape for shape in shapes if shape is not None and not shape.IsNull()]
    if not items:
        raise RuntimeError("no solids to compound")
    builder = BRep_Builder()
    compound = TopoDS_Compound()
    builder.MakeCompound(compound)
    for item in items:
        builder.Add(compound, item)
    return compound


def cut_shape(body: TopoDS_Shape, cutter: TopoDS_Shape) -> TopoDS_Shape:
    return BRepAlgoAPI_Cut(body, cutter).Shape()


def keep_halfspace(shape: TopoDS_Shape, axis: str, at: float, keep_negative: bool = True) -> TopoDS_Shape:
    """Cut away one side of a plane normal to X/Y/Z so the remainder can be HLRed as a section."""

    xmin, ymin, zmin, xmax, ymax, zmax = bbox3d(shape)
    pad = 80.0
    if axis == "x":
        if keep_negative:
            cutter = make_box(at, ymin - pad, zmin - pad, (xmax - at) + pad, (ymax - ymin) + 2 * pad, (zmax - zmin) + 2 * pad)
        else:
            cutter = make_box(xmin - pad, ymin - pad, zmin - pad, (at - xmin) + pad, (ymax - ymin) + 2 * pad, (zmax - zmin) + 2 * pad)
    elif axis == "y":
        if keep_negative:
            cutter = make_box(xmin - pad, at, zmin - pad, (xmax - xmin) + 2 * pad, (ymax - at) + pad, (zmax - zmin) + 2 * pad)
        else:
            cutter = make_box(xmin - pad, ymin - pad, zmin - pad, (xmax - xmin) + 2 * pad, (at - ymin) + pad, (zmax - zmin) + 2 * pad)
    elif axis == "z":
        if keep_negative:
            cutter = make_box(xmin - pad, ymin - pad, at, (xmax - xmin) + 2 * pad, (ymax - ymin) + 2 * pad, (zmax - at) + pad)
        else:
            cutter = make_box(xmin - pad, ymin - pad, zmin - pad, (xmax - xmin) + 2 * pad, (ymax - ymin) + 2 * pad, (at - zmin) + pad)
    else:
        raise ValueError(f"axis must be x/y/z, not {axis}")
    if cutter is None:
        raise RuntimeError("section cutter collapsed")
    return cut_shape(shape, cutter)


def _unit(vec: Sequence[float]) -> tuple[float, float, float]:
    x, y, z = (float(vec[0]), float(vec[1]), float(vec[2]))
    length = (x * x + y * y + z * z) ** 0.5
    if length <= 0:
        raise ValueError("zero-length vector")
    return (x / length, y / length, z / length)


def _cross(a: Sequence[float], b: Sequence[float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def projector_ax2(direction: Sequence[float], x_hint: Sequence[float]) -> gp_Ax2:
    """gp_Ax2 Z is the view direction (object toward viewer). X is the 2D horizontal."""

    z_dir = _unit(direction)
    x_raw = _unit(x_hint)
    # Re-orthogonalize X against Z so isometric hints stay legal.
    y_dir = _unit(_cross(z_dir, x_raw))
    x_dir = _unit(_cross(y_dir, z_dir))
    return gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(*z_dir), gp_Dir(*x_dir))


def _shape_edges(shape: TopoDS_Shape | None) -> list[TopoDS_Shape]:
    if shape is None or shape.IsNull():
        return []
    edges: list[TopoDS_Shape] = []
    explorer = TopExp_Explorer(shape, TopAbs_EDGE)
    while explorer.More():
        edges.append(explorer.Current())
        explorer.Next()
    return edges


def _discretize_edge(edge_shape: TopoDS_Shape, deflection: float) -> list[list[float]]:
    edge = TopoDS.Edge_s(edge_shape)
    curve = BRepAdaptor_Curve(edge)
    sampler = GCPnts_QuasiUniformDeflection(curve, deflection)
    if not sampler.IsDone() or sampler.NbPoints() < 2:
        return []
    points: list[list[float]] = []
    for index in range(1, sampler.NbPoints() + 1):
        point = sampler.Value(index)
        points.append([round(point.X(), 4), round(point.Y(), 4)])
    # Drop degenerate strokes.
    span = max(abs(points[0][0] - points[-1][0]), abs(points[0][1] - points[-1][1]))
    if span < 0.02 and len(points) == 2:
        return []
    return points


def hlr_polylines(
    shape: TopoDS_Shape,
    direction: Sequence[float],
    x_hint: Sequence[float],
    *,
    deflection: float = 0.12,
) -> dict:
    algo = HLRBRep_Algo()
    algo.Add(shape)
    algo.Projector(HLRAlgo_Projector(projector_ax2(direction, x_hint)))
    algo.Update()
    algo.Hide()
    extracted = HLRBRep_HLRToShape(algo)

    visible_shapes = [
        extracted.VCompound(),
        extracted.OutLineVCompound(),
        extracted.Rg1LineVCompound(),
    ]
    hidden_shapes = [
        extracted.HCompound(),
        extracted.OutLineHCompound(),
        extracted.Rg1LineHCompound(),
    ]
    visible: list[list[list[float]]] = []
    hidden: list[list[list[float]]] = []
    for group, bucket in ((visible_shapes, visible), (hidden_shapes, hidden)):
        for item in group:
            for edge in _shape_edges(item):
                poly = _discretize_edge(edge, deflection)
                if poly:
                    bucket.append(poly)

    xs = [pt[0] for stroke in visible + hidden for pt in stroke]
    ys = [pt[1] for stroke in visible + hidden for pt in stroke]
    if not xs:
        xmin, ymin, zmin, xmax, ymax, zmax = bbox3d(shape)
        xs, ys = [xmin, xmax], [ymin, ymax]
    bbox2d = [min(xs), min(ys), max(xs), max(ys)]
    return {
        "visible": visible,
        "hidden": hidden,
        "bbox2d": [round(value, 4) for value in bbox2d],
        "bbox3d": [round(value, 4) for value in bbox3d(shape)],
        "direction": [float(v) for v in direction],
        "xHint": [float(v) for v in x_hint],
        "edgeCount": {"visible": len(visible), "hidden": len(hidden)},
    }
