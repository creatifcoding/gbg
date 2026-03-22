import { Effect } from 'effect'
import { EmbeddingService, OpenAIEmbeddingLive } from './.pi/extensions/questionnaire/semantic/EmbeddingService.ts'

const layer = OpenAIEmbeddingLive()

const program = Effect.gen(function* () {
  const svc = yield* EmbeddingService
  const vec = yield* svc.embed('AG-Grid rendering is slow with 2000 rows and complex cell renderers')
  console.log('Dimensions:', vec.length)
  console.log('First 5:', Array.from(vec.slice(0, 5)).map(v => v.toFixed(4)))
  console.log('Non-zero:', vec.filter(v => v !== 0).length)

  const vecs = yield* svc.embedMany([
    'The frontend is sluggish when rendering large data grids',
    'I love chocolate ice cream on Sundays',
  ])
  console.log('')
  console.log('Sim → grid perf:', (svc.cosineSimilarity(vec, vecs[0]) * 100).toFixed(1) + '%')
  console.log('Sim → ice cream:', (svc.cosineSimilarity(vec, vecs[1]) * 100).toFixed(1) + '%')
})

await Effect.runPromise(program.pipe(Effect.provide(layer), Effect.scoped))
