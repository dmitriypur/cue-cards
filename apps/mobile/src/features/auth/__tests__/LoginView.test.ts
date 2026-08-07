import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import type { RouteLocationNormalized } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { createAuthGuard } from '@/app/authGuard'
import { createAppRouter } from '@/app/router'
import type { AuthSession } from '@/application/auth/Login'
import { ApiError } from '@/application/ports/ApiClient'
import {
  authDependenciesKey,
  authNavigationKey,
  type AuthDependencies,
  type AuthNavigation,
} from '@/features/auth/auth.dependencies'
import LoginView from '@/features/auth/LoginView.vue'
import { useAuthStore } from '@/features/auth/auth.store'
import type { components } from '@/infrastructure/api/generated/schema'

const user: components['schemas']['User'] = {
  id: '0198a70d-4f72-70ad-bb3f-35b64f6ee1b2',
  name: 'Владелец',
  email: 'owner@example.test',
  role: 'superadmin',
  entitlements: ['offline_scripts', 'offline_recording', 'cloud_sync', 'ai_cues'],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })

  return { promise, resolve }
}

function mountLogin(execute: AuthDependencies['login']['execute']) {
  const pinia = createPinia()
  const navigation: AuthNavigation = {
    openLibrary: vi.fn().mockResolvedValue(undefined),
  }
  const dependencies: AuthDependencies = {
    login: {
      execute,
      restore: vi.fn().mockResolvedValue({ mode: 'local-only', user: null }),
    },
    logout: { execute: vi.fn().mockResolvedValue(undefined) },
    afterAuthenticated: vi.fn().mockResolvedValue(undefined),
  }
  const wrapper = mount(LoginView, {
    global: {
      plugins: [pinia],
      provide: {
        [authDependenciesKey as symbol]: dependencies,
        [authNavigationKey as symbol]: navigation,
      },
    },
  })

  return { wrapper, pinia, navigation, dependencies }
}

describe('LoginView', () => {
  it('submits email, password, and device name, shows loading, then forgets the password', async () => {
    const pending = deferred<components['schemas']['User']>()
    const execute = vi.fn().mockReturnValue(pending.promise)
    const { wrapper, pinia, navigation, dependencies } = mountLogin(execute)

    await wrapper.get('input[name="email"]').setValue('owner@example.test')
    await wrapper.get('input[name="password"]').setValue('correct-password')
    await wrapper.get('input[name="device_name"]').setValue('Pixel 9')
    const submission = wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[type="submit"]').text()).toContain('Входим')

    pending.resolve(user)
    await submission
    await flushPromises()

    expect(execute).toHaveBeenCalledWith({
      email: 'owner@example.test',
      password: 'correct-password',
      device_name: 'Pixel 9',
    })
    expect(dependencies.afterAuthenticated).toHaveBeenCalledOnce()
    expect(vi.mocked(dependencies.afterAuthenticated).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(navigation.openLibrary).mock.invocationCallOrder[0]!)
    expect(navigation.openLibrary).toHaveBeenCalledOnce()
    expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('')
    expect(JSON.stringify(useAuthStore(pinia).$state)).not.toContain('correct-password')
  })

  it('shows a localized invalid-credential message without exposing internal details', async () => {
    const execute = vi.fn().mockRejectedValue(new ApiError(
      401,
      'AUTH_INVALID_CREDENTIALS',
      'sensitive upstream detail',
      'correlation-id',
    ))
    const { wrapper } = mountLogin(execute)

    await wrapper.get('input[name="email"]').setValue('owner@example.test')
    await wrapper.get('input[name="password"]').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Неверный email или пароль')
    expect(wrapper.text()).not.toContain('sensitive upstream detail')
  })

  it('explains local-only access when the server is offline', async () => {
    const execute = vi.fn().mockRejectedValue(new ApiError(
      0,
      'NETWORK_UNAVAILABLE',
      'sensitive network detail',
      'correlation-id',
    ))
    const { wrapper, navigation } = mountLogin(execute)

    await wrapper.get('input[name="email"]').setValue('owner@example.test')
    await wrapper.get('input[name="password"]').setValue('correct-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('сохранённые сценарии доступны офлайн')
    await wrapper.get('[data-action="open-local-library"]').trigger('click')
    expect(navigation.openLibrary).toHaveBeenCalledOnce()
  })

  it('offers the local library without requiring a failed login', async () => {
    const { wrapper, navigation } = mountLogin(vi.fn())

    expect(wrapper.get('[data-action="open-local-library"]').text())
      .toContain('Открыть локальную библиотеку')
    await wrapper.get('[data-action="open-local-library"]').trigger('click')
    expect(navigation.openLibrary).toHaveBeenCalledOnce()
  })
})

describe('auth guard', () => {
  it('registers a public login route', () => {
    const router = createAppRouter()

    expect(router.resolve('/login').name).toBe('login')
    expect(router.getRoutes().find(({ path }) => path === '/')?.redirect).toBe('/login')
  })

  it('sends authenticated users away from login and never blocks local recording after expiry', async () => {
    let session: AuthSession = { mode: 'authenticated', user }
    const state = {
      get session(): AuthSession { return session },
      restore: vi.fn().mockImplementation(async () => { session = { mode: 'local-only', user: null } }),
    }
    const guard = createAuthGuard(state)

    await expect(guard({ name: 'login' } as unknown as RouteLocationNormalized))
      .resolves.toEqual({ name: 'library' })

    session = { mode: 'local-only', user: null }
    await expect(guard({ name: 'script-record' } as unknown as RouteLocationNormalized))
      .resolves.toBe(true)
  })
})
