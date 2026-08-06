import { ref } from 'vue'

interface Point {
  readonly x: number
  readonly y: number
}

export function useHorizontalSwipe(
  onPrevious: () => void,
  onNext: () => void,
) {
  const start = ref<Point | null>(null)

  function onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0]
    start.value = touch === undefined ? null : { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(event: TouchEvent): void {
    const origin = start.value
    start.value = null
    const touch = event.changedTouches[0]
    if (origin === null || touch === undefined) return
    const horizontal = touch.clientX - origin.x
    const vertical = touch.clientY - origin.y
    if (Math.abs(horizontal) < 60 || Math.abs(horizontal) < Math.abs(vertical) * 1.5) return
    if (horizontal < 0) onNext()
    else onPrevious()
  }

  return { onTouchStart, onTouchEnd }
}
