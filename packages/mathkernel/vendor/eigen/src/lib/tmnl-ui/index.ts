/**
 * TMNL CEW Design System
 *
 * Command & Electronic Warfare inspired design system.
 * Pure black aesthetic with minimal accent.
 *
 * @example
 * ```tsx
 * import { TMNL } from '@/lib/tmnl-ui'
 *
 * // Typography
 * <TMNL.Label>STATUS</TMNL.Label>
 * <TMNL.Heading>SYSTEM ACTIVE</TMNL.Heading>
 *
 * // Form elements
 * <TMNL.Button variant="tmnl">ACTION</TMNL.Button>
 * <TMNL.Input placeholder="Enter value" />
 *
 * // Display
 * <TMNL.Badge variant="success">ONLINE</TMNL.Badge>
 * <TMNL.StatusIndicator status="active" label="OPERATIONAL" />
 *
 * // Layout
 * <TMNL.Card.Root>
 *   <TMNL.Card.Header>
 *     <TMNL.Card.Title>PANEL</TMNL.Card.Title>
 *   </TMNL.Card.Header>
 *   <TMNL.Card.Body>Content</TMNL.Card.Body>
 * </TMNL.Card.Root>
 *
 * // Drawer
 * <TMNL.Drawer.Root open={open} onClose={close}>
 *   <TMNL.Drawer.Header>...</TMNL.Drawer.Header>
 *   <TMNL.Drawer.Body>...</TMNL.Drawer.Body>
 * </TMNL.Drawer.Root>
 * ```
 *
 * @module
 */

// =============================================================================
// PRIMITIVES
// =============================================================================

import {
  Label,
  LabelSmall,
  Heading,
  Body,
  ID,
} from './primitives/Label'

import { Button } from './primitives/Button'
import { Input, Textarea } from './primitives/Input'
import { Badge, StatusIndicator } from './primitives/Badge'
import { Separator } from './primitives/Separator'

// =============================================================================
// COMPONENTS
// =============================================================================

import { Drawer } from './components/Drawer'
import { Card } from './components/Card'
import { StatusFooter, StatusItem } from './components/StatusFooter'

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const TMNL = {
  // Typography
  Label,
  LabelSmall,
  Heading,
  Body,
  ID,

  // Form
  Button,
  Input,
  Textarea,

  // Display
  Badge,
  StatusIndicator,
  Separator,

  // Layout (Compound)
  Card,
  Drawer,
  StatusFooter,
  StatusItem,
}

// =============================================================================
// TOKENS
// =============================================================================

export { TMNL_TOKENS, TMNL_FONT_SIZE, TMNL_COLORS } from './tokens'

// =============================================================================
// UTILITIES
// =============================================================================

export { cn } from './utils/cn'

// =============================================================================
// INDIVIDUAL EXPORTS (for tree-shaking)
// =============================================================================

// Primitives
export {
  Label,
  LabelSmall,
  Heading,
  Body,
  ID,
} from './primitives/Label'

export { Button } from './primitives/Button'
export { Input, Textarea } from './primitives/Input'
export { Badge, StatusIndicator } from './primitives/Badge'
export { Separator } from './primitives/Separator'

// Components
export {
  Drawer,
  DrawerRoot,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from './components/Drawer'

export {
  Card,
  CardRoot,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from './components/Card'

export { StatusFooter, StatusItem } from './components/StatusFooter'
