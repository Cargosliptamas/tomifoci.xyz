import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the tsconfig path alias ('@/*' -> './*') so tests can import modules that
// reference '@/lib/...' (e.g. lib/throttle.ts). Purely additive — relative imports
// used by existing tests are unaffected.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url))
    }
  }
})
