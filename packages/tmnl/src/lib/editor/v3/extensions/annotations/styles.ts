/**
 * Annotation Styles - CSS-in-JS Export
 *
 * Provides annotation styles as a template string for injection.
 * See styles.css for the source (kept for reference).
 *
 * @module editor/v3/extensions/annotations/styles
 */

export const annotationStyles = /* css */ `
/* =============================================================================
   Annotation Toolbar Animation
   ============================================================================= */

@keyframes annotationToolbarFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* =============================================================================
   Base Intent Mark Styles
   ============================================================================= */

.intent-mark {
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out,
    text-decoration-color 150ms ease-out,
    opacity 150ms ease-out;
  cursor: pointer;
}

.intent-mark[data-hidden="true"] {
  opacity: 0;
  pointer-events: none;
}

.intent-mark--filtered-hidden {
  opacity: 0.3;
  pointer-events: none;
  filter: grayscale(0.8);
  transition:
    opacity 200ms ease-out,
    filter 200ms ease-out;
}

.intent-mark[data-filtered="true"] {
  opacity: 0.3;
  filter: grayscale(0.8);
}

/* =============================================================================
   Visual Style Types
   ============================================================================= */

.intent-mark--highlight {
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
}

.intent-mark--highlight:hover {
  filter: brightness(1.1);
}

.intent-mark--pill {
  border-radius: 9999px;
  padding: 0 6px;
  margin: 0 2px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
  isolation: isolate;
}

.intent-mark--pill:hover {
  filter: brightness(1.15);
  transform: scale(1.02);
}

.intent-mark--pill.intent-mark--animated {
  background:
    linear-gradient(var(--tmnl-surface-1, #1a1a2e), var(--tmnl-surface-1, #1a1a2e)) padding-box,
    linear-gradient(90deg,
      var(--mark-color, var(--tmnl-accent-cyan, #00d4aa)),
      var(--tmnl-accent-purple, #a855f7),
      var(--tmnl-accent-cyan, #00d4aa)
    ) border-box;
  border: 1px solid transparent;
  animation: pill-gradient-rotate 3s linear infinite;
  background-size: 100% 100%, 200% 100%;
}

@keyframes pill-gradient-rotate {
  0% {
    background-position: 0 0, 0% 50%;
  }
  100% {
    background-position: 0 0, 200% 50%;
  }
}

.intent-mark--squiggle {
  text-decoration: wavy underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1.5px;
}

.intent-mark--squiggle:hover {
  text-decoration-thickness: 2px;
}

.intent-mark--underline {
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

.intent-mark--underline:hover {
  text-decoration-thickness: 2px;
}

.intent-mark--none {
  /* No visual styling */
}

/* =============================================================================
   Visual Effects
   ============================================================================= */

.intent-mark--effect-grain {
  position: relative;
}

.intent-mark--effect-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.08;
  pointer-events: none;
  mix-blend-mode: overlay;
  border-radius: inherit;
}

.intent-mark--effect-glow {
  box-shadow: 0 0 8px 2px currentColor;
}

/* =============================================================================
   Animated Effects - Squiggle Variants
   ============================================================================= */

.intent-mark--animated.intent-mark--squiggle,
.intent-mark--squiggle-crawl {
  animation: squiggle-crawl 2s ease-in-out infinite;
}

@keyframes squiggle-crawl {
  0%, 100% {
    text-underline-offset: 2px;
  }
  50% {
    text-underline-offset: 4px;
  }
}

.intent-mark--squiggle-pulse {
  animation: squiggle-pulse 1.5s ease-in-out infinite;
}

@keyframes squiggle-pulse {
  0%, 100% {
    text-decoration-color: var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  }
  50% {
    text-decoration-color: color-mix(in srgb, var(--mark-color, var(--tmnl-accent-cyan, #00d4aa)) 40%, transparent);
  }
}

.intent-mark--squiggle-wave {
  animation: squiggle-wave 2s ease-in-out infinite;
}

@keyframes squiggle-wave {
  0%, 100% {
    text-decoration-thickness: 1.5px;
  }
  25% {
    text-decoration-thickness: 2.5px;
  }
  50% {
    text-decoration-thickness: 1px;
  }
  75% {
    text-decoration-thickness: 2px;
  }
}

.intent-mark--squiggle-shimmer {
  animation: squiggle-shimmer 3s linear infinite;
}

@keyframes squiggle-shimmer {
  0% {
    text-decoration-color: var(--tmnl-accent-cyan, #00d4aa);
  }
  33% {
    text-decoration-color: var(--tmnl-accent-purple, #a855f7);
  }
  66% {
    text-decoration-color: var(--tmnl-accent-blue, #4da6ff);
  }
  100% {
    text-decoration-color: var(--tmnl-accent-cyan, #00d4aa);
  }
}

/* =============================================================================
   Animated Effects - Highlight Variants
   ============================================================================= */

.intent-mark--animated.intent-mark--highlight,
.intent-mark--highlight-pulse {
  animation: highlight-pulse 2s ease-in-out infinite;
}

@keyframes highlight-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.intent-mark--highlight-shimmer {
  position: relative;
  overflow: hidden;
}

.intent-mark--highlight-shimmer::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer-sweep 2.5s ease-in-out infinite;
}

@keyframes shimmer-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* =============================================================================
   TMNL Color Tokens
   ============================================================================= */

.intent-mark[style*="accent.cyan"] {
  --mark-color: var(--tmnl-accent-cyan, #00d4aa);
}

.intent-mark[style*="accent.yellow"] {
  --mark-color: var(--tmnl-accent-yellow, #ffd93d);
}

.intent-mark[style*="accent.blue"] {
  --mark-color: var(--tmnl-accent-blue, #4da6ff);
}

.intent-mark[style*="accent.purple"] {
  --mark-color: var(--tmnl-accent-purple, #a855f7);
}

.intent-mark[style*="accent.orange"] {
  --mark-color: var(--tmnl-accent-orange, #ff8c00);
}

.intent-mark[style*="accent.green"] {
  --mark-color: var(--tmnl-accent-green, #22c55e);
}

.intent-mark[style*="status.error"] {
  --mark-color: var(--tmnl-status-error, #ef4444);
}

.intent-mark[style*="status.warning"] {
  --mark-color: var(--tmnl-status-warning, #f59e0b);
}

.intent-mark[style*="status.success"] {
  --mark-color: var(--tmnl-status-success, #22c55e);
}

.intent-mark[style*="status.info"] {
  --mark-color: var(--tmnl-status-info, #3b82f6);
}

/* =============================================================================
   Hidden Annotation Nodes
   ============================================================================= */

.annotation-node {
  display: none !important;
  position: absolute;
  left: -9999px;
  visibility: hidden;
  pointer-events: none;
}

/* =============================================================================
   Selection and Focus States
   ============================================================================= */

.intent-mark[data-selected="true"] {
  outline: 2px solid var(--tmnl-accent-cyan, #00d4aa);
  outline-offset: 1px;
}

.intent-mark[data-hovered="true"] {
  filter: brightness(1.2);
}

/* =============================================================================
   Emanation Ring Effect (Active/Selected Marks)
   ============================================================================= */

.intent-mark--emanation,
.intent-mark[data-selected="true"].intent-mark--effect-emanation {
  position: relative;
}

.intent-mark--emanation::after,
.intent-mark[data-selected="true"].intent-mark--effect-emanation::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  opacity: 0;
  animation: emanation-ring 1.5s ease-out infinite;
  pointer-events: none;
}

.intent-mark--emanation::before,
.intent-mark[data-selected="true"].intent-mark--effect-emanation::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 1px solid var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  opacity: 0;
  animation: emanation-ring 1.5s ease-out infinite 0.3s;
  pointer-events: none;
}

@keyframes emanation-ring {
  0% {
    inset: -2px;
    opacity: 0.8;
  }
  100% {
    inset: -12px;
    opacity: 0;
  }
}

/* =============================================================================
   Attention Shimmer on Hover
   ============================================================================= */

.intent-mark--effect-attention:hover {
  position: relative;
}

.intent-mark--effect-attention:hover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    transparent 30%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 70%
  );
  background-size: 200% 100%;
  animation: attention-shimmer 0.6s ease-out forwards;
  pointer-events: none;
  border-radius: inherit;
}

@keyframes attention-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.intent-mark--effect-attention-pulse:hover {
  animation: attention-pulse 0.3s ease-out forwards;
}

@keyframes attention-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 8px 2px var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 4px 1px var(--mark-color, var(--tmnl-accent-cyan, #00d4aa));
  }
}

/* =============================================================================
   Intent-Specific Styles
   ============================================================================= */

.intent-mark[data-intent*="Hyperlink"] {
  color: var(--tmnl-accent-blue, #4da6ff);
}

.intent-mark[data-intent*="Hyperlink"]:hover {
  color: var(--tmnl-accent-cyan, #00d4aa);
}

.intent-mark[data-intent*="Citation"] {
  font-variant-numeric: tabular-nums;
}

.intent-mark[data-intent*="Citation"]::before {
  content: '[';
  opacity: 0.6;
}

.intent-mark[data-intent*="Citation"]::after {
  content: ']';
  opacity: 0.6;
}

.intent-mark[data-intent*="Note"] {
  background-image: linear-gradient(
    135deg,
    transparent 50%,
    currentColor 50%
  );
  background-size: 6px 6px;
  background-position: top right;
  background-repeat: no-repeat;
  padding-right: 8px;
}

.intent-mark[data-intent*="Action"] {
  font-weight: 500;
}

.intent-mark[data-intent*="Action"]:hover {
  cursor: pointer;
}

/* =============================================================================
   CreatedBy Indicators (subtle)
   ============================================================================= */

.intent-mark[data-created-by="agent"]::before {
  content: '✦';
  font-size: 0.7em;
  opacity: 0.5;
  margin-right: 2px;
  vertical-align: super;
}

.intent-mark[data-created-by="system"]::before {
  content: '⚙';
  font-size: 0.7em;
  opacity: 0.5;
  margin-right: 2px;
  vertical-align: super;
}

/* =============================================================================
   Dark Mode Adjustments
   ============================================================================= */

@media (prefers-color-scheme: dark) {
  .intent-mark--highlight {
    opacity: 0.9;
  }

  .intent-mark--effect-grain::after {
    opacity: 0.12;
    mix-blend-mode: soft-light;
  }
}

/* =============================================================================
   Print Styles
   ============================================================================= */

@media print {
  .intent-mark--animated {
    animation: none !important;
  }

  .intent-mark--effect-grain::after {
    display: none;
  }

  .intent-mark--effect-glow {
    box-shadow: none;
  }

  .annotation-node {
    display: none !important;
  }
}
`;

export default annotationStyles;
