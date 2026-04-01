import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function createDb() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) throw new Error('SUPABASE_DB_URL is required')
  const sql = postgres(connectionString, { prepare: false })
  return drizzle(sql, { schema })
}

let _db: ReturnType<typeof createDb> | undefined

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop) {
    if (!_db) _db = createDb()
    return (_db as any)[prop]
  },
})

export type DB = ReturnType<typeof createDb>
