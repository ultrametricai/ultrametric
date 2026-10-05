// @vitest-environment jsdom
// Sub-step vendor rows (founder 2026-10-05): per-step vendor scores render as plain text —
// the canonical/"via:" VendorChip /score links, the "or:" roster /score links, the ranked-row
// and computer-use #story-verdicts links are all gone from the step blocks. Process-level
// scores and the product pages keep their receipts links; this pin only covers what ProcessDag
// mounts. Second structural pin: no step block nests one interactive element inside another
// (a11y: no button-in-button, no link-in-button, no link-in-link). Rendered over the real
// corpus so a regression in any step block fails here.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProcessDag from '@/components/ProcessDag'
import { loadProcesses } from '@/lib/processes'

describe('ProcessDag — sub-step vendor rows (founder 2026-10-05)', () => {
  const tasks = loadProcesses()

  it('renders no per-vendor score links and no nested interactive elements, corpus-wide', () => {
    expect(tasks.length).toBeGreaterThan(0)
    for (const task of tasks) {
      const div = document.createElement('div')
      div.innerHTML = renderToString(
        <ProcessDag nodes={task.dag.nodes} edges={task.dag.edges} taskId={task.id} lensKey={task.id} />,
      )
      // The per-sub-step vendor score links are gone: no /score receipts links and no
      // #story-verdicts anchors anywhere in the step blocks.
      expect(div.querySelector('a[href$="/score"]'), task.id).toBeNull()
      expect(div.querySelector('a[href*="#story-verdicts"]'), task.id).toBeNull()
      // One click target per affordance: no interactive element contains another.
      for (const el of div.querySelectorAll('a, button')) {
        expect(
          el.parentElement?.closest('a, button'),
          `${task.id}: nested interactive <${el.tagName.toLowerCase()}> "${(el.textContent ?? '').slice(0, 40)}"`,
        ).toBeNull()
      }
    }
  })
})
