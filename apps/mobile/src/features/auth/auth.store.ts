import { defineStore } from 'pinia'

import type { AuthSession, Login } from '@/application/auth/Login'
import { ApiError } from '@/application/ports/ApiClient'
import type { components } from '@/infrastructure/api/generated/schema'

type LoginInput = components['schemas']['LoginRequest']
export type AuthFailure = 'invalid-credentials' | 'offline' | 'unknown'
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'local-only' | 'failed'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    status: 'idle' as AuthStatus,
    session: { mode: 'local-only', user: null } as AuthSession,
    failure: null as AuthFailure | null,
  }),
  actions: {
    async restore(login: Pick<Login, 'restore'>): Promise<void> {
      if (this.initialized) return
      this.status = 'loading'

      try {
        this.session = await login.restore()
        this.status = this.session.mode
      } catch {
        this.session = { mode: 'local-only', user: null }
        this.status = 'local-only'
      } finally {
        this.initialized = true
      }
    },
    async signIn(login: Pick<Login, 'execute'>, input: LoginInput): Promise<boolean> {
      this.status = 'loading'
      this.failure = null

      try {
        const user = await login.execute(input)
        this.session = { mode: 'authenticated', user }
        this.status = 'authenticated'
        this.initialized = true
        return true
      } catch (error: unknown) {
        this.session = { mode: 'local-only', user: null }
        this.initialized = true
        if (error instanceof ApiError && error.code === 'AUTH_INVALID_CREDENTIALS') {
          this.failure = 'invalid-credentials'
          this.status = 'failed'
        } else if (error instanceof ApiError && error.status === 0) {
          this.failure = 'offline'
          this.status = 'local-only'
        } else {
          this.failure = 'unknown'
          this.status = 'failed'
        }
        return false
      }
    },
  },
})
