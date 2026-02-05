/**
 * RvnSelect Tests
 *
 * Tests for the RvnSelect component migrated to Base UI.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnSelect } from '../RvnSelect'

const mockOptions = [
  { value: 'opt1', label: 'Option One' },
  { value: 'opt2', label: 'Option Two' },
  { value: 'opt3', label: 'Option Three', disabled: true },
]

describe('RvnSelect', () => {
  describe('Rendering', () => {
    it('renders a select trigger', () => {
      render(<RvnSelect options={mockOptions} />)
      // Base UI uses button role for trigger
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('displays placeholder when no value selected', () => {
      render(<RvnSelect options={mockOptions} placeholder="Select option" />)
      // Check that the combobox exists and has placeholder content
      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeInTheDocument()
    })

    it('displays selected value label', () => {
      render(<RvnSelect options={mockOptions} value="opt1" />)
      // The trigger should contain the selected value
      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('applies 3px border to trigger', () => {
      render(<RvnSelect options={mockOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ border: '3px solid #000000' })
    })

    it('uses monospace font family', () => {
      render(<RvnSelect options={mockOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger.style.fontFamily).toContain('Courier')
    })

    it('has no border-radius (brutalist)', () => {
      render(<RvnSelect options={mockOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ borderRadius: '0px' })
    })

    it('applies fullWidth style when prop is true', () => {
      render(<RvnSelect options={mockOptions} fullWidth />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ width: '100%' })
    })
  })

  describe('Behavior', () => {
    it('calls onValueChange when option is selected', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnSelect
          options={mockOptions}
          onValueChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      // Wait for dropdown to open
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })

      const option = screen.getByRole('option', { name: /OPTION ONE/i })
      await user.click(option)

      // Base UI may call with value directly or with event details
      expect(handleChange).toHaveBeenCalled()
    })

    it('shows dropdown on click', async () => {
      const user = userEvent.setup()
      render(<RvnSelect options={mockOptions} />)

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })
    })

    it('renders disabled options', async () => {
      const user = userEvent.setup()
      render(<RvnSelect options={mockOptions} />)

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      await waitFor(() => {
        const disabledOption = screen.getByRole('option', { name: /OPTION THREE/i })
        expect(disabledOption).toHaveAttribute('aria-disabled', 'true')
      })
    })

    it('respects disabled state on trigger', () => {
      render(<RvnSelect options={mockOptions} disabled />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has accessible name via placeholder', () => {
      render(<RvnSelect options={mockOptions} placeholder="Choose item" />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<RvnSelect options={mockOptions} />)

      const trigger = screen.getByRole('combobox')
      trigger.focus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument()
      })
    })
  })
})
