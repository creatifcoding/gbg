import * as Schema from 'effect/Schema'

import { WorkflowMeta, type WorkflowMeta as WorkflowMetaType } from '../domain/schemas'

export class LiteralMetaParseError extends Error {
  readonly name = 'LiteralMetaParseError'
}

export function extractLiteralMeta(script: string): WorkflowMetaType {
  const literal = extractMetaObjectLiteral(script)
  const value = new LiteralParser(literal).parseRoot()
  return Schema.decodeUnknownSync(WorkflowMeta)(value)
}

export function extractMetaObjectLiteral(script: string): string {
  const match = /export\s+const\s+meta\s*=\s*/g.exec(script)
  if (!match) {
    throw new LiteralMetaParseError('Missing `export const meta = { ... }` literal.')
  }

  let index = match.index + match[0].length
  while (/\s/.test(script[index] ?? '')) index++

  if (script[index] !== '{') {
    throw new LiteralMetaParseError('Workflow meta must be an object literal.')
  }

  const start = index
  let depth = 0
  let quote: '"' | "'" | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (; index < script.length; index++) {
    const char = script[index]
    const next = script[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index++
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index++
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index++
      continue
    }

    if (char === '`') {
      throw new LiteralMetaParseError('Template strings are not allowed in workflow meta.')
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        return script.slice(start, index + 1)
      }
    }
  }

  throw new LiteralMetaParseError('Unterminated workflow meta object literal.')
}

class LiteralParser {
  private index = 0

  constructor(private readonly input: string) {}

  parseRoot(): unknown {
    const value = this.parseValue()
    this.skipIgnorable()
    if (!this.done()) {
      this.fail('Unexpected content after meta literal.')
    }
    return value
  }

  private parseValue(): unknown {
    this.skipIgnorable()
    const char = this.peek()

    if (char === '{') return this.parseObject()
    if (char === '[') return this.parseArray()
    if (char === '"' || char === "'") return this.parseString()
    if (char === '-' || isDigit(char)) return this.parseNumber()
    if (isIdentifierStart(char)) return this.parseIdentifierValue()

    this.fail(`Unexpected token '${char ?? '<eof>'}'.`)
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{')
    const out: Record<string, unknown> = {}
    this.skipIgnorable()

    while (this.peek() !== '}') {
      if (this.done()) this.fail('Unterminated object literal.')
      if (this.peek() === '.') this.fail('Object spread is not allowed in workflow meta.')
      const key = this.parseKey()
      this.skipIgnorable()
      this.expect(':')
      out[key] = this.parseValue()
      this.skipIgnorable()
      if (this.peek() === ',') {
        this.index++
        this.skipIgnorable()
      } else if (this.peek() !== '}') {
        this.fail('Expected comma or closing brace in object literal.')
      }
    }

    this.expect('}')
    return out
  }

  private parseArray(): ReadonlyArray<unknown> {
    this.expect('[')
    const out: unknown[] = []
    this.skipIgnorable()

    while (this.peek() !== ']') {
      if (this.done()) this.fail('Unterminated array literal.')
      if (this.peek() === '.') this.fail('Array spread is not allowed in workflow meta.')
      out.push(this.parseValue())
      this.skipIgnorable()
      if (this.peek() === ',') {
        this.index++
        this.skipIgnorable()
      } else if (this.peek() !== ']') {
        this.fail('Expected comma or closing bracket in array literal.')
      }
    }

    this.expect(']')
    return out
  }

  private parseKey(): string {
    this.skipIgnorable()
    const char = this.peek()
    if (char === '"' || char === "'") return this.parseString()
    if (!isIdentifierStart(char)) this.fail('Expected object key.')
    return this.parseIdentifier()
  }

  private parseString(): string {
    const quote = this.peek()
    if (quote !== '"' && quote !== "'") this.fail('Expected string literal.')
    this.index++
    let out = ''

    while (!this.done()) {
      const char = this.input[this.index++]
      if (char === quote) return out
      if (char === '\\') {
        if (this.done()) this.fail('Unterminated escape sequence.')
        const escaped = this.input[this.index++]
        switch (escaped) {
          case '"':
          case "'":
          case '\\':
          case '/':
            out += escaped
            break
          case 'b':
            out += '\b'
            break
          case 'f':
            out += '\f'
            break
          case 'n':
            out += '\n'
            break
          case 'r':
            out += '\r'
            break
          case 't':
            out += '\t'
            break
          default:
            this.fail(`Unsupported escape sequence \\${escaped}.`)
        }
      } else {
        out += char
      }
    }

    this.fail('Unterminated string literal.')
  }

  private parseNumber(): number {
    const start = this.index
    if (this.peek() === '-') this.index++
    while (isDigit(this.peek())) this.index++
    if (this.peek() === '.') {
      this.index++
      while (isDigit(this.peek())) this.index++
    }
    const raw = this.input.slice(start, this.index)
    const value = Number(raw)
    if (!Number.isFinite(value)) this.fail(`Invalid number literal '${raw}'.`)
    return value
  }

  private parseIdentifierValue(): unknown {
    const id = this.parseIdentifier()
    switch (id) {
      case 'true':
        return true
      case 'false':
        return false
      case 'null':
        return null
      case 'undefined':
      case 'NaN':
      case 'Infinity':
        this.fail(`Identifier '${id}' is not allowed in workflow meta.`)
      default:
        this.fail(`Dynamic identifier '${id}' is not allowed in workflow meta.`)
    }
  }

  private parseIdentifier(): string {
    const start = this.index
    if (!isIdentifierStart(this.peek())) this.fail('Expected identifier.')
    this.index++
    while (isIdentifierPart(this.peek())) this.index++
    return this.input.slice(start, this.index)
  }

  private skipIgnorable(): void {
    while (!this.done()) {
      const char = this.peek()
      const next = this.input[this.index + 1]
      if (/\s/.test(char ?? '')) {
        this.index++
        continue
      }
      if (char === '/' && next === '/') {
        this.index += 2
        while (!this.done() && this.peek() !== '\n') this.index++
        continue
      }
      if (char === '/' && next === '*') {
        this.index += 2
        while (!this.done() && !(this.peek() === '*' && this.input[this.index + 1] === '/')) this.index++
        if (this.done()) this.fail('Unterminated block comment.')
        this.index += 2
        continue
      }
      return
    }
  }

  private expect(expected: string): void {
    this.skipIgnorable()
    if (this.peek() !== expected) {
      this.fail(`Expected '${expected}'.`)
    }
    this.index++
  }

  private peek(): string | undefined {
    return this.input[this.index]
  }

  private done(): boolean {
    return this.index >= this.input.length
  }

  private fail(message: string): never {
    throw new LiteralMetaParseError(`${message} at offset ${this.index}`)
  }
}

function isIdentifierStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z_$]/.test(char)
}

function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && /[0-9]/.test(char)
}
