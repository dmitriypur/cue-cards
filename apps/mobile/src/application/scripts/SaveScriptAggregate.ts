import { v7 as uuidv7 } from 'uuid'

import type { OutboxRepository } from '@/application/ports/OutboxRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'

export interface SaveScriptInput {
  readonly aggregate: ScriptAggregate
}

export interface Clock {
  now(): string
}

const systemClock: Clock = {
  now: () => new Date().toISOString(),
}

export class SaveScriptAggregate {
  private readonly scripts: ScriptRepository
  private readonly outbox: OutboxRepository
  private readonly unitOfWork: LocalUnitOfWork
  private readonly clock: Clock
  private readonly createOperationId: () => UUID

  public constructor(
    scripts: ScriptRepository,
    outbox: OutboxRepository,
    unitOfWork: LocalUnitOfWork,
    clock: Clock = systemClock,
    createOperationId: () => UUID = uuidv7,
  ) {
    this.scripts = scripts
    this.outbox = outbox
    this.unitOfWork = unitOfWork
    this.clock = clock
    this.createOperationId = createOperationId
  }

  public execute(input: SaveScriptInput): Promise<ScriptAggregate> {
    return this.unitOfWork.run(async (tx) => {
      await this.scripts.save(input.aggregate, tx)
      await this.outbox.upsertLatestSnapshot(
        {
          operationId: this.createOperationId(),
          aggregateId: input.aggregate.id,
          baseVersion: input.aggregate.serverVersion,
          type: 'script.replace',
          payload: input.aggregate,
          createdAt: this.clock.now(),
        },
        tx,
      )

      return input.aggregate
    })
  }
}
