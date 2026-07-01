import { MATCH_BY_ID, flag } from './fixtures'
import { sendPush, type SendPushResult, type PushPayload } from './push'

export type ResultPushInput = {
  matchId: number
  h: number
  a: number
}

export function resultPushPayload(result: ResultPushInput): PushPayload {
  const fixture = MATCH_BY_ID[result.matchId]
  const title = fixture
    ? `${flag(fixture.home)} ${fixture.home} ${result.h}:${result.a} ${fixture.away} ${flag(fixture.away)}`
    : `#${result.matchId} eredmény: ${result.h}:${result.a}`
  return {
    title,
    body: 'Új eredmény került be, a pontok frissültek.',
    tag: `result-${result.matchId}`,
    url: `/meccs-center?match=${result.matchId}`
  }
}

export function aggregateResultPushPayload(results: ResultPushInput[]): PushPayload {
  if (results.length === 1) return resultPushPayload(results[0])
  return {
    title: `${results.length} új eredmény`,
    body: 'Több mérkőzés eredménye frissült, a pontok újraszámolódtak.',
    tag: 'results-updated',
    url: '/meccs-center'
  }
}

export async function sendResultPush(results: ResultPushInput[]): Promise<SendPushResult> {
  if (results.length === 0) return { ok: true, sent: 0, failed: 0 }
  return sendPush(aggregateResultPushPayload(results))
}
