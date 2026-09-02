import { defaultThemeSchedulerTimeZone, resolveScheduledTheme } from '../shared/themes.js'
import { getActiveSiteTheme, saveActiveSiteTheme } from './database.js'

export async function runThemeScheduler(pool, { now = new Date(), timeZone = defaultThemeSchedulerTimeZone } = {}) {
  const activeTheme = resolveScheduledTheme({ date: now, timeZone })
  const previousTheme = await getActiveSiteTheme(pool)
  const changed = previousTheme !== activeTheme

  if (changed) {
    await saveActiveSiteTheme(pool, { activeTheme, updatedByUserId: null })
  }

  return { activeTheme, previousTheme, changed, timeZone }
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

export function nextThemeSchedulerRunAt(now = new Date(), timeZone = defaultThemeSchedulerTimeZone) {
  const candidate = new Date(now.getTime() + 60_000)
  candidate.setUTCSeconds(0, 0)
  for (let minute = 0; minute < 48 * 60; minute += 1) {
    const parts = zonedTimeParts(candidate, timeZone)
    if (parts.hour === '00' && parts.minute === '05') return candidate
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }
  throw new Error(`Could not find the next 00:05 run in ${timeZone}.`)
}
