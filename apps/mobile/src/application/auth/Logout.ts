import type { TokenStore } from '@/application/ports/TokenStore'
import type { RequestClient } from '@/application/ports/ApiClient'

export class Logout {
  private readonly client: RequestClient
  private readonly tokens: TokenStore

  public constructor(
    client: RequestClient,
    tokens: TokenStore,
  ) {
    this.client = client
    this.tokens = tokens
  }

  public async execute(): Promise<void> {
    try {
      await this.client.request<void>({
        method: 'POST',
        path: '/api/v1/auth/logout',
        authenticated: true,
      })
    } catch {
      // Local logout must succeed even when the API is unavailable.
    } finally {
      await this.tokens.clear()
    }
  }
}
