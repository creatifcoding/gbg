import { createFileRoute } from '@tanstack/react-router'
import { IntakeDrop } from '~/ui/intake-drop'

export const Route = createFileRoute('/intake')({
  component: IntakePage,
})

function IntakePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="vanta-label">Ten-second start</p>
        <h2 className="vanta-heading text-3xl">Dump, then file</h2>
        <p className="vanta-muted mt-2 max-w-xl text-[16px]">
          One screen. No wizard. A Card needs a type, a one-line claim, and three tags. Organism, structure, and function guesses are optional. Questions if you already have them.
        </p>
      </header>
      <IntakeDrop />
    </div>
  )
}
