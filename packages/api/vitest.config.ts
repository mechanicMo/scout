import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      TMDB_READ_ACCESS_TOKEN: 'test-token',
    },
  },
})
