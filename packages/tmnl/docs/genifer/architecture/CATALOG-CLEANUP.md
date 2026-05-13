# Catalog Cleanup — Deduplication & Reorganization

> **Status**: SPEC  
> **Epoch**: Catalog Overhaul (#F620)  
> **Date**: 2026-02-22

---

## Problem

After the core-domain-catalog expansion (69 components, vantablack aesthetic), the ui-domain-catalog now has **13 components that are redundant** with core. These duplicates use the old shadcn visual style (light mode defaults, generic colors), creating visual inconsistency and LLM confusion — two components with the same name but different renderers.

---

## Inventory: What Overlaps

| ui-domain-catalog | core-domain-catalog | Verdict |
|-------------------|---------------------|---------|
| Text | — (body text is `<p>`) | **REMOVE** — not worth a component |
| Heading | — (HTML headings) | **REMOVE** — use Box + semantic HTML |
| Button | ButtonRoot + 15 assemblies | **REMOVE** → replaced by button-domain-catalog |
| Card | Shell + HeaderBar | **REMOVE** → InfoCard, MetricCard cover this |
| CardHeader | HeaderBar | **REMOVE** |
| CardTitle | HLabel | **REMOVE** |
| CardDescription | — (just styled text) | **REMOVE** |
| CardContent | — (just a container) | **REMOVE** |
| CardFooter | — (just a flex div) | **REMOVE** |
| Input | core forms suite | **REMOVE** → Textarea, Select, DateInput cover inputs |
| Badge | Indicator | **REMOVE** |
| Alert | Callout + Banner | **REMOVE** |
| Separator | — (single `<hr>`) | **REMOVE** |

## What Stays in ui-domain-catalog

| Component | Why It's Unique |
|-----------|----------------|
| **Switch** | Boolean toggle with distinct visual treatment. Not the same as ToggleButton (which is a pressable button, not a slide toggle). |
| **Progress** | Progress bar with value fill. Not in core. Used for upload/download/processing feedback. |
| **FoldablePanel** | Domain-specific interactive panel wrapper for charts, maps, 3D views. Unique to the FoldablePanel subsystem. |
| **SemanticRegion** | Agent infrastructure — `data-semantic-*` attributes for Evolution agent targeting. Critical infrastructure, no equivalent in core. |

## Post-Cleanup File Map

```
src/lib/genifer/catalog/
├── core-domain-catalog.tsx      # 69 components — DONE, vantablack
├── button-domain-catalog.tsx    # 16 components — NEW, per BUTTON-SYSTEM.md
├── ui-domain-catalog.tsx        # 4 components  — GUTTED & restyled
├── geoint-domain-catalog.tsx    # 1 component   — unchanged
├── rvn-domain-catalog.tsx       # 19 components — unchanged
├── index.ts                     # barrel + registration
└── (layout/domain-catalog.tsx)  # 12 components — in layout module
```

**Total components across all catalogs after cleanup:**

| Catalog | Count | Change |
|---------|-------|--------|
| core-domain | 69 | — |
| button-domain | 16 | **+16 (new)** |
| ui-domain | 4 | **−13 (gutted)** |
| geoint-domain | 1 | — |
| rvn-domain | 19 | — |
| layout-domain | 12 | — |
| **Total** | **121** | net +3 |

## Restyling Plan for Remaining 4

### Switch (vantablack)
- Dark track: `rgba(50,50,50,0.6)` → cyan track when checked
- Thumb: neutral-400 → white when checked
- Label: font-mono, `var(--tmnl-text-sm, 14px)`, neutral-400

### Progress (vantablack)
- Track: `rgba(20,20,20,0.95)` with `1px solid rgba(50,50,50,0.6)` border
- Fill: cyan gradient `linear-gradient(90deg, rgba(34,211,238,0.6), rgb(34,211,238))`
- Label (optional): font-mono, `var(--tmnl-text-xs, 12px)`, neutral-500
- Value readout: font-mono, cyan, right-aligned

### FoldablePanel (no restyle needed)
- Already has its own design system via the FoldablePanel subsystem
- Badge colors match the harness palette
- No changes required

### SemanticRegion (invisible wrapper — no visual)
- Renders a `<div>` with data attributes, no visual chrome
- No restyle needed — it's infrastructure

---

## Migration Steps

1. **Remove 13 duplicated components** from `ui-domain-catalog.tsx`
2. **Remove associated schemas** (TextPropsSchema, HeadingPropsSchema, etc.)
3. **Remove associated renderers** (TextRenderer, HeadingRenderer, etc.)
4. **Restyle Switch + Progress** to vantablack
5. **Keep FoldablePanel + SemanticRegion** unchanged
6. **Update `defaultTier`** to `'domain'` (these are all domain-scoped, not core)
7. **Create `button-domain-catalog.tsx`** per BUTTON-SYSTEM.md
8. **Register button catalog** in `react/atoms/catalog.ts` and `harness/GeniferHarnessService.ts`
9. **Update tests** — adjust catalog-overhaul.test.ts component counts
10. **Verify full test suite** — 752+ genifer tests, zero tsc errors

---

## Test Impact

### Existing Tests to Update
- `catalog-overhaul.test.ts` — component counts will change:
  - UI domain count: 17 → 4
  - Total component count: adjust for removals + button additions
  - Add button-specific compound tests

### New Tests Needed
- `button-system.test.ts`:
  - All 16 components have valid schemas
  - All 11 variants render without error
  - All 5 sizes produce correct height
  - All 4 shapes produce correct border-radius
  - Compound relationships: ButtonRoot accepts slots
  - Named assemblies: ActionButton, ConfirmButton compose correctly
  - ButtonGroup accepts any button type
  - State props: loading, disabled, pressed, pulse
  - Tier assertions: core vs domain
  - Domain assertions: all have 'ui'

---

*Deduplication is not reduction. It's clarity.*
