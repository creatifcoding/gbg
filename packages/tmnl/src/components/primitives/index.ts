/**
 * TMNL Primitives
 *
 * Atomic UI components extracted from tmnl-ui.tsx.
 * All components use CSS custom properties from ScaleProvider.
 */

// Typography
export {
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
} from './typography';

// Button
export { Button, type ButtonProps } from './button';

// Input
export {
  Input,
  Checkbox,
  Switch,
  RadioGroup,
  type InputProps,
  type CheckboxProps,
  type SwitchProps,
  type RadioGroupProps,
} from './input';

// Badge & Utilities
export {
  Badge,
  Skeleton,
  Separator,
  Kbd,
  type BadgeProps,
  type SkeletonProps,
  type SeparatorProps,
  type KbdProps,
} from './badge';

// Card
export {
  Card,
  MissionCard,
  type CardProps,
  type MissionCardProps,
} from './card';
