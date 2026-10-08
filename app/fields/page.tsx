import type { Metadata } from 'next'
import Link from 'next/link'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'
import { companyFieldGroups, loadFieldPages } from '@/lib/companyFields'
import { REPO } from '@/lib/site'

// /fields (founder 2026-10-08): the company-fields registry (processes/company-fields.json) as
// a browsable index — the typed company-level values the repo genuinely consumes, each row
// linking its own specification page. Grouped by the committed field type (identifiers first:
// the EIN and the state file number are the founder-named anchors), membership computed from
// the registry, never hand-sorted. The consumption column shows whichever committed path
// derives the field: the open-module consumers, or the count of corpus processes that require
// the establishing artifact (the widened requires-and-carries rule).
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Company data fields — the typed values the processes establish and the modules consume — Ultrametric',
  description:
    'The typed company-level data fields behind the founder processes — the EIN, the incorporation date, the share counts, the runway inputs — each with its format specification, issuing authority, establishing artifact, and the committed code or processes that consume it.',
}

export default function FieldsPage() {
  const pagesById = new Map(loadFieldPages().map((p) => [p.field.id, p]))
  const groups = companyFieldGroups()
  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Company data fields — what the processes establish and the modules consume
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The typed vocabulary of company-level values (
          <code>processes/company-fields.json</code>): each field exists because a committed{' '}
          <Link href="/artifacts" className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
            artifact
          </Link>{' '}
          establishes it and committed code or a committed process consumes it — an{' '}
          <Link href="/open-modules" className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
            open module
          </Link>
          &rsquo;s exported function takes it, or corpus processes require the artifact that
          carries it. Every field page renders the sourced format specification: who issues the
          value, what shape it takes, and where it appears.
        </p>
      </section>
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="font-display text-xl font-semibold tracking-tight">{g.label}</h2>
          <div className={`mt-3 ${TABLE_SHELL}`}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th scope="col" className="px-3 py-2 font-normal">Field</th>
                  <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                    <span title="The field's format specification — the full sourced spec is on the field page">Format</span>
                  </th>
                  <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">
                    <span title="The registry artifact whose creation sets this value">Established by</span>
                  </th>
                  <th scope="col" className="px-3 py-2 font-normal">
                    <span title="The committed consumption path: open-module functions, or the corpus processes that require the establishing artifact">Consumed by</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {g.fields.map((f) => {
                  const page = pagesById.get(f.id)!
                  return (
                    <tr key={f.id} className="transition hover:bg-zinc-900/50">
                      <td className="px-3 py-2.5 align-top">
                        <Link
                          href={`/fields/${f.id}`}
                          title={f.description}
                          className="text-zinc-200 transition hover:text-emerald-300"
                        >
                          {f.label}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 align-top text-zinc-400 md:table-cell">
                        {f.spec.format}
                      </td>
                      <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                        <Link
                          href={page.artifact.href}
                          className="text-zinc-400 transition hover:text-emerald-300"
                        >
                          {page.artifact.label}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 align-top text-zinc-400">
                        {page.consumers.length > 0
                          ? page.consumers.map((c, i) => (
                              <span key={c.moduleId}>
                                {i > 0 && ' · '}
                                <Link
                                  href={c.href}
                                  title={`${c.moduleLabel} — ${c.functions.join(', ')}`}
                                  className="transition hover:text-emerald-300"
                                >
                                  {c.moduleLabel}
                                </Link>
                              </span>
                            ))
                          : `${page.requiringProcesses.length} process${page.requiringProcesses.length === 1 ? '' : 'es'} require the artifact`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-zinc-500">
        The registry lives in the open repo as <code>processes/company-fields.json</code>, with
        its published JSON Schema at <code>schemas/company-fields.schema.json</code>; the
        derivation rule and the spec contract are documented in{' '}
        <a
          href={`https://github.com/${REPO}/blob/main/lib/companyFields.ts`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition hover:text-emerald-300"
        >
          lib/companyFields.ts
        </a>
        .
      </p>
    </div>
  )
}
