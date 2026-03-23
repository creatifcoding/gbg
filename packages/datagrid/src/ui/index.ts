/**
 * UI module — AG-Grid rendering layer for @tmnl/datagrid.
 * 
 * Contains theme tokens, cell renderers, and the direct theme builder.
 * The stress testbed component lives in TMNL (consumer), not here.
 * 
 * @module
 */

// ── Theme ───────────────────────────────────────────
export {
  COLORS, TYPOGRAPHY, SPACING, DIMENSIONS, ANIMATION,
  TMNL_TOKENS, STATUS_COLORS, FLASH_COLORS,
  type TmnlTokens, type StatusColors, type FlashColors,
  createDirectTheme,
} from "./theme"

// ── Renderers ───────────────────────────────────────
export {
  RowHeaderRenderer,
  FormulaCellRenderer,
  StatusCellRenderer,
} from "./renderers"
