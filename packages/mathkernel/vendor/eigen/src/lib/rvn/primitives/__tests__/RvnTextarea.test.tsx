/**
 * RvnTextarea Tests
 *
 * Tests for the brutalist textarea component.
 * Note: Base UI does not have a textarea component, so this remains
 * a native implementation but follows Base UI patterns.
 *
 * Validates:
 * - Brutalist styling (3px border, monospace font)
 * - Focus state
 * - Resize behavior
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnTextarea } from '../RvnTextarea'

describe('RvnTextarea', () => {
  describe('rendering', () => {
    it('renders a textarea element', () => {
      render(<RvnTextarea />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with placeholder', () => {
      render(<RvnTextarea placeholder="Enter notes" />)
      expect(screen.getByPlaceholderText('Enter notes')).toBeInTheDocument()
    })

    it('forwards ref to textarea element', () => {
      const ref = { current: null } as React.RefObject<HTMLTextAreaElement>
      render(<RvnTextarea ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })

    it('sets default rows to 4', () => {
      render(<RvnTextarea />)
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4')
    })

    it('respects custom rows prop', () => {
      render(<RvnTextarea rows={10} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10')
    })
  })

  describe('brutalist styling', () => {
    it('has 3px solid black border', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveStyle({ border: '3px solid #000000' })
    })

    it('has monospace font', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveStyle({
        fontFamily: "'Courier New', Courier, monospace",
      })
    })

    it('has zero border radius', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveStyle({ borderRadius: '0px' })
    })

    it('has white background', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveStyle({ background: '#ffffff' })
    })
  })

  describe('focus state', () => {
    it('applies inset shadow on focus', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      expect(textarea).toHaveStyle({ boxShadow: 'inset 0 0 0 2px #000000' })
    })

    it('removes inset shadow on blur', () => {
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      fireEvent.blur(textarea)
      expect(textarea).toHaveStyle({ boxShadow: 'none' })
    })
  })

  describe('resize behavior', () => {
    it('defaults to vertical resize', () => {
      render(<RvnTextarea />)
      expect(screen.getByRole('textbox')).toHaveStyle({ resize: 'vertical' })
    })

    it('supports none resize', () => {
      render(<RvnTextarea resize="none" />)
      expect(screen.getByRole('textbox')).toHaveStyle({ resize: 'none' })
    })

    it('supports horizontal resize', () => {
      render(<RvnTextarea resize="horizontal" />)
      expect(screen.getByRole('textbox')).toHaveStyle({ resize: 'horizontal' })
    })

    it('supports both resize', () => {
      render(<RvnTextarea resize="both" />)
      expect(screen.getByRole('textbox')).toHaveStyle({ resize: 'both' })
    })
  })

  describe('interactions', () => {
    it('accepts text input', async () => {
      const user = userEvent.setup()
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test value')
      expect(textarea).toHaveValue('test value')
    })

    it('accepts multiline input', async () => {
      const user = userEvent.setup()
      render(<RvnTextarea />)
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'line1{enter}line2')
      expect(textarea).toHaveValue('line1\nline2')
    })

    it('calls onChange when value changes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<RvnTextarea onChange={onChange} />)
      await user.type(screen.getByRole('textbox'), 'a')
      expect(onChange).toHaveBeenCalled()
    })

    it('calls onFocus when focused', () => {
      const onFocus = vi.fn()
      render(<RvnTextarea onFocus={onFocus} />)
      fireEvent.focus(screen.getByRole('textbox'))
      expect(onFocus).toHaveBeenCalledTimes(1)
    })

    it('calls onBlur when blurred', () => {
      const onBlur = vi.fn()
      render(<RvnTextarea onBlur={onBlur} />)
      const textarea = screen.getByRole('textbox')
      fireEvent.focus(textarea)
      fireEvent.blur(textarea)
      expect(onBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute', () => {
      render(<RvnTextarea disabled />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('applies disabled opacity', () => {
      render(<RvnTextarea disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ opacity: '0.5' })
    })

    it('sets cursor to not-allowed', () => {
      render(<RvnTextarea disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ cursor: 'not-allowed' })
    })

    it('applies muted background', () => {
      render(<RvnTextarea disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ background: '#f4f4f4' })
    })

    it('disables resize when disabled', () => {
      render(<RvnTextarea disabled />)
      expect(screen.getByRole('textbox')).toHaveStyle({ resize: 'none' })
    })
  })

  describe('fullWidth', () => {
    it('sets width to 100% when fullWidth is true', () => {
      render(<RvnTextarea fullWidth />)
      expect(screen.getByRole('textbox')).toHaveStyle({ width: '100%' })
    })

    it('has auto width by default', () => {
      render(<RvnTextarea />)
      expect(screen.getByRole('textbox')).toHaveStyle({ width: 'auto' })
    })
  })
})
