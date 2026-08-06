import { describe, expect, it } from 'vitest'

import { CapacitorSourceFilePicker } from '@/infrastructure/capacitor/CapacitorSourceFilePicker'

describe('CapacitorSourceFilePicker', () => {
  it('requests one text file and converts its base64 bytes to UTF-8', async () => {
    let requestedOptions: unknown
    const picker = new CapacitorSourceFilePicker({
      async pickFiles(options) {
        requestedOptions = options
        return {
          files: [{
            name: 'тест.md',
            mimeType: 'text/markdown',
            size: 8,
            data: '0KLQtdGB0YI=',
          }],
        }
      },
    })

    await expect(picker.pick()).resolves.toEqual({
      name: 'тест.md',
      mimeType: 'text/markdown',
      size: 8,
      text: 'Тест',
    })
    expect(requestedOptions).toEqual({
      limit: 1,
      readData: true,
      types: ['text/plain', 'text/markdown'],
    })
  })

  it('returns null when no file was selected', async () => {
    const picker = new CapacitorSourceFilePicker({
      async pickFiles() {
        return { files: [] }
      },
    })

    await expect(picker.pick()).resolves.toBeNull()
  })

  it('rejects data that is not valid UTF-8', async () => {
    const picker = new CapacitorSourceFilePicker({
      async pickFiles() {
        return {
          files: [{
            name: 'тест.txt',
            mimeType: 'text/plain',
            size: 2,
            data: '//4=',
          }],
        }
      },
    })

    await expect(picker.pick()).rejects.toThrow('Файл должен быть сохранён в UTF-8.')
  })
})
