/**
 * RvnPreviewCard - Brutalist Preview Card (Base UI Wrapper)
 *
 * Wraps Base UI PreviewCard with RVN brutalist styling:
 * - 3px border
 * - Hover trigger
 * - Card preview on hover with delay
 *
 * @example
 * ```tsx
 * <RvnPreviewCard.Root>
 *   <RvnPreviewCard.Trigger>
 *     <a href="/unit/tx-99">TX-99</a>
 *   </RvnPreviewCard.Trigger>
 *   <RvnPreviewCard.Portal>
 *     <RvnPreviewCard.Positioner>
 *       <RvnPreviewCard.Popup>
 *         <RvnPreviewCard.Header>
 *           <RvnPreviewCard.Title>TX-99 Details</RvnPreviewCard.Title>
 *         </RvnPreviewCard.Header>
 *         <RvnPreviewCard.Body>
 *           <p>Status: Active</p>
 *           <p>Location: Sector 7</p>
 *         </RvnPreviewCard.Body>
 *       </RvnPreviewCard.Popup>
 *     </RvnPreviewCard.Positioner>
 *   </RvnPreviewCard.Portal>
 * </RvnPreviewCard.Root>
 * ```
 */

import * as React from 'react'
import { PreviewCard } from '@base-ui-components/react/preview-card'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnPreviewCardPopupProps
  extends React.ComponentPropsWithoutRef<typeof PreviewCard.Popup> {
  minWidth?: string
  maxWidth?: string
}

export interface RvnPreviewCardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnPreviewCardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

export interface RvnPreviewCardBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnPreviewCardFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnPreviewCardImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  popup: {
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  header: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    padding: RVN_SPACING.s,
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
  },
  body: {
    padding: RVN_SPACING.s,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMain,
    lineHeight: 1.5,
  },
  footer: {
    padding: RVN_SPACING.s,
    borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMuted,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Popup({
  style,
  minWidth = '280px',
  maxWidth = '400px',
  children,
  ...props
}: RvnPreviewCardPopupProps) {
  return (
    <PreviewCard.Popup
      style={{ ...styles.popup, minWidth, maxWidth, ...style }}
      data-rvn-preview-card-popup=""
      {...props}
    >
      {children}
    </PreviewCard.Popup>
  )
}

function Header({ style, children, ...props }: RvnPreviewCardHeaderProps) {
  return (
    <div
      style={{ ...styles.header, ...style }}
      data-rvn-preview-card-header=""
      {...props}
    >
      {children}
    </div>
  )
}

function Title({ style, children, ...props }: RvnPreviewCardTitleProps) {
  return (
    <h3
      style={{ ...styles.title, ...style }}
      data-rvn-preview-card-title=""
      {...props}
    >
      {children}
    </h3>
  )
}

function Body({ style, children, ...props }: RvnPreviewCardBodyProps) {
  return (
    <div
      style={{ ...styles.body, ...style }}
      data-rvn-preview-card-body=""
      {...props}
    >
      {children}
    </div>
  )
}

function Footer({ style, children, ...props }: RvnPreviewCardFooterProps) {
  return (
    <div
      style={{ ...styles.footer, ...style }}
      data-rvn-preview-card-footer=""
      {...props}
    >
      {children}
    </div>
  )
}

function Image({ style, alt = '', ...props }: RvnPreviewCardImageProps) {
  return (
    <img
      style={{ ...styles.image, ...style }}
      alt={alt}
      data-rvn-preview-card-image=""
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Popup.displayName = 'RvnPreviewCard.Popup'
Header.displayName = 'RvnPreviewCard.Header'
Title.displayName = 'RvnPreviewCard.Title'
Body.displayName = 'RvnPreviewCard.Body'
Footer.displayName = 'RvnPreviewCard.Footer'
Image.displayName = 'RvnPreviewCard.Image'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnPreviewCard = {
  Root: PreviewCard.Root,
  Trigger: PreviewCard.Trigger,
  Portal: PreviewCard.Portal,
  Positioner: PreviewCard.Positioner,
  Popup,
  Arrow: PreviewCard.Arrow,
  Header,
  Title,
  Body,
  Footer,
  Image,
}

export type {
  RvnPreviewCardPopupProps as PopupProps,
  RvnPreviewCardHeaderProps as HeaderProps,
  RvnPreviewCardTitleProps as TitleProps,
  RvnPreviewCardBodyProps as BodyProps,
  RvnPreviewCardFooterProps as FooterProps,
  RvnPreviewCardImageProps as ImageProps,
}
