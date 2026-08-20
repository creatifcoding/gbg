import { createFileRoute } from '@tanstack/react-router'
import { VantaCardTestbed } from '~/components/testbed/VantaCardTestbed'

export const Route = createFileRoute('/testbed/vanta')({
  component: VantaCardTestbed,
})
