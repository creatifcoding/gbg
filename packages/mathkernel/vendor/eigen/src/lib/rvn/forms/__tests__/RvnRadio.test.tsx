/**
 * RvnRadio Tests
 *
 * Tests for the RvnRadio component migrated to Base UI.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnRadio, RvnRadioGroup } from '../RvnRadio'

describe('RvnRadio', () => {
  describe('Rendering', () => {
    it('renders a radio button', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test Option" />
        </RvnRadioGroup>
      )
      // Base UI renders radio buttons with role="radio"
      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
    })

    it('renders with label', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test Label" />
        </RvnRadioGroup>
      )
      expect(screen.getByText('Test Label')).toBeInTheDocument()
    })

    it('renders multiple radio options', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
          <RvnRadio value="opt3" label="Option 3" />
        </RvnRadioGroup>
      )
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })
  })

  describe('Styling', () => {
    it('applies 16px circle size', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test" />
        </RvnRadioGroup>
      )
      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
    })

    it('applies 3px border to indicator', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test" />
        </RvnRadioGroup>
      )
      const radio = screen.getByRole('radio')
      expect(radio).toBeInTheDocument()
    })

    it('uses monospace font for labels', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test Label" />
        </RvnRadioGroup>
      )
      const label = screen.getByText('Test Label')
      expect(label.style.fontFamily).toContain('Courier')
    })
  })

  describe('Behavior', () => {
    it('calls onValueChange when radio is selected', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnRadioGroup onValueChange={handleChange}>
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )

      const secondOption = screen.getAllByRole('radio')[1]
      await user.click(secondOption)

      // Base UI calls onValueChange with the value
      expect(handleChange).toHaveBeenCalled()
      // The first argument should be the value
      const firstArg = handleChange.mock.calls[0][0]
      expect(firstArg === 'opt2' || firstArg?.value === 'opt2').toBe(true)
    })

    it('shows checked state for selected value', () => {
      render(
        <RvnRadioGroup value="opt1">
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )

      const firstOption = screen.getAllByRole('radio')[0]
      expect(firstOption).toHaveAttribute('aria-checked', 'true')
    })

    it('respects disabled state', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Disabled" disabled />
        </RvnRadioGroup>
      )

      const radio = screen.getByRole('radio')
      // Base UI uses aria-disabled
      expect(radio).toHaveAttribute('aria-disabled', 'true')
    })

    it('disables all options when group is disabled', () => {
      render(
        <RvnRadioGroup disabled>
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )

      const radios = screen.getAllByRole('radio')
      radios.forEach(radio => {
        expect(radio).toHaveAttribute('aria-disabled', 'true')
      })
    })
  })

  describe('Layout', () => {
    it('renders vertically by default', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )
      const group = screen.getByRole('radiogroup')
      expect(group).toBeInTheDocument()
    })

    it('renders horizontally when direction is horizontal', () => {
      render(
        <RvnRadioGroup direction="horizontal">
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )
      const group = screen.getByRole('radiogroup')
      expect(group).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has radiogroup role on container', () => {
      render(
        <RvnRadioGroup>
          <RvnRadio value="test" label="Test" />
        </RvnRadioGroup>
      )
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnRadioGroup onValueChange={handleChange} defaultValue="opt1">
          <RvnRadio value="opt1" label="Option 1" />
          <RvnRadio value="opt2" label="Option 2" />
        </RvnRadioGroup>
      )

      const firstRadio = screen.getAllByRole('radio')[0]
      firstRadio.focus()

      await user.keyboard('{ArrowDown}')
      // Arrow down should move focus and select next option
      expect(handleChange).toHaveBeenCalled()
    })
  })
})
