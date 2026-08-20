import { createFileRoute } from '@tanstack/react-router'
import { getCard } from '~/lib/catalog/functions'
import { CardDetail } from '~/ui/card-detail'

export const Route = createFileRoute('/cards/$cardId')({
  loader: ({ params }) => getCard({ data: { id: params.cardId } }),
  component: CardPage,
})

function CardPage() {
  const card = Route.useLoaderData()
  return <CardDetail card={card} />
}
