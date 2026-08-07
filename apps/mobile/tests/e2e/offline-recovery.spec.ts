import { expect, test } from '@playwright/test'

import { installFakeBackend } from './fixtures/fakeBackend'

const ids = {
  script: '0198a70d-5c68-7a3f-8d8e-9d51b1e75431',
  card: '0198a70d-5c68-7a3f-8d8e-9d51b1e75432',
  cue: '0198a70d-5c68-7a3f-8d8e-9d51b1e75433',
  operation: '0198a70d-5c68-7a3f-8d8e-9d51b1e75434',
}
const timestamp = '2026-08-07T12:00:00.000Z'

function snapshot(title: string, version: number) {
  return {
    id: ids.script,
    title,
    sourceFormat: 'markdown',
    sourceText: '# Синтетический сценарий',
    importHash: 'synthetic-hash',
    serverVersion: version,
    syncStatus: 'pending',
    cards: [{
      id: ids.card, scriptId: ids.script, position: 0, title: 'Карточка',
      fullText: 'Синтетический полный текст.', contentHash: 'content-hash', version,
      cueSet: { id: ids.cue, cardId: ids.card, cues: [], sourceHash: null, status: 'missing', generationId: null, manuallyEdited: false, version: 0, createdAt: timestamp, updatedAt: timestamp },
      createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    }],
    lastOpenedAt: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  }
}

function transport(value: ReturnType<typeof snapshot>) {
  return {
    id: value.id, title: value.title, source_format: value.sourceFormat,
    source_text: value.sourceText, import_hash: value.importHash, status: 'ready',
    version: value.serverVersion, last_opened_at: null, updated_at: value.updatedAt,
    deleted_at: null,
    cards: value.cards.map((card) => ({
      id: card.id, script_id: card.scriptId, position: card.position, title: card.title,
      full_text: card.fullText, content_hash: card.contentHash, version: card.version,
      deleted_at: null,
      cue_set: {
        id: card.cueSet.id, card_id: card.cueSet.cardId, cues: [], source_hash: null,
        status: 'missing', generation_id: null, manually_edited: false, version: 0,
      },
    })),
  }
}

test('recovered outbox receives 409 and preserves server plus duplicated local script', async ({ page }) => {
  const local = snapshot('Локальная версия', 1)
  const server = snapshot('Серверная версия', 2)
  await installFakeBackend(page, {
    conflictOnce: { aggregateId: ids.script, local: transport(local), server: transport(server) },
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('author@example.test')
  await page.getByLabel('Пароль').fill('synthetic-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText('Все изменения синхронизированы')).toBeVisible()

  await page.evaluate(({ ids, local, timestamp }) => {
    localStorage.setItem('cue_cards.e2e.scripts', JSON.stringify([local]))
    localStorage.setItem('cue_cards.e2e.outbox', JSON.stringify([{
      operationId: ids.operation, aggregateId: ids.script, baseVersion: 1,
      type: 'script.replace', payload: local, createdAt: timestamp,
      state: 'in_flight', attempts: 0, nextAttemptAt: null,
    }]))
    localStorage.setItem('cue_cards.e2e.recording_sessions', JSON.stringify([{
      scriptId: ids.script, currentCardId: ids.card, mode: 'full', fontScale: 1.2,
      updatedAt: timestamp,
    }]))
  }, { ids, local, timestamp })

  await page.goto('/library')
  await page.getByRole('button', { name: 'Синхронизировать' }).click()
  await expect(page.getByText('Требуется разрешить конфликт')).toBeVisible()
  await page.getByRole('button', { name: 'Сравнить версии' }).click()
  await expect(page.getByText('Локальная версия')).toBeVisible()
  await expect(page.getByText('Серверная версия')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Локальная версия')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cue_cards.e2e.recording_sessions') ?? '[]'))).toHaveLength(1)

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
  })
  await page.getByRole('button', { name: 'Сохранить локальную как копию' }).click()
  await expect(page.getByText('Серверная версия')).toBeVisible()
  await expect(page.getByText('Локальная версия (копия)')).toBeVisible()
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('cue_cards.e2e.outbox') ?? '[]'))
  expect(pending).toHaveLength(1)
  expect(pending[0].payload.title).toBe('Локальная версия (копия)')
})
