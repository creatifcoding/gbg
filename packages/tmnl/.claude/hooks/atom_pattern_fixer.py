#!/usr/bin/env python3
"""
PreToolUse Hook: Atom Pattern Auto-Fixer

Transforms Atom.set()/Atom.get() to registry.set()/registry.get() in TypeScript files.
Infers the registry name from file imports.

Input (stdin): JSON with tool_name, tool_input
Output (stdout): JSON with updatedInput containing transformed content

Exit codes:
  0 - Success (with optional updatedInput)
  2 - Block (if transformation fails and we need user intervention)
"""

import json
import re
import sys
from pathlib import Path


def find_registry_name(content: str) -> str | None:
    """
    Infer registry name from imports and variable declarations.

    Patterns searched:
    1. `const fooRegistry = Registry.make()` -> "fooRegistry"
    2. `export const barRegistry = Registry.make()` -> "barRegistry"
    3. `import { someRegistry } from` -> "someRegistry"
    """
    patterns = [
        # const/let/export const XXXRegistry = Registry.make()
        r'(?:export\s+)?(?:const|let)\s+(\w+Registry)\s*=\s*Registry\.make\(',
        # Variable named *Registry or *registry imported
        r'import\s+\{[^}]*\b(\w*[Rr]egistry)\b[^}]*\}\s+from',
        # Direct Registry.make() assignment with any name containing 'registry'
        r'(?:const|let)\s+(\w*[Rr]egistry\w*)\s*=\s*Registry\.make\(',
    ]

    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return match.group(1)

    return None


def transform_atom_calls(content: str, registry_name: str) -> tuple[str, list[str]]:
    """
    Transform Atom.set() and Atom.get() to registry equivalents.

    Returns:
        tuple of (transformed_content, list_of_changes_made)
    """
    changes = []

    # Pattern: Atom.set(atomName, value) -> registry.set(atomName, value)
    # But NOT: ctx.set() or registry.set() (already correct)
    atom_set_pattern = r'\bAtom\.set\s*\('
    atom_get_pattern = r'\bAtom\.get\s*\('

    # Count matches before transformation
    set_matches = len(re.findall(atom_set_pattern, content))
    get_matches = len(re.findall(atom_get_pattern, content))

    if set_matches > 0:
        content = re.sub(atom_set_pattern, f'{registry_name}.set(', content)
        changes.append(f"Transformed {set_matches} Atom.set() -> {registry_name}.set()")

    if get_matches > 0:
        content = re.sub(atom_get_pattern, f'{registry_name}.get(', content)
        changes.append(f"Transformed {get_matches} Atom.get() -> {registry_name}.get()")

    return content, changes


def has_atom_calls(content: str) -> bool:
    """Check if content contains Atom.set() or Atom.get() calls."""
    return bool(re.search(r'\bAtom\.(set|get)\s*\(', content))


def is_inside_effect_context(content: str, match_pos: int) -> bool:
    """
    Heuristic: Check if an Atom.set/get call might be inside Effect.gen context.

    This is a best-effort check - looks for nearby Effect.gen or yield* patterns.
    """
    # Look at surrounding 500 chars
    start = max(0, match_pos - 500)
    end = min(len(content), match_pos + 200)
    context = content[start:end]

    # If we see Effect.gen or yield* nearby, it might be valid Effect context
    effect_patterns = [
        r'Effect\.gen\s*\(',
        r'yield\s*\*',
        r'\.pipe\s*\(',
        r'Effect\.runPromise',
        r'Effect\.runSync',
    ]

    for pattern in effect_patterns:
        if re.search(pattern, context):
            return True

    return False


def analyze_atom_calls(content: str) -> list[dict]:
    """
    Find all Atom.set/get calls and determine if they're likely problematic.
    """
    issues = []

    for match in re.finditer(r'\bAtom\.(set|get)\s*\(', content):
        method = match.group(1)
        pos = match.start()

        # Get line number
        line_num = content[:pos].count('\n') + 1

        # Get the line content
        line_start = content.rfind('\n', 0, pos) + 1
        line_end = content.find('\n', pos)
        if line_end == -1:
            line_end = len(content)
        line_content = content[line_start:line_end].strip()

        # Check if likely inside Effect context
        in_effect = is_inside_effect_context(content, pos)

        issues.append({
            'method': method,
            'line': line_num,
            'content': line_content[:80],  # Truncate long lines
            'in_effect_context': in_effect,
            'needs_fix': not in_effect,
        })

    return issues


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing input JSON: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only process Edit and Write tools
    if tool_name not in ("Edit", "Write"):
        sys.exit(0)

    file_path = tool_input.get("file_path", "")

    # Only process TypeScript/TSX files
    if not file_path.endswith(('.ts', '.tsx')):
        sys.exit(0)

    # Get the content being written
    if tool_name == "Write":
        content = tool_input.get("content", "")
    elif tool_name == "Edit":
        content = tool_input.get("new_string", "")
    else:
        sys.exit(0)

    # Check for Atom.set/get patterns
    if not has_atom_calls(content):
        sys.exit(0)

    # Analyze the calls
    issues = analyze_atom_calls(content)
    fixable_issues = [i for i in issues if i['needs_fix']]

    if not fixable_issues:
        # All calls are inside Effect context, likely fine
        sys.exit(0)

    # Try to find registry name
    # First check the content being written
    registry_name = find_registry_name(content)

    # If not found in content, try to read the existing file
    if not registry_name and file_path:
        try:
            existing_content = Path(file_path).read_text()
            registry_name = find_registry_name(existing_content)
        except (FileNotFoundError, PermissionError):
            pass

    # If still not found, check for common patterns in the file path
    if not registry_name:
        # Default based on common patterns
        if 'fermion' in file_path.lower() or 'iot' in file_path.lower():
            registry_name = 'iotRegistry'
        elif 'sensor' in file_path.lower():
            registry_name = 'sensorRegistry'
        else:
            # Can't auto-fix without registry name - warn but don't block
            warning = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": (
                        f"Found {len(fixable_issues)} Atom.set()/get() calls outside Effect context, "
                        f"but couldn't infer registry name. Consider using registry.set()/get() pattern.\n"
                        f"Locations:\n" +
                        "\n".join(f"  Line {i['line']}: {i['content']}" for i in fixable_issues[:5])
                    )
                }
            }
            print(json.dumps(warning))
            sys.exit(0)

    # Transform the content
    transformed_content, changes = transform_atom_calls(content, registry_name)

    if not changes:
        sys.exit(0)

    # Build the updatedInput
    if tool_name == "Write":
        updated_input = {**tool_input, "content": transformed_content}
    else:  # Edit
        updated_input = {**tool_input, "new_string": transformed_content}

    # Return success with transformation
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": (
                f"Auto-fixed Atom pattern using '{registry_name}':\n" +
                "\n".join(f"  • {c}" for c in changes)
            ),
            "updatedInput": updated_input
        },
        "systemMessage": f"🔧 Auto-fixed: {', '.join(changes)}"
    }

    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
