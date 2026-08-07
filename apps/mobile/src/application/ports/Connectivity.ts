export type Unsubscribe = () => void

export interface Connectivity {
  current(): Promise<boolean>
  subscribe(listener: (online: boolean) => void): Unsubscribe
}
