import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

// The open artifact test surface (docs/repo-split-plan.md): the root
// data-integrity suite, the lib loader/determinism/golden suites, and engine correctness.
// The UI suites run in the private site repo. scripts/content-audit.test.mjs runs under
// node --test, outside this glob (see docs/repo-split-census.json).
export default defineConfig({
  root,
  test: {
    include: [
      '__tests__/**/*.test.ts',
      'lib/**/__tests__/**/*.test.ts',
      'rankings-engine/**/__tests__/**/*.test.ts',
    ],
    exclude: [...configDefaults.exclude, '**/.claude/**'],
    // An include-pattern typo must fail, not silently pass with no tests.
    passWithNoTests: false,
    // Heavy integration tests (full open-rankings/ copies + spawned engine CLIs) outlive the 5s
    // default under per-file worker isolation. Headroom, not semantics.
    testTimeout: 30_000,
    // coverage/ is the committed corpus coverage map; test-coverage reports write to
    // .coverage/ (gitignored) so the two never collide.
    coverage: { reportsDirectory: './.coverage' },
  },
  resolve: { alias: { '@': root } },
})
