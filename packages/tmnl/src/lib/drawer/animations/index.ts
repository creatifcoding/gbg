/**
 * Drawer Animations
 *
 * @module
 */

// Card Stack (default - clean slide + scale)
export {
  cardStackIn,
  cardStackOut,
  resetCardStackStyles,
  DEFAULT_CARD_STACK_CONFIG,
  type CardStackConfig,
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
