# util:router-coverage

> up: INDEX.md
> prereqs: none
> provides: skill-router-completeness-check
> children: none

Check that every leaf doc is reachable from SKILL.md — either directly mentioned, or its parent INDEX.md is mentioned (2-hop reachability).

```bash
SKILL=.pi/skills/<name>
echo "Checking reachability from SKILL.md:"
clean=true
for f in $(find $SKILL/references -name '*.md' 2>/dev/null | sort; find $SKILL/utils -name '*.md' 2>/dev/null | sort); do
  base=$(basename "$f")
  dir=$(dirname "$f")
  # Skip structural files — always reachable via directory routes
  [ "$base" = "INDEX.md" ] && continue
  [ "$base" = "REF.md" ] && continue
  # Direct: filename in SKILL.md
  grep -q "$base" $SKILL/SKILL.md && continue
  # Transitive: parent INDEX.md is in SKILL.md (2-hop)
  [ -f "$dir/INDEX.md" ] && grep -q "$(basename $dir)/INDEX.md\|$(basename $dir)/" $SKILL/SKILL.md && continue
  echo "  ⚠ NOT REACHABLE: $base ($f)"
  clean=false
done
$clean && echo "✓ All leaf docs reachable from SKILL.md (direct or via INDEX)"
```

## Output

**Pass:** `✓ All leaf docs reachable`

**Fail:** Files listed are not reachable from SKILL.md in ≤2 hops. Either add a direct route in SKILL.md, or ensure their parent directory's INDEX.md is routed.
