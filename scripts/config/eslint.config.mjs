import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// The open-surface lint config: eslint recommended for the plain-JS scripts, typescript-eslint
// recommended for the lib, rankings-engine, and test suites. (The pre-split config came from eslint-config-next; the
// severity downgrades below match what it applied, so the gate is unchanged.)
const eslintConfig = defineConfig([
  globalIgnores([
    // Scratch git worktrees created by coding-agent sessions.
    '.claude/**',
    // Vitest coverage reports (coverage/ itself is committed corpus data).
    '.coverage/**',
    // Stale Next build output in pre-strip checkouts: next is no longer a dependency,
    // but a leftover .next/ from before the strip must not redden the lint gate.
    '.next/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      // warn severity matches the pre-split gate; the _-prefix convention marks deliberate
      // discards (destructuring splits, catch bindings).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
])

export default eslintConfig
