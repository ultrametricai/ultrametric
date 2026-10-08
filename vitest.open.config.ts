import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The OPEN test surface (docs/REPO-SPLIT-PLAN.md, section 3): root data-integrity suite,
// lib loader/determinism/golden suites, and pipeline correctness. The CLOSED suites
// (components, app, infra, scripts/__tests__) run under the root vitest.config.ts and move
// to the private repo at strip time. scripts/content-audit.test.mjs runs under node --test,
// outside both configs (see docs/repo-split-census.json).
export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      '__tests__/**/*.test.{ts,tsx}',
      'lib/**/__tests__/**/*.test.{ts,tsx}',
      'pipeline/**/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.next/**'],
    // An include-pattern typo must fail, not silently pass with no tests.
    passWithNoTests: false,
    setupFiles: ['./vitest.setup.ts'],
    // Same headroom rationale as vitest.config.ts: heavy integration tests (full data/
    // copies + spawned pipeline CLIs) outlive the 5s default under per-file worker isolation.
    testTimeout: 30_000,
    // Same collision guard as vitest.config.ts: coverage/ is corpus data, reports go to
    // .coverage/ (gitignored).
    coverage: { reportsDirectory: './.coverage' },
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
