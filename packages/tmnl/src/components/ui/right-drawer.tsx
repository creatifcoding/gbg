/**
 * @file RightDrawer.tsx
 * @description A collapsible drawer component for the right side of the UI.
 * It uses the `Sheet` component from shadcn/ui for accessibility and smooth animations.
 * Ideal for showing notifications, logs, or secondary information.
 *
 * AI Adaptation Notes:
 * - This component is controlled (its open state is managed by the parent).
 * - The content inside `SheetContent` is placeholder and can be replaced with
 *   any components you need, such as a real-time event log or system status panel.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Bell } from "lucide-react"

interface RightDrawerProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function RightDrawer({ isOpen, onOpenChange }: RightDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-gray-900 border-l-green-400/20 text-green-400">
        <SheetHeader>
          <SheetTitle className="text-green-300 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 text-sm">
          {/* AI: This is placeholder content. Replace with dynamic notifications. */}
          <p>[14:08:12] System Initialized.</p>
          <p>[14:08:15] Holonet connection stable.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
