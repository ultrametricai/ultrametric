import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'

// The first scheduled run (2026-11-12) failed at check-refresh-stability: the scoped
// re-judge re-rolled every cell of each touched product and model noise flipped grades
// the appended spec does not support. Reconciliation between judge and derive (the
// story-runner convention) retains the baseline grade for those cells, so the committed
// candidate carries only new-source-supported changes.
describe('api-gap-repair workflow', () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, '../../.github/workflows/api-gap-repair.yml'), 'utf8',
  )
  const step = (name: string) => workflow.match(
    new RegExp(`^      - name: ${name}\\n[\\s\\S]*?(?=^      - name: |^      - uses: |$(?![\\s\\S]))`, 'm'),
  )?.[0]

  it('pins the refresh baseline from the checked-out main commit before any mutation', () => {
    const pin = step('Pin refresh baseline')
    expect(pin).toBeDefined()
    expect(pin).toContain('id: baseline')
    expect(pin).toContain('git rev-parse HEAD')
    expect(workflow.indexOf('- name: Pin refresh baseline'))
      .toBeLessThan(workflow.indexOf('- name: Verify candidates and append evidence'))
  })

  it('reconciles each touched arena against the pinned baseline after judge, before derive', () => {
    const judge = step('Judge and derive touched arenas')
    expect(judge).toBeDefined()
    expect(judge).toContain('BASELINE_SHA: ${{ steps.baseline.outputs.sha }}')
    const lines = judge!.split('\n').map((line) => line.trim())
    const judged = lines.indexOf('pnpm engine judge --batch --category "$ARENA"')
    const scoped = lines.indexOf('pnpm engine judge --batch --category "$ARENA" --product "$PRODUCT"')
    const reconcile = lines.indexOf('pnpm exec tsx rankings-engine/scripts/reconcile-refresh.ts \\')
    const baseline = lines.indexOf('--category "$ARENA" --baseline "$BASELINE_SHA" \\')
    const derive = lines.indexOf('pnpm engine derive --category "$ARENA"')
    expect(judged).toBeGreaterThan(-1)
    expect(scoped).toBeGreaterThan(-1)
    expect(reconcile).toBeGreaterThan(Math.max(judged, scoped))
    expect(baseline).toBe(reconcile + 1)
    expect(derive).toBeGreaterThan(reconcile)
  })

  it('commits the retention ledger directory with the wave', () => {
    const pr = step('Open PR if anything changed')
    expect(pr).toBeDefined()
    // reconcile-refresh writes rankings-engine/cache/refresh-retention/<arena>/decisions.json;
    // the staged rankings-engine/cache path carries it into the wave commit.
    expect(pr).toContain('git add open-rankings rankings-engine/cache reports/evidence-parity README.md')
  })

  it('reconciles two successive waves targeting different products without changing raw proposals', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'api-gap-waves-'))
    const arena = 'fixture'
    const data = path.join(root, 'open-rankings', arena)
    const cache = path.join(root, 'rankings-engine/cache')
    const write = (file: string, value: unknown) => {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
    }
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
    const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD') }
    try {
      vi.resetModules()
      vi.doMock('@/rankings-engine/paths', async () => {
        const actual = await vi.importActual<typeof import('../paths')>('@/rankings-engine/paths')
        return { ...actual, CACHE_DIR: cache, categoryDir: () => data,
          resolveCategories: () => [{ id: arena, name: arena, description: '', personas: ['developer'] }] }
      })
      const judge = await import('../stages/judge')
      const { reconcileRefresh } = await import('../refresh-reconciliation')
      const llm = await import('../llm')
      const modelCall = vi.fn(() => { throw new Error('Offline replay must use cached proposals') })
      llm.setClientForTests({ messages: { create: modelCall, batches: { create: modelCall } } } as never)
      const story = { id: 'story', title: 'Install dependencies', persona: 'developer', theme: 'core', group: 'core' as const, weight: 2 }
      const evidence = { id: 'old', tier: 'claimed-docs' as const, url: 'https://example.invalid/docs',
        excerpt: 'Install dependencies with the CLI.', fetchedAt: '2026-11-01T00:00:00Z' }
      const row = (productId: string, quality = 5) => ({ productId, storyId: story.id, verdict: 'partial', quality,
        confidence: 'high', rationale: 'Missing for 10: independent corroboration.', evidenceIds: ['old'],
        support: { subject: story.title, relation: 'direct', coverage: 'partial', citations: [{ evidenceId: 'old', quote: evidence.excerpt }] } })
      const cacheFile = (product: string) => path.join(cache, 'judge', arena, product, 'story.json')
      const proposal = (product: string, pack: typeof evidence[], quality = 5) => {
        write(path.join(data, 'evidence', `${product}.json`), pack)
        write(cacheFile(product), { hash: judge.cellHash(story, pack, judge.PROMPT_VERSION),
          keyVersion: judge.CELL_HASH_VERSION, verdict: row(product, quality) })
      }
      git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture')
      write(path.join(data, 'products.json'), ['first', 'second'].map(id => ({ id, name: id, vendor: id,
        type: 'oss', urls: { site: 'https://example.invalid' } })))
      write(path.join(data, 'stories.json'), [story])
      write(path.join(data, 'verdicts.json'), [row('first'), row('second')])
      for (const product of ['first', 'second']) proposal(product, [evidence])
      let baseline = commit()
      // Exercise the workflow's actual routing condition, with no provider calls.
      const condition = step('Judge and derive touched arenas')!.match(/^\s*(if \[ "\$COUNT"[^\n]+; then)$/m)![1]
      const route = () => execFileSync('bash', ['-eu', '-c', `${condition}\n echo category\nelse\n echo scoped\nfi`], {
        cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, COUNT: '1', ARENA: arena } as NodeJS.ProcessEnv,
      }).trim()
      for (const [index, product] of ['first', 'second'].entries()) {
        proposal(product, [evidence, { ...evidence, id: 'unrelated', url: 'https://example.invalid/other', excerpt: 'Account settings.' }], 7)
        const raw = ['first', 'second'].map(id => fs.readFileSync(cacheFile(id), 'utf8'))
        expect(route()).toBe(index === 0 ? 'scoped' : 'category')
        if (index === 1) {
          await expect(judge.runJudge({ category: arena, product, batch: true })).rejects.toThrow(/untouched/)
        }
        await judge.runJudge({ category: arena, product: route() === 'scoped' ? product : undefined, batch: true })
        const report = reconcileRefresh({ arena, baseline, root })
        expect(report.retained).toEqual(index === 0 ? ['first:story'] : ['first:story', 'second:story'])
        expect(JSON.parse(fs.readFileSync(path.join(data, 'verdicts.json'), 'utf8'))).toEqual([row('first'), row('second')])
        expect(['first', 'second'].map(id => fs.readFileSync(cacheFile(id), 'utf8'))).toEqual(raw)
        baseline = commit()
      }
      expect(modelCall).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('@/rankings-engine/paths')
      vi.resetModules()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
