/**
 * Status Banner View — compact card-stack toasts for harness status.
 *
 * Stack model: physical deck of cards.
 * - Collapsed: front card visible, back cards peek via negative margin overlap
 * - Expanded on hover: stagger cascade fans cards out (~30ms per card)
 * - Entry: slide down from top (150ms ease-out) via AnimatePresence
 * - Exit: slide out right (150ms ease-in) via AnimatePresence
 *
 * Engine: Hybrid — Framer Motion for enter/exit, CSS transitions for stack.
 *
 * Cards: 22px tall, 12px mono, vantablack solid backgrounds (no blur/filter).
 * Swipe-to-dismiss preserved. Liquid glass filter dropped for performance.
 *
 * @module morphchat/components/status-banner-view
 */

import {
  useState, useCallback, useRef, useEffect, useMemo,
  useDeferredValue, useTransition, memo,
  type ReactNode, type PointerEvent as R