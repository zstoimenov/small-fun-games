import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Turn } from '../types'

const PANE = 'cost-meter'
const WARN_MS = 30_000

const turns = atom({ plugin: 'cost-meter', key: 'turns' } as const, [])
const total = atom({ plugin: 'cost-meter', key: 'total' } as const, 0)
const tick = atom({ plugin: 'cost-meter', key: 'tick' } as const, 0)
const isHidden = atom({ plugin: 'cost-meter', key: 'isHidden' } as const, false)

const tokens = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${n}`

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const hitRate = (t: Turn) => {
  const prompt = t.input + t.cacheRead + t.cacheWrite
  return prompt === 0 ? 0 : Math.round((t.cacheRead / prompt) * 100)
}

const timeOfDay = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const register: Register = (on, options) => {
  const audRate = typeof options.audRate === 'number' ? options.audRate : 1.52
  const ttlMs = options.cacheTtl === '1h' ? 3_600_000 : 300_000
  const warnToast = options.warnToast !== false
  const aud = (usd: number) => `A$${(usd * audRate).toFixed(usd * audRate < 1 ? 3 : 2)}`

  let isWorking = false
  let warnedFor = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cost-meter',
      description: 'Show per-turn cost history and tips in a pane',
    })

    // Cost already spent before the meter loaded is not the first turn's.
    if ((await read($, turns)).length === 0) {
      const usd = (await $.session.usage()).cost?.usd ?? 0
      await update($, total, () => usd)
    }

    $.clock.every(1000, async () => {
      const last = (await read($, turns)).at(-1)
      if (!last || isWorking) {
        return
      }
      const now = await $.clock.now()
      const left = last.endedAt + ttlMs - now
      if (left > -2000) {
        await update($, tick, () => now)
      }
      if (warnToast && left > 0 && left <= WARN_MS && warnedFor !== last.endedAt) {
        warnedFor = last.endedAt
        $.ui.toast(`Prompt cache goes cold in ${Math.ceil(left / 1000)}s`, { timeoutMs: 8000 })
      }
    })

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    isWorking = true

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) {
      return result
    }
    isWorking = false

    const usd = (await $.session.usage()).cost?.usd ?? 0
    const before = await read($, total)
    const turn: Turn = {
      endedAt: await $.clock.now(),
      durationMs: e.durationMs,
      model: e.usage?.model ?? 'unknown',
      usd: Math.max(0, usd - before),
      input: e.usage?.input_tokens ?? 0,
      output: e.usage?.output_tokens ?? 0,
      cacheRead: e.usage?.cache_read_input_tokens ?? 0,
      cacheWrite: e.usage?.cache_creation_input_tokens ?? 0,
    }
    await update($, total, () => usd)
    await update($, turns, list => [...list, turn].slice(-100))

    return result
  })

  on('command.run', { command: 'cost-meter' }, async $ => {
    await update($, isHidden, () => false)
    await $.ui.open({ id: PANE, title: 'Cost meter' })

    return { text: 'Cost meter pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, turns)
    const last = list.at(-1)
    if (e.props.hasSurvey || !last || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = (await read($, tick)) || last.endedAt
    const left = last.endedAt + ttlMs - now
    const cache = e.props.isWorking
      ? { text: 'cache in use', color: undefined }
      : left <= 0
        ? { text: 'cache cold: next turn re-sends everything', color: 'red' }
        : { text: `cache warm ${clock(left)}`, color: left <= WARN_MS ? 'yellow' : 'green' }

    return (
      <Box>
        <Text dimColor>
          Last turn {aud(last.usd)} · {tokens(last.input + last.cacheRead + last.cacheWrite)} in /{' '}
          {tokens(last.output)} out · {hitRate(last)}% cached · session {aud(await read($, total))} ·{' '}
        </Text>
        <Text color={cache.color}>{cache.text} </Text>
        <Button key="open" label="Details" onPress={() => $.ui.open({ id: PANE, title: 'Cost meter' })} />
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, turns)
    const sum = list.reduce((acc, t) => acc + t.usd, 0)
    const avg = list.length === 0 ? 0 : sum / list.length
    const priciest = list.reduce<Turn | null>((top, t) => (!top || t.usd > top.usd ? t : top), null)
    const coldTurns = list.filter(t => t.cacheWrite > t.cacheRead && t.input + t.cacheWrite > 20_000)
    const room = Math.max(3, (e.viewport?.rows ?? 24) - 14)

    return (
      <Box flexDirection="column">
        <Text bold>
          Session {aud(await read($, total))} · {list.length} turns · avg {aud(avg)}/turn
        </Text>
        <Text dimColor>
          AUD rate {audRate} · cache TTL {ttlMs === 3_600_000 ? '1h' : '5m'}
        </Text>
        <Text> </Text>
        {list.length === 0 && <Text dimColor>No turns yet.</Text>}
        {list.length > 0 && <Text dimColor>time   cost       in      out   cached  model</Text>}
        {list
          .slice(-room)
          .reverse()
          .map(t => (
            <Text color={t === priciest ? 'yellow' : undefined}>
              {timeOfDay(t.endedAt)}  {aud(t.usd).padEnd(9)} {tokens(t.input + t.cacheRead + t.cacheWrite).padStart(6)}{' '}
              {tokens(t.output).padStart(6)}   {String(hitRate(t)).padStart(3)}%   {t.model}
            </Text>
          ))}
        <Text> </Text>
        <Text bold>Tips</Text>
        {coldTurns.length > 0 && (
          <Text>
            · {coldTurns.length} turn(s) rebuilt the cache. Replying within{' '}
            {ttlMs === 3_600_000 ? 'the hour' : '5 minutes'} keeps it warm and cheap.
          </Text>
        )}
        {priciest && priciest.usd > avg * 2 && list.length > 2 && (
          <Text>· Your priciest turn ({aud(priciest.usd)}) was over twice the average.</Text>
        )}
        <Text>· /compact shrinks a long conversation so every later turn re-sends less.</Text>
        <Text>· Start a new session for an unrelated task instead of growing this one.</Text>
      </Box>
    )
  })
}
