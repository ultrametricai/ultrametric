'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'
import type { BottomTables, BottomTableStep } from '@/lib/shared-processes/bottom-tables'
import { openProcessTarget } from '@/components/shared-processes/open-target'
import { useRegionalVariant } from './RegionalVariant'
import ExternalLinkMark from './ExternalLinkMark'

const linkStyle = 'cursor-pointer rounded-sm text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300'
const cellStyle = 'block min-w-0 px-3 py-2 text-sm leading-relaxed text-zinc-400 [overflow-wrap:anywhere] md:table-cell'

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return <td role="cell" className={cellStyle}><span aria-hidden="true" className="mb-1 block text-zinc-500 md:hidden">{label}</span>{children}</td>
}
function Table({ label, headings, children }: { label: string; headings: string[]; children: ReactNode }) {
  return <div className={`mt-3 ${TABLE_SHELL}`}>
    <table role="table" aria-label={label} className="block w-full table-fixed border-collapse text-sm md:table">
      <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group"><tr role="row" className={TABLE_HEADER_ROW}>{headings.map(heading => <th key={heading} role="columnheader" scope="col" className="px-3 py-2 font-normal">{heading}</th>)}</tr></thead>
      <tbody role="rowgroup" className="block divide-y divide-zinc-800/70 md:table-row-group">{children}</tbody>
    </table>
  </div>
}
function Steps({ steps }: { steps: BottomTableStep[] }) {
  return <ul className="space-y-2">{steps.map(step => <li key={step.scope}>
    <a href={`#${step.scope}`} className={linkStyle} onClick={event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      openProcessTarget(step.scope)
    }}>{step.label}</a>
    {step.condition && <span className="mt-1 block">{step.condition}</span>}
  </li>)}</ul>
}

export default function ProcessBottomTables({ recordId, variants }: { recordId: string; variants: Record<string, BottomTables> }) {
  const region = useRegionalVariant()
  const rows = variants[region?.selected ?? 'default'] ?? variants.default
  return <>
    {rows.produces.length > 0 && <section id={`${recordId}:produces`} aria-labelledby={`${recordId}:produces-heading`} className="min-w-0 scroll-mt-6">
      <h2 id={`${recordId}:produces-heading`} className="text-xl font-medium text-zinc-100">Produces</h2>
      <Table label="Artifacts produced by this process" headings={['Artifact', 'What it is', 'Producing step']}>
        {rows.produces.map(row => <tr role="row" key={row.id} className="block py-2 align-top md:table-row">
          <Cell label="Artifact"><Link href={`/artifacts/${row.id}`} className={linkStyle}>{row.label}</Link></Cell>
          <Cell label="What it is">{row.description}</Cell>
          <Cell label="Producing step"><Steps steps={row.steps} />{row.canonicalProducer && <p className="mt-2">Canonical producer: <Link href={row.canonicalProducer.href} className={linkStyle}>{row.canonicalProducer.title}</Link></p>}</Cell>
        </tr>)}
      </Table>
    </section>}
    {rows.modules.length > 0 && <section id={`${recordId}:open-modules`} aria-labelledby={`${recordId}:open-modules-heading`} className="min-w-0 scroll-mt-6">
      <h2 id={`${recordId}:open-modules-heading`} className="text-xl font-medium text-zinc-100">Open modules</h2>
      <Table label="Open modules serving this process" headings={['Module', 'What it computes', 'Serves', 'Source']}>
        {rows.modules.map(row => <tr role="row" key={row.id} className="block py-2 align-top md:table-row">
          <Cell label="Module"><Link href={`/open-modules/${row.id}`} className={linkStyle}>{row.label}</Link></Cell>
          <Cell label="What it computes">{row.computes}</Cell>
          <Cell label="Serves">{row.steps.length ? <Steps steps={row.steps} /> : row.processOnly ? 'This process as a whole' : 'No mapped steps in this regional view'}</Cell>
          <Cell label="Source"><a href={row.sourceHref} target="_blank" rel="noopener noreferrer" className={linkStyle}>{row.sourceFile}<ExternalLinkMark href={row.sourceHref} label="" /></a></Cell>
        </tr>)}
      </Table>
    </section>}
  </>
}
