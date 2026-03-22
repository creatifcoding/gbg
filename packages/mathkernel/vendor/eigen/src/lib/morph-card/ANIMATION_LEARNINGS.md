# ANIMATION LEARNINGS (SYSTEMIC TEMPLATE)

## TEMPLATE (PER LEARNING)

1. **NAME / LOCATION**
2. **CASE (WHAT WE SAW)**
3. **ROOT CAUSE**
4. **PRINCIPLE / GUIDELINE**
5. **EXTRAPOLATE x3 (APPLY ELSEWHERE)**
6. **DIAGRAM (SEQUENCE OR FLOW)**

---

## LEARNING 1: ANIMATEPRESENCE MODE = “WAIT” → BLANK GAPS

1. **NAME / LOCATION**
   - AnimatePresence mode in `MorphCard` + `DynamicIslandCard` content.

2. **CASE (WHAT WE SAW)**
   - Content went blank during tab transitions.

3. **ROOT CAUSE**
   - `mode="wait"` unmounts current node before mounting the next.

4. **PRINCIPLE / GUIDELINE**
   - Use `mode="sync"` or `mode="popLayout"` when continuity matters.

5. **EXTRAPOLATE x3**
   - Use `popLayout` for list item swaps to prevent blank flashes.
   - Use `sync` for card transitions where controls must remain visible.
   - Avoid `wait` for UI that contains persistent chrome (tabs, toolbars).

6. **DIAGRAM (SEQUENCE)**

```
USER            ANIMATEPRESENCE            DOM
  |                    |                  |
  |  TAB SWITCH        |                  |
  |------------------->|                  |
  |                    |  WAIT: UNMOUNT   |
  |                    |----------------->| (OLD CONTENT REMOVED)
  |                    |  WAIT: MOUNT     |
  |                    |----------------->| (NEW CONTENT ADDED)
  |                    |                  |
```

---

## LEARNING 2: LAYOUT ANIMATION OVERRIDES GRAMMAR

1. **NAME / LOCATION**
   - `layout` on content `motion.div`.

2. **CASE (WHAT WE SAW)**
   - Everything slid from the bottom regardless of grammar.

3. **ROOT CAUSE**
   - Framer layout FLIP injected its own motion, masking variants.

4. **PRINCIPLE / GUIDELINE**
   - If grammar-driven motion matters, remove `layout` from the **content** node.

5. **EXTRAPOLATE x3**
   - Keep layout animation on container, not content.
   - Disable layout for animated labels/indicators to avoid jitter.
   - Separate “size animation” from “content animation”.

6. **DIAGRAM (FLOW)**

```
GRAMMAR VARIANTS  --->  CONTENT MOTION.DIV  --->  VISUAL
        |                      |
        |                      +--> LAYOUT FLIP OVERRIDES (UNWANTED)
```

---

## LEARNING 3: MULTI‑LAYER ANIMATIONS STACK UNINTENTIONALLY

1. **NAME / LOCATION**
   - MorphCard content AnimatePresence + DynamicIslandCard AnimatePresence.

2. **CASE (WHAT WE SAW)**
   - Double animation feel, unexpected slides.

3. **ROOT CAUSE**
   - Two animation layers applied to the same subtree.

4. **PRINCIPLE / GUIDELINE**
   - Only one layer should animate a given subtree.

5. **EXTRAPOLATE x3**
   - Animate either card or view, not both.
   - Avoid nested AnimatePresence for the same element.
   - Move static UI outside the animated subtree.

6. **DIAGRAM (SEQUENCE)**

```
VIEW CHANGE
   |
   v
MORPHCARD ANIMATEPRESENCE
   |
   v
DYNAMICISLANDCARD ANIMATEPRESENCE
   |
   v
DOUBLE ANIMATION
```

---

## LEARNING 4: FILTER “ZOMBIE STYLES”

1. **NAME / LOCATION**
   - Transition grammar variants with `filter`.

2. **CASE (WHAT WE SAW)**
   - Blurred state persisted after transitions.

3. **ROOT CAUSE**
   - Some variants set `filter`, others omit it → stale filter remains.

4. **PRINCIPLE / GUIDELINE**
   - Always reset sensitive CSS (filter/opacity/transform) in animate/exit.

5. **EXTRAPOLATE x3**
   - Normalize `filter` across all verbs.
   - Always set `opacity` explicitly if some states omit it.
   - Reset transform components when mixing layout + keyframes.

6. **DIAGRAM (FLOW)**

```
VERB A SETS FILTER     VERB B OMITS FILTER
        |                        |
        v                        v
FILTER PERSISTS (ZOMBIE STYLE)
```

---

## LEARNING 5: DIRECTION IGNORED IN VARIANTS

1. **NAME / LOCATION**
   - `grammarToVariants` ignored `direction`.

2. **CASE (WHAT WE SAW)**
   - All slides looked identical.

3. **ROOT CAUSE**
   - Direction wasn’t mapped into variants.

4. **PRINCIPLE / GUIDELINE**
   - Every grammar dimension must be reflected in variant mapping.

5. **EXTRAPOLATE x3**
   - Map direction for slide/shutter/cascade.
   - Map modifier to ease/duration consistently.
   - Map complexity to secondary effects (blur/glow) deliberately.

6. **DIAGRAM (FLOW)**

```
GRAMMAR { verb: SLIDE, direction: DOWN }
        |
        v
VARIANTS (IGNORE DIRECTION)  --->  SAME MOTION EVERY TIME
```

---

## LEARNING 6: TAB INDICATOR SHOULD NOT BE IN CONTENT TRANSITIONS

1. **NAME / LOCATION**
   - TabBar underline inside animated subtree.

2. **CASE (WHAT WE SAW)**
   - Underline slid with content.

3. **ROOT CAUSE**
   - TabBar was inside the same AnimatePresence content wrapper.

4. **PRINCIPLE / GUIDELINE**
   - Keep navigation chrome outside content transitions.

5. **EXTRAPOLATE x3**
   - Keep headers/toolbars static during morphs.
   - Animate only the panel area, not the shell.
   - Separate animation channels for chrome vs content.

6. **DIAGRAM (SEQUENCE)**

```
TAB BAR + CONTENT
        |
        v
CONTENT TRANSITION WRAPPER
        |
        v
TAB BAR ANIMATES UNINTENTIONALLY
```

---

## LEARNING 7: UNDERLINE SIZE SHOULD BE TEXT‑BOUND

1. **NAME / LOCATION**
   - Tab underline sizing.

2. **CASE (WHAT WE SAW)**
   - Underline didn’t match label width / vanished on reflow.

3. **ROOT CAUSE**
   - JS measurement was brittle during layout updates.

4. **PRINCIPLE / GUIDELINE**
   - Prefer CSS‑bound underline inside label wrapper.

5. **EXTRAPOLATE x3**
   - Use inline wrapper for underline sizing.
   - Avoid DOM measuring for purely visual alignment.
   - Use layoutId on underline within label container.

6. **DIAGRAM (FLOW)**

```
LABEL WRAPPER (INLINE)
        |
        v
UNDERLINE WIDTH = LABEL WIDTH (CSS)
```
