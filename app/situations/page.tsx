import type { Metadata } from 'next'
import SituationsTable from '@/components/SituationsTable'
import { buildSituationRows } from '@/lib/processRows'

// /situations (founder 2026-10-02): the reactive, trigger-driven records get their own index —
// the rows moved OUT of the /processes table (its 'Situations' area group is gone; that table
// is processes only now). Detail pages STAY at /processes/<slug> this round (URL stability —
// every row here links there); if situations ever grow their own detail routes, the seam is
// this index's hrefs plus the slug routing in app/processes/[slug].

export const metadata: Metadata = {
  title: 'Situations — when something hits the company — Ultrametric',
  description:
    'The reactive founder situations, mapped step by step: a lawsuit lands, a breach is live, a tax notice arrives. Trigger, urgency, and the Agentic % for each; judgment, counsel, and signatures stay human.',
}

export default function SituationsPage() {
  const rows = buildSituationRows()
  return (
    <div className="space-y-6">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Situations — when something hits the company
        </h1>
        {/* The intro paragraph ('Not stops on the founder journey — …') is gone (founder
            2026-10-02) — the heading and the table's own tooltips carry the framing. */}
      </section>
      <section>
        <SituationsTable rows={rows} />
      </section>
    </div>
  )
}
