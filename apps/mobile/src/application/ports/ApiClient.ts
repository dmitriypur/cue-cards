export interface ApiOperation<T> {
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly body?: unknown
  readonly authenticated?: boolean
  readonly responseType?: T
}

export interface RequestClient {
  request<T>(operation: ApiOperation<T>): Promise<T>
}

export class ApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly correlationId: string
  public readonly fields?: Readonly<Record<string, readonly string[]>>

  public constructor(
    status: number,
    code: string,
    message: string,
    correlationId: string,
    fields?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.correlationId = correlationId
    if (fields !== undefined) this.fields = fields
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      message: this.message,
      correlationId: this.correlationId,
      ...(this.fields === undefined ? {} : { fields: this.fields }),
    }
  }
}
