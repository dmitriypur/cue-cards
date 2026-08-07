export class AppError extends Error {
  public readonly code: string
  public readonly correlationId?: string

  public constructor(code: string, safeMessage: string, correlationId?: string) {
    super(safeMessage)
    this.name = 'AppError'
    this.code = code
    if (correlationId !== undefined) this.correlationId = correlationId
  }

  public toJSON(): Readonly<Record<string, string>> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.correlationId === undefined ? {} : { correlationId: this.correlationId }),
    }
  }
}
