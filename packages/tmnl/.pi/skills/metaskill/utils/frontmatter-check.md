# util:frontmatter-check

> up: INDEX.md
> prereqs: none
> provides: frontmatter-field-count-per-file
> children: none

Count frontmatter fields per file in a skill. Useful for spotting files with weak or missing headers.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  fields=$(head -6 "$f" | grep -cP '> (up|prereqs|provides|children|governed-by|meta|cross):')
  echo "$fields fields  $f"
done
```

## Output

Each line shows field count and file path. Files with 0 fields have no frontmatter. Files with 1-2 fields may be incomplete (most docs should have 3-4: up, prereqs, provides, children).
