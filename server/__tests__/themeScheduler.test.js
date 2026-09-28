import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp, sessionCookieFor } from './sessionTestHelpers.js'
import { getSeasonalThemesWithSavedSchedules } from '../database.js'
import { runThemeScheduler } from '../themeScheduler.js'
import { defaultThemeKey, resolveScheduledTheme, seasonalThemes, validateScheduledThemes } from '../../shared/themes.js'

function date(value) {
  return new Date(value)
}

function createThemePool(initialTheme = defaultThemeKey, initialSchedules = []) {
  let activeTheme = initialTheme
  const calls = []
  const schedules = new Map(initialSchedules)
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql.includes('SELECT theme_key, starts_on, ends_on FROM seasonal_theme_schedules')) {
        return { rows: [...schedules].map(([theme_key, schedule]) => ({ theme_key, starts_on: schedule.startsOn, ends_on: schedule.endsOn })) }
      }
      if (sql.includes('INSERT INTO seasonal_theme_schedules')) {
        schedules.set(params[0], { startsOn: params[1], endsOn: params[2] })
        return { rows: [{ theme_key: params[0], starts_on: params[1], ends_on: params[2] }] }
      }
      if (sql.includes('SELECT active_theme')) return { rows: [{ active_theme: activeTheme }] }
      if (sql.includes('RETURNING active_theme')) {
        activeTheme = params[0]
        return { rows: [{ active_theme: activeTheme }] }
      }
      if (sql.includes('INSERT INTO admin_job_executions')) {
        return { rows: [{ last_executed_at: '2026-09-04T12:00:00.000Z' }] }
      }
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) {
        return { rows: [{ id: 17, username: params[0], full_name: 'Florin' }] }
      }
      return { rows: [] }
    },
  }
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('seasonal theme resolver honors Autumn boundaries in Bucharest', () => {
  assert.equal(resolveScheduledTheme({ date: date('2026-08-31T20:59:00Z') }), 'default')
  assert.equal(resolveScheduledTheme({ date: date('2026-08-31T21:00:00Z') }), 'autumn')
  assert.equal(resolveScheduledTheme({ date: date('2026-09-10T20:59:00Z') }), 'autumn')
  assert.equal(resolveScheduledTheme({ date: date('2026-09-10T21:00:00Z') }), 'default')
})

test('seasonal theme resolver honors Halloween boundaries in Bucharest', () => {
  assert.equal(resolveScheduledTheme({ date: date('2026-10-19T20:59:00Z') }), 'default')
  assert.equal(resolveScheduledTheme({ date: date('2026-10-19T21:00:00Z') }), 'halloween')
  assert.equal(resolveScheduledTheme({ date: date('2026-10-31T21:59:00Z') }), 'halloween')
  assert.equal(resolveScheduledTheme({ date: date('2026-10-31T22:00:00Z') }), 'default')
})

test('available Autumn and Halloween schedules do not overlap', () => {
  assert.ok(seasonalThemes.every((theme) => theme.schedule?.startsOn && theme.schedule?.endsOn))
  assert.deepEqual(seasonalThemes.find(({ key }) => key === 'new-years-eve').schedule, { startsOn: '12-28', endsOn: '01-03' })
  assert.doesNotThrow(() => validateScheduledThemes())
})

test('seasonal theme resolver uses the requested timezone and supports cross-year periods', () => {
  const instant = date('2026-08-31T22:30:00Z')
  assert.equal(resolveScheduledTheme({ date: instant, timeZone: 'UTC' }), 'default')
  assert.equal(resolveScheduledTheme({ date: instant, timeZone: 'Europe/Bucharest' }), 'autumn')

  const crossYearThemes = [{ key: 'new-years', available: true, schedule: { startsOn: '12-28', endsOn: '01-03' } }]
  assert.equal(resolveScheduledTheme({ date: date('2026-12-31T12:00:00Z'), themes: crossYearThemes }), 'new-years')
  assert.equal(resolveScheduledTheme({ date: date('2027-01-03T12:00:00Z'), themes: crossYearThemes }), 'new-years')
  assert.equal(resolveScheduledTheme({ date: date('2027-01-04T12:00:00Z'), themes: crossYearThemes }), 'default')
  assert.throws(() => validateScheduledThemes([
    ...crossYearThemes,
    { key: 'january', available: true, schedule: { startsOn: '01-02', endsOn: '01-04' } },
  ]), /overlap/i)
})

test('unavailable themes are ignored and enabled overlapping periods are rejected', () => {
  const themes = [
    { key: 'available', available: true, schedule: { startsOn: '09-01', endsOn: '09-10' } },
    { key: 'coming-soon', available: false, schedule: { startsOn: '09-01', endsOn: '09-10' } },
  ]
  assert.equal(resolveScheduledTheme({ date: date('2026-09-05T12:00:00Z'), themes }), 'available')
  assert.throws(() => validateScheduledThemes([
    themes[0],
    { key: 'overlap', available: true, schedule: { startsOn: '09-05', endsOn: '09-15' } },
  ]), /overlap/i)
})

test('theme scheduler persists only a required change without an activating user', async () => {
  const pool = createThemePool('default')
  const options = { now: date('2026-09-04T12:00:00Z'), timeZone: 'Europe/Bucharest' }
  const firstRun = await runThemeScheduler(pool, options)
  const writesAfterFirstRun = pool.calls.filter(({ sql }) => sql.includes('RETURNING active_theme')).length
  const secondRun = await runThemeScheduler(pool, options)

  assert.deepEqual(firstRun, { activeTheme: 'autumn', previousTheme: 'default', changed: true, timeZone: 'Europe/Bucharest' })
  assert.deepEqual(secondRun, { activeTheme: 'autumn', previousTheme: 'autumn', changed: false, timeZone: 'Europe/Bucharest' })
  assert.equal(pool.calls.filter(({ sql }) => sql.includes('RETURNING active_theme')).length, writesAfterFirstRun)
  assert.deepEqual(pool.calls.find(({ sql }) => sql.includes('RETURNING active_theme')).params, ['autumn', null])

  const deactivation = await runThemeScheduler(pool, { now: date('2026-09-12T12:00:00Z'), timeZone: 'Europe/Bucharest' })
  assert.deepEqual(deactivation, { activeTheme: 'default', previousTheme: 'autumn', changed: true, timeZone: 'Europe/Bucharest' })
})

test('theme scheduler uses persisted annual windows and ignores saved windows for unavailable themes', async () => {
  const pool = createThemePool('default', [
    ['autumn', { startsOn: '09-06', endsOn: '09-12' }],
    ['valentines-day', { startsOn: '09-01', endsOn: '09-10' }],
  ])
  const beforeSavedWindow = await runThemeScheduler(pool, { now: date('2026-09-05T12:00:00Z'), timeZone: 'UTC' })
  assert.equal(beforeSavedWindow.activeTheme, 'default')
  const insideSavedWindow = await runThemeScheduler(pool, { now: date('2026-09-07T12:00:00Z'), timeZone: 'UTC' })
  assert.equal(insideSavedWindow.activeTheme, 'autumn')
})

test('authenticated Admin can save seasonal windows; invalid, overlapping, and unauthenticated writes fail', async () => {
  const pool = createThemePool()
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const url = `${baseUrl}/api/admin/seasonal-themes/valentines-day/schedule`
    const unauthenticated = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsOn: '02-07', endsOn: '02-14' }),
    })
    assert.equal(unauthenticated.status, 401)

    const invalid = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: sessionCookieFor('florind') }, body: JSON.stringify({ startsOn: '02-31', endsOn: '03-02' }),
    })
    assert.equal(invalid.status, 400)

    const overlapping = await fetch(`${baseUrl}/api/admin/seasonal-themes/autumn/schedule`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: sessionCookieFor('florind') }, body: JSON.stringify({ startsOn: '10-20', endsOn: '10-25' }),
    })
    assert.equal(overlapping.status, 400)
    assert.match((await overlapping.json()).error, /overlap/i)

    const saved = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: sessionCookieFor('florind') }, body: JSON.stringify({ startsOn: '02-08', endsOn: '02-15' }),
    })
    assert.equal(saved.status, 200)
    assert.deepEqual(await saved.json(), { key: 'valentines-day', startsOn: '02-08', endsOn: '02-15' })
    const reloaded = await getSeasonalThemesWithSavedSchedules(pool)
    assert.deepEqual(reloaded.find(({ key }) => key === 'valentines-day').schedule, { startsOn: '02-08', endsOn: '02-15' })
  } finally {
    await closeServer(server)
  }
})

test('authenticated Admin can run the seasonal scheduler and receive the public theme result', async () => {
  const pool = createThemePool('default')
  const app = await createApp(pool, {
    jobs: [{
      key: 'theme-scheduler',
      name: 'Seasonal Theme Scheduler',
      execution: 'Daily scheduler worker',
      frequency: 'Daily at 00:05',
      source: 'theme-scheduler',
      run: (nextPool, options) => runThemeScheduler(nextPool, { ...options, now: date('2026-09-04T12:00:00Z') }),
    }],
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const unauthenticated = await fetch(`${baseUrl}/api/admin/jobs/theme-scheduler/run`, { method: 'POST' })
    assert.equal(unauthenticated.status, 401)

    const run = await fetch(`${baseUrl}/api/admin/jobs/theme-scheduler/run`, {
      method: 'POST',
      headers: { Cookie: sessionCookieFor('florind') },
    })
    assert.equal(run.status, 200)
    assert.deepEqual(await run.json(), {
      job: 'theme-scheduler',
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      lastExecutedAt: '2026-09-04T12:00:00.000Z',
      activeTheme: 'autumn',
      previousTheme: 'default',
      changed: true,
      timeZone: 'Europe/Bucharest',
    })
    assert.deepEqual(await (await fetch(`${baseUrl}/api/theme`)).json(), { activeTheme: 'autumn' })
  } finally {
    await closeServer(server)
  }
})
