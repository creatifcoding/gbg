# Text Morph Animation Reference

> Technique: 4-phase character morphing between strings of varying lengths

---

## Overview

A text morphing animation that transitions between two strings by:
1. Fading out characters that don't exist in target
2. Compressing remaining characters to close gaps
3. Scrambling characters to their final positions
4. Fading in new characters (for growing strings)

**Use Case:** ThinkingLevelButton label transitions (Off ↔ Low ↔ Medium ↔ High)

---

## Algorithm: Character Mapping

### Core Data Structure

```typescript
interface CharMapping {
  sourceIndex: number | null  // null = new char (fade in)
  targetIndex: number
  char: string
  operation: 'keep' | 'fadeOut' | 'fadeIn' | 'transform'
}
```

### Mapping Function

```typescript
function computeCharMapping(from: string, to: string): CharMapping[] {
  const result: CharMapping[] = []
  const fromChars = [...from]
  const toChars = [...to]
  const used = new Set<number>()

  // Pass 1: Match identical chars in same position
  for (let i = 0; i < Math.min(fromChars.length, toChars.length); i++) {
    if (fromChars[i] === toChars[i]) {
      result.push({
        sourceIndex: i,
        targetIndex: i,
        char: toChars[i],
        operation: 'keep'
      })
      used.add(i)
    }
  }

  // Pass 2: Map remaining source chars to target positions
  for (let i = 0; i < fromChars.length; i++) {
    if (used.has(i)) continue

    if (i < toChars.length) {
      result.push({
        sourceIndex: i,
        targetIndex: i,
        char: toChars[i],
        operation: 'transform'
      })
      used.add(i)
    } else {
      result.push({
        sourceIndex: i,
        targetIndex: -1,
        char: fromChars[i],
        operation: 'fadeOut'
      })
    }
  }

  // Pass 3: Add new chars for growing strings
  for (let i = fromChars.length; i < toChars.length; i++) {
    result.push({
      sourceIndex: null,
      targetIndex: i,
      char: toChars[i],
      operation: 'fadeIn'
    })
  }

  return result.sort((a, b) =>
    (a.targetIndex === -1 ? a.sourceIndex! : a.targetIndex) -
    (b.targetIndex === -1 ? b.sourceIndex! : b.targetIndex)
  )
}
```

### Example Mappings

```
"Low" → "Medium" (growing +3)
┌─────┬───────┬───────┬──────┬───────────┐
│ Src │ Tgt   │ Char  │ Op   │ Notes     │
├─────┼───────┼───────┼──────┼───────────┤
│ 0   │ 0     │ M     │ xfm  │ L→M       │
│ 1   │ 1     │ e     │ xfm  │ o→e       │
│ 2   │ 2     │ d     │ xfm  │ w→d       │
│ -   │ 3     │ i     │ in   │ new       │
│ -   │ 4     │ u     │ in   │ new       │
│ -   │ 5     │ m     │ in   │ new       │
└─────┴───────┴───────┴──────┴───────────┘

"Medium" → "High" (shrinking -2)
┌─────┬───────┬──────┬───────┬───────────┐
│ Src │ Tgt   │ Char │ Op    │ Notes     │
├─────┼───────┼──────┼───────┼───────────┤
│ 0   │ 0     │ H    │ xfm   │ M→H       │
│ 1   │ 1     │ i    │ xfm   │ e→i       │
│ 2   │ 2     │ g    │ xfm   │ d→g       │
│ 3   │ 3     │ h    │ xfm   │ i→h       │
│ 4   │ -1    │ u    │ out   │ removed   │
│ 5   │ -1    │ m    │ out   │ removed   │
└─────┴───────┴──────┴───────┴───────────┘
```

---

## Animation Timeline

```
Time (ms)    0       100      200      400      500
             │        │        │        │        │
Phase 1:     ├────────┤        │        │        │  FADE OUT
Phase 2:              ├────────┤        │        │  COMPRESS
Phase 3:                       ├────────────────┤  SCRAMBLE
Phase 4:                                ├───────┤  FADE IN
```

### Phase 1: Fade Out (0-100ms)

Chars marked `fadeOut` become invisible.

```typescript
import { animate, stagger } from 'animejs'

const fadeOutTargets = mapping
  .filter(m => m.operation === 'fadeOut')
  .map(m => charSpans[m.sourceIndex!])

animate(fadeOutTargets, {
  opacity: [1, 0],
  scale: [1, 0.5],
  filter: ['blur(0px)', 'blur(4px)'],
  duration: 100,
  delay: stagger(15, { from: 'center' }),
  ease: 'outQuad',
})
```

### Phase 2: Compress (100-200ms)

Remaining chars slide to close gaps.

```typescript
const keepTransformTargets = mapping
  .filter(m => m.operation === 'keep' || m.operation === 'transform')

// Calculate compression offset for each char
const getCompressionX = (m: CharMapping, charWidth: number) => {
  const fadeOutsBefore = mapping
    .filter(x => x.operation === 'fadeOut' && x.sourceIndex! < m.sourceIndex!)
    .length
  return -fadeOutsBefore * charWidth
}

animate(keepTransformTargets.map(m => charSpans[m.sourceIndex!]), {
  translateX: (el, i) => getCompressionX(keepTransformTargets[i], 8),
  duration: 100,
  ease: 'inOutQuad',
}, { delay: 100 })
```

### Phase 3: Scramble (200-400ms)

Chars shuffle to final positions with letter swap.

```typescript
animate(keepTransformTargets.map(m => charSpans[m.sourceIndex!]), {
  translateX: (el, i) => {
    const m = keepTransformTargets[i]
    const compressionOffset = getCompressionX(m, 8)
    const targetOffset = (m.targetIndex - m.sourceIndex!) * 8
    return compressionOffset + targetOffset
  },
  translateY: [
    { value: (el, i) => (i % 2 === 0 ? -12 : 12), duration: 100 },
    { value: 0, duration: 100 }
  ],
  duration: 200,
  delay: stagger(25, { from: 'random' }),
  ease: 'outElastic(1, 0.6)',
  onUpdate: (anim) => {
    // Swap letters at 50% progress
    if (anim.progress >= 50 && !anim._lettersSwapped) {
      keepTransformTargets.forEach((m, i) => {
        charSpans[m.sourceIndex!].textContent = m.char
      })
      anim._lettersSwapped = true
    }
  }
}, { delay: 200 })
```

### Phase 4: Fade In (400-500ms)

New chars appear (only for growing strings).

```typescript
const fadeInMappings = mapping.filter(m => m.operation === 'fadeIn')

if (fadeInMappings.length > 0) {
  // Create new spans at target positions
  fadeInMappings.forEach(m => {
    const span = document.createElement('span')
    span.textContent = m.char
    span.style.cssText = 'display:inline-block;opacity:0;'
    container.appendChild(span)
    charSpans[m.targetIndex] = span
  })

  animate(fadeInMappings.map(m => charSpans[m.targetIndex]), {
    opacity: [0, 1],
    scale: [0.5, 1],
    filter: ['blur(4px)', 'blur(0px)'],
    duration: 100,
    delay: stagger(20),
    ease: 'outQuad',
  }, { delay: 400 })
}
```

---

## Complete Implementation

```typescript
import { animate, createTimeline, stagger } from 'animejs'

interface MorphOptions {
  duration?: number
  charWidth?: number
  onComplete?: () => void
}

export function morphText(
  container: HTMLElement,
  fromText: string,
  toText: string,
  options: MorphOptions = {}
) {
  const {
    duration = 500,
    charWidth = 8,
    onComplete
  } = options

  // Phase durations as fractions
  const p1 = duration * 0.2   // 0-20%: fade out
  const p2 = duration * 0.2   // 20-40%: compress
  const p3 = duration * 0.4   // 40-80%: scramble
  const p4 = duration * 0.2   // 80-100%: fade in

  // Get existing char spans
  const charSpans = [...container.querySelectorAll('span')] as HTMLSpanElement[]

  // Compute mapping
  const mapping = computeCharMapping(fromText, toText)

  // Categorize
  const fadeOuts = mapping.filter(m => m.operation === 'fadeOut')
  const keeps = mapping.filter(m => m.operation === 'keep' || m.operation === 'transform')
  const fadeIns = mapping.filter(m => m.operation === 'fadeIn')

  // Build timeline
  const tl = createTimeline({
    onComplete,
  })

  // Phase 1: Fade out
  if (fadeOuts.length > 0) {
    tl.add(fadeOuts.map(m => charSpans[m.sourceIndex!]), {
      opacity: [1, 0],
      scale: [1, 0.5],
      duration: p1,
      delay: stagger(p1 / fadeOuts.length, { from: 'center' }),
      ease: 'outQuad',
    }, 0)
  }

  // Phase 2: Compress
  const getCompressionX = (m: CharMapping) => {
    const fadeOutsBefore = fadeOuts.filter(x => x.sourceIndex! < m.sourceIndex!).length
    return -fadeOutsBefore * charWidth
  }

  tl.add(keeps.map(m => charSpans[m.sourceIndex!]), {
    translateX: (_, i) => getCompressionX(keeps[i]),
    duration: p2,
    ease: 'inOutQuad',
  }, p1)

  // Phase 3: Scramble + letter swap
  let lettersSwapped = false
  tl.add(keeps.map(m => charSpans[m.sourceIndex!]), {
    translateX: (_, i) => {
      const m = keeps[i]
      const compression = getCompressionX(m)
      const target = (m.targetIndex - m.sourceIndex!) * charWidth
      return compression + target
    },
    translateY: [
      { value: (_, i) => (i % 2 === 0 ? -10 : 10), duration: p3 * 0.5 },
      { value: 0, duration: p3 * 0.5 }
    ],
    duration: p3,
    delay: stagger(p3 / keeps.length / 2, { from: 'random' }),
    ease: 'outElastic(1, 0.6)',
    onUpdate: (anim) => {
      if (anim.progress >= 50 && !lettersSwapped) {
        keeps.forEach(m => {
          charSpans[m.sourceIndex!].textContent = m.char
        })
        lettersSwapped = true
      }
    }
  }, p1 + p2)

  // Phase 4: Fade in new chars
  if (fadeIns.length > 0) {
    fadeIns.forEach(m => {
      const span = document.createElement('span')
      span.textContent = m.char
      span.style.cssText = 'display:inline-block;opacity:0;'
      container.appendChild(span)
      charSpans[m.targetIndex] = span
    })

    tl.add(fadeIns.map(m => charSpans[m.targetIndex]), {
      opacity: [0, 1],
      scale: [0.5, 1],
      duration: p4,
      delay: stagger(p4 / fadeIns.length),
      ease: 'outQuad',
    }, p1 + p2 + p3)
  }

  return tl
}
```

---

## Integration with ThinkingLevelButton

```tsx
// In ChatInput.tsx

const labelContainerRef = useRef<HTMLSpanElement>(null)

const handleClick = () => {
  const fromText = currentOption.name
  const toText = nextOption.name

  if (prefersReducedMotion || thinkingLevel === 'none') {
    setThinkingLevel(nextOption.id)
    return
  }

  morphText(labelContainerRef.current!, fromText, toText, {
    duration: nextAnim.duration.press + nextAnim.duration.release,
    onComplete: () => setThinkingLevel(nextOption.id)
  })

  // Trigger other animations (shadow, scale) in parallel
  setIsPressed(true)
}

// Render
{isActive && (
  <span
    ref={labelContainerRef}
    className="font-mono text-magenta-400"
    style={{ fontSize: '10px' }}
  >
    {/* Char spans populated by morphText */}
  </span>
)}
```

---

## Beads

| ID | Title | Status |
|----|-------|--------|
| tmnl-qaako | Character mapping algorithm | open |
| tmnl-yxssu | Phase 1 - Fade out | open |
| tmnl-j17b7 | Phase 2 - Compress | open |
| tmnl-7zorg | Phase 3 - Scramble | open |
| tmnl-az4jt | Phase 4 - Fade in | open |
| tmnl-uucmu | Container management | open |
| tmnl-k7w7l | Integration | open |
| tmnl-ypwpb | Feature (parent) | open |

---

## See Also

- **Skill:** `../SKILL.md` (decision trees for animation routing)
- **Index:** `INDEX.md` (technique catalog)
- **Navigation:** `../AGENTS.md` (agent instructions)
- **anime.js v4 source:** `../../../../../submodules/anime/`
- **Text splitting API:** `animejs/text` module
