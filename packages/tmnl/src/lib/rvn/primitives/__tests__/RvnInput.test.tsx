/**
 * RvnInput Tests
 *
 * Tests for the Base UI-wrapped brutalist input component.
 * Validates:
 * - Base UI Input is used
 * - Brutalist styling (3px border, focus inversion)
 * - Monospace font
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnInput } from '../RvnInput'

describe('RvnInput', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<RvnInput />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('forwards ref to input element', () => {
      const ref = { current: null } as React.RefObject<HTMLInputElement>
      render(<RvnInput ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('renders with placeholder', () => {
      render(<RvnInput placeholder="Enter value" />)
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('applies default variant styling with shadow', () => {
      render(<RvnInput variant="default" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)' })
    })

    it('applies inline variant styling without shadow', () => {
      render(<RvnInput variant="inline" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ boxShadow: 'none' })
    })
  })

  describe('brutalist styling', () => {
    it('has 3px solid black border', () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ border: '3px solid #000000' })
    })

    it('has monospace font', () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({
        fontFamily: "'Courier New', Courier, monospace",
      })
    })

    it('has zero border radius', () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ borderRadius: '0px' })
    })

    it('has white background', () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ background: '#ffffff' })
    })
  })

  describe('focus state', () => {
    it('inverts colors on focus (black bg, white text)', async () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      expect(input).toHaveStyle({ background: '#000000' })
      expect(input).toHaveStyle({ color: '#ffffff' })
    })

    it('restores default colors on blur', () => {
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(input).toHaveStyle({ background: '#ffffff' })
      expect(input).toHaveStyle({ color: '#000000' })
    })

    it('does not invert colors for inline variant on focus', () => {
      render(<RvnInput variant="inline" />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      expect(input).not.toHaveStyle({ background: '#000000' })
    })
  })

  describe('interactions', () => {
    it('accepts text input', async () => {
      const user = userEvent.setup()
      render(<RvnInput />)
      const input = screen.getByRole('textbox')
      await user.type(input, 'test value')
      expect(input).toHaveValue('test value')
    })

    it('calls onChange when value changes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<RvnInput onChange={onChange} />)
      await user.type(screen.getByRole('textbox'), 'a')
      expect(onChange).toHaveBeenCalled()
    })

    it('calls onFocus when focused', () => {
      const onFocus = vi.fn()
      render(<RvnInput onFocus={onFocus} />)
      fireEvent.focus(screen.getByRole('textbox'))
      expect(onFocus).toHaveBeenCalledTimes(1)
    })

    it('calls onBlur when blurred', () => {
      const onBlur = vi.fn()
      render(<RvnInput onBlur={onBlur} />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(onBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute', () => {
      render(<RvnInput disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('applies disabled opacity', () => {
      render(<RvnInput disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ opacity: '0.5' })
    })

    it('sets cursor to not-allowed', () => {
      render(<RvnInput disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ cursor: 'not-allowed' })
    })

    it('applies muted background', () => {
      render(<RvnInput disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ background: '#f4f4f4' })
    })
  })

  describe('fullWidth', () => {
    it('sets width to 100% when fullWidth is true', () => {
      render(<RvnInput fullWidth />)
      expect(screen.getByRole('textbox')).toHaveStyle({ width: '100%' })
    })

    it('has auto width by default', () => {
      render(<RvnInput />)
      expect(screen.getByRole('textbox')).toHaveStyle({ width: 'auto' })
    })
  })
})
