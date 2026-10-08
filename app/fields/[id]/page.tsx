import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findFieldPage, loadCompanyFields } from '@/lib/companyFields'
import { REPO } from '@/lib/site'

// One company data field (founder 2026-10-08: "a page that explains the specification of data
// fields like an EIN — map those out in the repo, and draw the content from the repo into the
// site"): everything on this page reads back from the committed registry
// (processes/company-fields.json). The Specification section renders the field's spec block
// verbatim — format, pattern where the authority's format is strict, the authority's own
// documented example where one exists, the assigning authority, the documents the value
// appears on, and the URL citations behind the format claims (every URL fetch-verified when
// curated). The establishing artifact links its /artifacts page; the consumption side shows
// whichever committed path derives the field: the open-module functions (consumedBy), or — for
// the identifier fields on the widened requires-and-carries path — the corpus processes whose
// `requires` carries the establishing artifact, COMPUTED from processes/corpus.json. Fully
// static, params from the registry, unknown ids 404 (same contract as app/artifacts/[id]).

export function generateStaticParams() {
  return loadCompanyFields().map((f) => ({ id: f.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const page = findFieldPage(id)
  return {
    title: `${page ? page.field.label : id} — Company data fields — Ultrametric`,
    description: page ? `${page.field.spec.format} ${page.field.description}` : undefined,
  }
}

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = findFieldPage(id)
  if (!page) notFound()
  const { field, artifact, consumers, requiringProcesses } = page
  const { spec } = field

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          <Link href="/fields" className="hover:text-emerald-300">Fields</Link>
          <span className="mx-1 text-zinc-600">/</span>
          <span className="font-mono normal-case">
            {field.type}
            {field.values ? ` (${field.values.join(' | ')})` : ''}
          </span>
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          {field.label}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">{field.description}</p>
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Specification
        </h2>
        <dl className="mt-3 max-w-2xl space-y-3 text-sm">
          <div>
            <dt className="text-xs tracking-wide text-zinc-500">Format</dt>
            <dd className="mt-0.5 text-zinc-300">{spec.format}</dd>
          </div>
          {spec.pattern && (
            <div>
              <dt className="text-xs tracking-wide text-zinc-500">Pattern</dt>
              <dd className="mt-0.5">
                <code className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                  {spec.pattern}
                </code>
              </dd>
            </div>
          )}
          {spec.example && (
            <div>
              <dt className="text-xs tracking-wide text-zinc-500">
                <span title="The authority's own documented format example, verbatim from the cited source — never an invented value">
                  Documented example
                </span>
              </dt>
              <dd className="mt-0.5 font-mono text-zinc-300">{spec.example}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs tracking-wide text-zinc-500">Issuer / authority</dt>
            <dd className="mt-0.5 text-zinc-300">{spec.authority}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-zinc-500">Where it appears</dt>
            <dd className="mt-0.5">
              <ul className="list-disc space-y-0.5 pl-5 text-zinc-400">
                {spec.whereItAppears.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-zinc-500">
              <span title="The pages the format claims cite — fetch-verified when the registry entry was curated">
                Sources
              </span>
            </dt>
            <dd className="mt-0.5">
              <ul className="space-y-1 text-zinc-400">
                {spec.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                    >
                      {s.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Established by
        </h2>
        <p className="mt-2 text-sm">
          <Link
            href={artifact.href}
            className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
          >
            {artifact.label}
          </Link>
          <span className="ml-2 text-xs text-zinc-400">
            the registry artifact whose creation sets this value
          </span>
        </p>
      </section>

      {consumers.length > 0 ? (
        <section>
          <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
            Consumed by open modules
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            The committed <code>lib/openstartup</code> functions that take this value — the
            registry wiring this field&rsquo;s existence rests on.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {consumers.map((c) => (
              <li key={c.moduleId} className="flex items-baseline gap-2">
                <Link
                  href={c.href}
                  className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                >
                  {c.moduleLabel}
                </Link>
                <span className="font-mono text-xs text-zinc-500">{c.functions.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
            Processes that require it
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            This identifier is consumed through its establishing artifact: every committed corpus
            process whose <code>requires</code> carries {artifact.label} enters the value along
            the way. Computed from <code>processes/corpus.json</code>, never hand-listed.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {requiringProcesses.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <Link
                  href={p.href}
                  className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                >
                  {p.title}
                </Link>
                <span className="text-xs text-zinc-500">{p.area}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-zinc-500">
        <a
          href={`https://github.com/${REPO}/blob/main/processes/company-fields.json`}
          target="_blank"
          rel="noopener noreferrer"
          title="Registry source — processes/company-fields.json (one file holds the whole registry; JSON carries no per-entry anchor, so the link opens the file)"
          className="transition hover:text-emerald-300"
        >
          View the registry source in the repo ↗
        </a>
      </p>
    </div>
  )
}
