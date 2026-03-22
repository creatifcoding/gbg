/**
 * Brand Components
 *
 * Logos, marks, and branded visual elements.
 *
 * @module components/brand
 */

// Main component (compound)
export {
  SelfchartersLogo,
  useSelfchartersLogo,
  SelfchartersLogoStatic,
  SelfchartersLogoAnimated,
} from './SelfchartersLogo'

export type {
  SelfchartersLogoProps,
  SelfchartersLogoRef,
  StaticProps as SelfchartersLogoStaticProps,
  AnimatedProps as SelfchartersLogoAnimatedProps,
} from './SelfchartersLogo'

// Types
export type {
  LogoVariant,
  AnimationType,
  AnimationConfig,
  LogoPathData,
  LogoRefs,
  AnimationControls,
  SelfchartersLogoBaseProps,
} from './types'

// Path data (for advanced usage)
export { LOGO_PATHS, getLogoPaths } from './paths'

// Services (for DI)
export {
  LogoAnimation,
  type LogoAnimationShape,
  getAnimationImpl,
  StrokeDrawLayer,
  FadeInLayer,
  ScaleRevealLayer,
  PulseLayer,
  NoneLayer,
  DynamicLayer,
} from './services'
