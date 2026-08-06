import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('library semantic theme tokens', () => {
  it('defines a destructive foreground pair for light and dark surfaces', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')

    expect(styles).toContain('--color-destructive-foreground: var(--destructive-foreground)')
    expect(styles.match(/--destructive-foreground:/g)).toHaveLength(2)
  })
})
