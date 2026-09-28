import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { ensureUserRoles } from '../database.js'

const users = new Map([
  ['florind', { id: 1, username: 'florind', password: 'test', full_name: 'Florin Druta', role: 'admin' }],
  ['alex', { id: 2, username: 'alex', password: 'test', full_name: 'Alex Morgan', role: 'user' }],
])

function createPool() {
  const sessions = new Map()
  return {
    sessions,
    async query(sql, params = []) {
      if (sql.includes('FROM users') && sql.includes('AND password = $2')) {
        const user = users.get(params[0])
        return { rows: user?.password === params[1] ? [user] : [] }
      }
      if (sql.includes('INSERT INTO user_sessions')) {
        sessions.set(params[0], { userId: params[1], expiresAt: params[2] })
        return { rows: [] }
      }
      if (sql.includes('FROM user_sessions JOIN users')) {
        const session = sessions.get(params[0])
        const user = [...users.values()].find((item) => item.id === session?.userId)
        return { rows: user && session.expiresAt > new Date() ? [user] : [] }
      }
      if (sql.includes('DELETE FROM user_sessions')) {
        sessions.delete(params[0])
        return { rows: [] }
      }
      if (sql.includes('RETURNING active_theme')) return { rows: [{ active_theme: params[0] }] }
      return { rows: [] }
    },
  }
}

async function login(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'test' }),
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /HttpOnly;.*SameSite=Strict/)
  return { user: (await response.json()).user, cookie: response.headers.get('set-cookie').split(';')[0] }
}

test('role migration defaults to user and assigns only florind admin', async () => {
  const queries = []
  await ensureUserRoles({ async query(sql) { queries.push(sql); return { rows: [] } } })
  assert.match(queries[0], /role TEXT NOT NULL DEFAULT 'user'/)
  assert.match(queries[1], /username = 'florind' THEN 'admin' ELSE 'user'/)
})

test('sessions restore identity, reject forged headers, and revoke on logout', async () => {
  const pool = createPool()
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const admin = await login(baseUrl, 'florind')
    const regular = await login(baseUrl, 'alex')
    assert.deepEqual(admin.user, { username: 'florind', fullName: 'Florin Druta', role: 'admin' })
    assert.equal(regular.user.role, 'user')
    assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: regular.cookie, 'x-watchvault-username': 'florind' } }).then((response) => response.json())).user.username, 'alex')
    assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { 'x-watchvault-username': 'florind' } })).status, 401)
    assert.equal((await fetch(`${baseUrl}/api/admin/theme`, { method: 'PUT', headers: { Cookie: regular.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ activeTheme: 'autumn' }) })).status, 403)
    assert.equal((await fetch(`${baseUrl}/api/admin/theme`, { method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ activeTheme: 'autumn' }) })).status, 200)
    assert.equal((await fetch(`${baseUrl}/api/admin/theme`, { method: 'PUT', headers: { 'x-watchvault-username': 'florind', 'Content-Type': 'application/json' }, body: JSON.stringify({ activeTheme: 'autumn' }) })).status, 401)
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: admin.cookie } })
    assert.equal(logout.status, 204)
    assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: admin.cookie } })).status, 401)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('all Admin API routes require an admin session', async () => {
  const app = await createApp(createPool(), { jobs: [] })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const { cookie } = await login(baseUrl, 'alex')
    const admin = await login(baseUrl, 'florind')
    const endpoints = [
      ['PUT', '/api/admin/theme'],
      ['GET', '/api/admin/overview'],
      ['PUT', '/api/admin/seasonal-themes/autumn/schedule'],
      ['PUT', '/api/admin/rss-sources/ign-movies'],
      ['PUT', '/api/admin/preferences/sections'],
      ['PUT', '/api/admin/filelist'],
      ['DELETE', '/api/admin/filelist'],
      ['PUT', '/api/admin/igdb'],
      ['DELETE', '/api/admin/igdb'],
      ['POST', '/api/admin/jobs/popular/run'],
    ]
    for (const [method, path] of endpoints) {
      assert.equal((await fetch(`${baseUrl}${path}`, { method, headers: { Cookie: cookie } })).status, 403, path)
      assert.equal((await fetch(`${baseUrl}${path}`, { method })).status, 401, path)
      const adminResponse = await fetch(`${baseUrl}${path}`, { method, headers: { Cookie: admin.cookie } })
      assert.notEqual(adminResponse.status, 401, path)
      assert.notEqual(adminResponse.status, 403, path)
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
