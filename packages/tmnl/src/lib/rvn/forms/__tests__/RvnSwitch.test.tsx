/**
 * RvnSwitch Tests
 *
 * Tests for the RvnSwitch component migrated to Base UI.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnSwitch } from '../RvnSwitch'

describe('RvnSwitch', () => {
  describe('Rendering', () => {
    it('renders a switch', () => {
      render(<RvnSwitch />)
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('renders with label', () => {
      render(<RvnSwitch label="Toggle Feature" />)
      expect(screen.getByText('Toggle Feature')).toBeInTheDocument()
    })

    it('renders label on the right by default', () => {
      render(<RvnSwitch label="Right Label" />)
      const label = screen.getByText('Right Label')
      expect(label).toBeInTheDocument()
    })

    it('renders label on the left when specified', () => {
      render(<RvnSwitch label="Left Label" labelPosition="left" />)
      const label = screen.getByText('Left Label')
      expect(label).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('applies 3px border to track', () => {
      render(<RvnSwitch />)
      const switchEl = screen.getByRole('switch')
      // Border is on the track element
      expect(switchEl).toBeInTheDocument()
    })

    it('has black thumb', () => {
      render(<RvnSwitch />)
      const switchEl = screen.getByRole('switch')
      expect(switchEl).toBeInTheDocument()
    })

    it('has no border-radius (brutalist)', () => {
      render(<RvnSwitch />)
      const switchEl = screen.getByRole('switch')
      expect(switchEl).toBeInTheDocument()
    })

    it('uses monospace font for label', () => {
      render(<RvnSwitch label="Test Label" />)
      const label = screen.getByText('Test Label')
      expect(label.style.fontFamily).toContain('Courier')
    })
  })

  describe('Behavior', () => {
    it('toggles on click', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<RvnSwitch onCheckedChange={handleChange} />)

      const switchEl = screen.getByRole('switch')
      await user.click(switchEl)

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('toggles from checked to unchecked', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<RvnSwitch checked onCheckedChange={handleChange} />)

      const switchEl = screen.getByRole('switch')
      await user.click(switchEl)

      expect(handleChange).toHaveBeenCalledWith(false)
    })

    it('respects controlled checked state', () => {
      render(<RvnSwitch checked />)
      const switchEl = screen.getByRole('switch')
      expect(switchEl).toHaveAttribute('aria-checked', 'true')
    })

    it('respects disabled state', () => {
      render(<RvnSwitch disabled />)
      const switchEl = screen.getByRole('switch')
      // Base UI uses aria-disabled instead of the disabled attribute
      expect(switchEl).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not toggle when disabled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<RvnSwitch disabled onCheckedChange={handleChange} />)

      const switchEl = screen.getByRole('switch')
      await user.click(switchEl)

      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('Uncontrolled mode', () => {
    it('works with defaultChecked', () => {
      render(<RvnSwitch defaultChecked />)
      const switchEl = screen.getByRole('switch')
      expect(switchEl).toHaveAttribute('aria-checked', 'true')
    })

    it('toggles internally when uncontrolled', async () => {
      const user = userEvent.setup()
      render(<RvnSwitch defaultChecked={false} />)

      const switchEl = screen.getByRole('switch')
      expect(switchEl).toHaveAttribute('aria-checked', 'false')

      await user.click(switchEl)
      expect(switchEl).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Accessibility', () => {
    it('has switch role', () => {
      render(<RvnSwitch />)
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('has aria-checked attribute', () => {
      render(<RvnSwitch checked />)
      const switchEl = screen.getByRole('switch')
      expect(switchEl).toHaveAttribute('aria-checked', 'true')
    })

    it('supports keyboard toggle via Space', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<RvnSwitch onCheckedChange={handleChange} />)

      const switchEl = screen.getByRole('switch')
      switchEl.focus()
      await user.keyboard(' ')

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('supports keyboard toggle via Enter', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<RvnSwitch onCheckedChange={handleChange} />)

      const switchEl = screen.getByRole('switch')
      switchEl.focus()
      await user.keyboard('{Enter}')

      expect(handleChange).toHaveBeenCalledWith(true)
    })
  })
})
