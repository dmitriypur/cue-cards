import type { OutboxRepository } from '@/application/ports/OutboxRepository'
import type { ScriptRepository } from '@/application/ports/ScriptRepository'
import type { SyncPage } from '@/application/ports/SyncGateway'
import type { SyncStateRepository } from '@/application/ports/SyncStateRepository'
import type { ScriptAggregate, ScriptCard } from '@/domain/scripts/types'
import { LocalUnitOfWork } from '@/infrastructure/sqlite/LocalUnitOfWork'
import type { SqlTransaction } from '@/infrastructure/sqlite/SqlDriver'

export class ApplyRemoteChanges {
  private readonly scripts: ScriptRepository
  private readonly outbox: OutboxRepository
  private readonly syncState: SyncStateRepository
  private readonly unitOfWork: LocalUnitOfWork

  public constructor(
    scripts: ScriptRepository,
    outbox: OutboxRepository,
    syncState: SyncStateRepository,
    unitOfWork: LocalUnitOfWork,
  ) {
    this.scripts = scripts
    this.outbox = outbox
    this.syncState = syncState
    this.unitOfWork = unitOfWork
  }

  public execute(page: SyncPage): Promise<void> {
    return this.unitOfWork.run(async (tx) => {
      for (const change of page.changes) {
        await this.applyChange(change.snapshot, change.version, tx)
      }
      await this.syncState.setCursor(page.nextCursor, tx)
    })
  }

  private async applyChange(
    remote: ScriptAggregate,
    version: number,
    tx: SqlTransaction,
  ): Promise<void> {
    const local = await this.scripts.get(remote.id, tx)
    if (local !== null && version <= local.serverVersion) return

    const hasLocalCommand = await this.outbox.hasForAggregate(remote.id, tx)
    if (local === null || !hasLocalCommand) {
      await this.scripts.save({
        ...remote,
        serverVersion: version,
        syncStatus: 'synced',
      }, tx)
      return
    }

    await this.scripts.save({
      ...local,
      serverVersion: version,
      syncStatus: 'pending',
      cards: local.cards.map((card) => this.mergeSafeCueSet(card, remote)),
    }, tx)
  }

  private mergeSafeCueSet(card: ScriptCard, remote: ScriptAggregate): ScriptCard {
    const remoteCard = remote.cards.find(({ id }) => id === card.id)
    if (remoteCard === undefined) return card
    const remoteCues = remoteCard.cueSet
    if (
      card.cueSet.manuallyEdited
      || remoteCues.sourceHash !== card.contentHash
      || remoteCues.version <= card.cueSet.version
    ) return card

    return { ...card, cueSet: remoteCues }
  }
}
