export const defaultThemeKey = 'default'
export const defaultThemeSchedulerTimeZone = 'Europe/Bucharest'

export const seasonalThemes = [
  { key: 'valentines-day', name: "Valentine's Day", emoji: '💕', date: '14 February', period: '7–14 Feb', available: false },
  { key: 'lunar-new-year', name: 'Lunar New Year', emoji: '🧧', date: '17 February', period: '14–22 Feb', available: false },
  { key: 'spring', name: 'Spring Theme', emoji: '🌸', date: '1 March', period: '1–7 Mar', available: false },
  { key: 'st-patricks-day', name: "St. Patrick's Day", emoji: '☘️', date: '17 March', period: '15–17 Mar', available: false },
  { key: 'april-fools-day', name: "April Fools' Day", emoji: '🤡', date: '1 April', period: '1 Apr only', available: false },
  { key: 'orthodox-easter', name: 'Orthodox Easter', emoji: '🐣', date: '2 May', period: '1–4 May', available: false },
  { key: 'summer', name: 'Summer Theme', emoji: '🌞', date: '1 June', period: '1–10 June', available: false },
  {
    key: 'autumn',
    name: 'Autumn Theme',
    emoji: '🍂',
    date: '1 September',
    period: '1–10 Sep',
    schedule: { startsOn: '09-01', endsOn: '09-10' },
    tmdbKeyword: 'autumn',
    available: true,
  },
  { key: 'halloween', name: 'Halloween', emoji: '👻', date: '31 October', period: '20–31 Oct', available: false },
  { key: 'winter', name: 'Winter Theme', emoji: '❄️', date: '1 December', period: '1–27 Dec', available: false },
  { key: 'new-years-eve', name: "New Year's Eve", emoji: '🎆', date: '31 December', period: '28 Dec–3 Jan', available: false },
]

export const availableThemeKeys = new Set([
  defaultThemeKey,
  ...seasonalThemes.filter((theme) => theme.available).map((theme) => theme.key),
])

export function isAvailableTheme(themeKey) {
  return typeof themeKey === 'string' && availableThemeKeys.has(themeKey)
}

export function getSeasonalTheme(themeKey) {
  return seasonalThemes.find((theme) => theme.key === themeKey) ?? null
}

export function normalizeActiveTheme(themeKey) {
  return isAvailableTheme(themeKey) ? themeKey : defaultThemeKey
}

function parseMonthDay(value) {
  const match = typeof value === 'string' ? /^(\d{2})-(\d{2})$/.exec(value) : null
  if (!match) throw new Error(`Invalid seasonal theme date: ${value}`)
  const month = Number(match[1])
  const day = Number(match[2])
  const date = new Date(Date.UTC(2024, month - 1, day))
  if (month < 1 || month > 12 || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid seasonal theme date: ${value}`)
  }
  return month * 100 + day
}

function isMonthDayInPeriod(monthDay, startsOn, endsOn) {
  const start = parseMonthDay(startsOn)
  const end = parseMonthDay(endsOn)
  return start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end
}

function getZonedMonthDay(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]))
  return Number(parts.month) * 100 + Number(parts.day)
}

export function validateScheduledThemes(themes = seasonalThemes) {
  const scheduledThemes = themes.filter((theme) => theme.available)
  const claimedDays = new Map()

  for (const theme of scheduledThemes) {
    if (!theme.schedule) throw new Error(`Available seasonal theme ${theme.key} requires a schedule.`)
    const { startsOn, endsOn } = theme.schedule
    parseMonthDay(startsOn)
    parseMonthDay(endsOn)
    for (let month = 1; month <= 12; month += 1) {
      const daysInMonth = new Date(Date.UTC(2024, month, 0)).getUTCDate()
      for (let day = 1; day <= daysInMonth; day += 1) {
        const monthDay = month * 100 + day
        if (!isMonthDayInPeriod(monthDay, startsOn, endsOn)) continue
        const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (claimedDays.has(dateKey)) {
          throw new Error(`Seasonal theme schedules overlap: ${claimedDays.get(dateKey)} and ${theme.key}.`)
        }
        claimedDays.set(dateKey, theme.key)
      }
    }
  }
}

export function resolveScheduledTheme({ date = new Date(), timeZone = defaultThemeSchedulerTimeZone, themes = seasonalThemes } = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('A valid date is required to resolve a seasonal theme.')
  validateScheduledThemes(themes)
  const monthDay = getZonedMonthDay(date, timeZone)
  const matchingTheme = themes.find((theme) => theme.available && theme.schedule && isMonthDayInPeriod(monthDay, theme.schedule.startsOn, theme.schedule.endsOn))
  return matchingTheme?.key ?? defaultThemeKey
}
