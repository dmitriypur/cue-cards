import type { Page, Route } from '@playwright/test'

interface SubmittedCommand {
  readonly operation_id: string
  readonly aggregate_id: string
  readonly base_version: number
  readonly payload: Record<string, unknown>
}

export interface FakeBackend {
  readonly submissions: SubmittedCommand[]
}

interface FakeBackendOptions {
  readonly conflictOnce?: {
    readonly aggregateId: string
    readonly local: Record<string, unknown>
    readonly server: Record<string, unknown>
  }
}

const user = {
  id: '0198a70d-5c68-7a3f-8d8e-9d51b1e75421',
  name: 'Автор',
  email: 'author@example.test',
  role: 'superadmin',
  entitlements: ['scripts', 'ai_cues'],
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function installFakeBackend(
  page: Page,
  options: FakeBackendOptions = {},
): Promise<FakeBackend> {
  const submissions: SubmittedCommand[] = []
  let conflictPending = options.conflictOnce !== undefined
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/v1/auth/login' && request.method() === 'POST') {
      await json(route, {
        data: {
          access_token: 'synthetic-e2e-token',
          token_type: 'Bearer',
        },
      })
      return
    }

    if (path === '/api/v1/me' && request.method() === 'GET') {
      await json(route, { data: user })
      return
    }

    if (path === '/api/v1/sync/commands' && request.method() === 'POST') {
      const body = request.postDataJSON() as { readonly commands?: readonly SubmittedCommand[] }
      const commands = [...(body.commands ?? [])]
      submissions.push(...commands)
      if (conflictPending && options.conflictOnce !== undefined) {
        conflictPending = false
        await json(route, {
          error: {
            code: 'SYNC_VERSION_CONFLICT',
            message: 'Version conflict.',
            correlation_id: 'e2e-correlation',
            conflict: {
              aggregate_id: options.conflictOnce.aggregateId,
              local: options.conflictOnce.local,
              server: options.conflictOnce.server,
            },
          },
        }, 409)
        return
      }
      await json(route, {
        data: {
          results: commands.map((command) => ({
            operation_id: command.operation_id,
            aggregate_id: command.aggregate_id,
            version: command.base_version + 1,
            duplicate: false,
          })),
        },
      })
      return
    }

    if (path === '/api/v1/sync' && request.method() === 'GET') {
      await json(route, { data: { changes: [], next_cursor: 0, has_more: false } })
      return
    }

    await json(route, {
      error: {
        code: 'E2E_ROUTE_NOT_IMPLEMENTED',
        message: `Fake route is missing: ${request.method()} ${path}`,
        correlation_id: 'e2e-correlation',
      },
    }, 501)
  })

  return { submissions }
}
