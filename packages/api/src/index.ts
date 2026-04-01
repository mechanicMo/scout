import { configDotenv } from 'dotenv'
import { join } from 'path'
configDotenv({ path: join(process.cwd(), '../../.env') })

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './router'
import { createContext } from './context'

const app = new Hono()

app.use('*', cors({ origin: '*', credentials: true }))

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_, c) => createContext(c),
  })
)

app.get('/health', (c) => c.json({ ok: true }))

const port = Number(process.env.API_PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Scout API running on http://localhost:${port}`)
})

export type { AppRouter } from './router'
