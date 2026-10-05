import { describe, expect, it } from 'vitest'
import { loadProcesses } from '@/lib/processes'
import { guidanceParagraphs, stepGuidanceFor, stepGuidanceForTask } from '@/lib/shared-processes/step-guidance'
import { readSharedCatalog } from '@/lib/shared-processes/reader'

// Committed per-step descriptions for the corpus process pages (founder 2026-10-05): the shared
// record parts whose id matches a corpus DAG node id carry that step's authored guidance. Pins:
// the worked brand_002 example (the founder's 'Set primary logo' complaint), the never-invent
// contract (nodes without committed guidance resolve to null), structural totality over the
// real corpus, and the display cleaning (markdown markers stripped, bullets folded — never a
// rewrite of the committed words).

describe('stepGuidanceForTask (the node-id ↔ shared-part binding)', () => {
  it("brand_002 n2 ('Set primary logo') resolves to its record part's committed guidance", () => {
    const guidance = stepGuidanceFor('brand_002', 'n2')
    expect(guidance).toBeTruthy()
    expect(guidance).toContain('Return the main logo')
    // Verbatim from the committed record — the loader never rewrites.
    const record = readSharedCatalog().find((r) => r.id === 'brand_002')!
    const part = record.parts.find((p) => p.id === 'n2')!
    expect(guidance).toBe(part.guidance?.trim())
  })

  it('an unknown node id (or unknown task) resolves to null — nothing is ever invented', () => {
    expect(stepGuidanceFor('brand_002', 'no-such-node')).toBeNull()
    expect(stepGuidanceFor('no-such-task', 'n1')).toBeNull()
  })

  it('over the real corpus: substantial coverage, and every entry is honest (a real node id, a non-empty committed string)', () => {
    const tasks = loadProcesses()
    let total = 0
    let covered = 0
    for (const task of tasks) {
      const byNode = stepGuidanceForTask(task.id)
      const nodeIds = new Set(task.dag.nodes.map((n) => n.id))
      for (const nodeId of nodeIds) {
        total += 1
        const g = byNode[nodeId]
        if (g !== undefined) {
          covered += 1
          expect(g.trim().length, `${task.id}:${nodeId} guidance must be non-empty`).toBeGreaterThan(0)
        }
      }
    }
    // The catalog covered 700 of 865 corpus nodes when this landed — pin a floor, not the
    // exact count, so authored additions never break the suite while a loader regression does.
    expect(total).toBeGreaterThan(500)
    expect(covered / total).toBeGreaterThan(0.5)
  })
})

describe('guidanceParagraphs (display cleaning only)', () => {
  it('splits on blank lines, folds bullet lines, strips **/` markers — and never invents words', () => {
    const text = 'Lead paragraph with **bold** and `code`.\n\n- first point\n- second point\n\nCloser.'
    expect(guidanceParagraphs(text)).toEqual([
      'Lead paragraph with bold and code.',
      '· first point · second point',
      'Closer.',
    ])
  })

  it('empty/whitespace input yields no paragraphs', () => {
    expect(guidanceParagraphs('   \n\n  ')).toEqual([])
  })
})
