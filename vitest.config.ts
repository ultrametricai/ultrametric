import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.next/**'],
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    // vitest 5 spawns a fresh isolated worker per test file (v4 reused workers), which slows the
    // handful of heavy integration tests (full data/ copies + spawned pipeline CLIs) past the 5s
    // default. Headroom, not semantics: genuinely-hung tests still fail.
    testTimeout: 30_000,
    // coverage/ is the committed corpus coverage map; test-coverage reports write to
    // .coverage/ (gitignored) so the two never collide.
    coverage: { reportsDirectory: './.coverage' },
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
