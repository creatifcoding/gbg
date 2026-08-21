"""Worktree-scoped isolation directories. Home profiles are not authority."""

from __future__ import annotations

from hashlib import sha256
import os
from pathlib import Path
import time


SUBDIRS = (
    "build",
    "cargo-target",
    "result",
    "browser",
    "cache",
    "solver-temp",
)


def worktree_id(lab_root: Path) -> str:
    resolved = str(lab_root.resolve())
    return sha256(resolved.encode("utf-8")).hexdigest()[:16]


def isolation_root(lab_root: Path, run_id: str | None = None) -> Path:
    preset = os.environ.get("MANTIS_ISOLATION_ROOT")
    if preset:
        root = Path(preset)
    else:
        ident = worktree_id(lab_root)
        run = run_id or os.environ.get("MANTIS_RUN_ID") or f"run-{int(time.time())}-{os.getpid()}"
        root = Path("/tmp/mantis-lab") / ident / run
    for name in SUBDIRS:
        (root / name).mkdir(parents=True, exist_ok=True)
    (root / "cache" / "cargo").mkdir(parents=True, exist_ok=True)
    (root / "cache" / "npm").mkdir(parents=True, exist_ok=True)
    (root / "cache" / "bun").mkdir(parents=True, exist_ok=True)
    (root / "cache" / "xdg").mkdir(parents=True, exist_ok=True)
    (root / "cache" / "pycache").mkdir(parents=True, exist_ok=True)
    (root / "cache" / "freecad").mkdir(parents=True, exist_ok=True)
    return root


def apply_env(lab_root: Path, run_id: str | None = None) -> Path:
    root = isolation_root(lab_root, run_id)
    os.environ["MANTIS_LAB_ROOT"] = str(lab_root.resolve())
    os.environ["MANTIS_ISOLATION_ROOT"] = str(root)
    os.environ["MANTIS_BUILD_DIR"] = str(root / "build")
    os.environ["MANTIS_RESULT_DIR"] = str(root / "result")
    os.environ["MANTIS_BROWSER_DIR"] = str(root / "browser")
    os.environ["MANTIS_CACHE_DIR"] = str(root / "cache")
    os.environ["MANTIS_SOLVER_TEMP"] = str(root / "solver-temp")
    os.environ["CARGO_TARGET_DIR"] = str(root / "cargo-target")
    os.environ["CARGO_HOME"] = str(root / "cache" / "cargo")
    os.environ["npm_config_cache"] = str(root / "cache" / "npm")
    os.environ.setdefault("npm_config_offline", "true")
    os.environ["BUN_INSTALL_CACHE_DIR"] = str(root / "cache" / "bun")
    os.environ["XDG_CACHE_HOME"] = str(root / "cache" / "xdg")
    os.environ["TMPDIR"] = str(root / "solver-temp")
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(root / "browser")
    os.environ["PYTHONPYCACHEPREFIX"] = str(root / "cache" / "pycache")
    os.environ["PYTHONNOUSERSITE"] = "1"
    os.environ["PIP_NO_INDEX"] = "1"
    os.environ.setdefault("CARGO_NET_OFFLINE", "true")
    os.environ["FREECAD_USER_HOME"] = str(root / "cache" / "freecad")
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    return root
