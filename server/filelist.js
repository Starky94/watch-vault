import crypto from 'node:crypto'

const algorithm = 'aes-256-gcm'

export function encryptFilelistValue(value, key) {
  const encryptionKey = decodeEncryptionKey(key)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptFilelistValue(value, key) {
  const encryptionKey = decodeEncryptionKey(key)
  const [ivValue, tagValue, encryptedValue] = String(value || '').split('.')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Stored Filelist credentials are invalid')
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
}

export function buildFilelistSearchUrl({ username, passkey, query, season = null, episode = null }) {
  const url = new URL('https://filelist.io/api.php')
  url.searchParams.set('username', username)
  url.searchParams.set('passkey', passkey)
  url.searchParams.set('action', 'search-torrents')
  url.searchParams.set('type', 'name')
  url.searchParams.set('query', query)
  if (Number.isInteger(season)) url.searchParams.set('season', String(season))
  if (Number.isInteger(episode)) url.searchParams.set('episode', String(episode))
  return url
}

export function buildFilelistTvEpisodeQuery(showName, season, episode) {
  const normalizedName = String(showName ?? '').trim().toLowerCase().replace(/\s+/g, '.')
  if (!normalizedName) throw new Error('A TV show name is required for Filelist search')
  if (!Number.isInteger(season) || season < 0) throw new Error('A valid TV season number is required for Filelist search')
  if (!Number.isInteger(episode) || episode < 0) throw new Error('A valid TV episode number is required for Filelist search')
  return `${normalizedName}.S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
}

export function mapFilelistResults(payload) {
  if (!Array.isArray(payload)) throw new Error('Filelist returned an invalid response')
  return payload
    .filter((item) => item && typeof item.name === 'string' && typeof item.download_link === 'string')
    .sort((left, right) => Date.parse(right.upload_date || '') - Date.parse(left.upload_date || ''))
    .slice(0, 10)
    .map((item) => ({
      name: item.name,
      category: typeof item.category === 'string' && item.category ? item.category : 'Uncategorized',
      uploadDate: typeof item.upload_date === 'string' ? item.upload_date : null,
      downloadLink: item.download_link,
    }))
}

function decodeEncryptionKey(value) {
  if (!value) throw new Error('Missing required environment variable: FILELIST_ENCRYPTION_KEY')
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('FILELIST_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}
