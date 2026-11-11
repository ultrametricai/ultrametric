import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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
    expect(sweep).toContain('git diff --cached --quiet -- open-rankings')
    expect(sweep).toContain('git add open-rankings README.md')
    expect(sweep).toContain('pnpm tsx rankings-engine/scripts/cert-sweep.ts')
  })
})

describe('certification sweep change detection', () => {
  it.each(['unchanged', 'tracked update', 'new-only'] as const)(
    'handles %s certification outputs',
    (scenario) => {
      const sweep = read('.github/workflows/cert-sweep.yml')
      const step = sweep.split('      - name: Open PR if anything changed\n')[1]
      expect(step).toBeDefined()
      // Execute the workflow's real preflight, stopping before stats/branch/push operations.
      const preflight = step.split('        run: |\n')[1].split('          pnpm stats')[0]
        .split('\n').map((line) => line.replace(/^          /, '')).join('\n')
      expect(preflight).toContain('git diff')
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cert-sweep-preflight-'))
      const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
      const write = (file: string, content: string) => {
        const target = path.join(dir, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, content)
      }
      const registry = 'open-rankings/example/certifications.json'
      const report = 'open-rankings/example/cert-reports/vendor.json'
      try {
        git('init', '--quiet')
        git('config', 'user.name', 'Certification test')
        git('config', 'user.email', 'certification-test@example.invalid')
        write('open-rankings/example/products.json', '[]\n')
        if (scenario !== 'new-only') {
          write(registry, '[]\n')
          write(report, '{}\n')
        }
        git('add', '.')
        git('commit', '--quiet', '-m', 'Initial fixture')
        if (scenario !== 'unchanged') {
          write(registry, '[{"product":"vendor"}]\n')
          write(report, '{"passed":true}\n')
        }
        write('unrelated.txt', 'Leave untracked\n')
        const output = execFileSync('bash', ['-e', '-o', 'pipefail', '-c',
          `${preflight}\nprintf 'CONTINUE_CERT_SWEEP\n'`,
        ], { cwd: dir, encoding: 'utf8' })
        const staged = git('diff', '--cached', '--name-only').trim().split('\n').filter(Boolean)
        if (scenario === 'unchanged') {
          expect(output).toContain('No certification changes')
          expect(output).not.toContain('CONTINUE_CERT_SWEEP')
          expect(staged).toEqual([])
        } else {
          expect(output).toContain('CONTINUE_CERT_SWEEP')
          expect(output).not.toContain('No certification changes')
          expect(staged.sort()).toEqual([registry, report].sort())
        }
        expect(git('ls-files', '--others', '--exclude-standard').trim()).toBe('unrelated.txt')
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  )
})
