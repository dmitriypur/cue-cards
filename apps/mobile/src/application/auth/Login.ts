import type { TokenStore } from '@/application/ports/TokenStore'
import { ApiError, type ApiOperation, type RequestClient } from '@/application/ports/ApiClient'
import type { components } from '@/infrastructure/api/generated/schema'

type LoginInput = components['schemas']['LoginRequest']
type LoginResponse = components['schemas']['LoginResponse']
type User = components['schemas']['User']
type UserResponse = components['schemas']['UserResponse']

export type AuthSession =
  | { readonly mode: 'authenticated'; readonly user: User }
  | { readonly mode: 'local-only'; readonly user: null }

const meOperation: ApiOperation<UserResponse> = {
  method: 'GET',
  path: '/api/v1/me',
  authenticated: true,
}

export class Login {
  private readonly client: RequestClient
  private readonly tokens: TokenStore

  public constructor(
    client: RequestClient,
    tokens: TokenStore,
  ) {
    this.client = client
    this.tokens = tokens
  }

  public async execute(input: LoginInput): Promise<User> {
    const response = await this.client.request<LoginResponse>({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: input,
      authenticated: false,
    })

    await this.tokens.set(response.data.access_token)

    try {
      return (await this.client.request(meOperation)).data
    } catch (error: unknown) {
      await this.tokens.clear()
      throw error
    }
  }

  public async restore(): Promise<AuthSession> {
    if (await this.tokens.get() === null) {
      return { mode: 'local-only', user: null }
    }

    try {
      const response = await this.client.request(meOperation)

      return { mode: 'authenticated', user: response.data }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await this.tokens.clear()
        return { mode: 'local-only', user: null }
      }
      if (error instanceof ApiError && error.status === 0) {
        return { mode: 'local-only', user: null }
      }
      throw error
    }
  }
}
