/**
 * RvnDropdown Tests
 *
 * Tests for the Base UI-wrapped brutalist dropdown component.
 * Validates:
 * - Base UI Select is used
 * - Brutalist styling (3px border, black dropdown)
 * - Options rendering
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnDropdown } from '../RvnDropdown'

const testOptions = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' },
]

describe('RvnDropdown', () => {
  describe('rendering', () => {
    it('renders a select trigger', () => {
      render(<RvnDropdown options={testOptions} />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders placeholder text', () => {
      render(<RvnDropdown options={testOptions} placeholder="Select option" />)
      expect(screen.getByText('SELECT OPTION')).toBeInTheDocument()
    })

    it('renders selected value', () => {
      render(<RvnDropdown options={testOptions} value="opt1" onChange={() => {}} />)
      expect(screen.getByText('OPTION 1')).toBeInTheDocument()
    })
  })

  describe('brutalist styling', () => {
    it('has 3px solid black border on trigger', () => {
      render(<RvnDropdown options={testOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ border: '3px solid #000000' })
    })

    it('has zero border radius', () => {
      render(<RvnDropdown options={testOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ borderRadius: '0px' })
    })

    it('has monospace font', () => {
      render(<RvnDropdown options={testOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({
        fontFamily: "'Courier New', Courier, monospace",
      })
    })

    it('has uppercase text', () => {
      render(<RvnDropdown options={testOptions} />)
      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveStyle({ textTransform: 'uppercase' })
    })
  })

  describe('dropdown behavior', () => {
    it('opens dropdown on click', async () => {
      const user = userEvent.setup()
      render(<RvnDropdown options={testOptions} />)
      await user.click(screen.getByRole('combobox'))
      // The dropdown should render options - use findByRole for async
      const listbox = await screen.findByRole('listbox', {}, { timeout: 2000 })
      expect(listbox).toBeInTheDocument()
    })

    it('shows all options when opened', async () => {
      const user = userEvent.setup()
      render(<RvnDropdown options={testOptions} />)
      await user.click(screen.getByRole('combobox'))
      await waitFor(() => {
        expect(screen.getByText('OPTION 1')).toBeInTheDocument()
        expect(screen.getByText('OPTION 2')).toBeInTheDocument()
        expect(screen.getByText('OPTION 3')).toBeInTheDocument()
      })
    })

    it('calls onValueChange when option selected', async () => {
      const user = userEvent.setup()
      const onValueChange = vi.fn()
      render(<RvnDropdown options={testOptions} onValueChange={onValueChange} />)
      await user.click(screen.getByRole('combobox'))
      await waitFor(async () => {
        const option = screen.getByRole('option', { name: /option 2/i })
        await user.click(option)
      })
      expect(onValueChange).toHaveBeenCalledWith('opt2')
    })
  })

  describe('controlled mode', () => {
    it('displays controlled value', () => {
      render(<RvnDropdown options={testOptions} value="opt2" onChange={() => {}} />)
      expect(screen.getByText('OPTION 2')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute on trigger', () => {
      render(<RvnDropdown options={testOptions} disabled />)
      expect(screen.getByRole('combobox')).toBeDisabled()
    })

    it('applies disabled opacity', () => {
      render(<RvnDropdown options={testOptions} disabled />)
      expect(screen.getByRole('combobox')).toHaveStyle({ opacity: '0.5' })
    })

    it('does not open when disabled', async () => {
      const user = userEvent.setup()
      render(<RvnDropdown options={testOptions} disabled />)
      await user.click(screen.getByRole('combobox'))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('fullWidth', () => {
    it('sets width to 100% when fullWidth is true', () => {
      render(<RvnDropdown options={testOptions} fullWidth />)
      expect(screen.getByRole('combobox')).toHaveStyle({ width: '100%' })
    })
  })
})
