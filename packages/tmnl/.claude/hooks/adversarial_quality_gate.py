#!/usr/bin/env python3
"""
Stop Hook: Adversarial Quality Gate

Blocks completion until quality checks pass:
1. Beads status (unclosed work warning)
2. Git status (uncommitted changes warning)
3. TypeScript check (type errors block)
4. Effect anti-pattern scan (violations warning)

Input (stdin): JSON with stop_hook_active
Output (stdout): JSON with decision to block or allow

Exit codes:
  0 - Success (block/allow via JSON)
"""

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# =============================================================================
# EFFECT ANTI-PATTERNS (from cube.kitlangton.com)
# =============================================================================
ANTI_PATTERNS = [
    # Untyped exceptions
    (r'throw\s+new\s+\w*Error', "Untyped exception - use Data.TaggedError"),

    # await inside Effect (but not runPromise/runSync)
    (r'\bawait\s+(?!Effect\.run)', "await inside Effect - use yield* instead"),

    # Type cast to any
    (r'\bas\s+any\b', "Type cast to any - validate with Schema"),

    # Global state access
    (r'\bglobalThis\.\w+\s*=', "Global state mutation - provide via Layer"),
    (r'\bwindow\.\w+\s*=', "Global state mutation - provide via Layer"),

    # Raw Promise construction
    (r'new\s+Promise\s*\(', "Raw Promise - use Effect.promise or Effect.async"),

    # Atom.set/get outside Effect context (in React callbacks)
    # This is tricky - we flag it but the atom_pattern_fixer should have caught it
    (r'onClick\s*=\s*\{[^}]*Atom\.(set|get)', "Atom.set/get in React callback - use registry.set/get"),
    (r'onChange\s*=\s*\{[^}]*Atom\.(set|get)', "Atom.set/get in React callback - use registry.set/get"),
]


@dataclass
class QualityReport:
    """Aggregated quality check results."""
    type_errors: list[str] = field(default_factory=list)
    anti_patterns: list[str] = field(default_factory=list)
    uncommitted_changes: bool = False
    unclosed_beads: list[str] = field(default_factory=list)

    @property
    def should_block(self) -> bool:
        """Block on type errors only."""
        return len(self.type_errors) > 0

    @property
    def has_warnings(self) -> bool:
        return (
            len(self.anti_patterns) > 0 or
            self.uncommitted_changes or
            len(self.unclosed_beads) > 0
        )

    def format_block_reason(self) -> str:
        parts = ["🚫 Quality Gate BLOCKED completion:"]

        if self.type_errors:
            parts.append(f"\n**TypeScript Errors ({len(self.type_errors)}):**")
            for err in self.type_errors[:5]:  # Limit to 5
                parts.append(f"  • {err}")
            if len(self.type_errors) > 5:
                parts.append(f"  ... and {len(self.type_errors) - 5} more")

        return "\n".join(parts)

    def format_warnings(self) -> str:
        parts = ["⚠️  Quality Gate Warnings:"]

        if self.anti_patterns:
            parts.append(f"\n**Effect Anti-Patterns ({len(self.anti_patterns)}):**")
            for ap in self.anti_patterns[:5]:
                parts.append(f"  • {ap}")

        if self.uncommitted_changes:
            parts.append("\n**Uncommitted Changes:** Run `git status` to review")

        if self.unclosed_beads:
            parts.append(f"\n**Unclosed Beads ({len(self.unclosed_beads)}):**")
            for bead in self.unclosed_beads[:3]:
                parts.append(f"  • {bead}")

        return "\n".join(parts)


def check_typescript() -> list[str]:
    """Run TypeScript check and collect errors."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        result = subprocess.run(
            ['bun', 'run', 'tsc', '--noEmit'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            return []

        # Parse errors from output
        errors = []
        for line in result.stdout.split('\n'):
            if 'error TS' in line:
                # Extract just the relevant part
                errors.append(line.strip()[:120])

        return errors

    except subprocess.TimeoutExpired:
        return ["TypeScript check timed out"]
    except Exception as e:
        return [f"TypeScript check failed: {e}"]


def check_git_status() -> bool:
    """Check for uncommitted changes."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10
        )

        # Any output means uncommitted changes
        return bool(result.stdout.strip())

    except Exception:
        return False


def check_beads() -> list[str]:
    """Check for in-progress beads."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        result = subprocess.run(
            ['bd', 'list', '--status=in_progress', '--format=json'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            return []

        # Parse JSON output
        try:
            issues = json.loads(result.stdout)
            return [f"{i['id']}: {i['title']}" for i in issues[:5]]
        except (json.JSONDecodeError, KeyError):
            # Fallback: parse line-by-line
            lines = result.stdout.strip().split('\n')
            return [line.strip() for line in lines if line.strip()][:5]

    except Exception:
        return []


def scan_anti_patterns() -> list[str]:
    """Scan recently changed files for Effect anti-patterns."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        # Get list of changed files
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD~5', '--', '*.ts', '*.tsx'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            return []

        changed_files = [f for f in result.stdout.strip().split('\n') if f]

        violations = []

        for file_path in changed_files[:10]:  # Limit files scanned
            full_path = Path(project_dir) / file_path
            if not full_path.exists():
                continue

            try:
                content = full_path.read_text()

                for pattern, message in ANTI_PATTERNS:
                    matches = re.findall(pattern, content)
                    if matches:
                        violations.append(f"{file_path}: {message}")
                        break  # One violation per file is enough

            except Exception:
                continue

        return violations

    except Exception:
        return []


def run_quality_checks() -> QualityReport:
    """Run all quality checks and aggregate results."""
    report = QualityReport()

    # TypeScript (most important - blocks)
    report.type_errors = check_typescript()

    # Git status (warning)
    report.uncommitted_changes = check_git_status()

    # Beads status (warning)
    report.unclosed_beads = check_beads()

    # Anti-pattern scan (warning)
    report.anti_patterns = scan_anti_patterns()

    return report


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    # Check if this is a second invocation (hook already ran once)
    stop_hook_active = input_data.get("stop_hook_active", False)

    if stop_hook_active:
        # Already blocked once, don't block again (avoid infinite loop)
        sys.exit(0)

    # Run quality checks
    report = run_quality_checks()

    # Determine outcome
    if report.should_block:
        output = {
            "decision": "block",
            "reason": report.format_block_reason()
        }
        print(json.dumps(output))
        sys.exit(0)

    # Warnings only - allow but notify
    if report.has_warnings:
        output = {
            "systemMessage": report.format_warnings()
        }
        print(json.dumps(output))
        sys.exit(0)

    # All clean
    print("✅ Quality gate passed")
    sys.exit(0)


if __name__ == "__main__":
    main()
