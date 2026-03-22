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

// Interactive Card
export {
  InteractiveCard,
  type InteractiveCardProps,
  type InteractiveCardMode,
} from './InteractiveCard';

// Metrics
export {
  MetricBadge,
  type MetricBadgeProps,
  type MetricAccent,
  type MetricVariant,
  type MetricFormat,
} from './metrics';

// Panel
export {
  PanelWrapper,
  PanelHeader,
  PanelFooter,
  type PanelWrapperProps,
  type PanelHeaderProps,
  type PanelFooterProps,
} from './panel';

// Slider Variants
export {
  LogSlider,
  LogSliderPresets,
  type LogSliderProps,
} from './slider';

// FSM (Finite State Machine)
export {
  StateNode,
  getStateColors,
  TransitionArrow,
  TransitionRule,
  type StateNodeProps,
  type FsmStateType,
  type StateColors,
  type TransitionArrowProps,
  type ArrowDirection,
  type TransitionRuleProps,
} from './fsm';
