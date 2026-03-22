/**
 * RvnForm - Brutalist Form (Base UI)
 *
 * Wraps Base UI Form with RVN styling.
 *
 * Features:
 * - Form submission handling
 * - Validation state management
 * - Consistent spacing
 */

import * as React from 'react'
import { Form as BaseForm } from '@base-ui-components/react/form'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode, FormEvent } from 'react'
import { RVN_SPACING } from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnFormProps {
  /** Form submission handler */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  /** Clear errors handler */
  onClearErrors?: () => void
  /** Form errors object */
  errors?: Record<string, string>
  /** Form content */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const formStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.m,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnForm({
  onSubmit,
  onClearErrors,
  errors,
  children,
  className,
  style,
}: RvnFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <BaseForm
      className={clsx('rvn-form', className)}
      onSubmit={handleSubmit}
      onClearErrors={onClearErrors}
      errors={errors}
      style={{ ...formStyles, ...style }}
    >
      {children}
    </BaseForm>
  )
}
