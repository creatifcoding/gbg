# JCK Design Recon — CSS Extraction

Extracted from jckltd.com on 2026-03-31. Source: custom `style.css` + Tailwind with custom config + inline styles.

---

## Color Palette

### Primary Brand Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| **JCK Blue** | `#0d6efd` | `rgb(13, 110, 253)` | Primary brand. Buttons, links, heading lines, fills, borders, background blocks. Everywhere. |
| **JCK Navy** | `#032359` | `rgb(3, 35, 89)` | Dark variant. Hover states, alt borders, link default color, dark backgrounds, overlay opacity. |
| **JCK Light** | `#ecfeff` | — | Page background. Very pale cyan/ice. `.jck-background-page`. Also SVG fill background. |

### Extended Palette (from Tailwind classes + CSS)

| Token | Value | Usage |
|---|---|---|
| White | `#FFFFFF` | Card backgrounds, button alt bg, text on dark |
| Black | `#000` | Mobile menu text |
| Blue-50 | Tailwind `bg-blue-50` | Light card backgrounds |
| Blue-800 | Tailwind `bg-blue-800` / `text-blue-800` | Heading text, hover buttons, service headings |
| Gray-400 | `text-gray-400` | Muted timestamps, secondary meta |
| Gray-500 | `text-gray-500` / `bg-gray-500` | Dim text, dividers |
| Gray-600 | `text-gray-600` | Body text |
| Gray-800 | `bg-gray-800` | Dark section backgrounds |
| Gray-900 | `text-gray-900` | Primary body text |
| CoolGray-50 | `bg-coolGray-50` | Service cards background (very light gray) |
| Indigo-200 | `text-indigo-200` | Decorative text on dark backgrounds |
| Accent Blue | `#60adff` | Carousel slide cards, lighter accent |
| Text Shadow Blue | `text-shadow: 1px 1px #0d6efd` | Hero text depth effect |

### Derived Semantic Mapping

```
primary:       #0d6efd (JCK Blue)
primary-dark:  #032359 (JCK Navy)
primary-light: #ecfeff (JCK Ice)
primary-mid:   #60adff (lighter blue accent)

surface:       #FFFFFF (white cards)
surface-alt:   coolGray-50 (service cards)
bg-page:       #ecfeff (pale cyan page bg)
bg-dark:       gray-800 / navy overlay

text-primary:  gray-900
text-secondary: gray-600
text-muted:    gray-400 / gray-500
text-on-dark:  white / indigo-200
text-link:     #032359 (navy default), #0d6efd (hover)
```

---

## Typography

### Fonts

| Font | Usage | Source |
|---|---|---|
| **Krona One** | Headings only (`.font-heading`). Bold geometric sans. Very distinctive — compact, wide, uppercase-feeling even in mixed case. | Google Fonts (via Tailwind extend) |
| **Noto Sans** | Body, captions, meta text. Weights: 400, 700, italic variants. Clean humanist sans. | Google Fonts (explicit `<link>`) |

### Type Scale (from Tailwind classes used)

| Class | ~Size | Usage |
|---|---|---|
| `text-xs` | 12px | Fine print, meta |
| `text-sm` | 14px | Captions, secondary info |
| `text-base` | 16px | Body text |
| `text-md` | ~15px (custom?) | Mid-size body |
| `text-lg` | 18px | Service headings, subheadings |
| `text-xl` | 20px | Section headings, testimonial name |
| `text-2xl` | 24px | Card headings, service titles |
| `text-3xl` | 30px | Page section headings |
| `text-4xl` | 36px | Expertise page headings |
| `text-7xl` | 72px | Hero "JCK LTD." title |
| `text-8xl` | 96px | "Your Career with JCK" massive display |

### Weight Usage

| Weight | Tailwind | Usage |
|---|---|---|
| 400 | `font-medium` (their usage is inconsistent — they use medium for what looks like 400) | Body text, nav links |
| 600 | `font-semibold` | Subheadings, service titles, CTA buttons |
| 700 | `font-bold` | Main headings, hero text, page titles |

### Text Transforms

- `uppercase` used on: service headings (`text-lg text-blue-800 font-semibold uppercase`), CTA links ("READ MORE →", "EXPERTISE", "SERVICES")
- `tracking-wider` or `tracking-widest` — letter-spacing on uppercase elements
- Arrow suffix `→` on all CTAs (not an icon — literal unicode arrow)

---

## Layout & Spacing

### Container

- Max width: `1480px` (custom, wider than Tailwind default)
- XL screens: `2100px`
- Padding: varies by section (`p-4` to `p-16`)

### Card Pattern

```css
/* Service cards */
background: coolGray-50 (near-white)
border-radius: rounded-lg (8px) or rounded-xl (12px)
padding: p-4 to p-6
border: border-b-2 or border-b-8 with border-color (#0d6efd blue)

/* Emphasis cards — colored bottom border */
border-bottom: 8px solid #0d6efd (thick blue accent)
```

### Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `rounded-md` | 6px | Buttons, small elements |
| `rounded-lg` | 8px | Cards, panels |
| `rounded-xl` | 12px | CTA buttons, large cards |
| `rounded-full` | 9999px | Avatars, dots |
| `rounded-l-xl rounded-t-xl` | 12px top-left | Asymmetric CTA buttons (distinctive!) |

### Shadow

- `shadow-2xl` on hero section / major cards
- `shadow-blue-500` — colored shadow on blue elements (subtle glow)
- Button shadow: `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)` on `.jck-button-alt`

---

## Interactive Patterns

### Buttons

**Primary (`.jck-button`):**
```css
background-color: #0d6efd;
color: #FFFFFF;
border-radius: 0.375rem (6px);
border-width: 1px;
transition: ease 0.3s;
```
Hover: `background-color: rgb(3, 35, 89)` — darkens to navy.

**Alt (`.jck-button-alt`):**
```css
background-color: #FFFFFF;
color: rgb(3, 35, 89);
box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
border-radius: 0.375rem;
```
Hover: text changes to `#0d6efd` blue.

**CTA Buttons (Expertise/Services):**
```
rounded-l-xl rounded-t-xl  /* Asymmetric border-radius — distinctive! */
font-semibold
uppercase
jck-background-color (#0d6efd) / jck-background-page (#ecfeff)
hover:bg-blue-800 hover:text-white
transition duration-300
```

### Hover Interaction Pattern

`.jck-hover-button` — text slides out, replacement text slides in. Animate with transform translate + opacity. Transition delay 0.4s for the reveal. Uses `data-hover` attribute for replacement content.

This is a **distinctive micro-interaction** — the text literally swaps with a slide animation on hover.

### Links

Default: `color: rgb(3, 35, 89)` (navy), hover: `#0d6efd` (blue).
Arrow: unicode `→` appended to CTA text: "READ MORE →", "CONTACT JCK →", "JOIN JCK →"

---

## Visual Motifs

### The Blue Accent Line
```css
.jck-heading-line {
  width: 80px;
  height: 2px;
  display: inline-block;
  background: #0d6efd;
}
```
Used as a divider under section headings. 80px wide, 2px tall, JCK blue.

### Diamond Clip Path
```css
clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
```
Used on decorative elements — diamond/rhombus shape. Applied to 42px wide elements.

### Parallax Backgrounds
Full-bleed background images with `background-attachment: fixed`. Airport terminal photos, warehouse interiors.

### Country Flag Badges
Small flag images (`UK.png`, `US.png`, `CAN.png`, `SG.png`) used as region indicators next to project listings. `<span class="...">USA</span>` with colored background.

### Blue Bottom Border Accent
`border-b-8 border-color` — thick blue bottom border on cards. Creates a "stamped" or "flagged" look.

---

## What Their Site Gets Right

1. **Color confidence** — One blue, used everywhere. Not 5 blues. `#0d6efd` is THE color.
2. **Krona One headings** — Distinctive, geometric, instantly recognizable. Not Inter or Roboto.
3. **Arrow CTAs** — Every action link has `→`. Creates visual rhythm and directional flow.
4. **Thick border accents** — `border-b-8` on cards is bold and industrial. Feels like engineering, not SaaS.
5. **Clean white cards on pale cyan** — High contrast without being stark.
6. **Country badges** — Simple, effective way to show global presence.

## What Their Site Gets Wrong (Opportunities to Exceed)

1. **No dark mode** — Industrial software needs dark mode for field use (warehouse floors, night shifts).
2. **No component system** — Raw Tailwind classes everywhere. No tokens, no compounds. Inconsistent padding.
3. **No data visualization** — Zero charts, gauges, or metrics anywhere. SIOS should have EVM gauges that their site can't show.
4. **Static content** — No interactivity beyond hover effects. SIOS demos will be dynamic.
5. **No typography hierarchy beyond size** — Same weight patterns everywhere. No tension between heading and body.
6. **Inconsistent border radius** — Mixes `rounded-md`, `rounded-lg`, `rounded-xl` without clear logic.
7. **Old stack** — Vue 2, jQuery, Owl Carousel. Not a technical concern for design but signals they're not cutting edge.

---

## SIOS Design System — How We Match and Exceed

### Match
- **JCK Blue `#0d6efd`** as a primary accent (not THE primary — we need our own identity too)
- **Arrow CTAs** — adopt the `→` suffix pattern
- **Krona One** for hero/display headings — shows we're in their visual language
- **White Surface on pale bg** — clean card pattern with border accents
- **Country/region badges** — adapt to zone/discipline badges

### Exceed
- **Dark mode primary** — their site is light-only. SIOS is dark-first for field use.
- **Full token system** — consistent, composable, documented.
- **Data visualization** — gauges, progress rings, animated counters. Things their site can't do.
- **Interactive state machines** — live transitions, not static content.
- **Dual-font tension** — Krona One (headings) vs JetBrains Mono (data) vs Inter (body). Three voices, clear hierarchy.
- **Thick border accent** — adopt their `border-b-8` motif but use it semantically (green = passed, red = failed, blue = active).
