import { describe, expect, it, vi } from 'vitest'

import { SafeLogger, type SafeLogContext } from '@/shared/logging/SafeLogger'

describe('SafeLogger', () => {
  it('writes only allowlisted identifiers from runtime context', () => {
    const sink = vi.fn()
    const logger = new SafeLogger(sink)
    const context = {
      correlationId: '0198a70d-5c68-7a3f-8d8e-9d51b1e75420',
      operationId: '0198a70d-5c68-7a3f-8d8e-9d51b1e75421',
      outcome: 'failed',
      scriptText: 'СЕКРЕТНЫЙ СЦЕНАРИЙ',
      password: 'password-sentinel',
      authorization: 'Bearer token-sentinel',
    } as unknown as SafeLogContext

    logger.info('sync.failed', context)

    expect(sink).toHaveBeenCalledWith('sync.failed', {
      correlationId: '0198a70d-5c68-7a3f-8d8e-9d51b1e75420',
      operationId: '0198a70d-5c68-7a3f-8d8e-9d51b1e75421',
      outcome: 'failed',
    })
    expect(JSON.stringify(sink.mock.calls)).not.toContain('SENTINEL')
    expect(JSON.stringify(sink.mock.calls)).not.toContain('СЕКРЕТНЫЙ')
  })

  it('rejects secrets hidden under allowlisted keys', () => {
    const sink = vi.fn()
    new SafeLogger(sink).info('sync.failed', {
      correlationId: 'token-sentinel',
      operationId: 'СЕКРЕТНЫЙ СЦЕНАРИЙ',
      outcome: 'password sentinel',
    })

    expect(sink).toHaveBeenCalledWith('sync.failed', {})
  })
})
