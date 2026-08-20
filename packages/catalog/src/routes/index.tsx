import { createFileRoute } from '@tanstack/react-router'
import { listCards } from '~/lib/catalog/functions'
import { CatalogIndex } from '~/ui/catalog-index'

export const Route = createFileRoute('/')({
  loader: () => listCards(),
  component: IndexPage,
})

function IndexPage() {
  const cards = Route.useLoaderData()
  return <CatalogIndex cards={cards} />
}
