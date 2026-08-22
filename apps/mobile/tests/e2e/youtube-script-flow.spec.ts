import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

import { installFakeBackend } from './fixtures/fakeBackend'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('author imports, edits offline, reconnects, syncs, and restores recording', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => localStorage.getItem('cue_cards.e2e.online') !== 'false',
    })
  })
  const backend = await installFakeBackend(page)
  await page.goto('/login')

  await page.getByLabel('Email').fill('author@example.test')
  await page.getByLabel('Пароль').fill('synthetic-password')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible()
  await expect(page.getByText('Сценариев пока нет')).toBeVisible()

  await page.getByRole('button', { name: 'Импортировать сценарий' }).click()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Выбрать файл' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(fileURLToPath(new URL('../fixtures/script-structured.md', import.meta.url)))

  await expect(page.getByRole('heading', { name: 'Предпросмотр импорта' })).toBeVisible()
  await expect(page.getByLabel('Название сценария')).toHaveValue('Сценарий о внимании')
  await page.getByLabel('Название сценария').fill('Сценарий о внимании — исправлен')
  await page.getByRole('button', { name: 'Сохранить без ИИ' }).click()

  await expect(page).toHaveURL(/\/library\?created=/)
  await expect(page.getByText('Сценарий о внимании — исправлен')).toBeVisible()

  await page.getByRole('button', { name: 'Изменить' }).click()
  await expect(page.getByRole('heading', { name: 'Сценарий о внимании' })).toBeVisible()
  await page.getByRole('button', { name: 'Создать тезисы для сценария' }).click()
  await expect(page.getByText('Тезисы готовы').first()).toBeVisible()
  await expect(page.locator('[data-card-id]').first().locator('[data-cue-input]')).toHaveCount(6)
  await page.getByRole('button', { name: 'Переместить карточку вниз' }).first().click()
  await expect(page.getByLabel('Заголовок').first()).toHaveValue('Основная мысль')

  await page.evaluate(() => {
    localStorage.setItem('cue_cards.e2e.online', 'false')
    globalThis.dispatchEvent(new Event('offline'))
  })
  await page.getByLabel('Заголовок').nth(1).fill('Крючок обновлён')
  await expect(page.getByRole('status').filter({ hasText: 'Сохранено локально' })).toBeVisible()
  await expect(page.getByText('Офлайн — изменения сохранены на устройстве')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Заголовок').nth(1)).toHaveValue('Крючок обновлён')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cue_cards.e2e.outbox') ?? '[]').length)).toBe(1)

  await page.evaluate(() => {
    localStorage.setItem('cue_cards.e2e.online', 'true')
    globalThis.dispatchEvent(new Event('online'))
  })
  await expect(page.getByText('Все изменения синхронизированы')).toBeVisible()
  await expect.poll(() => backend.submissions.length).toBeGreaterThan(0)
  expect(JSON.stringify(backend.submissions.at(-1)?.payload)).toContain('Крючок обновлён')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cue_cards.e2e.outbox') ?? '[]').length)).toBe(0)
  const syncedScript = await page.evaluate(() => JSON.parse(localStorage.getItem('cue_cards.e2e.scripts') ?? '[]')[0])
  expect(syncedScript.serverVersion).toBeGreaterThan(0)
  expect(syncedScript.syncStatus).toBe('synced')

  await page.goto('/library')
  await page.getByRole('button', { name: 'Начать запись' }).click()
  await expect(page.getByRole('heading', { name: 'Настройка записи' })).toBeVisible()
  await page.getByRole('button', { name: 'Начать запись' }).click()
  await expect(page.locator('[data-recording-content]')).toContainText('Ключевая мысль')
  await expect(page.locator('[data-recording-content]')).toContainText('Связный переход')
  await page.getByRole('button', { name: 'Показать полный текст' }).first().click()
  await expect(page.locator('[data-recording-content]')).toContainText('Сначала покажите результат')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Основная мысль' })).toBeVisible()
  await expect(page.locator('[data-recording-content]')).toContainText('Сначала покажите результат')
})
