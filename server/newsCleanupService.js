import { deleteExpiredUnretainedNewsArticles } from './database.js'

export const newsRetentionDays = 7
export const defaultNewsCleanupTimeZone = 'Europe/Bucharest'

export async function runNewsCleanup(pool, { now = new Date() } = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('A valid cleanup time is required.')
  const cutoff = new Date(now.getTime() - newsRetentionDays * 24 * 60 * 60 * 1000)
  const deletedCount = await deleteExpiredUnretainedNewsArticles(pool, { cutoff })
  return { deletedCount, cutoff: cutoff.toISOString() }
}

function zonedTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]))
}

export function nextNewsCleanupRunAt(now = new Date(), timeZone = defaultNewsCleanupTimeZone) {
  const candidate = new Date(now.getTime() + 60_000)
  candidate.setUTCSeconds(0, 0)
  for (let minute = 0; minute < 48 * 60; minute += 1) {
    const parts = zonedTimeParts(candidate, timeZone)
    if (parts.hour === '00' && parts.minute === '10') return candidate
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }
  throw new Error(`Could not find the next 00:10 run in ${timeZone}.`)
}
