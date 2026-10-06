import type { Metadata } from 'next'
import { DOCUMENT_USE_CASES, loadDocumentRegistry, type DocumentUseCase, type OpenDocument } from '@/lib/documents'
import { REPO } from '@/lib/site'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// /open-documents (founder 2026-10-03, with the documents/ → open-documents/ rename): the
// open-documents registry as a browsable index. Same policy as the repo layer it renders
// (open-documents/registry.json via lib/documents.ts): link, never redistribute — every row
// opens the publisher's live page, verified on its checked_on date. /documents 308s here
// (next.config.ts redirects) so old links stay alive. Document families (founder 2026-10-06):
// rows sharing a registry `family` (the YC SAFE variants, the NVCA suite) group together in
// their use-case table — pulled adjacent at the family's first registry position — and each
// family row shows its committed `variant` label, so the SAFE reads as one object with variants
// while the table idiom stays.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Open documents — the canonical startup legal documents — Ultrametric',
  description:
    'Openly licensed and freely published startup legal documents — SAFEs, incorporation packages, offer letters, board consents — as dated, link-only records. Every URL is verified on its checked_on date; the documents stay on the publisher’s site.',
}

// Registry order with family members pulled adjacent at the family's first position — pure
// reordering, no row invented or dropped (the per-table row-count test pins that).
function groupFamilies(docs: OpenDocument[]): OpenDocument[] {
  const out: OpenDocument[] = []
  const emitted = new Set<string>()
  for (const d of docs) {
    if (!d.family) {
      out.push(d)
    } else if (!emitted.has(d.family)) {
      emitted.add(d.family)
      out.push(...docs.filter((x) => x.family === d.family))
    }
  }
  return out
}

const USE_CASE_LABELS: Record<DocumentUseCase, string> = {
  formation: 'Formation',
  fundraising: 'Fundraising',
  hiring: 'Hiring',
  commercial: 'Commercial',
  governance: 'Governance',
  privacy: 'Privacy',
  'open-source': 'Open source',
}

export default function OpenDocumentsPage() {
  const registry = loadDocumentRegistry()
  const publishers = new Set(registry.documents.map((d) => d.publisher)).size
  return (
    <div className="space-y-6">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Open documents — the canonical startup legal documents
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {registry.documents.length} openly licensed or freely published documents from{' '}
          {publishers} publishers, as dated records. Link, never redistribute: each row opens the
          publisher&rsquo;s live page, verified on its <code>checked_on</code> date. The license
          note states the published terms and what still requires counsel — none of these
          substitute for a lawyer.
        </p>
      </section>
      {DOCUMENT_USE_CASES.map((useCase) => {
        const docs = groupFamilies(registry.documents.filter((d) => d.use_case === useCase))
        if (docs.length === 0) return null
        return (
          <section key={useCase}>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {USE_CASE_LABELS[useCase]}
            </h2>
            <div className={`mt-3 ${TABLE_SHELL}`}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className={TABLE_HEADER_ROW}>
                    <th scope="col" className="px-3 py-2 font-normal">
                      <span title="Opens the publisher's live page — the document itself stays on the publisher's site">Document</span>
                    </th>
                    <th scope="col" className="px-3 py-2 font-normal">Publisher</th>
                    <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">
                      <span title="Descriptive, not a registry code — many standards are deliberately jurisdiction-neutral">Jurisdiction</span>
                    </th>
                    <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                      <span title="The published license or terms, and what still requires counsel">License / counsel note</span>
                    </th>
                    <th scope="col" className="px-3 py-2 font-normal">
                      <span title="When the URL was last verified live">Checked</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {docs.map((d) => (
                    <tr key={d.id} className="transition hover:bg-zinc-900/50">
                      <td className="px-3 py-2.5 align-top">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${d.name} — ${d.publisher}, checked ${d.checked_on} (external site)`}
                          className="text-zinc-200 transition hover:text-emerald-300"
                        >
                          {d.name}
                        </a>
                        <span className="ml-1.5 text-[10px] text-zinc-500">{d.format}</span>
                        {d.variant && (
                          <span
                            className="ml-1.5 rounded-full border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                            title={`Variant in the ${d.family} document family — grouped rows are one object in several registered forms`}
                          >
                            {d.variant}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-zinc-400">{d.publisher}</td>
                      <td className="hidden px-3 py-2.5 align-top text-zinc-400 sm:table-cell">{d.jurisdiction}</td>
                      <td className="hidden px-3 py-2.5 align-top text-zinc-500 md:table-cell">{d.license_note}</td>
                      <td className="px-3 py-2.5 align-top text-zinc-500">{d.checked_on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      <p className="text-xs text-zinc-500">
        The records live in the open repo:{' '}
        <a
          href={`https://github.com/${REPO}/blob/main/open-documents/README.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition hover:text-emerald-300"
        >
          open-documents/README.md
        </a>{' '}
        carries the full map with counsel notes; the registry states a {registry.review_window_days}-day
        review window and the sync gates are in <code>lib/documents.ts</code>.
      </p>
    </div>
  )
}
