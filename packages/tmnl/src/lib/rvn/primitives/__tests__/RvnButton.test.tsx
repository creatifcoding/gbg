/**
 * RvnButton Tests
 *
 * Tests for the Base UI-wrapped brutalist button component.
 * Validates:
 * - Base UI Button is used as the underlying component
 * - RVN brutalist styling is preserved
 * - Compound component pattern works (Icon, Label)
 * - All variants render correctly
 * - Press/hover states work
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RvnButton } from '../RvnButton'

describe('RvnButton', () => {
  describe('rendering', () => {
    it('renders a button element', () => {
      render(<RvnButton>Click me</RvnButton>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('renders children content', () => {
      render(<RvnButton>Deploy Unit</RvnButton>)
      expect(screen.getByText('Deploy Unit')).toBeInTheDocument()
    })

    it('forwards ref to the button element', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>
      render(<RvnButton ref={ref}>Test</RvnButton>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('variants', () => {
    it('applies default variant styling', () => {
      render(<RvnButton variant="default">Default</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ background: 'transparent' })
    })

    it('applies primary variant styling', () => {
      render(<RvnButton variant="primary">Primary</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ background: '#000000' })
    })

    it('applies ghost variant styling', () => {
      render(<RvnButton variant="ghost">Ghost</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ border: 'none' })
    })
  })

  describe('sizes', () => {
    it('applies sm size padding', () => {
      render(<RvnButton size="sm">Small</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ padding: '8px 16px' })
    })

    it('applies md size padding', () => {
      render(<RvnButton size="md">Medium</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ padding: '12px 24px' })
    })

    it('applies lg size padding', () => {
      render(<RvnButton size="lg">Large</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ padding: '16px 32px' })
    })
  })

  describe('brutalist styling', () => {
    it('has 3px solid black border', () => {
      render(<RvnButton>Test</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ border: '3px solid #000000' })
    })

    it('has 4px 4px shadow', () => {
      render(<RvnButton>Test</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)' })
    })

    it('has uppercase text', () => {
      render(<RvnButton>Test</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ textTransform: 'uppercase' })
    })

    it('has zero border radius', () => {
      render(<RvnButton>Test</RvnButton>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ borderRadius: '0px' })
    })
  })

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn()
      render(<RvnButton onClick={onClick}>Click</RvnButton>)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn()
      render(
        <RvnButton onClick={onClick} disabled>
          Click
        </RvnButton>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('applies press state styles on mousedown', () => {
      render(<RvnButton>Press</RvnButton>)
      const button = screen.getByRole('button')
      fireEvent.mouseDown(button)
      expect(button).toHaveStyle({ boxShadow: 'none' })
      expect(button).toHaveStyle({ transform: 'translate(4px, 4px)' })
    })

    it('removes press state on mouseup', () => {
      render(<RvnButton>Press</RvnButton>)
      const button = screen.getByRole('button')
      fireEvent.mouseDown(button)
      fireEvent.mouseUp(button)
      expect(button).toHaveStyle({ boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)' })
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute', () => {
      render(<RvnButton disabled>Disabled</RvnButton>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('applies disabled opacity', () => {
      render(<RvnButton disabled>Disabled</RvnButton>)
      expect(screen.getByRole('button')).toHaveStyle({ opacity: '0.5' })
    })

    it('sets cursor to not-allowed', () => {
      render(<RvnButton disabled>Disabled</RvnButton>)
      expect(screen.getByRole('button')).toHaveStyle({ cursor: 'not-allowed' })
    })
  })

  describe('fullWidth', () => {
    it('sets width to 100% when fullWidth is true', () => {
      render(<RvnButton fullWidth>Full Width</RvnButton>)
      expect(screen.getByRole('button')).toHaveStyle({ width: '100%' })
    })
  })

  describe('compound components', () => {
    it('renders Icon slot', () => {
      render(
        <RvnButton>
          <RvnButton.Icon>
            <span data-testid="icon">+</span>
          </RvnButton.Icon>
          <RvnButton.Label>Add</RvnButton.Label>
        </RvnButton>
      )
      expect(screen.getByTestId('icon')).toBeInTheDocument()
    })

    it('renders Label slot', () => {
      render(
        <RvnButton>
          <RvnButton.Label>Deploy</RvnButton.Label>
        </RvnButton>
      )
      expect(screen.getByText('Deploy')).toBeInTheDocument()
    })
  })
})
