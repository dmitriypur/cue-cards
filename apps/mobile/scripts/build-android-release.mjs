import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { verifyReleaseConfig } from './verify-release-config.mjs'

export function validateReleaseApiUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('VITE_API_BASE_URL is required for an Android release')
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid URL')
  }

  if (url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use HTTPS')
  }

  return url.href.replace(/\/$/u, '')
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    ...options,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

async function main() {
  const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const keyPropertiesPath = process.env.CUE_CARDS_KEY_PROPERTIES
    ?? resolve(mobileRoot, 'android/key.properties')
  const apiBaseUrl = validateReleaseApiUrl(process.env.VITE_API_BASE_URL)

  await verifyReleaseConfig({ keyPropertiesPath })
  process.stdout.write('Release API and signing configuration validated\n')

  const environment = {
    ...process.env,
    CUE_CARDS_KEY_PROPERTIES: keyPropertiesPath,
    VITE_API_BASE_URL: apiBaseUrl,
  }

  run('npm', ['run', 'build'], { cwd: mobileRoot, env: environment })
  run('npm', ['run', 'cap:sync'], { cwd: mobileRoot, env: environment })
  run('./gradlew', ['assembleRelease'], {
    cwd: resolve(mobileRoot, 'android'),
    env: environment,
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Android release build failed'}\n`)
    process.exitCode = 1
  })
}
