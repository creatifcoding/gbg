#!/usr/bin/env python3
"""Replace React namespace member references with named React imports.

Default target: ./src relative to the current working directory.
This is intentionally boring: it rewrites local TS/TSX files, merges existing
named imports, preserves type-only imports, and removes namespace imports.
"""
from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

REACT_MEMBER_RE = re.compile(r"\bReact\.([A-Za-z_$][\w$]*)")
REACT_IMPORT_RE = re.compile(
    r"(?ms)^import\s+(?P<body>.*?)\s+from\s+(?P<quote>['\"])react(?P=quote)\s*;?\n?"
)

TYPE_EXPORTS = {
    "AriaAttributes",
    "AriaRole",
    "Attributes",
    "CSSProperties",
    "ChangeEvent",
    "ClipboardEvent",
    "ComponentProps",
    "ComponentPropsWithRef",
    "ComponentPropsWithoutRef",
    "Dispatch",
    "DragEvent",
    "ElementRef",
    "FC",
    "FormEvent",
    "ForwardedRef",
    "HTMLAttributes",
    "KeyboardEvent",
    "MouseEvent",
    "MutableRefObject",
    "PropsWithChildren",
    "ReactElement",
    "ReactNode",
    "Ref",
    "RefCallback",
    "RefObject",
    "SetStateAction",
    "SyntheticEvent",
}

SOURCE_EXTENSIONS = {".ts", ".tsx"}
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".direnv",
    ".next",
    ".turbo",
    ".vite",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "vendor",
}



def split_named_imports(body: str) -> tuple[set[str], set[str]]:
    """Return (values, types) from a react import body."""
    values: set[str] = set()
    types: set[str] = set()
    named_match = re.search(r"\{(?P<named>.*?)\}", body, flags=re.S)
    if not named_match:
        return values, types

    for raw_part in named_match.group("named").split(","):
        part = raw_part.strip()
        if not part:
            continue
        is_type = part.startswith("type ")
        if is_type:
            part = part[5:].strip()
        # Preserve the imported binding name for de-duping; aliases are rare here,
        # but `Foo as Bar` should be considered occupied by Bar in the local file.
        local_name = part.split(" as ")[-1].strip()
        if is_type:
            types.add(local_name)
        else:
            values.add(local_name)
    return values, types


def generated_import(values: set[str], types: set[str]) -> str:
    # If a symbol is needed as a value, it cannot be type-only.
    types = types - values
    specifiers = [f"type {name}" for name in sorted(types)] + sorted(values)
    return f"import {{ {', '.join(specifiers)} }} from 'react'\n" if specifiers else ""


def rewrite_source(text: str) -> tuple[str, bool]:
    members = set(REACT_MEMBER_RE.findall(text))
    if not members:
        return text, False

    value_members = {name for name in members if name not in TYPE_EXPORTS}
    type_members = members - value_members

    existing_values: set[str] = set()
    existing_types: set[str] = set()
    first_import_start: int | None = None

    def remove_react_import(match: re.Match[str]) -> str:
        nonlocal first_import_start, existing_values, existing_types
        if first_import_start is None:
            first_import_start = match.start()
        values, types = split_named_imports(match.group("body"))
        existing_values |= values
        existing_types |= types
        return ""

    without_react_imports = REACT_IMPORT_RE.sub(remove_react_import, text)
    replaced = REACT_MEMBER_RE.sub(lambda match: match.group(1), without_react_imports)

    new_import = generated_import(existing_values | value_members, existing_types | type_members)
    if not new_import:
        return replaced, replaced != text

    insert_at = first_import_start
    if insert_at is None:
        import_match = re.search(r"(?m)^import\s+", replaced)
        insert_at = import_match.start() if import_match else 0
    rewritten = replaced[:insert_at] + new_import + replaced[insert_at:]
    return rewritten, rewritten != text


def iter_source_files(paths: list[Path], excluded_dirs: set[str]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            for root, dirs, names in os.walk(path):
                dirs[:] = [name for name in dirs if name not in excluded_dirs]
                root_path = Path(root)
                for name in names:
                    child = root_path / name
                    if child.suffix in SOURCE_EXTENSIONS:
                        files.append(child)
        elif path.is_file() and path.suffix in SOURCE_EXTENSIONS:
            files.append(path)
    return sorted(set(files))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", type=Path, default=[Path("src")])
    parser.add_argument("--check", action="store_true", help="Report files that would change without writing")
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Directory basename to prune; can be passed multiple times",
    )
    args = parser.parse_args()
    excluded_dirs = DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir)

    changed: list[Path] = []
    for file_path in iter_source_files(args.paths, excluded_dirs):
        before = file_path.read_text(encoding="utf-8")
        after, did_change = rewrite_source(before)
        if not did_change:
            continue
        changed.append(file_path)
        if not args.check:
            file_path.write_text(after, encoding="utf-8")

    for file_path in changed:
        print(file_path)
    if args.check and changed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
