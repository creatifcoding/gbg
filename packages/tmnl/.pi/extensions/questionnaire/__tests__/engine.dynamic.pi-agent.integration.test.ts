import { spawn } from 'node:child_process'
import { describe, expect, it, beforeEach } from 'vitest'
import { Schema } from 'effect'

import { Questionnaire } from '../schema.ts'
import * as Engine from '../engine.ts'
import { get, stateAtom, resetRegistry, subscribe } from '../atoms.ts'

interface PiJsonRun {
  text: string
  stderr: string
  code: number
}

async function runPiJson(prompt: string): Promise<PiJsonRun> {
  const args = ['--mode', 'json', '-p', '--no-session', '--model', 'claude-sonnet-4-5', prompt]

  return await new Promise((resolve) => {
    const proc = spawn('pi', args, {
      cwd: process.cwd(),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let buffer = ''
    let stderr = ''
    let finalAssistantText = ''

    const onLine = (line: string) => {
      if (!line.trim()) return

      let event: any
      try {
        event = JSON.parse(line)
      } catch {
        return
      }

      if (event.type === 'message_end' && event.message?.role === 'assistant') {
        const parts = Array.isArray(event.message.content) ? event.message.content : []
        const text = parts
          .map((p: any) => (p?.type === 'text' ? String(p.text ?? '') : ''))
          .join('')
          .trim()
        if (text) finalAssistantText = text
      }
    }

    proc.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) onLine(line)
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (buffer.trim()) onLine(buffer)
      resolve({ text: finalAssistantText, stderr, code: code ?? 1 })
    })

    proc.on('error', (err) => {
      resolve({ text: '', stderr: `${stderr}\n${String(err)}`, code: 1 })
    })
  })
}

const RUN_INTEGRATION = process.env.QUESTIONNAIRE_RUN_PI_AGENT_INTEGRATION === '1'
const maybeDescribe = RUN_INTEGRATION ? describe : describe.skip

maybeDescribe('engine dynamic next-hook (pi-agent integration)', () => {
  beforeEach(() => {
    resetRegistry()
  })

  it('injects next question from pi --mode json response', async () => {
    const spec = Schema.decodeUnknownSync(Questionnaire)({
      id: 'pi-agent-integration-spec',
      title: 'PI Agent Integration',
      startId: 'q1',
      questions: [
        {
          id: 'q1',
          prompt: 'Which lane?',
          type: 'select',
          options: [
            { value: 'backend', label: 'Backend' },
            { value: 'frontend', label: 'Frontend' },
          ],
          next: { backend: 'q2_static', frontend: 'q2_static' },
          nextHook: {
            hookId: 'pi-agent-integration-hook',
            toolName: 'pi-agent.dynamic-next',
            when: ['backend'],
            mode: 'inject',
            metaPrompt: 'Return strict JSON only.',
          },
        },
        {
          id: 'q2_static',
          prompt: 'Static fallback',
          type: 'input',
        },
      ],
    })

    const unsub = subscribe(stateAtom, () => {})

    try {
      Engine.start(spec, {
        dynamicResolver: async (input) => {
          const prompt = [
            'You are a questionnaire dynamic hook resolver.',
            'Return JSON ONLY with shape: {"mode":"inject|modify|none", "question"?: object, "patch"?: object, "targetId"?: string, "note"?: string}.',
            'If answerValues contains "backend", return mode="inject" and question={"id":"dynamic_pi_agent_followup","prompt":"Dynamic PI Agent follow-up","type":"input"}.',
            'Otherwise return {"mode":"none"}.',
            `Context: ${JSON.stringify({ answerValues: input.answerValues, policyMode: input.hook.mode })}`,
          ].join('\n')

          const run = await runPiJson(prompt)
          if (run.code !== 0 || !run.text) {
            return {
              mode: 'none',
              note: `pi run failed code=${run.code}`,
              audit: { stderr: run.stderr },
            }
          }

          const parsed = JSON.parse(run.text)
          return {
            mode: parsed.mode,
            question: parsed.question,
            patch: parsed.patch,
            targetId: parsed.targetId,
            note: parsed.note,
            audit: { raw: run.text, code: run.code },
          }
        },
      })

      await Engine.selectOption('backend', 'Backend')

      const s = get(stateAtom)
      expect(s.status).toBe('active')
      expect(s.current?.id).toBe('dynamic_pi_agent_followup')
      expect(s.current?.prompt).toBe('Dynamic PI Agent follow-up')
      expect(s.dynamicTrace.length).toBeGreaterThan(0)
      expect(s.dynamicTrace.at(-1)?.appliedMode).toBe('inject')
      expect(s.dynamicTrace.at(-1)?.toolName).toBe('pi-agent.dynamic-next')
    } finally {
      unsub()
    }
  }, 60_000)
})
