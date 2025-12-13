/**
 * Drawer Animations
 *
 * @module
 */

// Card Stack (default - clean slide + scale + stack depth)
export {
  cardStackIn,
  cardStackOut,
  animateStackDepth,
  applyStackDepth,
  resetCardStackStyles,
  DEFAULT_CARD_STACK_CONFIG,
  DEFAULT_STACK_DEPTH_CONFIG,
  type CardStackConfig,
  type StackDepthConfig,
} from './card-stack'

// Legacy: Rolodex (3D rotation + blur + strobe)
export {
  rolodexIn,
  rolodexOut,
  rolodexSwitch,
  resetRolodexStyles,
} from './rolodex'

// Legacy: Parallax Lift (multi-drawer stack effects)
export {
  parallaxLiftStack,
  parallaxCollapse,
  parallaxReorder,
  applyParallaxStyles,
  resetParallaxStyles,
} from './parallax-lift'
