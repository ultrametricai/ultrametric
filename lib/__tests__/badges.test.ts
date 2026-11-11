import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('retired badge embeds', () => {
  it('does not generate or overlay score and certification SVGs', () => {
    expect(fs.existsSync(path.join(root, 'scripts/generate-badges.mjs'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'public/badges'))).toBe(false)
    expect(JSON.parse(read('package.json')).scripts).not.toHaveProperty('badges')
    const manifest = JSON.parse(read('open-manifest.json'))
    expect(manifest.entries.some((entry: { path: string }) =>
      entry.path === 'public/badges' || entry.path === 'scripts/generate-badges.mjs',
    )).toBe(false)
  })

  it('keeps refresh workflows independent of removed assets', () => {
    for (const file of fs.readdirSync(path.join(root, '.github/workflows'))) {
      const workflow = read(`.github/workflows/${file}`)
      expect(workflow).not.toContain('generate-badges.mjs')
      expect(workflow).not.toContain('public/badges')
    }
  })

  it('still detects and stages certification registry and report changes', () => {
    const sweep = read('.github/workflows/cert-sweep.yml')
    expect(sweep).toContain('git diff --quiet -- open-rankings')
    expect(sweep).toContain('git add open-rankings README.md')
    expect(sweep).toContain('pnpm tsx rankings-engine/scripts/cert-sweep.ts')
  })
})
