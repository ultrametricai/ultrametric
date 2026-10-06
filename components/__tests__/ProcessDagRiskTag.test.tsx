// @vitest-environment jsdom
// The step risk tag (founder 2026-10-06: the '{level} risk' body text rendered as hard-to-see
// grey — promote it to a tag next to the route tag, in the step tags' chip idiom). Pins, over
// the real corpus:
//   1. every risk-bearing step wears the tag IN THE HEADER TAG ROW (same row as its route tag),
//      in the honest quiet tones — red-ish high, amber-ish medium, muted-but-readable zinc low
//      (the contrast-sweep floor: no zinc-600/700 text);
//   2. the old grey body-text line is gone — '{level} risk' never renders as bare zinc body
//      text anymore.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProcessDag from '@/components/ProcessDag'
import { loadProcesses } from '@/lib/processes'

const TONE: Record<string, string> = {
  high: 'text-red-300',
  medium: 'text-amber-300',
  low: 'text-zinc-400',
}

function renderTask(task: ReturnType<typeof loadProcesses>[number]) {
  const div = document.createElement('div')
  div.innerHTML = renderToString(
    <ProcessDag nodes={task.dag.nodes} edges={task.dag.edges} taskId={task.id} lensKey={task.id} />,
  )
  return div
}

describe('ProcessDag — the step risk tag (founder 2026-10-06)', () => {
  const tasks = loadProcesses()
  // Non-vacuous: the corpus really carries all three tiers (comp_013 n4 is the one low).
  const tiers = new Set(tasks.flatMap((t) => t.dag.nodes.map((n) => n.riskLevel).filter(Boolean)))

  it('the corpus carries risk-bearing steps across the tiers this pins', () => {
    expect(tiers.has('high')).toBe(true)
    expect(tiers.has('medium')).toBe(true)
    expect(tiers.has('low')).toBe(true)
  })

  it('every risk-bearing step renders its tag beside the route tag, in the tier tone — and the grey body line is gone', () => {
    for (const task of tasks) {
      const risky = task.dag.nodes.filter((n) => n.riskLevel)
      if (risky.length === 0) continue
      const div = renderTask(task)
      const tags = [...div.querySelectorAll('span')].filter((s) =>
        /^(low|medium|high) risk$/.test(s.textContent ?? ''),
      )
      // One tag per risk-bearing step (the default-method header row).
      expect(tags.length, task.id).toBeGreaterThanOrEqual(risky.length)
      for (const tag of tags) {
        const level = (tag.textContent ?? '').split(' ')[0]
        // The chip idiom, not body text: a toned, padded tag…
        expect(tag.className, `${task.id}: ${tag.textContent}`).toContain(TONE[level])
        expect(tag.className).toContain('rounded')
        expect(tag.className).toContain('px-1.5')
        // …never the old hard-to-see grey (and never below the contrast-sweep floor).
        expect(tag.className).not.toMatch(/text-zinc-[567]00/)
        // In the header tag row: the same shrink-to-fit row span that carries the route badge
        // (its sibling is the uppercase route tag — 'manual form' and friends).
        const row = tag.parentElement!
        const routeTag = [...row.children].find((c) =>
          ['agent', 'manual form', 'human or computer use', '✍ signature — legally human'].includes(c.textContent ?? ''),
        )
        expect(routeTag, `${task.id}: risk tag must sit next to the route tag`).toBeTruthy()
      }
    }
  })
})
