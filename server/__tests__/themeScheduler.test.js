import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { runThemeScheduler } from '../themeScheduler.js'
import { defaultThemeKey, resolveScheduledTheme, validateScheduledThemes } from '../../shared/themes.js'

function date(value) {
  return new Date(value)
}

function createThemePool(initialTheme = defaultThemeKey) {
  let activeTheme = initialTheme
  const calls = []
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params })
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

test('seasonal theme resolver uses the requested timezone and supports cross-year periods', () => {
  const instant = date('2026-08-31T22:30:00Z')
  assert.equal(resolveScheduledTheme({ date: instant, timeZone: 'UTC' }), 'default')
  assert.equal(resolveScheduledTheme({ date: instant, timeZone: 'Europe/Bucharest' }), 'autumn')

  const crossYearThemes = [{ key: 'new-years', available: true, schedule: { startsOn: '12-28', endsOn: '01-03' } }]
  assert.equal(resolveScheduledTheme({ date: date('2026-12-31T12:00:00Z'), themes: crossYearThemes }), 'new-years')
  assert.equal(resolveScheduledTheme({ date: date('2027-01-03T12:00:00Z'), themes: crossYearThemes }), 'new-years')
  assert.equal(resolveScheduledTheme({ date: date('2027-01-04T12:00:00Z'), themes: crossYearThemes }), 'default')
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
      headers: { 'x-watchvault-username': 'florin' },
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
