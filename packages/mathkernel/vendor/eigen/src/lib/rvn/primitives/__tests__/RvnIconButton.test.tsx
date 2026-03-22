/**
 * RvnIconButton Tests
 *
 * Tests for the Base UI-wrapped icon button component.
 * Validates:
 * - Base UI Button is used
 * - Square dimensions (44px default)
 * - Touch-friendly tap target
 * - Icon rendering
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RvnIconButton } from '../RvnIconButton'

describe('RvnIconButton', () => {
  describe('rendering', () => {
    it('renders a button element', () => {
      render(<RvnIconButton title="Close">X</RvnIconButton>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders children as icon', () => {
      render(
        <RvnIconButton title="Add">
          <span data-testid="plus-icon">+</span>
        </RvnIconButton>
      )
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
    })

    it('forwards ref to button element', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>
      render(
        <RvnIconButton ref={ref} title="Test">
          X
        </RvnIconButton>
      )
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('accessibility', () => {
    it('sets aria-label from title prop', () => {
      render(<RvnIconButton title="Close panel">X</RvnIconButton>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close panel')
    })

    it('sets title attribute', () => {
      render(<RvnIconButton title="Close panel">X</RvnIconButton>)
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Close panel')
    })
  })

  describe('sizes', () => {
    it('applies sm size (32px)', () => {
      render(
        <RvnIconButton title="Small" size="sm">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: '32px', height: '32px' })
    })

    it('applies md size (44px) - touch friendly default', () => {
      render(
        <RvnIconButton title="Medium" size="md">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: '44px', height: '44px' })
    })

    it('applies lg size (56px)', () => {
      render(
        <RvnIconButton title="Large" size="lg">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: '56px', height: '56px' })
    })

    it('defaults to md size', () => {
      render(<RvnIconButton title="Default">X</RvnIconButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: '44px', height: '44px' })
    })
  })

  describe('variants', () => {
    it('applies default variant styling', () => {
      render(
        <RvnIconButton title="Default" variant="default">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ background: 'transparent' })
    })

    it('applies primary variant styling', () => {
      render(
        <RvnIconButton title="Primary" variant="primary">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ background: '#000000' })
    })

    it('applies ghost variant styling', () => {
      render(
        <RvnIconButton title="Ghost" variant="ghost">
          X
        </RvnIconButton>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ border: 'none' })
    })
  })

  describe('brutalist styling', () => {
    it('has 3px solid black border', () => {
      render(<RvnIconButton title="Test">X</RvnIconButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ border: '3px solid #000000' })
    })

    it('has 4px 4px shadow', () => {
      render(<RvnIconButton title="Test">X</RvnIconButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)' })
    })

    it('is square (no padding distortion)', () => {
      render(<RvnIconButton title="Test">X</RvnIconButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ padding: '0' })
    })
  })

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn()
      render(
        <RvnIconButton title="Click" onClick={onClick}>
          X
        </RvnIconButton>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn()
      render(
        <RvnIconButton title="Disabled" onClick={onClick} disabled>
          X
        </RvnIconButton>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('applies press state on mousedown', () => {
      render(<RvnIconButton title="Press">X</RvnIconButton>)
      const button = screen.getByRole('button')
      fireEvent.mouseDown(button)
      expect(button).toHaveStyle({ boxShadow: 'none' })
      expect(button).toHaveStyle({ transform: 'translate(4px, 4px)' })
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute', () => {
      render(
        <RvnIconButton title="Disabled" disabled>
          X
        </RvnIconButton>
      )
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('applies disabled opacity', () => {
      render(
        <RvnIconButton title="Disabled" disabled>
          X
        </RvnIconButton>
      )
      expect(screen.getByRole('button')).toHaveStyle({ opacity: '0.5' })
    })
  })
})
