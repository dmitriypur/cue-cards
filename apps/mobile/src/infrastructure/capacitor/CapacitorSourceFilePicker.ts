import {
  FilePicker,
  type PickFilesOptions,
  type PickFilesResult,
} from '@capawesome/capacitor-file-picker'

import type { SourceFilePicker } from '@/application/ports/SourceFilePicker'
import type { SourceDocument } from '@/domain/import/types'

interface NativeFilePicker {
  pickFiles(options?: PickFilesOptions): Promise<PickFilesResult>
}

function decodeUtf8(data: string): string {
  const binary = atob(data)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Файл должен быть сохранён в UTF-8.')
  }
}

export class CapacitorSourceFilePicker implements SourceFilePicker {
  private readonly nativePicker: NativeFilePicker

  public constructor(nativePicker: NativeFilePicker = FilePicker) {
    this.nativePicker = nativePicker
  }

  public async pick(): Promise<SourceDocument | null> {
    const result = await this.nativePicker.pickFiles({
      limit: 1,
      readData: true,
      types: ['text/plain', 'text/markdown'],
    })
    const file = result.files[0]
    if (file === undefined) return null

    let text: string
    if (file.data !== undefined) {
      text = decodeUtf8(file.data)
    } else if (file.blob !== undefined) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer())
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        throw new Error('Файл должен быть сохранён в UTF-8.')
      }
    } else {
      throw new Error('Не удалось прочитать выбранный файл.')
    }

    return {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      text,
    }
  }
}
