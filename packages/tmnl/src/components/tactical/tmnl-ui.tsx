/**
 * TMNL UI Entry Point
 *
 * This is the facade/barrel export for the TMNL component library.
 * All components are now modularized in separate files.
 *
 * Usage:
 *   import { Tmnl } from '@/components/tactical/tmnl-ui';
 *   <Tmnl.Button />
 *   <Tmnl.LeftDrawer />
 */

// =============================================================================
// IMPORTS FROM MODULAR LOCATIONS
// =============================================================================

// Primitives
import {
  Label,
  LabelSmall,
  CardLabel,
  Heading,
  GroupHeader,
  Body,
  Coords,
  ID,
  Stat,
  ItemNumber,
  ItemSubtitle,
  Button,
  Input,
  Checkbox,
  Switch,
  RadioGroup,
  Badge,
  Skeleton,
  Separator,
  Kbd,
  Card,
  MissionCard,
} from '@/components/primitives';

// Static UI
import {
  StatusFooter,
  Drawer,
  LeftDrawer,
  RightDrawer,
  CommandBar,
  Modal,
} from '@/components/static-ui';

// Controllers
import { Knob, Slider, Fader } from '@/components/controllers';

// =============================================================================
// TMNL NAMESPACE EXPORT (Backward Compatibility)
// =============================================================================

export const Tmnl = {
  // Typography
  Label,
  LabelSmall,
  Heading,
  Body,
  ID,
  Stat,
  CardLabel,
  Coords,
  GroupHeader,
  ItemNumber,
  ItemSubtitle,

  // Atoms
  Button,
  Input,
  Badge,
  Skeleton,
  Separator,
  Kbd,
  Checkbox,
  Switch,
  RadioGroup,

  // Drawer
  Drawer,
  LeftDrawer,
  RightDrawer,

  // Overlays
  CommandBar,
  Modal,

  // Cards
  Card,
  MissionCard,

  // Layout
  StatusFooter,

  // Controller Components
  Controller: {
    Knob,
    Slider,
    Fader,
  },
};

// =============================================================================
// INDIVIDUAL EXPORTS (For Direct Import)
// =============================================================================

// Re-export everything for direct imports
export * from '@/components/primitives';
export * from '@/components/static-ui';
export * from '@/components/controllers';

// Legacy named exports for backward compatibility
export { Knob as TmnlKnob, Slider as TmnlSlider, Fader as TmnlFader } from '@/components/controllers';
