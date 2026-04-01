import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  schemaFilter: ['scout'],
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL!,
  },
} satisfies Config
