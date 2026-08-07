import type { SourceFilePicker } from '@/application/ports/SourceFilePicker'
import type { SourceDocument } from '@/domain/import/types'

export class BrowserSourceFilePicker implements SourceFilePicker {
  public async pick(): Promise<SourceDocument | null> {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.txt,text/markdown,text/plain'
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
      input.click()
    })

    if (file === null) return null

    return {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      text: await file.text(),
    }
  }
}
