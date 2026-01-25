/**
 * VANTA → Theia CSS Variable Mapping
 *
 * Theia uses --theia-* CSS variables derived from VS Code color tokens.
 * This mapping bridges TMNL's VANTA design system to Theia's theming.
 *
 * @see https://code.visualstudio.com/api/references/theme-color
 * @module theia-ide/browser/vanta-theme
 */

/**
 * VANTA Design System Colors
 * Imported conceptually from packages/tmnl/src/components/portal/tokens.ts
 */
const VANTA = {
  surface: {
    void: '#000000',
    base: '#030303',
    elevated: '#0a0a0a',
    raised: '#111111',
    overlay: '#1a1a1a',
  },
  text: {
    primary: '#e5e5e5',
    secondary: '#a3a3a3',
    tertiary: '#737373',
    muted: '#525252',
  },
  accent: {
    cyan: '#22d3ee',
    cyanGlow: 'rgba(34, 211, 238, 0.15)',
    emerald: '#34d399',
    rose: '#fb7185',
    amber: '#fbbf24',
    violet: '#a78bfa',
  },
  border: {
    default: '#1a1a1a',
    subtle: '#0f0f0f',
    strong: '#262626',
  },
  typography: {
    fontMono: '"Share Tech Mono", "JetBrains Mono", "Fira Code", monospace',
    fontUI: '"Geo", "Space Grotesk", "Inter", sans-serif',
    sizeBase: '13px',
    sizeSmall: '12px',
    lineHeight: '1.5',
  },
} as const;

/**
 * Complete VANTA → Theia token mapping
 */
export const VANTA_TO_THEIA_TOKENS: Record<string, string> = {
  // ==========================================================================
  // Editor Core
  // ==========================================================================
  '--theia-editor-background': VANTA.surface.void,
  '--theia-editor-foreground': VANTA.text.primary,
  '--theia-editorCursor-foreground': VANTA.accent.cyan,
  '--theia-editor-lineHighlightBackground': VANTA.surface.elevated,
  '--theia-editor-lineHighlightBorder': 'transparent',
  '--theia-editor-selectionBackground': VANTA.accent.cyanGlow,
  '--theia-editor-inactiveSelectionBackground': 'rgba(34, 211, 238, 0.08)',
  '--theia-editor-selectionHighlightBackground': 'rgba(34, 211, 238, 0.1)',
  '--theia-editorIndentGuide-background': VANTA.border.subtle,
  '--theia-editorIndentGuide-activeBackground': VANTA.border.default,
  '--theia-editorWhitespace-foreground': VANTA.text.muted,

  // ==========================================================================
  // Editor Line Numbers
  // ==========================================================================
  '--theia-editorLineNumber-foreground': VANTA.text.muted,
  '--theia-editorLineNumber-activeForeground': VANTA.text.secondary,

  // ==========================================================================
  // Editor Gutter
  // ==========================================================================
  '--theia-editorGutter-background': VANTA.surface.void,
  '--theia-editorGutter-modifiedBackground': VANTA.accent.amber,
  '--theia-editorGutter-addedBackground': VANTA.accent.emerald,
  '--theia-editorGutter-deletedBackground': VANTA.accent.rose,

  // ==========================================================================
  // Editor Widget (Hover, Suggest, etc.)
  // ==========================================================================
  '--theia-editorWidget-background': VANTA.surface.base,
  '--theia-editorWidget-border': VANTA.border.default,
  '--theia-editorWidget-foreground': VANTA.text.primary,
  '--theia-editorSuggestWidget-background': VANTA.surface.base,
  '--theia-editorSuggestWidget-border': VANTA.border.default,
  '--theia-editorSuggestWidget-foreground': VANTA.text.primary,
  '--theia-editorSuggestWidget-highlightForeground': VANTA.accent.cyan,
  '--theia-editorSuggestWidget-selectedBackground': VANTA.accent.cyanGlow,
  '--theia-editorHoverWidget-background': VANTA.surface.base,
  '--theia-editorHoverWidget-border': VANTA.border.default,
  '--theia-editorHoverWidget-foreground': VANTA.text.primary,

  // ==========================================================================
  // Side Bar
  // ==========================================================================
  '--theia-sideBar-background': VANTA.surface.base,
  '--theia-sideBar-foreground': VANTA.text.secondary,
  '--theia-sideBar-border': VANTA.border.default,
  '--theia-sideBarTitle-foreground': VANTA.text.primary,
  '--theia-sideBarSectionHeader-background': VANTA.surface.elevated,
  '--theia-sideBarSectionHeader-foreground': VANTA.text.primary,
  '--theia-sideBarSectionHeader-border': VANTA.border.subtle,

  // ==========================================================================
  // Activity Bar
  // ==========================================================================
  '--theia-activityBar-background': VANTA.surface.void,
  '--theia-activityBar-foreground': VANTA.text.secondary,
  '--theia-activityBar-inactiveForeground': VANTA.text.muted,
  '--theia-activityBar-border': VANTA.border.subtle,
  '--theia-activityBarBadge-background': VANTA.accent.cyan,
  '--theia-activityBarBadge-foreground': VANTA.surface.void,

  // ==========================================================================
  // Panel (Bottom Panel)
  // ==========================================================================
  '--theia-panel-background': VANTA.surface.base,
  '--theia-panel-border': VANTA.border.default,
  '--theia-panelTitle-activeBorder': VANTA.accent.cyan,
  '--theia-panelTitle-activeForeground': VANTA.text.primary,
  '--theia-panelTitle-inactiveForeground': VANTA.text.muted,

  // ==========================================================================
  // Status Bar
  // ==========================================================================
  '--theia-statusBar-background': VANTA.surface.void,
  '--theia-statusBar-foreground': VANTA.text.secondary,
  '--theia-statusBar-border': VANTA.border.subtle,
  '--theia-statusBarItem-hoverBackground': VANTA.surface.elevated,
  '--theia-statusBarItem-activeBackground': VANTA.surface.raised,

  // ==========================================================================
  // Title Bar
  // ==========================================================================
  '--theia-titleBar-activeBackground': VANTA.surface.void,
  '--theia-titleBar-activeForeground': VANTA.text.primary,
  '--theia-titleBar-inactiveBackground': VANTA.surface.void,
  '--theia-titleBar-inactiveForeground': VANTA.text.muted,
  '--theia-titleBar-border': VANTA.border.subtle,

  // ==========================================================================
  // Tabs
  // ==========================================================================
  '--theia-tab-activeBackground': VANTA.surface.base,
  '--theia-tab-activeForeground': VANTA.text.primary,
  '--theia-tab-activeBorder': 'transparent',
  '--theia-tab-activeBorderTop': VANTA.accent.cyan,
  '--theia-tab-inactiveBackground': VANTA.surface.void,
  '--theia-tab-inactiveForeground': VANTA.text.muted,
  '--theia-tab-border': VANTA.border.subtle,
  '--theia-tab-hoverBackground': VANTA.surface.elevated,
  '--theia-tab-hoverForeground': VANTA.text.primary,
  '--theia-editorGroupHeader-tabsBackground': VANTA.surface.void,
  '--theia-editorGroupHeader-tabsBorder': VANTA.border.subtle,
  '--theia-editorGroup-border': VANTA.border.default,

  // ==========================================================================
  // List / Tree
  // ==========================================================================
  '--theia-list-activeSelectionBackground': VANTA.accent.cyanGlow,
  '--theia-list-activeSelectionForeground': VANTA.text.primary,
  '--theia-list-inactiveSelectionBackground': 'rgba(34, 211, 238, 0.08)',
  '--theia-list-inactiveSelectionForeground': VANTA.text.primary,
  '--theia-list-hoverBackground': VANTA.surface.elevated,
  '--theia-list-hoverForeground': VANTA.text.primary,
  '--theia-list-focusBackground': VANTA.accent.cyanGlow,
  '--theia-list-focusForeground': VANTA.text.primary,
  '--theia-list-highlightForeground': VANTA.accent.cyan,
  '--theia-tree-indentGuidesStroke': VANTA.border.subtle,

  // ==========================================================================
  // Input / Form Controls
  // ==========================================================================
  '--theia-input-background': VANTA.surface.elevated,
  '--theia-input-foreground': VANTA.text.primary,
  '--theia-input-border': VANTA.border.default,
  '--theia-input-placeholderForeground': VANTA.text.muted,
  '--theia-inputOption-activeBorder': VANTA.accent.cyan,
  '--theia-inputOption-activeBackground': VANTA.accent.cyanGlow,
  '--theia-inputOption-activeForeground': VANTA.text.primary,
  '--theia-inputValidation-errorBackground': VANTA.surface.base,
  '--theia-inputValidation-errorBorder': VANTA.accent.rose,
  '--theia-inputValidation-warningBackground': VANTA.surface.base,
  '--theia-inputValidation-warningBorder': VANTA.accent.amber,
  '--theia-inputValidation-infoBackground': VANTA.surface.base,
  '--theia-inputValidation-infoBorder': VANTA.accent.cyan,

  // ==========================================================================
  // Dropdown
  // ==========================================================================
  '--theia-dropdown-background': VANTA.surface.base,
  '--theia-dropdown-foreground': VANTA.text.primary,
  '--theia-dropdown-border': VANTA.border.default,
  '--theia-dropdown-listBackground': VANTA.surface.base,

  // ==========================================================================
  // Button
  // ==========================================================================
  '--theia-button-background': VANTA.accent.cyan,
  '--theia-button-foreground': VANTA.surface.void,
  '--theia-button-hoverBackground': '#06b6d4', // cyan-500
  '--theia-button-secondaryBackground': VANTA.surface.elevated,
  '--theia-button-secondaryForeground': VANTA.text.primary,
  '--theia-button-secondaryHoverBackground': VANTA.surface.raised,

  // ==========================================================================
  // Scrollbar
  // ==========================================================================
  '--theia-scrollbar-shadow': 'transparent',
  '--theia-scrollbarSlider-background': 'rgba(255, 255, 255, 0.1)',
  '--theia-scrollbarSlider-hoverBackground': 'rgba(255, 255, 255, 0.15)',
  '--theia-scrollbarSlider-activeBackground': 'rgba(255, 255, 255, 0.2)',

  // ==========================================================================
  // Focus / Selection
  // ==========================================================================
  '--theia-focusBorder': VANTA.accent.cyan,
  '--theia-selection-background': VANTA.accent.cyanGlow,
  '--theia-foreground': VANTA.text.primary,
  '--theia-descriptionForeground': VANTA.text.secondary,
  '--theia-disabledForeground': VANTA.text.muted,
  '--theia-icon-foreground': VANTA.text.secondary,
  '--theia-widget-shadow': 'rgba(0, 0, 0, 0.5)',

  // ==========================================================================
  // Notification / Messages
  // ==========================================================================
  '--theia-notifications-background': VANTA.surface.base,
  '--theia-notifications-foreground': VANTA.text.primary,
  '--theia-notifications-border': VANTA.border.default,
  '--theia-notificationCenterHeader-background': VANTA.surface.elevated,
  '--theia-notificationLink-foreground': VANTA.accent.cyan,

  // ==========================================================================
  // Semantic Colors
  // ==========================================================================
  '--theia-errorForeground': VANTA.accent.rose,
  '--theia-errorBackground': 'rgba(251, 113, 133, 0.1)',
  '--theia-warningForeground': VANTA.accent.amber,
  '--theia-warningBackground': 'rgba(251, 191, 36, 0.1)',
  '--theia-infoForeground': VANTA.accent.cyan,
  '--theia-infoBackground': 'rgba(34, 211, 238, 0.1)',
  '--theia-successForeground': VANTA.accent.emerald,
  '--theia-successBackground': 'rgba(52, 211, 153, 0.1)',

  // ==========================================================================
  // Git Decorations
  // ==========================================================================
  '--theia-gitDecoration-addedResourceForeground': VANTA.accent.emerald,
  '--theia-gitDecoration-modifiedResourceForeground': VANTA.accent.amber,
  '--theia-gitDecoration-deletedResourceForeground': VANTA.accent.rose,
  '--theia-gitDecoration-untrackedResourceForeground': VANTA.accent.emerald,
  '--theia-gitDecoration-conflictingResourceForeground': VANTA.accent.rose,
  '--theia-gitDecoration-ignoredResourceForeground': VANTA.text.muted,

  // ==========================================================================
  // Minimap (disabled but themed anyway)
  // ==========================================================================
  '--theia-minimap-background': VANTA.surface.void,
  '--theia-minimapSlider-background': 'rgba(255, 255, 255, 0.1)',
  '--theia-minimapSlider-hoverBackground': 'rgba(255, 255, 255, 0.15)',
  '--theia-minimapSlider-activeBackground': 'rgba(255, 255, 255, 0.2)',

  // ==========================================================================
  // Typography
  // ==========================================================================
  '--theia-code-font-family': VANTA.typography.fontMono,
  '--theia-code-font-size': VANTA.typography.sizeBase,
  '--theia-code-line-height': VANTA.typography.lineHeight,
  '--theia-ui-font-family': VANTA.typography.fontUI,
  '--theia-ui-font-size': VANTA.typography.sizeSmall,
};

/**
 * CSS string for additional overrides that require !important
 */
export const VANTA_STYLE_OVERRIDES = `
  /* Force Monaco editor background */
  .monaco-editor,
  .monaco-editor .margin,
  .monaco-editor-background,
  .monaco-editor .inputarea.ime-input {
    background: ${VANTA.surface.void} !important;
  }

  /* Force Theia editor container */
  .theia-editor,
  .theia-editor-container {
    background: ${VANTA.surface.void} !important;
  }

  /* Tab bar styling */
  .p-TabBar {
    background: ${VANTA.surface.void} !important;
  }

  .p-TabBar-tab {
    border-color: ${VANTA.border.subtle} !important;
  }

  .p-TabBar-tab.p-mod-current {
    border-top-color: ${VANTA.accent.cyan} !important;
    background: ${VANTA.surface.base} !important;
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* Focus rings */
  *:focus {
    outline-color: ${VANTA.accent.cyan} !important;
  }

  /* Selection */
  ::selection {
    background: ${VANTA.accent.cyanGlow} !important;
  }
`;
