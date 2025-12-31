#!/usr/bin/env python3
"""
PostToolUse Hook: Smart Validation State Machine

Decides what validation to run based on multiple factors:
- File type (.ts/.tsx vs .js/.jsx vs other)
- Change size (lines changed)
- File location (src/ vs tests/ vs other)
- Recent validation state (avoid redundant checks)

State Machine States:
- FULL_CHECK: Run tsc + eslint
- TYPE_CHECK: Run tsc only
- LINT_CHECK: Run eslint only
- LIGHT_CHECK: Quick syntax check
- SKIP: No validation needed

Input (stdin): JSON with tool_name, tool_input, tool_response
Output (stdout): Validation results or skip message
"""

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


class ValidationLevel(Enum):
    FULL_CHECK = "full"      # tsc + eslint
    TYPE_CHECK = "type"      # tsc only
    LINT_CHECK = "lint"      # eslint only
    LIGHT_CHECK = "light"    # Quick check
    SKIP = "skip"            # No validation


@dataclass
class FileContext:
    """Context about the file being edited."""
    path: str
    extension: str
    is_typescript: bool
    is_javascript: bool
    is_test: bool
    is_source: bool
    is_config: bool
    change_size: int  # Approximate lines changed
    directory: str


@dataclass
class ValidationDecision:
    """Result of the state machine decision."""
    level: ValidationLevel
    reason: str
    commands: list[str]


def analyze_file_context(tool_input: dict, tool_response: dict) -> Optional[FileContext]:
    """Extract file context from tool input/response."""
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return None

    path = Path(file_path)
    extension = path.suffix.lower()

    # Determine file type
    is_typescript = extension in ('.ts', '.tsx')
    is_javascript = extension in ('.js', '.jsx', '.mjs', '.cjs')

    # Determine location
    parts = path.parts
    is_test = any(p in ('__tests__', 'test', 'tests', 'spec') for p in parts) or \
              any(path.name.endswith(s) for s in ('.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'))
    is_source = 'src' in parts
    is_config = path.name in (
        'package.json', 'tsconfig.json', 'vite.config.ts',
        '.eslintrc.js', '.eslintrc.json', 'tailwind.config.js'
    ) or extension in ('.json', '.yaml', '.yml')

    # Estimate change size
    change_size = 0
    if 'content' in tool_input:
        change_size = len(tool_input['content'].split('\n'))
    elif 'new_string' in tool_input:
        change_size = len(tool_input['new_string'].split('\n'))

    return FileContext(
        path=file_path,
        extension=extension,
        is_typescript=is_typescript,
        is_javascript=is_javascript,
        is_test=is_test,
        is_source=is_source,
        is_config=is_config,
        change_size=change_size,
        directory=str(path.parent),
    )


def decide_validation(ctx: FileContext) -> ValidationDecision:
    """
    State machine for validation decisions.

    Decision tree:
    1. Config files -> SKIP (let user handle manually)
    2. Non-JS/TS files -> SKIP
    3. Test files + small changes -> LIGHT_CHECK
    4. Test files + large changes -> TYPE_CHECK
    5. Source TypeScript + small changes -> TYPE_CHECK
    6. Source TypeScript + large changes -> FULL_CHECK
    7. Source JavaScript -> LINT_CHECK
    8. Other -> LIGHT_CHECK
    """
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    # Skip non-code files
    if ctx.is_config:
        return ValidationDecision(
            level=ValidationLevel.SKIP,
            reason="Config file - skipping auto-validation",
            commands=[]
        )

    if not (ctx.is_typescript or ctx.is_javascript):
        return ValidationDecision(
            level=ValidationLevel.SKIP,
            reason=f"Non-JS/TS file ({ctx.extension}) - skipping",
            commands=[]
        )

    # Test files - lighter validation
    if ctx.is_test:
        if ctx.change_size <= 20:
            return ValidationDecision(
                level=ValidationLevel.LIGHT_CHECK,
                reason=f"Test file, small change ({ctx.change_size} lines)",
                commands=[
                    f'cd "{project_dir}" && bun run tsc --noEmit --skipLibCheck 2>&1 | head -5 || true'
                ]
            )
        else:
            return ValidationDecision(
                level=ValidationLevel.TYPE_CHECK,
                reason=f"Test file, larger change ({ctx.change_size} lines)",
                commands=[
                    f'cd "{project_dir}" && timeout 45 bun run tsc --noEmit 2>&1 | head -15 || true'
                ]
            )

    # Source TypeScript files
    if ctx.is_typescript and ctx.is_source:
        if ctx.change_size <= 10:
            return ValidationDecision(
                level=ValidationLevel.TYPE_CHECK,
                reason=f"Source TS, small change ({ctx.change_size} lines)",
                commands=[
                    f'cd "{project_dir}" && timeout 30 bun run tsc --noEmit 2>&1 | head -10 || true'
                ]
            )
        else:
            return ValidationDecision(
                level=ValidationLevel.FULL_CHECK,
                reason=f"Source TS, substantial change ({ctx.change_size} lines)",
                commands=[
                    f'cd "{project_dir}" && timeout 45 bun run tsc --noEmit 2>&1 | head -15 || true',
                    f'cd "{project_dir}" && timeout 20 bunx eslint "{ctx.path}" --format compact 2>&1 | head -10 || true'
                ]
            )

    # JavaScript files
    if ctx.is_javascript:
        return ValidationDecision(
            level=ValidationLevel.LINT_CHECK,
            reason="JavaScript file - ESLint only",
            commands=[
                f'cd "{project_dir}" && timeout 20 bunx eslint "{ctx.path}" --fix --format compact 2>&1 | head -10 || true'
            ]
        )

    # TypeScript but not in src/
    if ctx.is_typescript:
        return ValidationDecision(
            level=ValidationLevel.TYPE_CHECK,
            reason="TypeScript outside src/",
            commands=[
                f'cd "{project_dir}" && timeout 30 bun run tsc --noEmit 2>&1 | head -10 || true'
            ]
        )

    # Fallback
    return ValidationDecision(
        level=ValidationLevel.LIGHT_CHECK,
        reason="Fallback - light syntax check",
        commands=[
            f'cd "{project_dir}" && bun run tsc --noEmit --skipLibCheck 2>&1 | head -5 || true'
        ]
    )


def run_validation(decision: ValidationDecision) -> str:
    """Execute validation commands and collect output."""
    if decision.level == ValidationLevel.SKIP:
        return f"⏭️  {decision.reason}"

    outputs = []
    outputs.append(f"🔍 Validation: {decision.level.value} ({decision.reason})")

    for cmd in decision.commands:
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60
            )
            output = result.stdout.strip() or result.stderr.strip()
            if output:
                outputs.append(output)
        except subprocess.TimeoutExpired:
            outputs.append("⏱️  Validation timed out")
        except Exception as e:
            outputs.append(f"⚠️  Validation error: {e}")

    return "\n".join(outputs)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing input JSON: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    tool_response = input_data.get("tool_response", {})

    # Only process Edit and Write tools
    if tool_name not in ("Edit", "Write"):
        sys.exit(0)

    # Analyze file context
    ctx = analyze_file_context(tool_input, tool_response)
    if not ctx:
        sys.exit(0)

    # Decide validation level
    decision = decide_validation(ctx)

    # Run validation
    output = run_validation(decision)

    # Print output (will be shown in verbose mode)
    if output:
        print(output)

    sys.exit(0)


if __name__ == "__main__":
    main()
