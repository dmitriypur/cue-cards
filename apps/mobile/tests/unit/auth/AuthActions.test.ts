import { describe, expect, it } from 'vitest'

import { Login } from '@/application/auth/Login'
import { Logout } from '@/application/auth/Logout'
import type { TokenStore } from '@/application/ports/TokenStore'
import type {
  ApiOperation,
  RequestClient,
} from '@/application/ports/ApiClient'
import { ApiError } from '@/application/ports/ApiClient'
import type { components } from '@/infrastructure/api/generated/schema'

type LoginResponse = components['schemas']['LoginResponse']
type UserResponse = components['schemas']['UserResponse']

const user: components['schemas']['User'] = {
  id: '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2',
  name: 'Владелец',
  email: 'owner@example.test',
  role: 'superadmin',
  entitlements: [
    'offline_scripts',
    'offline_recording',
    'cloud_sync',
    'ai_cues',
  ],
}

class MemoryTokenStore implements TokenStore {
  public token: string | null = null

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

class FakeRequestClient implements RequestClient {
  public readonly paths: string[] = []
  public onRequest: (operation: ApiOperation<unknown>) => unknown = () => {
    throw new Error('Unexpected request')
  }

  public async request<T>(operation: ApiOperation<T>): Promise<T> {
    this.paths.push(operation.path)

    return this.onRequest(operation) as T
  }
}

describe('authentication actions', () => {
  it('stores the login token before requesting the current user', async () => {
    const tokens = new MemoryTokenStore()
    const client = new FakeRequestClient()
    client.onRequest = (operation) => {
      if (operation.path === '/api/v1/auth/login') {
        return {
          data: {
            access_token: 'sanctum-token',
            token_type: 'Bearer',
            user,
          },
        } satisfies LoginResponse
      }

      expect(tokens.token).toBe('sanctum-token')

      return { data: user } satisfies UserResponse
    }

    const result = await new Login(client, tokens).execute({
      email: 'owner@example.test',
      password: 'correct-password',
      device_name: 'Pixel 9',
    })

    expect(result).toEqual(user)
    expect(client.paths).toEqual(['/api/v1/auth/login', '/api/v1/me'])
  })

  it('clears a newly stored token when loading the current user fails', async () => {
    const tokens = new MemoryTokenStore()
    const client = new FakeRequestClient()
    client.onRequest = (operation) => {
      if (operation.path === '/api/v1/auth/login') {
        return {
          data: {
            access_token: 'do-not-retain',
            token_type: 'Bearer',
            user,
          },
        } satisfies LoginResponse
      }

      throw new Error('offline')
    }

    await expect(new Login(client, tokens).execute({
      email: 'owner@example.test',
      password: 'correct-password',
      device_name: 'Pixel 9',
    })).rejects.toThrow('offline')
    expect(tokens.token).toBeNull()
  })

  it('clears local credentials when server logout fails', async () => {
    const tokens = new MemoryTokenStore()
    tokens.token = 'existing-token'
    const client = new FakeRequestClient()
    client.onRequest = () => { throw new Error('offline') }

    await expect(new Logout(client, tokens).execute()).resolves.toBeUndefined()

    expect(client.paths).toEqual(['/api/v1/auth/logout'])
    expect(tokens.token).toBeNull()
  })

  it('restores missing credentials as local-only mode without a request', async () => {
    const tokens = new MemoryTokenStore()
    const client = new FakeRequestClient()

    const result = await new Login(client, tokens).restore()

    expect(result).toEqual({ mode: 'local-only', user: null })
    expect(client.paths).toEqual([])
  })

  it('clears an expired token and restores local-only mode', async () => {
    const tokens = new MemoryTokenStore()
    tokens.token = 'expired-token'
    const client = new FakeRequestClient()
    client.onRequest = () => {
      throw new ApiError(401, 'AUTH_UNAUTHENTICATED', 'expired', 'correlation-id')
    }

    const result = await new Login(client, tokens).restore()

    expect(result).toEqual({ mode: 'local-only', user: null })
    expect(tokens.token).toBeNull()
  })
})
