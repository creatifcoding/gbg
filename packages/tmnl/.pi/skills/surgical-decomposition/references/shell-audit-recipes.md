# Shell Audit Recipes

Copy-paste shell commands for every phase of surgical decomposition. Replace `TARGET` placeholders with your actual paths.

## Pre-Decomposition Audit

### Full section map (functions, classes, constants, section headers)
```bash
grep -n '^export function\|^export const\|^export class\|^export type\|^export interface\|^// ===' TARGET_FILE
```

### Consumer map (who imports what)
```bash
# List all consumers
grep -rn "from.*TARGET_MODULE" src/ --include='*.ts' --include='*.tsx' | \
  grep -v 'TARGET_FILE:' | sed 's/:.*from.*//' | sort -u

# Per-consumer symbol list
for f in $(grep -rln "from.*TARGET_MODULE" src/ --include='*.ts' --include='*.tsx' | grep -v TARGET_FILE); do
  echo "--- $(basename $f):"
  grep -B20 "from.*TARGET_MODULE" "$f" | grep -E '^\s+\w+' | sed 's/,$//' | tr -d ' '
  echo ""
done
```

### Dependency graph (what does target import)
```bash
grep "^import" TARGET_FILE
```

### Cycle detection (does any dependency import target back)
```bash
for dep in $(grep "^import.*from './" TARGET_FILE | sed "s/.*from '//;s/'.*//"); do
  dep_file="$(dirname TARGET_FILE)/${dep}.ts"
  [ -f "$dep_file" ] && grep -q "$(basename TARGET_FILE .ts)" "$dep_file" && \
    echo "CYCLE: $(basename $dep_file)" || echo "OK: $(basename $dep_file)"
done
```

### Line count
```bash
wc -l < TARGET_FILE
```

## Post-Extraction Verification

### Verify after every single extraction
```bash
npx tsc --noEmit && echo "TSC: CLEAN" || echo "TSC: BROKEN"
npx vitest run path/to/tests/ 2>&1 | tail -3
```

### Full module audit (line counts per file)
```bash
find NEW_DIR -name '*.ts' -o -name '*.tsx' | sort | while read f; do
  lines=$(wc -l < "$f"); base="${f#NEW_DIR/}"
  printf "  %-40s %3d lines\n" "$base" "$lines"
done
```

### Directory summary
```bash
for dir in subdir1 subdir2 subdir3; do
  count=$(find "NEW_DIR/$dir" -maxdepth 1 -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)
  total=$(find "NEW_DIR/$dir" -maxdepth 1 \( -name '*.ts' -o -name '*.tsx' \) -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
  printf "  %-20s %2d files  %4s lines\n" "$dir/" "$count" "${total:-0}"
done
```

### Cycle check on new modules
```bash
for f in NEW_DIR/*.ts; do
  imports=$(grep "from './" "$f" | sed "s/.*from '.\///;s/'.*//;s/\.ts$//" | sort -u)
  for imp in $imports; do
    back=$(grep "from '.*$(basename $f .ts)'" "NEW_DIR/$imp.ts" 2>/dev/null | grep -v "^import type")
    [ -n "$back" ] && echo "RUNTIME CYCLE: $(basename $f) <-> $imp.ts"
  done
done
```

### Verify shim re-exports match barrel
```bash
diff <(grep 'export' NEW_DIR/index.ts | sed 's/export //' | sort) \
     <(grep 'export' SHIM_FILE | sed 's/export //' | sort)
```

## Efficiency Audit

### Redundant singleton calls in one function
```bash
grep -n 'getInstance()\|getStx()\|getStore()' TARGET_FILE | \
  awk -F: '{print $1}' | uniq -c | sort -rn | head -5
# Lines appearing >1 = same function calls getInstance multiple times
```

### Multiple .peek() on same observable
```bash
grep -n '\.peek()' TARGET_FILE | sort
```

### forEach on hot path (prefer indexed for-loop)
```bash
grep -n '\.forEach(' TARGET_FILE
```

### Verbose guard patterns (could be optional chain)
```bash
grep -n 'if.*peek.*{' TARGET_FILE
# Check if the body is just a .set() — replace with ?.field.set()
```

### Object spread in loops (allocation pressure)
```bash
grep -n '{ \.\.\.' TARGET_FILE
```

## Composition Pattern Audit

### Count props on a component
```bash
grep -c 'readonly\|?:' COMPONENT_FILE
```

### Count useCallback in provider (target: 0)
```bash
grep -c 'useCallback' PROVIDER_FILE
```

### Verify state module decoupled from provider
```bash
grep 'from.*state-module' PROVIDER_FILE && echo "COUPLED" || echo "DECOUPLED"
```

### Verify data-slot on all atoms
```bash
for f in ATOMS_DIR/*.tsx; do
  grep -q 'data-slot=' "$f" && echo "✓ $(basename $f)" || echo "✗ $(basename $f)"
done
```

### Verify compound namespace exports
```bash
grep -c 'Header:\|Content:\|Resize:\|Title:\|Controls:' COMPONENT_FILE
```

### Provider line count (target: ≤150)
```bash
wc -l < PROVIDER_FILE
```

## Git

### Staged diff stats
```bash
git diff --cached --stat
```

### Commit template
```bash
git commit -m "refactor(domain): decompose [file] into [subdir]/ modules

Split [N]-line monolith into [M] focused modules:

[subdir]/module1.ts  ([N] lines) — description
[subdir]/module2.ts  ([N] lines) — description

[file].ts            ([N] lines) — backward-compat re-export shim

Cycle audit: CLEAN
Efficiency fixes: [list]
[N]/[N] tests pass, tsc clean"
```
