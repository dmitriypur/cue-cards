import { access, readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REQUIRED_FIELDS = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']

export async function verifyReleaseConfig({ keyPropertiesPath }) {
  const resolvedProperties = resolve(keyPropertiesPath)
  await requireFile(resolvedProperties, 'Signing properties file does not exist')

  const values = parseProperties(await readFile(resolvedProperties, 'utf8'))
  for (const field of REQUIRED_FIELDS) {
    if (typeof values[field] !== 'string' || values[field].trim() === '') {
      throw new Error(`Missing signing field: ${field}`)
    }
  }

  const configuredStoreFile = values.storeFile.trim()
  const storeFile = isAbsolute(configuredStoreFile)
    ? configuredStoreFile
    : resolve(dirname(resolvedProperties), configuredStoreFile)
  await requireFile(storeFile, 'Signing keystore does not exist')

  if (
    basename(storeFile).toLowerCase() === 'debug.keystore'
    || values.keyAlias.trim().toLowerCase() === 'androiddebugkey'
  ) {
    throw new Error('Android debug signing material is not allowed')
  }

  return {
    storeFile,
    storePassword: values.storePassword,
    keyAlias: values.keyAlias.trim(),
    keyPassword: values.keyPassword,
    keyPropertiesPath: resolvedProperties,
  }
}

function parseProperties(contents) {
  const values = {}
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return values
}

async function requireFile(path, message) {
  try {
    await access(path)
  } catch {
    throw new Error(message)
  }
}

async function main() {
  const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const keyPropertiesPath = process.env.CUE_CARDS_KEY_PROPERTIES
    ?? resolve(mobileRoot, 'android/key.properties')
  await verifyReleaseConfig({ keyPropertiesPath })
  process.stdout.write(`Release signing fields validated: ${REQUIRED_FIELDS.join(', ')}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Release configuration is invalid'}\n`)
    process.exitCode = 1
  })
}
