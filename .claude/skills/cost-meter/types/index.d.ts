export type Turn = {
  endedAt: number
  durationMs: number
  model: string
  usd: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

declare module 'claude-code' {
  interface PluginState {
    'cost-meter': {
      turns: Turn[]
      total: number
      tick: number
      isHidden: boolean
    }
  }
}
