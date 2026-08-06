import { describe, expect, it } from 'vitest'

import { createAppRouter } from '@/app/router'
import LibraryView from '@/features/library/LibraryView.vue'

describe('library routes', () => {
  it('uses the offline library and exposes editor and recording destinations', () => {
    const router = createAppRouter()

    expect(router.resolve('/library').matched[0]?.components?.default).toBe(LibraryView)
    expect(router.resolve('/scripts/script-id/edit').name).toBe('script-edit')
    expect(router.resolve('/scripts/script-id/record').name).toBe('script-record')
  })
})
