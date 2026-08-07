import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

import { installFakeBackend } from './fixtures/fakeBackend'

async function assertControls(page: Page): Promise<void> {
  const controls = page.locator('button, input, select, textarea, a[href]')
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index)
    if (!await control.isVisible()) continue
    await expect(control).toHaveAccessibleName(/.+/)
  }
  const boxes = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect()
    return box.width === 0 || box.height === 0 ? [] : [{ tag: element.tagName, width: box.width, height: box.height }]
  }))
  for (const [index, box] of boxes.entries()) {
    expect(box.width, `${box.tag} ${index} width`).toBeGreaterThanOrEqual(48)
    expect(box.height, `${box.tag} ${index} height`).toBeGreaterThanOrEqual(48)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
}

async function assertSemanticContrast(page: Page, dark: boolean): Promise<void> {
  await page.locator('html').evaluate((element, enabled) => element.classList.toggle('dark', enabled), dark)
  const ratios = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    const pairs = [
      ['--background', '--foreground'], ['--card', '--card-foreground'],
      ['--surface', '--surface-foreground'], ['--popover', '--popover-foreground'],
      ['--primary', '--primary-foreground'], ['--secondary', '--secondary-foreground'],
      ['--muted', '--muted-foreground'], ['--accent', '--accent-foreground'],
      ['--destructive', '--destructive-foreground'], ['--sidebar', '--sidebar-foreground'],
      ['--sidebar-primary', '--sidebar-primary-foreground'],
      ['--sidebar-accent', '--sidebar-accent-foreground'],
    ] as const
    const luminance = (value: string): number => {
      const [lightness = 0, chroma = 0, hue = 0] = value
        .match(/-?\d+(?:\.\d+)?/gu)?.slice(0, 3).map(Number) ?? []
      const radians = hue * Math.PI / 180
      const a = chroma * Math.cos(radians)
      const b = chroma * Math.sin(radians)
      const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
      const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
      const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
      const red = Math.min(1, Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))
      const green = Math.min(1, Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))
      const blue = Math.min(1, Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }
    return pairs.map(([background, foreground]) => {
      const left = luminance(styles.getPropertyValue(background))
      const right = luminance(styles.getPropertyValue(foreground))
      return { pair: `${background}/${foreground}`, ratio: (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05) }
    })
  })
  for (const { pair, ratio } of ratios) expect(ratio, `${dark ? 'dark' : 'light'} ${pair}`).toBeGreaterThanOrEqual(4.5)
}

test('representative flows remain accessible at 320px, enlarged text, and both themes', async ({ page }) => {
  await installFakeBackend(page)
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.evaluate(() => { document.documentElement.style.fontSize = '22.4px' })
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus')
  await expect(focused).toHaveAccessibleName(/.+/)
  await expect(focused).toHaveCSS('outline-style', /^(auto|solid)$/)
  await assertControls(page)
  await assertSemanticContrast(page, false)
  await assertSemanticContrast(page, true)

  await page.getByLabel('Email').fill('author@example.test')
  await page.getByLabel('Пароль').fill('synthetic-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText('Все изменения синхронизированы')).toBeVisible()
  await assertControls(page)
  await page.getByRole('button', { name: 'Импортировать сценарий' }).click()
  await assertControls(page)
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Выбрать файл' }).click()
  await (await chooserPromise).setFiles(fileURLToPath(new URL('../fixtures/script-structured.md', import.meta.url)))
  await assertControls(page)
  await page.getByRole('button', { name: 'Сохранить без ИИ' }).click()
  await page.getByRole('button', { name: 'Изменить' }).click()
  await assertControls(page)
  await page.goto('/library')
  await page.getByRole('button', { name: 'Начать запись' }).click()
  await assertControls(page)
})
