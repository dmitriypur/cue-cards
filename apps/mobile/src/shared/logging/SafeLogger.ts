export interface SafeLogContext {
  readonly correlationId?: string
  readonly userId?: string
  readonly operationId?: string
  readonly generationId?: string
  readonly route?: string
  readonly outcome?: string
}

type SafeValue = string
type SanitizedContext = Record<string, SafeValue>
type LogSink = (event: string, context: SanitizedContext) => void

const allowedKeys = [
  'correlationId',
  'userId',
  'operationId',
  'generationId',
  'route',
  'outcome',
] as const
const identifierKeys = new Set(['correlationId', 'userId', 'operationId', 'generationId'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const technicalValue = /^[a-z0-9][a-z0-9._/-]{0,127}$/iu

export class SafeLogger {
  private readonly sink: LogSink

  public constructor(sink: LogSink = (event, context) => console.info(event, context)) {
    this.sink = sink
  }

  public info(event: string, context: SafeLogContext): void {
    const runtime = context as Readonly<Record<string, unknown>>
    const safe: SanitizedContext = {}
    for (const key of allowedKeys) {
      const value = runtime[key]
      if (typeof value !== 'string') continue
      if (identifierKeys.has(key) ? uuid.test(value) : technicalValue.test(value)) safe[key] = value
    }
    this.sink(event, safe)
  }
}
