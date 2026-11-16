import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

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
})
