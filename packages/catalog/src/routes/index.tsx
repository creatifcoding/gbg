import { createFileRoute } from '@tanstack/react-router'
import { listSpecimens } from '~/lib/catalog/functions'
import { CatalogIndex } from '~/ui/catalog-index'

export const Route = createFileRoute('/')({
  loader: () => listSpecimens(),
  component: IndexPage,
})

function IndexPage() {
  const specimens = Route.useLoaderData()
  return <CatalogIndex specimens={specimens} />
}
