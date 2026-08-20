import { createFileRoute } from '@tanstack/react-router'
import { getSpecimen } from '~/lib/catalog/functions'
import { SpecimenDetail } from '~/ui/specimen-detail'

export const Route = createFileRoute('/specimens/$specimenId')({
  loader: ({ params }) => getSpecimen({ data: { id: params.specimenId } }),
  component: SpecimenPage,
})

function SpecimenPage() {
  const specimen = Route.useLoaderData()
  return <SpecimenDetail specimen={specimen} />
}
