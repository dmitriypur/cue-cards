import type { InjectionKey } from 'vue'

import type { FinishRecording } from '@/application/recording/FinishRecording'
import type { MoveRecordingCursor, MoveRecordingCursorInput } from '@/application/recording/MoveRecordingCursor'
import type { StartRecording, StartRecordingInput } from '@/application/recording/StartRecording'
import type { UpdateRecordingDisplay, UpdateRecordingDisplayInput } from '@/application/recording/UpdateRecordingDisplay'
import type { RecordingSession } from '@/application/ports/RecordingSessionRepository'
import type { WakeLock } from '@/application/ports/WakeLock'
import type { ScriptAggregate, UUID } from '@/domain/scripts/types'

export interface RecordingDependencies {
  readonly loadScript: { execute(scriptId: UUID): Promise<ScriptAggregate> }
  loadSession(scriptId: UUID): Promise<RecordingSession | null>
  readonly startRecording: Pick<StartRecording, 'execute'> & {
    execute(input: StartRecordingInput): Promise<RecordingSession>
  }
  readonly moveRecordingCursor: Pick<MoveRecordingCursor, 'execute'> & {
    execute(input: MoveRecordingCursorInput): Promise<RecordingSession>
  }
  readonly updateRecordingDisplay: Pick<UpdateRecordingDisplay, 'execute'> & {
    execute(input: UpdateRecordingDisplayInput): Promise<RecordingSession>
  }
  readonly finishRecording: Pick<FinishRecording, 'execute'>
  readonly wakeLock: WakeLock
  onAppStateChange(listener: (isActive: boolean) => void | Promise<void>): () => void
  openLibrary(): Promise<void>
}

export const recordingDependenciesKey: InjectionKey<RecordingDependencies> = Symbol('recording-dependencies')
