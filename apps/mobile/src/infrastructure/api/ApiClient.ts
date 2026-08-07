import {
  ApiError,
  type ApiOperation,
  type RequestClient,
} from '@/application/ports/ApiClient'
import type { TokenStore } from '@/application/ports/TokenStore'

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

interface ApiClientOptions {
  readonly baseUrl: string
  readonly tokens: TokenStore
  readonly fetcher?: FetchLike
  readonly timeoutMs?: number
  readonly createCorrelationId?: () => string
}

interface ErrorEnvelope {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly correlation_id: string
    readonly fields?: Readonly<Record<string, readonly string[]>>
  }
}

export class ApiClient implements RequestClient {
  private readonly options: ApiClientOptions
  private readonly fetcher: FetchLike
  private readonly timeoutMs: number
  private readonly createCorrelationId: () => string

  public constructor(options: ApiClientOptions) {
    this.options = options
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.createCorrelationId = options.createCorrelationId ?? (() => crypto.randomUUID())
  }

  public async request<T>(operation: ApiOperation<T>): Promise<T> {
    const correlationId = this.createCorrelationId()
    const headers = new Headers({
      Accept: 'application/json',
      'X-Correlation-ID': correlationId,
    })

    if (operation.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (operation.authenticated === true) {
      const token = await this.options.tokens.get()
      if (token === null) {
        throw new ApiError(
          401,
          'AUTH_UNAUTHENTICATED',
          'Требуется вход в аккаунт.',
          correlationId,
        )
      }
      headers.set('Authorization', `Bearer ${token}`)
    }

    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetcher(
        `${this.options.baseUrl.replace(/\/$/, '')}${operation.path}`,
        {
          method: operation.method,
          headers,
          signal: controller.signal,
          ...(operation.body === undefined
            ? {}
            : { body: JSON.stringify(operation.body) }),
        },
      )

      if (!response.ok) {
        const envelope = await this.readErrorEnvelope(response)
        throw new ApiError(
          response.status,
          envelope?.error.code ?? 'HTTP_ERROR',
          envelope?.error.message ?? 'Запрос не может быть выполнен.',
          envelope?.error.correlation_id ?? correlationId,
          envelope?.error.fields,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      return await response.json() as T
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error

      if (controller.signal.aborted) {
        throw new ApiError(
          0,
          'REQUEST_TIMEOUT',
          'Сервер не ответил вовремя.',
          correlationId,
        )
      }

      throw new ApiError(
        0,
        'NETWORK_UNAVAILABLE',
        'Нет соединения с сервером.',
        correlationId,
      )
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }

  private async readErrorEnvelope(response: Response): Promise<ErrorEnvelope | null> {
    try {
      const value: unknown = await response.json()
      if (!isRecord(value) || !isRecord(value.error)) return null
      if (
        typeof value.error.code !== 'string'
        || typeof value.error.message !== 'string'
        || typeof value.error.correlation_id !== 'string'
      ) return null

      return value as unknown as ErrorEnvelope
    } catch {
      return null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
