# util:cross-symmetry

> up: INDEX.md
> prereqs: none
> provides: bidirectional-cross-reference-validation
> children: none

Verify that every `cross:` declaration is bidirectional — if A declares `cross: B`, B must declare `cross: A`.

```bash
SKILL=.pi/skills/<name>
clean=true
for f in $(find $SKILL -name '*.md' | sort); do
  cross=$(head -8 "$f" | grep '> cross:' | sed 's/> cross: //' | tr ',' '\n' | tr -d ' ')
  [ -z "$cross" ] && continue
  dir=$(dirname "$f")
  base=$(basename "$f")
  parent=$(basename "$dir")
  for ref in $cross; do
    target="$dir/$ref"
    [ ! -f "$target" ] && { echo "✗ $f declares cross: $ref but file doesn't exist"; clean=false; continue; }
    # Check if target crosses back (by filename or by parent/filename pattern)
    grep -qP "cross:.*($base|$parent/)" "$target" || { echo "⚠ $f → cross: $ref  BUT  $ref doesn't cross back"; clean=false; }
  done
done
$clean && echo "✓ All cross-references are symmetric"
```

## Output

**Pass:** `✓ All cross-references are symmetric`

**Fail:** `⚠ A → cross: B BUT B doesn't cross back` — add the missing `cross:` field to B's frontmatter.
