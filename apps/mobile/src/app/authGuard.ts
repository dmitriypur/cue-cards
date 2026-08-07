import type {
  NavigationGuardReturn,
  RouteLocationNormalized,
} from 'vue-router'

import type { AuthSession } from '@/application/auth/Login'

interface AuthGuardState {
  readonly initialized?: boolean
  readonly session: AuthSession
  restore(): Promise<void>
}

export function createAuthGuard(state: AuthGuardState) {
  return async (to: RouteLocationNormalized): Promise<NavigationGuardReturn> => {
    if (state.initialized === false) await state.restore()

    if (to.name === 'login' && state.session.mode === 'authenticated') {
      return { name: 'library' }
    }

    return true
  }
}
