# TMNL Typography System

A comprehensive typographic framework for the TMNL interface. Every component adheres to this system.

---

## Design Philosophy

TMNL typography balances **tactical precision** with **readability**. The system draws from:
- Military/aviation instrument panels (dense, scannable)
- DAW interfaces (information-rich, hierarchical)
- Brutalist design (honest materials, no decoration)

**Core Principles:**
1. **Legibility over style** — Function dictates form
2. **Monospace foundation** — Tabular alignment, code-native
3. **Condensed for density** — Maximum information per pixel
4. **High contrast** — Works on dark backgrounds, low light conditions

---

## Font Stack

### Primary Fonts (Local Assets)

| Font | Role | Weights | Character |
|------|------|---------|-----------|
| **Bungee Shade** | Wordmark | Regular | Dramatic, layered shadow effect |
| **Barlow Condensed** | Conversational AI | Thin–Black (18 variants) | Condensed, fast text rendering |
| **Orbitron** | Numeric/Status | Variable (400–900) | Sci-fi, geometric, authoritative |
| **Share Tech Mono** | Data Display | Regular | Clean monospace, grid-native |
| **VT323** | Terminal/Retro | Regular | CRT aesthetic, nostalgic |
| **Geo** | Geometric Accent | Regular, Italic | Minimal, futuristic |
| **Silkscreen** | Pixel UI | Regular, Bold | 8-bit, bitmap aesthetic |
| **Bungee Hairline** | Ultra-light Display | Regular | Delicate, high contrast |

### System Fallbacks

```css
--font-mono-stack: 'Share Tech Mono', 'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace;
--font-display-stack: 'Orbitron', 'Barlow Condensed', system-ui, sans-serif;
--font-retro-stack: 'VT323', 'Silkscreen', 'Courier New', monospace;
```

---

## Font Roles & Usage

### 1. Bungee Shade — Brand Wordmark

**Usage:** TMNL logo/wordmark ONLY. Never for body text, headings, or UI elements.

**Characteristics:**
- Dramatic layered shadow creates depth
- Designed for horizontal AND vertical text
- Best at large sizes (24px+)
- Single weight limits flexibility — use sparingly

**Implementation:**
```css
.tmnl-wordmark {
  font-family: 'Bungee Shade', fantasy;
  font-size: 18px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```

**Do:**
- Use for the TMNL wordmark in header
- Pair with neutral backgrounds
- Allow generous whitespace

**Don't:**
- Use for headings or navigation
- Stack vertically in tight spaces
- Apply text effects (already has shadow)

---

### 2. Barlow Condensed — Conversational AI

**Usage:** AI assistant responses, chat interfaces, streaming text, mission briefs.

**Characteristics:**
- Condensed width maximizes text per line
- Full weight range (Thin to Black) for hierarchy
- Excellent for typewriter/streaming animations
- Highly legible at small sizes due to open counters

**Weight Guidelines:**

| Weight | Name | Use Case |
|--------|------|----------|
| 100 | Thin | Decorative, large display |
| 200 | ExtraLight | Subtle metadata |
| 300 | Light | Secondary body text |
| 400 | Regular | Primary body text |
| 500 | Medium | Emphasis within body |
| 600 | SemiBold | Subheadings, labels |
| 700 | Bold | Headings, alerts |
| 800 | ExtraBold | Critical warnings |
| 900 | Black | Maximum emphasis (rare) |

**Implementation:**
```css
.ai-response {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

.ai-response-emphasis {
  font-weight: 600;
}
```

**Animation Pattern:**
```typescript
// Typewriter effect for AI responses
const CHAR_DELAY = 15; // ms between characters
const WORD_PAUSE = 50; // ms pause after punctuation
```

---

### 3. Orbitron — Numeric & Status Display

**Usage:** Counters, timers, coordinates, measurements, status indicators, alerts.

**Characteristics:**
- Geometric letterforms with sci-fi aesthetic
- Variable font (400–900 weight axis)
- Tabular figures by default — perfect for counters
- Strong presence even at small sizes

**Weight Guidelines:**

| Weight | Use Case |
|--------|----------|
| 400 | Ambient data, background metrics |
| 500 | Standard readouts |
| 600 | Important values |
| 700 | Warnings, elevated status |
| 800–900 | Critical alerts, errors |

**Implementation:**
```css
.metric-value {
  font-family: 'Orbitron', sans-serif;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

.metric-critical {
  font-weight: 700;
  color: var(--tmnl-accent-red);
}
```

**Pairing:** Use with Barlow Condensed labels or Share Tech Mono data.

---

### 4. Share Tech Mono — Data Display

**Usage:** Data grids, tables, code snippets, technical values, logs.

**Characteristics:**
- Clean, neutral monospace
- Single weight keeps it utilitarian
- Grid-aligned — every character same width
- Excellent for tabular data

**Implementation:**
```css
.data-grid-cell {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums slashed-zero;
}

.data-grid-header {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--tmnl-text-tertiary);
}
```

**Grid Typography:**
| Element | Size | Weight | Spacing |
|---------|------|--------|---------|
| Cell value | 11px | 400 | 0 |
| Header | 10px | 400 | 0.1em |
| Footer/Totals | 11px | 400 | 0 |

---

### 5. VT323 — Terminal & Retro

**Usage:** Console output, boot sequences, retro UI elements, CRT effects.

**Characteristics:**
- Authentic VT320 terminal aesthetic
- Single weight, pixel-aligned
- Best with scanline/CRT effects
- Pairs with green/amber terminal colors

**Implementation:**
```css
.terminal-output {
  font-family: 'VT323', monospace;
  font-size: 16px; /* VT323 needs larger sizes */
  line-height: 1.2;
  letter-spacing: 0;
  color: #00ff00; /* Classic green */
  text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
}

.terminal-prompt::before {
  content: '> ';
  color: #00aa00;
}
```

**Size Note:** VT323 was designed for screen display at specific sizes. Use 14px, 16px, 18px, or 24px for best rendering. Avoid odd sizes.

---

### 6. Geo — Geometric Accent

**Usage:** Futuristic labels, decorative numbers, abstract UI elements.

**Characteristics:**
- Extremely minimal geometric forms
- Regular and Italic variants
- Best for short text (1–3 words)
- Creates tension with denser fonts

**Implementation:**
```css
.geo-label {
  font-family: 'Geo', sans-serif;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.geo-accent {
  font-family: 'Geo', sans-serif;
  font-style: italic;
  font-size: 48px;
  opacity: 0.1; /* Background decoration */
}
```

---

### 7. Silkscreen — Pixel UI

**Usage:** 8-bit aesthetic, retro badges, pixel-perfect elements.

**Characteristics:**
- Bitmap-style rendering
- Regular and Bold weights
- Best at sizes divisible by 8 (8px, 16px, 24px)
- Pairs with Geo for retro-futurism

**Implementation:**
```css
.pixel-badge {
  font-family: 'Silkscreen', monospace;
  font-size: 8px;
  text-transform: uppercase;
  image-rendering: pixelated;
}
```

---

### 8. Bungee Hairline — Ultra-Light Display

**Usage:** Large decorative text, watermarks, subtle backgrounds.

**Characteristics:**
- Extremely thin strokes
- High contrast against dark backgrounds
- Fragile at small sizes — use 24px+
- Creates elegance in industrial context

**Implementation:**
```css
.watermark {
  font-family: 'Bungee Hairline', sans-serif;
  font-size: 72px;
  opacity: 0.05;
  pointer-events: none;
}
```

---

## Type Scale

TMNL uses a **custom modular scale** optimized for dense technical interfaces.

**Base:** 11px (tmnl-base)
**Ratio:** ~1.18 (between Minor Second and Major Second)

| Token | Size | Line Height | Letter Spacing | Use Case |
|-------|------|-------------|----------------|----------|
| `tmnl-4xs` | 6px | 1.4 | 0.2em | Micro labels, decorative |
| `tmnl-3xs` | 7px | 1.4 | 0.15em | Timestamps, metadata |
| `tmnl-2xs` | 8px | 1.4 | 0.12em | Badges, tags |
| `tmnl-xs` | 9px | 1.5 | 0.1em | Captions, footnotes |
| `tmnl-sm` | 10px | 1.5 | 0.08em | Secondary UI text |
| `tmnl-base` | 11px | 1.6 | 0.05em | Primary body text |
| `tmnl-md` | 12px | 1.5 | 0.02em | Emphasized body |
| `tmnl-lg` | 14px | 1.4 | 0 | Subheadings |
| `tmnl-xl` | 16px | 1.3 | -0.01em | Section headers |
| `tmnl-2xl` | 18px | 1.2 | -0.02em | Page titles |
| `tmnl-3xl` | 24px | 1.1 | -0.02em | Hero text |
| `tmnl-4xl` | 32px | 1.0 | -0.03em | Display |
| `tmnl-5xl` | 48px | 1.0 | -0.04em | Splash/wordmark |

**Pattern:** Letter spacing decreases as size increases (tighter tracking for headlines).

---

## Semantic Typography Classes

### Pre-composed Styles (index.css)

```css
/* System Identifiers */
.tmnl-type-id        /* Agent IDs, mission codes */
.tmnl-type-id-sm     /* Smaller identifiers */

/* Statistics & Metrics */
.tmnl-type-stat      /* Large numerical displays */
.tmnl-type-stat-md   /* Medium stats */
.tmnl-type-stat-sm   /* Small stats */
.tmnl-type-stat-unit /* Unit labels (dB, Hz, ms) */

/* Headings */
.tmnl-type-heading-xl
.tmnl-type-heading-lg
.tmnl-type-heading
.tmnl-type-heading-sm

/* Labels */
.tmnl-type-label     /* Field labels, category tags */
.tmnl-type-label-sm
.tmnl-type-label-xs

/* Body Text */
.tmnl-type-body
.tmnl-type-body-sm
.tmnl-type-body-xs
.tmnl-type-body-emphasis

/* Code & Terminal */
.tmnl-type-code
.tmnl-type-code-sm
.tmnl-type-terminal
.tmnl-type-command

/* Data Display */
.tmnl-type-coords    /* Coordinates */
.tmnl-type-timestamp /* Timestamps */
.tmnl-type-value     /* Generic values */

/* Navigation */
.tmnl-type-nav
.tmnl-type-nav-active

/* Badges & Tags */
.tmnl-type-badge
.tmnl-type-tag

/* Alerts */
.tmnl-type-alert
.tmnl-type-warning
.tmnl-type-success

/* LCD Display */
.tmnl-type-lcd
.tmnl-type-lcd-sm
.tmnl-type-lcd-lg
```

---

## Font Loading Strategy

### @font-face Declarations

```css
/* Bungee Shade - Wordmark */
@font-face {
  font-family: 'Bungee Shade';
  src: url('/assets/data/fonts/Bungee_Shade/BungeeShade-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

/* Barlow Condensed - AI Conversational */
@font-face {
  font-family: 'Barlow Condensed';
  src: url('/assets/data/fonts/Barlow_Condensed/BarlowCondensed-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('/assets/data/fonts/Barlow_Condensed/BarlowCondensed-Light.ttf') format('truetype');
  font-weight: 300;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('/assets/data/fonts/Barlow_Condensed/BarlowCondensed-Medium.ttf') format('truetype');
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('/assets/data/fonts/Barlow_Condensed/BarlowCondensed-SemiBold.ttf') format('truetype');
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: 'Barlow Condensed';
  src: url('/assets/data/fonts/Barlow_Condensed/BarlowCondensed-Bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}

/* Orbitron - Numeric/Status (Variable) */
@font-face {
  font-family: 'Orbitron';
  src: url('/assets/data/fonts/Orbitron/Orbitron-VariableFont_wght.ttf') format('truetype-variations');
  font-weight: 400 900;
  font-display: swap;
}

/* Share Tech Mono - Data */
@font-face {
  font-family: 'Share Tech Mono';
  src: url('/assets/data/fonts/Share_Tech_Mono/ShareTechMono-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

/* VT323 - Terminal */
@font-face {
  font-family: 'VT323';
  src: url('/assets/data/fonts/VT323/VT323-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

/* Geo - Geometric */
@font-face {
  font-family: 'Geo';
  src: url('/assets/data/fonts/Geo/Geo-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Geo';
  src: url('/assets/data/fonts/Geo/Geo-Italic.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

/* Silkscreen - Pixel */
@font-face {
  font-family: 'Silkscreen';
  src: url('/assets/data/fonts/Silkscreen/Silkscreen-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Silkscreen';
  src: url('/assets/data/fonts/Silkscreen/Silkscreen-Bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}

/* Bungee Hairline - Display */
@font-face {
  font-family: 'Bungee Hairline';
  src: url('/assets/data/fonts/Bungee_Hairline/BungeeHairline-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
```

---

## CSS Custom Properties

```css
:root {
  /* Font Families */
  --font-wordmark: 'Bungee Shade', fantasy;
  --font-conversational: 'Barlow Condensed', sans-serif;
  --font-numeric: 'Orbitron', sans-serif;
  --font-data: 'Share Tech Mono', monospace;
  --font-terminal: 'VT323', monospace;
  --font-geometric: 'Geo', sans-serif;
  --font-pixel: 'Silkscreen', monospace;
  --font-hairline: 'Bungee Hairline', sans-serif;

  /* Legacy mappings (for existing code) */
  --font-tmnl: var(--font-data);
  --font-display: var(--font-numeric);
  --font-body: var(--font-conversational);
  --font-code: var(--font-data);
}
```

---

## Component Mapping

| Component | Primary Font | Secondary Font |
|-----------|--------------|----------------|
| **Header Wordmark** | Bungee Shade | — |
| **Navigation Tabs** | Barlow Condensed (500) | — |
| **Sidebar Icons** | — (icons only) | — |
| **Data Grid Cells** | Share Tech Mono | — |
| **Data Grid Headers** | Share Tech Mono (uppercase) | — |
| **AI Chat Response** | Barlow Condensed (400) | — |
| **Metric Counters** | Orbitron (500) | — |
| **Status Badges** | Orbitron (600) | — |
| **Terminal Output** | VT323 | — |
| **Toast Messages** | Barlow Condensed (500) | — |
| **Modal Titles** | Barlow Condensed (700) | — |
| **Form Labels** | Barlow Condensed (600) | — |
| **Input Text** | Share Tech Mono | — |
| **Button Text** | Barlow Condensed (600) | — |
| **Timestamps** | Share Tech Mono | Geo (decorative) |

---

## Anti-Patterns

### Don't:

1. **Mix more than 2 fonts in one component**
   - Exception: Decorative backgrounds

2. **Use Bungee Shade for anything but wordmark**
   - It's a display font, not a text font

3. **Apply letter-spacing to VT323**
   - It's pixel-designed, spacing breaks alignment

4. **Use weights below 400 at sizes under 12px**
   - Light weights become illegible

5. **Combine Silkscreen with smooth fonts**
   - Pixel aesthetic clashes with anti-aliased text

6. **Use Geo for more than 3 words**
   - It's accent typography, not body copy

---

## Performance Considerations

1. **Subset fonts** for production (Latin only unless needed)
2. **Preload critical fonts** (Share Tech Mono, Barlow Condensed Regular)
3. **Use font-display: swap** to prevent FOIT
4. **Variable fonts** (Orbitron) reduce file count
5. **Load VT323/Silkscreen lazily** — retro features aren't critical path

```html
<link rel="preload" href="/assets/data/fonts/Share_Tech_Mono/ShareTechMono-Regular.ttf" as="font" type="font/ttf" crossorigin>
<link rel="preload" href="/assets/data/fonts/Barlow_Condensed/BarlowCondensed-Regular.ttf" as="font" type="font/ttf" crossorigin>
```

---

## Tailwind Integration

Update `tailwind.config.js` to use local fonts:

```javascript
fontFamily: {
  wordmark: ["'Bungee Shade'", "fantasy"],
  conversational: ["'Barlow Condensed'", "sans-serif"],
  numeric: ["'Orbitron'", "sans-serif"],
  data: ["'Share Tech Mono'", "monospace"],
  terminal: ["'VT323'", "monospace"],
  geometric: ["'Geo'", "sans-serif"],
  pixel: ["'Silkscreen'", "monospace"],
  hairline: ["'Bungee Hairline'", "sans-serif"],

  // Legacy aliases
  tmnl: ["'Share Tech Mono'", "monospace"],
  display: ["'Orbitron'", "sans-serif"],
  body: ["'Barlow Condensed'", "sans-serif"],
  code: ["'Share Tech Mono'", "monospace"],
  lcd: ['"DSEG7"', '"Courier New"', "monospace"],
}
```

---

## Quick Reference

| Need | Use | Class/Style |
|------|-----|-------------|
| TMNL logo | Bungee Shade | `font-wordmark` |
| AI response | Barlow Condensed | `font-conversational` |
| Data grid | Share Tech Mono | `font-data` |
| Counters/timers | Orbitron | `font-numeric` |
| Terminal look | VT323 | `font-terminal` |
| Futuristic label | Geo | `font-geometric` |
| 8-bit aesthetic | Silkscreen | `font-pixel` |
| Elegant watermark | Bungee Hairline | `font-hairline` |

---

*Last updated: 2024-12-14*
