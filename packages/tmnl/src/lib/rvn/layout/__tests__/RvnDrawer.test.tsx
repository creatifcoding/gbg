/**
 * RvnDrawer Tests
 *
 * Tests for the Base UI Dialog-wrapped drawer component.
 */

import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RvnDrawer } from '../RvnDrawer'

describe('RvnDrawer', () => {
  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <RvnDrawer.Root open={false} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Backdrop />
            <RvnDrawer.Content>
              <RvnDrawer.Title>Test Title</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render when open', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Backdrop />
            <RvnDrawer.Content>
              <RvnDrawer.Title>Test Title</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should render all compound parts', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content>
              <RvnDrawer.Header>
                <RvnDrawer.Title>Drawer Title</RvnDrawer.Title>
              </RvnDrawer.Header>
              <RvnDrawer.Body>
                <p>Drawer body content</p>
              </RvnDrawer.Body>
              <RvnDrawer.Footer>
                <button>Close</button>
              </RvnDrawer.Footer>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      expect(screen.getByText('Drawer Title')).toBeInTheDocument()
      expect(screen.getByText('Drawer body content')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('should position from right by default', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content data-testid="drawer-content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('drawer-content')
      expect(content).toHaveAttribute('data-position', 'right')
    })

    it('should position from left when specified', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="left" data-testid="drawer-content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('drawer-content')
      expect(content).toHaveAttribute('data-position', 'left')
    })

    it('should position from top when specified', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="top" data-testid="drawer-content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('drawer-content')
      expect(content).toHaveAttribute('data-position', 'top')
    })

    it('should position from bottom when specified', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="bottom" data-testid="drawer-content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('drawer-content')
      expect(content).toHaveAttribute('data-position', 'bottom')
    })
  })

  describe('Accessibility', () => {
    it('should have role dialog', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content>
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onOpenChange when Escape is pressed', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnDrawer.Root open={true} onOpenChange={handleOpenChange}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content>
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      await user.keyboard('{Escape}')
      expect(handleOpenChange).toHaveBeenCalled()
      expect(handleOpenChange.mock.calls[0][0]).toBe(false)
    })

    it('should call onOpenChange when backdrop is clicked', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()

      render(
        <RvnDrawer.Root open={true} onOpenChange={handleOpenChange}>
          <RvnDrawer.Portal>
            <RvnDrawer.Backdrop data-testid="backdrop" />
            <RvnDrawer.Content>
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
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
          <RvnDrawer.Root open={open} onOpenChange={setOpen}>
            <RvnDrawer.Trigger>
              Open Drawer
            </RvnDrawer.Trigger>
            <RvnDrawer.Portal>
              <RvnDrawer.Content>
                <RvnDrawer.Title>Triggered Drawer</RvnDrawer.Title>
              </RvnDrawer.Content>
            </RvnDrawer.Portal>
          </RvnDrawer.Root>
        )
      }

      render(<TestComponent />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByText('Open Drawer'))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Styling', () => {
    it('should apply border on visible edge for right drawer', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="right" data-testid="content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ borderLeft: '3px solid #000000' })
    })

    it('should apply border on visible edge for left drawer', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="left" data-testid="content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ borderRight: '3px solid #000000' })
    })

    it('should apply black header background', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content>
              <RvnDrawer.Header data-testid="header">
                <RvnDrawer.Title>Test</RvnDrawer.Title>
              </RvnDrawer.Header>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const header = screen.getByTestId('header')
      expect(header).toHaveStyle({ background: '#000000' })
    })
  })

  describe('Size Control', () => {
    it('should accept custom width for side drawers', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content width="500px" data-testid="content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ width: '500px' })
    })

    it('should accept custom height for top/bottom drawers', () => {
      render(
        <RvnDrawer.Root open={true} onOpenChange={() => {}}>
          <RvnDrawer.Portal>
            <RvnDrawer.Content position="bottom" height="300px" data-testid="content">
              <RvnDrawer.Title>Test</RvnDrawer.Title>
            </RvnDrawer.Content>
          </RvnDrawer.Portal>
        </RvnDrawer.Root>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveStyle({ height: '300px' })
    })
  })
})
