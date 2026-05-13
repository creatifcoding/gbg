# util:children-sync

> up: INDEX.md
> prereqs: none
> provides: index-children-vs-actual-file-drift-detection
> children: none

Check that every INDEX.md's declared `children` matches the actual files in its directory, and vice versa.

```bash
SKILL=.pi/skills/<name>
for idx in $(find $SKILL -name 'INDEX.md' | sort); do
  dir=$(dirname "$idx")
  echo "── $idx ──"
  declared=$(head -8 "$idx" | grep '> children:' | sed 's/> children: //' | tr ',' '\n' | tr -d ' ')
  # Files in dir not declared as children
  for f in $(ls "$dir"/*.md 2>/dev/null | sort); do
    base=$(basename "$f")
    [ "$base" = "INDEX.md" ] && continue
    echo "$declared" | grep -q "$base" || echo "  EXISTS BUT NOT DECLARED: $base"
  done
  # Declared children that don't exist
  for child in $declared; do
    [ "$child" = "none" ] && continue
    [ ! -f "$dir/$child" ] && echo "  DECLARED BUT MISSING: $child"
  done
done
```

## Output

**Pass:** Only `── path ──` headers, no findings under them.

**Fail:** `EXISTS BUT NOT DECLARED` means a file was added but INDEX frontmatter wasn't updated. `DECLARED BUT MISSING` means a file was deleted or renamed but INDEX wasn't updated.
