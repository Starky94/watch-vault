import { importCollections } from './collectionImportService.js'
import { recordAdminJobExecution } from './database.js'
import { recordErrorSafely } from './errorLogs.js'

export async function runCollectionImport(pool, options) {
  const result = await importCollections(pool, options)
  for (const failure of result.errors ?? []) {
    await recordErrorSafely(pool, { source: 'job', context: `collections: ${failure.id}`, error: failure.message })
  }
  if (result.errors?.length) throw new Error(`Collections import saved ${result.insertedCount} collections; ${result.errors.length} failed (see error logs).`)
  return result
}

export async function executeCollectionImport(pool, options) {
  const result = await runCollectionImport(pool, options)
  if (!result.skipped) await recordAdminJobExecution(pool, 'collections')
  console.log(`Collections import: ${JSON.stringify(result)}`)
  return result
}
