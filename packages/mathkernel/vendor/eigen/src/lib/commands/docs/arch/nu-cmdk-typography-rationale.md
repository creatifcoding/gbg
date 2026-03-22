# NuCmdk Typography Rationale (Vantablack Command Surface)

**Status:** Active (implementation-aligned)
**Date:** 2026-02-16
**Scope:** `src/lib/commands/shell/*`, `src/index.css`, `nix/modules/fonts.nix`
**Reference aesthetic:** `src/components/testbed/PipelineADRTestbed.tsx`

---

## Decision

NuCmdk command-surface typography uses a **Pipeline ADR-aligned mono-forward stack** with strict token control:

1. **UI text (`--font-cmdk-ui`)** → `var(--font-label)` / Share Tech Mono
   - query input, primary/secondary row content, footer text.
2. **Structural headings (`--font-cmdk-heading`)** → `var(--font-label)` / Share Tech Mono
   - mode band, kind tabs, section headers.
3. **Technical/meta (`--font-cmdk-mono`)** → `var(--font-label)` / Share Tech Mono
   - shortcuts, IDs, dense metadata, action chips.

In short: **single tactical mono voice**, tuned by weight/spacing/contrast rather than family switching.

Additional Pipeline ADR alignment choices:
- reduced forced casing (fewer global uppercase transforms),
- lower tracking in structural bands,
- hierarchy shifted to contrast + weight, not decorative spread.

Accessibility fallback remains available via Nix-provisioned alternates (e.g. Atkinson Hyperlegible Mono).

---

## Why this stack (and not font chaos)

### 1) Legibility under scan pressure
Command palettes are scan-heavy, not reading-heavy. We need fast parsing of labels, shortcuts, and status chips.

- Share Tech Mono gives high scan density and tactical rhythm without dropping below the 12px floor.
- Hierarchy is expressed through weight, tracking, and contrast (Pipeline ADR pattern), not family hopping.
- Character distinction for IDs/shortcuts (`I/l/1`, `O/0`) remains strong under mono-first rendering.

### 2) Preserve shell guardrails while allowing provider variance
NuCmdk contract says provider payload can vary semantically, but shell keeps layout/typography control. This stack supports that rule:

- Provider content can differ.
- Font system does not drift per provider.
- Surface stays coherent across lanes.

### 3) Vantablack aesthetic compatibility
The palette moved darker and tighter; a mono-forward voice with aggressive contrast and restrained radius matches the Pipeline ADR brutalist feel better than mixed-family stacks.

---

## Evidence base

Typography policy here follows established UI/accessibility guidance (not taste-only):

1. **NN/g legibility/readability model** (legibility, readability, comprehension, scanability):
   - https://www.nngroup.com/articles/legibility-readability-comprehension/
2. **NN/g typography fundamentals for UX teams**:
   - https://www.nngroup.com/articles/typography-terms-ux/
3. **WCAG 2.1 text contrast/resize/reflow constraints**:
   - https://www.w3.org/TR/WCAG21/
4. **Command palette interaction expectations** (keyboard-first, hierarchy, contextual ranking):
   - https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/
   - https://linear.app/changelog/2019-12-18-new-command-menu

---

## Non-negotiable constraints

1. **12px floor** for all command-surface text.
2. **No ad-hoc inline font families** in shell bands.
3. **Token-first styling** (`NU_CMDK_TOKENS.typography.family.*`).
4. **Low-radius surfaces** (Vantablack alignment; avoid pill inflation except explicit chips).
5. **Fallback-safe chains** so missing local assets do not break rendering.

---

## Why Nix provisioning is required

Local machine fonts are not deterministic. We need reproducible typography in:

- nix develop shells,
- CI/test environments,
- Tauri packaging workflows.

So font selection is materialized in `nix/modules/fonts.nix`, with mission-control scripts:

- `tmnl fonts-list`
- `tmnl fonts-sync`

`fonts-sync` copies curated font binaries into `assets/data/fonts/nix/*` so the web app bundles known files rather than relying on host OS installs.

---

## Implementation mapping

- **Nix module:** `nix/modules/fonts.nix`
- **Nix imports:** `nix/default.nix`, `nix/modules/default.nix`
- **CSS variables + @font-face:** `src/index.css`
- **Shell token contract:** `src/lib/commands/shell/tokens.ts`
- **Band usage:**
  - `src/lib/commands/shell/components/ModeBand.tsx`
  - `src/lib/commands/shell/components/KindBand.tsx`
  - `src/lib/commands/shell/components/QueryBand.tsx`
  - `src/lib/commands/shell/components/ResultsBand.tsx`
  - `src/lib/commands/shell/components/FooterBand.tsx`

---

## Deferred follow-ups

1. Add visual regression snapshots for font fallback paths (missing `assets/data/fonts/nix`).
2. Add perf note on variable-font payload tradeoffs (possible subsetting later).
3. Evaluate Atkinson as optional accessibility toggle for command surface.

---

## Acceptance checks

- Typecheck passes.
- NuCmdk shell tests pass.
- No text below 12px in command surface.
- No hardcoded per-component font family outside token contract.
- Documented rationale exists (this file) and is linked from docs index.
