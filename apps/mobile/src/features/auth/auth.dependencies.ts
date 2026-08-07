import type { InjectionKey } from 'vue'

import type { Login } from '@/application/auth/Login'
import type { Logout } from '@/application/auth/Logout'

export interface AuthDependencies {
  readonly login: Pick<Login, 'execute' | 'restore'>
  readonly logout: Pick<Logout, 'execute'>
  readonly afterAuthenticated: () => Promise<void>
}

export interface AuthNavigation {
  openLibrary(): Promise<void>
}

export const authDependenciesKey: InjectionKey<AuthDependencies> = Symbol('auth-dependencies')
export const authNavigationKey: InjectionKey<AuthNavigation> = Symbol('auth-navigation')
