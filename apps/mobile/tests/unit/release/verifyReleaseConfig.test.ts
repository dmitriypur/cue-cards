import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { verifyReleaseConfig } from '../../../scripts/verify-release-config.mjs'
import { validateReleaseApiUrl } from '../../../scripts/build-android-release.mjs'

async function fixture(): Promise<{ directory: string; keystore: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'cue-cards-release-'))
  const keystore = join(directory, 'cue-cards-release.jks')
  await writeFile(keystore, 'synthetic keystore placeholder')
  return { directory, keystore }
}

describe('verifyReleaseConfig', () => {
  it('rejects a missing key properties file', async () => {
    await expect(verifyReleaseConfig({
      keyPropertiesPath: join(tmpdir(), 'missing-cue-cards-key.properties'),
    })).rejects.toThrow('Signing properties file does not exist')
  })

  it('rejects a missing key alias', async () => {
    const { directory, keystore } = await fixture()
    const properties = join(directory, 'key.properties')
    await writeFile(properties, `storeFile=${keystore}\nstorePassword=secret\nkeyPassword=secret\n`)

    await expect(verifyReleaseConfig({ keyPropertiesPath: properties }))
      .rejects.toThrow('Missing signing field: keyAlias')
  })

  it('rejects a nonexistent keystore', async () => {
    const { directory } = await fixture()
    const properties = join(directory, 'key.properties')
    await writeFile(properties, [
      `storeFile=${join(directory, 'missing.jks')}`,
      'storePassword=secret',
      'keyAlias=cue-cards',
      'keyPassword=secret',
    ].join('\n'))

    await expect(verifyReleaseConfig({ keyPropertiesPath: properties }))
      .rejects.toThrow('Signing keystore does not exist')
  })

  it('rejects the Android debug keystore', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cue-cards-release-'))
    const keystore = join(directory, 'debug.keystore')
    const properties = join(directory, 'key.properties')
    await writeFile(keystore, 'debug placeholder')
    await writeFile(properties, [
      `storeFile=${keystore}`,
      'storePassword=android',
      'keyAlias=androiddebugkey',
      'keyPassword=android',
    ].join('\n'))

    await expect(verifyReleaseConfig({ keyPropertiesPath: properties }))
      .rejects.toThrow('Android debug signing material is not allowed')
  })

  it('accepts a complete external release configuration', async () => {
    const { directory, keystore } = await fixture()
    const properties = join(directory, 'key.properties')
    await writeFile(properties, [
      `storeFile=${keystore}`,
      'storePassword=secret',
      'keyAlias=cue-cards',
      'keyPassword=secret',
    ].join('\n'))

    await expect(verifyReleaseConfig({ keyPropertiesPath: properties }))
      .resolves.toMatchObject({ keyAlias: 'cue-cards' })
  })
})

describe('validateReleaseApiUrl', () => {
  it('rejects a missing production API URL', () => {
    expect(() => validateReleaseApiUrl(undefined)).toThrow('VITE_API_BASE_URL is required')
  })

  it('rejects a non-HTTPS API URL', () => {
    expect(() => validateReleaseApiUrl('http://cue-cards.web-func.ru'))
      .toThrow('VITE_API_BASE_URL must use HTTPS')
  })

  it('accepts the Cue Cards production API origin', () => {
    expect(validateReleaseApiUrl('https://cue-cards.web-func.ru'))
      .toBe('https://cue-cards.web-func.ru')
  })
})
