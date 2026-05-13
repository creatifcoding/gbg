# util:audit-all

> up: INDEX.md
> prereqs: none
> provides: bulk-workspace-audit
> children: none

Bulk-audit every skill in the workspace. One line per skill.

```bash
printf "%-35s %s  %5s  %s  %s\n" "SKILL" "GOV" "FILES" "CL" "FM_MISS"
printf "%-35s %s  %5s  %s  %s\n" "-----" "---" "-----" "--" "-------"
for skill in .pi/skills/*/SKILL.md; do
  dir=$(dirname "$skill")
  name=$(basename "$dir")
  files=$(find "$dir" -name '*.md' | wc -l)
  gov=$(grep -q 'governed-by: metaskill' "$skill" 2>/dev/null && echo "✓" || echo "✗")
  cl=$(test -f "$dir/CHANGELOG.md" && echo "✓" || echo "✗")
  fm_miss=0
  for f in $(find "$dir" -name '*.md'); do
    head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || fm_miss=$((fm_miss + 1))
  done
  printf "%-35s  %s   %4d   %s   %d\n" "$name" "$gov" "$files" "$cl" "$fm_miss"
done
```

## Output

Table with one row per skill. Columns:
- **GOV**: ✓ if `governed-by: metaskill` in SKILL.md
- **FILES**: total .md file count
- **CL**: ✓ if CHANGELOG.md exists
- **FM_MISS**: count of files missing frontmatter (0 = clean)
