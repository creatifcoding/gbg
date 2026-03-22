/**
 * RvnAvatar - Brutalist Avatar Component
 *
 * Wraps Base UI Avatar with RVN styling:
 * - 3px black border
 * - No border-radius (square)
 * - Monospace fallback initials
 *
 * @example
 * ```tsx
 * <RvnAvatar.Root>
 *   <RvnAvatar.Image src="/avatar.jpg" alt="User" />
 *   <RvnAvatar.Fallback>JD</RvnAvatar.Fallback>
 * </RvnAvatar.Root>
 * ```
 */

import * as React from 'react'
import { Avatar } from '@base-ui-components/react/avatar'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnAvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export interface RvnAvatarRootProps extends React.ComponentProps<typeof Avatar.Root> {
  /** Size of the avatar */
  size?: RvnAvatarSize
}

export interface RvnAvatarImageProps extends React.ComponentProps<typeof Avatar.Image> {}
export interface RvnAvatarFallbackProps extends React.ComponentProps<typeof Avatar.Fallback> {}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface RvnAvatarContextValue {
  size: RvnAvatarSize
}

const RvnAvatarContext = React.createContext<RvnAvatarContextValue>({
  size: 'md',
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const sizeMap: Record<RvnAvatarSize, { size: string; fontSize: string }> = {
  sm: { size: '32px', fontSize: RVN_FONT_SIZES.label },
  md: { size: '48px', fontSize: RVN_FONT_SIZES.heading },
  lg: { size: '64px', fontSize: RVN_FONT_SIZES.dataMd },
  xl: { size: '96px', fontSize: RVN_FONT_SIZES.dataLg },
}

const styles = {
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    overflow: 'hidden',
    background: RVN_COLORS.surface,
    flexShrink: 0,
  } as React.CSSProperties,
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  } as React.CSSProperties,
  fallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: RVN_COLORS.black,
    color: RVN_COLORS.textInverse,
    fontFamily: RVN_FONTS.mono,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLSpanElement, RvnAvatarRootProps>(
  ({ size = 'md', style, ...props }, ref) => {
    const sizeStyles = sizeMap[size]

    return (
      <RvnAvatarContext.Provider value={{ size }}>
        <Avatar.Root
          ref={ref}
          style={{
            ...styles.root,
            width: sizeStyles.size,
            height: sizeStyles.size,
            ...style,
          }}
          {...props}
        />
      </RvnAvatarContext.Provider>
    )
  }
)
Root.displayName = 'RvnAvatar.Root'

const Image = React.forwardRef<HTMLImageElement, RvnAvatarImageProps>(
  ({ style, ...props }, ref) => (
    <Avatar.Image
      ref={ref}
      style={{ ...styles.image, ...style }}
      {...props}
    />
  )
)
Image.displayName = 'RvnAvatar.Image'

const Fallback = React.forwardRef<HTMLSpanElement, RvnAvatarFallbackProps>(
  ({ style, ...props }, ref) => {
    const { size } = React.useContext(RvnAvatarContext)
    const sizeStyles = sizeMap[size]

    return (
      <Avatar.Fallback
        ref={ref}
        style={{
          ...styles.fallback,
          fontSize: sizeStyles.fontSize,
          ...style,
        }}
        {...props}
      />
    )
  }
)
Fallback.displayName = 'RvnAvatar.Fallback'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnAvatar = {
  Root,
  Image,
  Fallback,
}

export {
  Root as RvnAvatarRoot,
  Image as RvnAvatarImage,
  Fallback as RvnAvatarFallback,
}
