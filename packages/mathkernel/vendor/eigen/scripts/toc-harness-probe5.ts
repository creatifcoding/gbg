/**
 * TOC Probe 5: Is PubSub.publish blocking when there are no subscribers?
 */
import { Effect, PubSub, Stream, Fiber } from 'effect'

const program = Effect.gen(function* () {
  const ps = yield* PubSub.unbounded<string>()
  
  console.log('[1] publish with no subscriber...')
  const published = yield* PubSub.publish(ps, 'msg-1')
  console.log('[1] published:', published)
  
  console.log('[2] publish again...')
  const published2 = yield* PubSub.publish(ps, 'msg-2')
  console.log('[2] published:', published2)
  
  console.log('[3] subscribe, then publish...')
  const sub = yield* PubSub.subscribe(ps)
  const published3 = yield* PubSub.publish(ps, 'msg-3')
  console.log('[3] published:', published3)
  
  console.log('✓ PubSub.publish does not block')
})

Effect.runPromise(program).then(
  () => process.exit(0),
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
