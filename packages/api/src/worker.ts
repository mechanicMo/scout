import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './router'
import { createContext } from './context'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_DB_URL: string
  TMDB_READ_ACCESS_TOKEN: string
  GROQ_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({ origin: '*', credentials: true }))

// Bridge Cloudflare env bindings into process.env so existing packages
// (db client, routers) can read them without modification
app.use('*', async (c, next) => {
  Object.assign(process.env, c.env)
  await next()
})

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_, c) => createContext(c),
  })
)

app.get('/health', (c) => c.json({ ok: true }))

export default app
