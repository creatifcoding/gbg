import { createFileRoute } from '@tanstack/react-router'
import { getCatalogStore } from '~/lib/catalog/store.server'

export const Route = createFileRoute('/api/blobs/$specimenId/$attachmentId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const blob = getCatalogStore().readBlob(
          params.specimenId,
          params.attachmentId,
        )
        if (!blob) {
          return new Response('Not found', { status: 404 })
        }
        return new Response(Buffer.from(blob.bytes), {
          headers: {
            'content-type': blob.mimeType,
            'content-disposition': `inline; filename="${blob.filename.replaceAll('"', '')}"`,
            'cache-control': 'private, max-age=60',
          },
        })
      },
    },
  },
})
