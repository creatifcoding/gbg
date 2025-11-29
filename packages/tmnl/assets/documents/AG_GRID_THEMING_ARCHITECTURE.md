# AG Grid Theming Architecture Deep Dive

## Executive Summary

AG Grid v34+ introduces a sophisticated theming system built on:
- **Composable Parts**: Modular style components (buttons, checkboxes, tabs, icons, inputs)
- **Parameterized Themes**: 200+ configurable CSS custom properties
- **Reference System**: Derived values via `{ ref: 'paramName' }` syntax
- **Calc Expressions**: Computed values via `{ calc: 'spacing * 2' }` syntax
- **Mode Support**: Light/dark/custom color schemes with mode-specific overrides

---

## Architecture Layers

```
                    ┌─────────────────────────────────────┐
                    │         Your Custom Theme           │
                    │   themeQuartz.withParams({...})     │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │         Built-in Themes             │
                    │  themeQuartz | themeAlpine |        │
                    │  themeBalham | themeMaterial        │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
┌────────▼────────┐   ┌────────────▼────────┐   ┌───────────▼───────┐
│     Parts       │   │    Core Params      │   │   Shared Params   │
│ (Modular CSS)   │   │   (Grid-specific)   │   │   (Foundation)    │
└─────────────────┘   └─────────────────────┘   └───────────────────┘
```

---

## I. Theme API

### Creating & Customizing Themes

```typescript
import { themeQuartz } from 'ag-grid-community';

// Method 1: Extend built-in theme
const myTheme = themeQuartz.withParams({
  accentColor: '#00A2FF',
  backgroundColor: '#000000',
  fontSize: 12,
});

// Method 2: Create from scratch
import { createTheme } from 'ag-grid-community';

const customTheme = createTheme()
  .withPart(checkboxStyleDefault)
  .withPart(iconSetQuartzRegular)
  .withPart(tabStyleQuartz)
  .withParams({
    accentColor: '#ff0000',
    // ...
  });
```

### Theme Interface

```typescript
type Theme<TParams> = {
  withPart<TPartParams>(part: Part<TPartParams>): Theme<TParams & TPartParams>;
  withoutPart(feature: string): Theme<TParams>;
  withParams(defaults: Partial<TParams>, mode?: string): Theme<TParams>;
};
```

---

## II. Built-in Themes

| Theme | Font | Style | Best For |
|-------|------|-------|----------|
| **themeQuartz** | IBM Plex Sans | Modern, clean | Default choice |
| **themeAlpine** | System fonts | Accessible, rounded | Accessibility focus |
| **themeBalham** | System fonts | Compact, dense | Data-heavy UIs |
| **themeMaterial** | Roboto | Google MD | Material Design apps |

### Theme Composition Example (Quartz)

```typescript
const themeQuartz = createTheme()
  .withPart(checkboxStyleDefault)
  .withPart(colorSchemeVariable)
  .withPart(iconSetQuartzRegular)
  .withPart(tabStyleQuartz)
  .withPart(inputStyleBordered)
  .withPart(columnDropStyleBordered)
  .withParams({
    fontFamily: [{ googleFont: 'IBM Plex Sans' }, ...systemFonts],
  });
```

---

## III. Parts System (Modular Composition)

Parts are swappable style modules that control specific UI components.

### Available Parts

| Part Category | Variants | Controls |
|---------------|----------|----------|
| **button-style** | `base`, `alpine`, `balham`, `quartz` | Button appearance |
| **checkbox-style** | `default` | Checkbox/radio styling |
| **color-scheme** | `variable`, `light`, `dark` | Light/dark mode |
| **icon-set** | `alpine`, `balham`, `material`, `quartz` | Icon glyphs |
| **input-style** | `bordered`, `underlined` | Form input styling |
| **tab-style** | `alpine`, `material`, `quartz`, `rolodex` | Tab appearance |
| **column-drop-style** | `bordered`, `plain` | Column drop zone |
| **batch-edit** | `base` | Batch edit indicators |

### Swapping Parts

```typescript
import { themeQuartz, iconSetMaterial, inputStyleUnderlined } from 'ag-grid-community';

const hybridTheme = themeQuartz
  .withPart(iconSetMaterial)      // Replace icons
  .withPart(inputStyleUnderlined); // Replace input style
```

---

## IV. Parameter Categories

### Shared Parameters (Foundation)

These apply to all themes and affect the entire grid:

```typescript
interface SharedThemeParams {
  // Core Colors
  accentColor: ColorValue;        // Brand color for selections, checkboxes
  backgroundColor: ColorValue;     // Grid background
  foregroundColor: ColorValue;     // Default text/border color
  borderColor: ColorValue;         // Default border color
  chromeBackgroundColor: ColorValue; // Headers, tool panels, menus

  // Typography
  fontFamily: FontFamilyValue;     // Default font stack
  fontSize: LengthValue;           // Base font size (default: 14)

  // Spacing & Layout
  spacing: LengthValue;            // Base spacing unit (default: 8)
  borderRadius: LengthValue;       // Corner radius (default: 4)
  borderWidth: LengthValue;        // Default border width (default: 1)
  iconSize: LengthValue;           // Icon dimensions (default: 16)

  // Shadows
  popupShadow: ShadowValue;        // Dialogs, menus
  cardShadow: ShadowValue;         // Dropdowns, editors
  focusShadow: ShadowValue;        // Focus rings

  // Color Scheme
  browserColorScheme: ColorSchemeValue; // 'light' | 'dark'
}
```

### Core Parameters (Grid-Specific)

200+ parameters for fine-grained control:

#### Row & Cell Styling
```typescript
rowHeight: LengthValue;
rowBorder: BorderValue;
rowHoverColor: ColorValue;
oddRowBackgroundColor: ColorValue;
selectedRowBackgroundColor: ColorValue;
cellTextColor: ColorValue;
cellHorizontalPadding: LengthValue;
cellEditingBorder: BorderValue;
```

#### Header Styling
```typescript
headerHeight: LengthValue;
headerBackgroundColor: ColorValue;
headerTextColor: ColorValue;
headerFontFamily: FontFamilyValue;
headerFontSize: LengthValue;
headerFontWeight: FontWeightValue;
headerRowBorder: BorderValue;
headerColumnBorder: BorderValue;
headerColumnResizeHandleColor: ColorValue;
```

#### Range Selection
```typescript
rangeSelectionBackgroundColor: ColorValue;
rangeSelectionBorderColor: ColorValue;
rangeSelectionBorderStyle: BorderStyleValue;
rangeSelectionHighlightColor: ColorValue;
```

#### Menu & Popup
```typescript
menuBackgroundColor: ColorValue;
menuBorder: BorderValue;
menuShadow: ShadowValue;
menuTextColor: ColorValue;
dialogBorder: BorderValue;
dialogShadow: ShadowValue;
```

#### Side Panel
```typescript
sideBarBackgroundColor: ColorValue;
sidePanelBorder: BorderValue;
sideButtonBackgroundColor: ColorValue;
sideButtonSelectedBackgroundColor: ColorValue;
```

---

## V. Value Types

### ColorValue

```typescript
// Simple color
accentColor: '#00A2FF'

// Reference another param
headerTextColor: { ref: 'foregroundColor' }

// Mix with another color
selectedRowBackgroundColor: { ref: 'accentColor', mix: 0.12 }

// Mix onto a background
borderColor: { ref: 'foregroundColor', onto: 'backgroundColor', mix: 0.15 }
```

### LengthValue

```typescript
// Pixels (number)
spacing: 8

// String with unit
fontSize: '14px'

// Calculated value
rowHeight: { calc: 'max(iconSize, dataFontSize) + spacing * 3.25' }

// Reference
headerFontSize: { ref: 'fontSize' }
```

### FontFamilyValue

```typescript
// Array with Google Font support
fontFamily: [
  { googleFont: 'IBM Plex Sans' },
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'sans-serif',
]
```

### BorderValue

```typescript
// Boolean (uses defaults)
rowBorder: true

// Color only
cellEditingBorder: { color: '#00A2FF' }

// Full specification
headerColumnBorder: {
  style: 'solid',
  width: 1,
  color: 'transparent',
}
```

### ShadowValue

```typescript
// CSS string
popupShadow: '0 0 16px #00000026'

// Object notation
focusShadow: { spread: 3, color: { ref: 'accentColor', mix: 0.5 } }
```

---

## VI. Mode Support (Light/Dark)

### Using Color Schemes

```typescript
import { themeQuartz, colorSchemeDark } from 'ag-grid-community';

// Apply dark mode
const darkTheme = themeQuartz.withPart(colorSchemeDark);

// Or via withParams
const darkTheme2 = themeQuartz.withParams({
  backgroundColor: '#1e1e1e',
  foregroundColor: '#ffffff',
  browserColorScheme: 'dark',
});
```

### Mode-Specific Parameters

```typescript
const customTheme = createTheme()
  .withParams({
    accentColor: '#2196f3',
  })
  .withParams({
    backgroundColor: '#1e1e1e',
    foregroundColor: '#ffffff',
  }, 'dark');
```

---

## VII. TMNL Integration Strategy

### Current Implementation (`data-grid-theme.ts`)

```typescript
import { themeQuartz } from 'ag-grid-community';

const tmnlTheme = themeQuartz.withParams({
  accentColor: '#00A2FF',
  backgroundColor: '#000000',
  borderColor: '#595D5A',
  borderRadius: 2,
  browserColorScheme: 'dark',
  cellHorizontalPaddingScale: 0.8,
  cellTextColor: '#C3CBC5',
  columnBorder: true,
  fontFamily: { googleFont: 'Inclusive Sans' },
  fontSize: 12,
  foregroundColor: '#FFFFFF',
  headerBackgroundColor: '#000000',
  headerFontSize: 14,
  headerFontWeight: 700,
  headerRowBorder: true,
  headerTextColor: '#FFFFFF',
  oddRowBackgroundColor: '#1E1E21',
  rangeSelectionBackgroundColor: '#FFFF0020',
  rangeSelectionBorderColor: 'yellow',
  rangeSelectionBorderStyle: 'dotted',
  rowBorder: true,
  rowVerticalPaddingScale: 1.5,
  wrapperBorder: true,
  wrapperBorderRadius: 2,
});
```

### Recommendations for TMNL Cohesion

1. **Use Monospace Font Family**
   ```typescript
   fontFamily: [
     'ui-monospace',
     'SFMono-Regular',
     '"SF Mono"',
     'Menlo',
     'Consolas',
     'monospace',
   ],
   ```

2. **Match TMNL Color Palette**
   ```typescript
   backgroundColor: '#0a0a0a',      // TMNL black
   chromeBackgroundColor: '#141414', // TMNL header
   borderColor: '#262626',           // TMNL borders
   accentColor: '#ffffff',           // TMNL accent (white)
   ```

3. **Compact Spacing for Widget Context**
   ```typescript
   spacing: 4,
   rowVerticalPaddingScale: 0.8,
   cellHorizontalPaddingScale: 0.7,
   fontSize: 11,
   ```

4. **Remove Decorative Elements**
   ```typescript
   wrapperBorder: false,
   wrapperBorderRadius: 0,
   headerRowBorder: { color: '#262626' },
   focusShadow: 'none',
   ```

---

## VIII. Submodule Reference

The complete ag-grid source is available at:
```
../../submodules/ag-grid/
```

### Key Paths

| Path | Contents |
|------|----------|
| `packages/ag-grid-community/src/theming/` | Core theming system |
| `packages/ag-grid-community/src/theming/parts/` | All parts (button, checkbox, icon, etc.) |
| `packages/ag-grid-community/src/theming/core/core-css.ts` | All core parameters |
| `packages/ag-grid-community/src/agStack/theming/shared/shared-css.ts` | Shared parameters |
| `documentation/ag-grid-docs/src/components/theme-builder/` | Theme builder tool source |

---

## IX. Breaking Changes in v34

1. **Module Registration Required**
   ```typescript
   import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
   ModuleRegistry.registerModules([AllCommunityModule]);
   ```

2. **Legacy CSS Removed** - No more `.ag-theme-alpine` classes
3. **New Theme API** - `withPart()`, `withParams()`, `withoutPart()`
4. **Parts are Tree-Shakeable** - Only imported parts are bundled

---

## X. References

- [AG Grid Theming Documentation](https://www.ag-grid.com/react-data-grid/theming/)
- [Theme Builder Tool](https://www.ag-grid.com/theme-builder/)
- [Migration Guide v33 to v34](https://www.ag-grid.com/react-data-grid/upgrading-to-ag-grid-34/)
- Submodule: `../../submodules/ag-grid/`

---

*Document generated during TMNL ag-grid integration experiment (EDIN Negotiate phase)*
