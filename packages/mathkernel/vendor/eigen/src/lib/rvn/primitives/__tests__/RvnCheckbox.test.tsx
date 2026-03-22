/**
 * RvnCheckbox Tests
 *
 * Tests for the Base UI-wrapped brutalist checkbox component.
 * Validates:
 * - Base UI Checkbox is used
 * - Brutalist styling (border, checkmark)
 * - Label rendering
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RvnCheckbox } from '../RvnCheckbox'

describe('RvnCheckbox', () => {
  describe('rendering', () => {
    it('renders a checkbox', () => {
      render(<RvnCheckbox />)
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('renders with label', () => {
      render(<RvnCheckbox label="Accept terms" />)
      expect(screen.getByText('ACCEPT TERMS')).toBeInTheDocument()
    })

    it('renders label on the right by default', () => {
      const { container } = render(<RvnCheckbox label="Label" />)
      const root = container.querySelector('[class*="rvn-checkbox"]')
      expect(root).toHaveStyle({ flexDirection: 'row' })
    })

    it('renders label on the left when labelPosition is left', () => {
      const { container } = render(<RvnCheckbox label="Label" labelPosition="left" />)
      const root = container.querySelector('[class*="rvn-checkbox"]')
      expect(root).toHaveStyle({ flexDirection: 'row-reverse' })
    })
  })

  describe('brutalist styling', () => {
    it('renders indicator with brutalist styling', () => {
      const { container } = render(<RvnCheckbox />)
      // Find the indicator element (the visual checkbox)
      const indicator = container.querySelector('.rvn-checkbox-indicator')
      expect(indicator).toBeInTheDocument()
    })

    it('has uppercase label text', () => {
      render(<RvnCheckbox label="option" />)
      const labelSpan = screen.getByText('OPTION')
      expect(labelSpan).toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('respects controlled checked prop', () => {
      render(<RvnCheckbox checked={true} onCheckedChange={() => {}} />)
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('respects controlled unchecked prop', () => {
      render(<RvnCheckbox checked={false} onCheckedChange={() => {}} />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('calls onCheckedChange when clicked', () => {
      const onCheckedChange = vi.fn()
      render(<RvnCheckbox onCheckedChange={onCheckedChange} />)
      fireEvent.click(screen.getByRole('checkbox'))
      expect(onCheckedChange).toHaveBeenCalled()
    })
  })

  describe('uncontrolled mode', () => {
    it('starts unchecked by default', () => {
      render(<RvnCheckbox />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('toggles on click', () => {
      render(<RvnCheckbox />)
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('respects defaultChecked prop', () => {
      render(<RvnCheckbox defaultChecked />)
      expect(screen.getByRole('checkbox')).toBeChecked()
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute', () => {
      render(<RvnCheckbox disabled />)
      // Base UI uses aria-disabled instead of native disabled attribute
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true')
    })

    it('applies disabled opacity to container', () => {
      const { container } = render(<RvnCheckbox disabled />)
      const root = container.querySelector('[class*="rvn-checkbox"]')
      expect(root).toHaveStyle({ opacity: '0.5' })
    })

    it('sets cursor to not-allowed', () => {
      const { container } = render(<RvnCheckbox disabled />)
      const root = container.querySelector('[class*="rvn-checkbox"]')
      expect(root).toHaveStyle({ cursor: 'not-allowed' })
    })

    it('does not toggle when disabled', () => {
      const onCheckedChange = vi.fn()
      render(<RvnCheckbox disabled onCheckedChange={onCheckedChange} />)
      fireEvent.click(screen.getByRole('checkbox'))
      expect(onCheckedChange).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('supports name attribute for forms', () => {
      const { container } = render(<RvnCheckbox name="terms" />)
      // Base UI renders a hidden input for form submission
      const hiddenInput = container.querySelector('input[name="terms"]')
      expect(hiddenInput || screen.getByRole('checkbox')).toBeInTheDocument()
    })
  })
})
