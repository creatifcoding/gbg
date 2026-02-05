/**
 * RvnModal Tests
 *
 * Tests for the Base UI Dialog-wrapped modal component.
 */

import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnModal } from '../RvnModal'

describe('RvnModal', () => {
  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <RvnModal.Root open={false} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Backdrop />
            <RvnModal.Content>
              <RvnModal.Title>Test Title</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render when open', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Backdrop />
            <RvnModal.Content>
              <RvnModal.Title>Test Title</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should render title', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Header>
                <RvnModal.Title>Mission Control</RvnModal.Title>
              </RvnModal.Header>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      expect(screen.getByText('Mission Control')).toBeInTheDocument()
    })

    it('should render body content', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Body>
                <p>Modal body content</p>
              </RvnModal.Body>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      expect(screen.getByText('Modal body content')).toBeInTheDocument()
    })

    it('should render footer with actions', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Footer>
                <button>Cancel</button>
                <button>Confirm</button>
              </RvnModal.Footer>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have role dialog', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      // Base UI Dialog uses role="dialog" - modal attribute is set via CSS
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should associate title with dialog via aria-labelledby', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Title>Accessible Title</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      const dialog = screen.getByRole('dialog')
      const title = screen.getByText('Accessible Title')
      expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    })
  })

  describe('Interactions', () => {
    it('should call onOpenChange when Escape is pressed', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnModal.Root open={true} onOpenChange={handleOpenChange}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      await user.keyboard('{Escape}')
      // Base UI passes (open, details) where details includes reason
      expect(handleOpenChange).toHaveBeenCalled()
      expect(handleOpenChange.mock.calls[0][0]).toBe(false)
    })

    it('should call onOpenChange when backdrop is clicked', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnModal.Root open={true} onOpenChange={handleOpenChange}>
          <RvnModal.Portal>
            <RvnModal.Backdrop data-testid="backdrop" />
            <RvnModal.Content>
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      const backdrop = screen.getByTestId('backdrop')
      await user.click(backdrop)
      expect(handleOpenChange).toHaveBeenCalled()
      expect(handleOpenChange.mock.calls[0][0]).toBe(false)
    })

    it('should work with Trigger component', async () => {
      const user = userEvent.setup()

      function TestComponent() {
        const [open, setOpen] = React.useState(false)
        return (
          <RvnModal.Root open={open} onOpenChange={setOpen}>
            <RvnModal.Trigger>
              {/* Trigger renders its own button, so we pass content directly */}
              Open Modal
            </RvnModal.Trigger>
            <RvnModal.Portal>
              <RvnModal.Content>
                <RvnModal.Title>Triggered Modal</RvnModal.Title>
              </RvnModal.Content>
            </RvnModal.Portal>
          </RvnModal.Root>
        )
      }

      render(<TestComponent />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByText('Open Modal'))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('should work with Close component', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnModal.Root open={true} onOpenChange={handleOpenChange}>
          <RvnModal.Portal>
            <RvnModal.Content>
              <RvnModal.Header>
                <RvnModal.Title>Test</RvnModal.Title>
                <RvnModal.Close>
                  {/* Close renders its own button element */}
                  X
                </RvnModal.Close>
              </RvnModal.Header>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      await user.click(screen.getByText('X'))
      expect(handleOpenChange).toHaveBeenCalled()
      expect(handleOpenChange.mock.calls[0][0]).toBe(false)
    })
  })

  describe('Styling', () => {
    it('should apply brutalist border to content', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content data-testid="content">
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ border: '3px solid #000000' })
    })

    it('should apply zero border-radius', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Content data-testid="content">
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ borderRadius: '0px' })
    })

    it('should apply dark backdrop', () => {
      render(
        <RvnModal.Root open={true} onOpenChange={() => {}}>
          <RvnModal.Portal>
            <RvnModal.Backdrop data-testid="backdrop" />
            <RvnModal.Content>
              <RvnModal.Title>Test</RvnModal.Title>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      )

      const backdrop = screen.getByTestId('backdrop')
      expect(backdrop).toHaveStyle({ background: 'rgba(0, 0, 0, 0.8)' })
    })
  })
})
