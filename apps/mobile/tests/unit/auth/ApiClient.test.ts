import { describe, expect, it } from 'vitest'

import { ApiError } from '@/application/ports/ApiClient'
import type { TokenStore } from '@/application/ports/TokenStore'
import {
  ApiClient,
  type FetchLike,
} from '@/infrastructure/api/ApiClient'

class MemoryTokenStore implements TokenStore {
  public constructor(public token: string | null) {}

  public async get(): Promise<string | null> {
    return this.token
  }

  public async set(token: string): Promise<void> {
    this.token = token
  }

  public async clear(): Promise<void> {
    this.token = null
  }
}

function client(
  fetcher: FetchLike,
  tokens = new MemoryTokenStore('secret-token'),
  timeoutMs = 100,
): ApiClient {
  return new ApiClient({
    baseUrl: 'https://api.example.test',
    tokens,
    fetcher,
    timeoutMs,
    createCorrelationId: () => '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2',
  })
}

describe('ApiClient', () => {
  it('sends bearer authentication, correlation id, and JSON body', async () => {
    let request: Request | null = null
    const api = client(async (input, init) => {
      request = new Request(input, init)

      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const result = await api.request<{ data: { ok: boolean } }>({
      method: 'POST',
      path: '/api/v1/sync/commands',
      authenticated: true,
      body: { commands: [] },
    })

    expect(result).toEqual({ data: { ok: true } })
    expect(request).not.toBeNull()
    expect(request!.headers.get('Authorization')).toBe('Bearer secret-token')
    expect(request!.headers.get('X-Correlation-ID')).toBe('0198a70d-4f72-70ad-bb3f-35b64f6ee1b2')
    expect(request!.headers.get('Content-Type')).toBe('application/json')
    await expect(request!.json()).resolves.toEqual({ commands: [] })
  })

  it('normalizes API envelopes without retaining the bearer token', async () => {
    const api = client(async () => new Response(JSON.stringify({
      error: {
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Требуется вход в аккаунт.',
        correlation_id: 'server-correlation-id',
      },
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    const error = await api.request({
      method: 'GET',
      path: '/api/v1/me',
      authenticated: true,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 401,
      code: 'AUTH_UNAUTHENTICATED',
      correlationId: 'server-correlation-id',
    })
    expect(JSON.stringify(error)).not.toContain('secret-token')
  })

  it('returns undefined for a successful no-content response', async () => {
    const api = client(async () => new Response(null, { status: 204 }))

    await expect(api.request<void>({
      method: 'POST',
      path: '/api/v1/auth/logout',
      authenticated: true,
    })).resolves.toBeUndefined()
  })

  it('aborts timed-out requests and exposes only a normalized safe error', async () => {
    const api = client((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Bearer secret-token', 'AbortError'))
      })
    }), new MemoryTokenStore('secret-token'), 1)

    const error = await api.request({
      method: 'GET',
      path: '/api/v1/me',
      authenticated: true,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'REQUEST_TIMEOUT' })
    expect(JSON.stringify(error)).not.toContain('secret-token')
  })
})
