import crypto from 'node:crypto'
import { createApp as createProductionApp } from '../app.js'

const testSessionUsers = new Map()

export function sessionCookieFor(username) {
  const token = crypto.createHash('sha256').update(`watchvault-test:${username}`).digest('base64url')
  testSessionUsers.set(crypto.createHash('sha256').update(token).digest('hex'), username)
  return `watchvault_session=${token}`
}

export function createApp(pool, options = {}) {
  return createProductionApp(pool, {
    ...options,
    initializeAuthSchema: async () => {},
    persistSession: async () => {},
    resolveSession: async (_pool, tokenHash) => {
      const username = testSessionUsers.get(tokenHash)
      if (!username) return null
      let result
      try { result = await pool.query(`
      SELECT
        id,
        username,
        full_name
      FROM users
      WHERE username = $1
      LIMIT 1
    `, [username]) } catch { result = { rows: [] } }
      const user = result.rows?.[0] ?? { id: 1, username, full_name: username }
      return { ...user, role: user.role ?? (username === 'florind' ? 'admin' : 'user') }
    },
  })
}
