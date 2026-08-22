import { describe, expect, it } from 'vitest'

import { MergeCards } from '@/application/scripts/MergeCards'
import { ReorderCards } from '@/application/scripts/ReorderCards'
import { SplitCard } from '@/application/scripts/SplitCard'
import { UpdateCard } from '@/application/scripts/UpdateCard'
import { UpdateCues } from '@/application/scripts/UpdateCues'
import type { SaveScriptInput } from '@/application/scripts/SaveScriptAggregate'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptAggregate, ScriptCard } from '@/domain/scripts/types'

const now = '2026-08-06T10:00:00.000Z'

function card(
  id: string,
  position: number,
  title: string,
  fullText: string,
  contentHash: string,
): ScriptCard {
  return {
    id,
    scriptId: 'script-1',
    position,
    title,
    fullText,
    contentHash,
    version: 2,
    cueSet: {
      id: `cue-${id}`,
      cardId: id,
      cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'],
      sourceHash: contentHash,
      status: 'ready',
      generationId: 'generation-1',
      manuallyEdited: false,
      version: 1,
      createdAt: '2026-08-06T08:00:00.000Z',
      updatedAt: '2026-08-06T08:00:00.000Z',
    },
    createdAt: '2026-08-06T08:00:00.000Z',
    updatedAt: '2026-08-06T08:00:00.000Z',
    deletedAt: null,
  }
}

const aggregate: ScriptAggregate = {
  id: 'script-1',
  title: 'Сценарий',
  sourceFormat: 'markdown',
  sourceText: '# Сценарий',
  importHash: 'import-hash',
  serverVersion: 4,
  syncStatus: 'synced',
  cards: [
    card('card-a', 0, 'Первый', 'Первый текст.', 'hash-a'),
    card('card-b', 1, 'Второй', 'Второй текст.', 'hash-b'),
    card('card-c', 2, 'Третий', 'Третий текст.', 'hash-c'),
  ],
  lastOpenedAt: '2026-08-06T09:00:00.000Z',
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T09:00:00.000Z',
  deletedAt: null,
}

function harness() {
  let savedInput: SaveScriptInput | null = null
  const repository: ScriptRepository = {
    list: async () => [],
    get: async (id) => id === aggregate.id ? aggregate : null,
    save: async () => undefined,
    softDelete: async () => undefined,
  }
  const saver = {
    async execute(input: SaveScriptInput): Promise<ScriptAggregate> {
      savedInput = input
      return input.aggregate
    },
  }

  return {
    repository,
    saver,
    clock: { now: () => now },
    saved: () => savedInput,
  }
}

describe('card editing actions', () => {
  it('updates title and text, recalculates the hash, and retains stale cues', async () => {
    const context = harness()
    const action = new UpdateCard(context.repository, context.saver, context.clock)

    const result = await action.execute({
      scriptId: aggregate.id,
      cardId: 'card-a',
      title: '  Новый заголовок  ',
      fullText: 'Новый полный текст.',
    })

    expect(result.cards[0]).toMatchObject({
      title: 'Новый заголовок',
      fullText: 'Новый полный текст.',
      contentHash: 'deb6b9c8a783daa4dd25bde06698933cebace90b413eeef96cbee05739ffb910',
      updatedAt: now,
      cueSet: {
        cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'],
        sourceHash: 'hash-a',
        status: 'stale',
      },
    })
    expect(result).toMatchObject({ syncStatus: 'pending', updatedAt: now })
    expect(context.saved()).toEqual({ aggregate: result })
  })

  it('normalizes positions to the exact requested order', async () => {
    const context = harness()
    const action = new ReorderCards(context.repository, context.saver, context.clock)

    const result = await action.execute({
      scriptId: aggregate.id,
      orderedCardIds: ['card-c', 'card-a', 'card-b'],
    })

    expect(result.cards.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: 'card-c', position: 0 },
      { id: 'card-a', position: 1 },
      { id: 'card-b', position: 2 },
    ])
    expect(result.cards.every(({ updatedAt }) => updatedAt === now)).toBe(true)
    expect(context.saved()).toEqual({ aggregate: result })
  })

  it('rejects an incomplete or duplicate requested order without saving', async () => {
    const context = harness()
    const action = new ReorderCards(context.repository, context.saver, context.clock)

    await expect(action.execute({
      scriptId: aggregate.id,
      orderedCardIds: ['card-a', 'card-a', 'card-c'],
    })).rejects.toThrow('Card order must contain every card exactly once')
    expect(context.saved()).toBeNull()
  })

  it('splits at a Unicode code-point offset without breaking an emoji', async () => {
    const splitAggregate: ScriptAggregate = {
      ...aggregate,
      cards: [
        card('card-a', 0, 'Первый', 'Начало 🎬 финал', 'hash-a'),
        aggregate.cards[1]!,
      ],
    }
    const context = harness()
    context.repository.get = async () => splitAggregate
    const ids = ['card-new', 'cue-new']
    const action = new SplitCard(
      context.repository,
      context.saver,
      context.clock,
      () => ids.shift() ?? 'unexpected-id',
    )

    const result = await action.execute({
      scriptId: aggregate.id,
      cardId: 'card-a',
      offset: 9,
      nextTitle: '  Продолжение  ',
    })

    expect(result.cards).toHaveLength(3)
    expect(result.cards[0]).toMatchObject({
      id: 'card-a',
      position: 0,
      fullText: 'Начало 🎬',
      contentHash: '511d6798d609f4326eaab3d427727c03ed9cabce388646fd8b41beb13f66acf1',
      cueSet: { status: 'stale', cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'] },
    })
    expect(result.cards[1]).toMatchObject({
      id: 'card-new',
      scriptId: aggregate.id,
      position: 1,
      title: 'Продолжение',
      fullText: 'финал',
      contentHash: '11a73ce7c55191b3d04dcf4872a1a5d093b1f8b566f2720cd296c09268340b3e',
      version: 0,
      cueSet: {
        id: 'cue-new',
        cardId: 'card-new',
        cues: [],
        sourceHash: null,
        status: 'missing',
        manuallyEdited: false,
      },
    })
    expect(result.cards[2]).toMatchObject({ id: 'card-b', position: 2 })
  })

  it('merges a card with its next card and rejects merging the last card', async () => {
    const context = harness()
    const action = new MergeCards(context.repository, context.saver, context.clock)

    const result = await action.execute({ scriptId: aggregate.id, cardId: 'card-a' })

    expect(result.cards.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: 'card-a', position: 0 },
      { id: 'card-c', position: 1 },
    ])
    expect(result.cards[0]).toMatchObject({
      fullText: 'Первый текст.\n\nВторой текст.',
      contentHash: '557fae11287cb9e587e693617ddd64567e88f1119bb4e8ea877e73d8e9ed4437',
      cueSet: { status: 'stale', cues: ['Первый тезис', 'Второй тезис', 'Третий тезис'] },
    })

    await expect(action.execute({ scriptId: aggregate.id, cardId: 'card-c' }))
      .rejects.toThrow('Last card cannot be merged')
  })

  it('trims and saves one manual cue without changing full text', async () => {
    const context = harness()
    const action = new UpdateCues(context.repository, context.saver, context.clock)

    const result = await action.execute({
      scriptId: aggregate.id,
      cardId: 'card-a',
      cues: ['  Единственная опора  '],
    })

    expect(result.cards[0]).toMatchObject({
      fullText: 'Первый текст.',
      contentHash: 'hash-a',
      cueSet: {
        cues: ['Единственная опора'],
        sourceHash: 'hash-a',
        status: 'ready',
        manuallyEdited: true,
        version: 2,
        updatedAt: now,
      },
    })
    expect(context.saved()).toEqual({ aggregate: result })
  })

  it('saves more than five unique manual cues', async () => {
    const context = harness()
    const action = new UpdateCues(context.repository, context.saver, context.clock)
    const cues = ['Раз', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть']

    const result = await action.execute({ scriptId: aggregate.id, cardId: 'card-a', cues })

    expect(result.cards[0]?.cueSet.cues).toEqual(cues)
    expect(context.saved()).toEqual({ aggregate: result })
  })

  it.each([
    ['empty list', []],
    ['empty', ['Раз', 'Два', '   ']],
    ['duplicate', ['Раз', ' Раз ']],
    ['overlong', ['я'.repeat(201)]],
  ])('rejects %s manual cues without saving', async (_case, cues) => {
    const context = harness()
    const action = new UpdateCues(context.repository, context.saver, context.clock)

    await expect(action.execute({ scriptId: aggregate.id, cardId: 'card-a', cues }))
      .rejects.toThrow('Cues must contain unique non-empty strings up to 200 characters')
    expect(context.saved()).toBeNull()
  })
})
