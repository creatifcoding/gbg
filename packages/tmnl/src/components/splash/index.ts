/**
 * Splash Screen Module
 *
 * Q-Branch Brutalist boot sequence:
 * - CRT effects (static, scanlines, moiré, flicker)
 * - Terminal init log (staccato rhythm)
 * - TMNL logo reveal (letter→word expansion)
 * - Morph/dissolve transition
 */

export { Splash, default } from './Splash'
export { CRTEffect } from './CRTEffect'
export { TerminalInit } from './TerminalInit'
export { LogoReveal } from './LogoReveal'

// Tokens for customization
export * from './tokens'
