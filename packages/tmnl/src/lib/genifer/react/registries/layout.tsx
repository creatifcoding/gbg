/**
 * @fileoverview Layout component registry for genifer
 *
 * Wires the layout module components (Grid, Stack, Flex, etc.) to the
 * genifer ComponentRegistry interface.
 *
 * @module genifer/react/registries/layout
 */

'use client';

import {
  Grid,
  Stack,
  VStack,
  HStack,
  Flex,
  FlexItem,
  Spacer,
  Divider,
  Center,
  AspectRatio,
  Wrap,
} from '@/lib/layout/components';
import type { SpacingToken } from '@/lib/layout/schemas';
import type { ComponentRegistry, ComponentRenderProps } from '../renderer';

// =============================================================================
// Layout Component Adapters
// =============================================================================

/**
 * Grid adapter - CSS Grid with breakpoints and resize support
 */
function GridAdapter({ element, children }: ComponentRenderProps) {
  const { template, breakpoints, gap, direction, resizable, className, ...rest } = element.props;
  return (
    <Grid
      id={element.key}
      template={template as string}
      breakpoints={breakpoints as any}
      gap={gap as SpacingToken}
      direction={direction as 'row' | 'column'}
      resizable={resizable as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Grid>
  );
}

/**
 * Stack adapter - Linear flex layout
 */
function StackAdapter({ element, children }: ComponentRenderProps) {
  const { direction, gap, align, justify, wrap, fill, className, ...rest } = element.props;
  return (
    <Stack
      direction={direction as 'row' | 'column'}
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      wrap={wrap as boolean}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Stack>
  );
}

/**
 * VStack adapter - Vertical stack
 */
function VStackAdapter({ element, children }: ComponentRenderProps) {
  const { gap, align, justify, fill, className, ...rest } = element.props;
  return (
    <VStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </VStack>
  );
}

/**
 * HStack adapter - Horizontal stack
 */
function HStackAdapter({ element, children }: ComponentRenderProps) {
  const { gap, align, justify, fill, className, ...rest } = element.props;
  return (
    <HStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </HStack>
  );
}

/**
 * Flex adapter - Full flexbox control
 */
function FlexAdapter({ element, children }: ComponentRenderProps) {
  const { direction, wrap, gap, alignItems, justifyContent, fill, className, ...rest } = element.props;
  return (
    <Flex
      direction={direction as any}
      wrap={wrap as any}
      gap={gap as SpacingToken}
      alignItems={alignItems as any}
      justifyContent={justifyContent as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Flex>
  );
}

/**
 * FlexItem adapter - Flex child with grow/shrink/basis
 */
function FlexItemAdapter({ element, children }: ComponentRenderProps) {
  const { grow, shrink, basis, className, ...rest } = element.props;
  return (
    <FlexItem
      grow={grow as number}
      shrink={shrink as number}
      basis={basis as string | number}
      className={className as string}
      {...rest}
    >
      {children}
    </FlexItem>
  );
}

/**
 * Spacer adapter - Flexible space (renders empty flex div)
 */
function SpacerAdapter(_props: ComponentRenderProps) {
  return <Spacer />;
}

/**
 * Divider adapter - Visual separator
 */
function DividerAdapter({ element }: ComponentRenderProps) {
  const { orientation, className } = element.props;
  return (
    <Divider
      orientation={orientation as 'horizontal' | 'vertical'}
      className={className as string}
    />
  );
}

/**
 * Center adapter - Center content
 */
function CenterAdapter({ element, children }: ComponentRenderProps) {
  const { className, ...rest } = element.props;
  return (
    <Center className={className as string} {...rest}>
      {children}
    </Center>
  );
}

/**
 * AspectRatio adapter - Maintain aspect ratio
 */
function AspectRatioAdapter({ element, children }: ComponentRenderProps) {
  const { ratio, className, ...rest } = element.props;
  return (
    <AspectRatio ratio={ratio as number} className={className as string} {...rest}>
      {children}
    </AspectRatio>
  );
}

/**
 * Wrap adapter - Wrapping flex container
 */
function WrapAdapter({ element, children }: ComponentRenderProps) {
  const { gap, alignItems, justifyContent, className, ...rest } = element.props;
  return (
    <Wrap
      gap={gap as SpacingToken}
      alignItems={alignItems as any}
      justifyContent={justifyContent as any}
      className={className as string}
      {...rest}
    >
      {children}
    </Wrap>
  );
}

// =============================================================================
// Registry Export
// =============================================================================

/**
 * Layout component registry for genifer
 *
 * @example
 * ```tsx
 * import { layoutRegistry } from '@/lib/genifer/react/registries/layout'
 * import { Renderer } from '@/lib/genifer'
 *
 * <Renderer tree={tree} registry={{ ...layoutRegistry, ...otherComponents }} />
 * ```
 */
export const layoutRegistry: ComponentRegistry = {
  Grid: GridAdapter,
  Stack: StackAdapter,
  VStack: VStackAdapter,
  HStack: HStackAdapter,
  Flex: FlexAdapter,
  FlexItem: FlexItemAdapter,
  Spacer: SpacerAdapter,
  Divider: DividerAdapter,
  Center: CenterAdapter,
  AspectRatio: AspectRatioAdapter,
  Wrap: WrapAdapter,
};

/**
 * Helper to merge layout registry with other registries
 */
export function withLayoutRegistry(base: ComponentRegistry): ComponentRegistry {
  return { ...layoutRegistry, ...base };
}
