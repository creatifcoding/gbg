# ADR-007: Framer Motion for Animation — Not Custom Animatable System

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user)

---

## Context

TMNL has a custom `animatable()` + `useAnimatable()` animation library built on GSAP and anime.js drivers, integrated with effect-atom. The question is whether Tsingou's rendering layers should use this custom system or a mainstream library.

## Decision

**Use framer-motion for all animation in Tsingou.** The custom `animatable()` system is NOT used.

### Rationale

| Factor | Custom animatable | framer-motion |
|--------|------------------|---------------|
| React integration | Hook-based, manual | `motion.*` components, declarative |
| Layout animation | Manual FLIP | `layoutId` + `AnimatePresence` |
| Ecosystem | Internal only | Massive, well-documented |
| Gesture support | None | Built-in drag, tap, hover, pan |
| Exit animations | Manual cleanup | `AnimatePresence` handles unmount |
| Bundle size | GSAP + anime.js + custom | framer-motion standalone |
| SSR support | None | Built-in |
| TypeScript | Custom types | First-class |

### Where framer-motion applies in Tsingou

| Surface | Animation Use |
|---------|--------------|
| Signal flash/pulse | `motion.div` opacity/scale transitions on signal events |
| Adapter health badges | `AnimatePresence` for connect/disconnect transitions |
| Panel morphing | `layoutId` for layout transitions between views |
| Pipeline status | `motion.div` spring animations for status changes |
| Signal flow visualization | `motion.path` for animated SVG data flows |
| Dashboard controls | `motion.button` hover/tap states |

## Consequences

### Positive
- Declarative animation model — `animate`, `exit`, `layout` props
- `AnimatePresence` handles unmount animations (impossible with CSS)
- `layoutId` enables magic move transitions between list/detail views
- Massive community, excellent docs, stable API

### Negative
- Bundle size (~30KB gzipped) — but replaces GSAP + anime.js
- Another dependency — not Effect-native
- No built-in effect-atom integration — use `motion.div style={{ opacity: atomValue }}`

## Implementation Notes

- Install: `bun add framer-motion`
- Use `motion.*` components directly in rendering layers
- `AnimatePresence` wraps signal list for enter/exit animations
- `layoutId` for panel morphing (MorphChat pattern reuse)
- GSAP/anime.js remain available for non-React contexts (sidecar, canvas)
