import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArenaVendorList from '@/components/ArenaVendorList'
import ArtifactGeoNotes from '@/components/ArtifactGeoNotes'
import { findArtifactPage, loadArtifactPages } from '@/lib/artifactPages'
import { fieldsEstablishedBy } from '@/lib/companyFields'

// One registry artifact (founder 2026-10-05): what it is (the committed description from
// processes/artifacts.json), the canonical producer and documented exception producers, every
// process that needs it (the consumer side of the lib/processDeps.ts dependency graph), and the
// judged vendor markets around the steps that bring it into existence. Vendor lists are
// COMPUTED (lib/artifactPages.ts → lib/arenaLeaders.ts) from the producing steps' covering
// arenas and the arenas' committed leaderboards — never hand-picked; artifacts born in state
// portals or signature acts keep an honest empty state. The Document section (founder
// 2026-10-06: classic document objects — the flip of the 2026-10-05 absence pin) renders the
// registry's committed `documents` mapping onto open-documents/registry.json: name, publisher,
// and license note straight from the registry record, every link the publisher's canonical URL
// (link, never redistribute — the open-documents deep-link rule). Where the mapped documents
// share an open-documents `family` (the YC SAFE's cap/discount/MFN/international forms), a
// Variants line renders them as one object — the labels are the registry's committed `variant`
// fields, never invented prose. Artifacts with no registered template render no section: honest
// absence, never an invented mapping. Fully static, params from the registry, unknown ids 404.
//
// Two sections joined 2026-10-07 (founder geo-coverage + data-fields asks):
// - "Outside the US" renders the registry's committed per-country `geo` analogs through
//   components/ArtifactGeoNotes.tsx — driven by the ONE shared geo store (the process pages'
//   idiom), never a control of its own; artifacts with no committed entries render nothing.
// - "Data fields" lists the processes/company-fields.json fields THIS artifact establishes
//   (field exists only because a committed open-module function consumes it, or — the
//   2026-10-08 identifier widening — committed processes require-and-carry the artifact), each
//   field linking its /fields specification page and each consumer its /open-modules page.

export function generateStaticParams() {
  return loadArtifactPages().map((a) => ({ id: a.artifact.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const page = findArtifactPage(id)
  return {
    title: `${page ? page.artifact.label : id} — Artifacts — Ultrametric`,
    description: page ? page.artifact.description : undefined,
  }
}

export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = findArtifactPage(id)
  if (!page) notFound()
  const { artifact, producer, bornAt, exceptionProducers, neededBy, arenas, documents } = page
  const fieldRows = fieldsEstablishedBy(artifact.id)

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          <Link href="/artifacts" className="hover:text-emerald-300">Artifacts</Link>
          <span className="mx-1 text-zinc-600">/</span>
          {page.producingArea}
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          {artifact.label}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">{artifact.description}</p>
      </section>

      {documents.length > 0 && (
        <section>
          <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
            Document
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            The registered open template{documents.length > 1 ? 's' : ''} this artifact is
            executed on — a committed mapping (processes/artifacts.json onto the{' '}
            <Link href="/open-documents" className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
              open-documents registry
            </Link>
            ). Each link opens the publisher&rsquo;s canonical page; the documents stay on the
            publisher&rsquo;s site.
          </p>
          {page.documentFamilies.map((g) => (
            <p key={g.family} className="mt-2 text-sm text-zinc-400">
              <span title={`One document object in ${g.docs.length} registered variants (open-documents family: ${g.family})`}>
                Variants:
              </span>{' '}
              {g.docs.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ' · '}
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${d.name} — ${d.publisher}, checked ${d.checked_on} (external site)`}
                    className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                  >
                    {d.variant}
                  </a>
                </span>
              ))}
            </p>
          ))}
          <ul className="mt-3 space-y-3 text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${d.name} — ${d.publisher}, checked ${d.checked_on} (external site)`}
                  className="text-zinc-200 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                >
                  {d.name} ↗
                </a>
                <span className="ml-2 text-xs text-zinc-400">{d.publisher}</span>
                <p className="mt-1 max-w-2xl text-xs text-zinc-400">{d.license_note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Produced by
        </h2>
        <p className="mt-2 text-sm">
          <Link
            href={producer.href}
            className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
          >
            {producer.title}
          </Link>
          <span className="ml-2 text-xs text-zinc-500">{producer.area}</span>
          <span
            className="ml-2 rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500"
            title="One canonical producer per artifact keeps the cross-process dependency graph a DAG — dependency edges always point here"
          >
            canonical producer
          </span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          <span title="The corpus pins the exact step where this artifact comes into existence (node-level producesArtifact)">
            Born at:
          </span>{' '}
          <Link
            href={bornAt.href}
            className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
            title={`Jump to the step that produces it: ${bornAt.label}`}
          >
            {bornAt.label}
          </Link>
        </p>
        {exceptionProducers.length > 0 && (
          <p className="mt-2 text-sm text-zinc-400">
            <span title="Documented exception producers — other committed processes that also bring this artifact into existence">
              Also produced by:
            </span>{' '}
            {exceptionProducers.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' · '}
                <Link
                  href={p.href}
                  className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                >
                  {p.title}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Needed by
        </h2>
        {neededBy.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-sm">
            {neededBy.map((p) => (
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
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            {artifact.terminal
              ? 'No committed process consumes this artifact — it leaves the dependency graph here (a filed election, a published report, the final certificate).'
              : 'No committed process lists this artifact in its requires yet.'}
          </p>
        )}
      </section>

      {fieldRows.length > 0 && (
        <section>
          <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
            Data fields
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            The typed company data this artifact establishes (
            <code>processes/company-fields.json</code>) — each field exists because a committed
            open-module function consumes it, or committed processes require-and-carry this
            artifact. Each field links its{' '}
            <Link href="/fields" className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300">
              specification page
            </Link>
            .
          </p>
          <table className="mt-3 w-full max-w-2xl text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-1.5 pr-4 font-medium">Field</th>
                <th className="py-1.5 pr-4 font-medium">Type</th>
                <th className="py-1.5 font-medium">Consumed by</th>
              </tr>
            </thead>
            <tbody>
              {fieldRows.map(({ field, consumers }) => (
                <tr key={field.id} className="border-b border-zinc-900 align-top">
                  <td className="py-2 pr-4" title={field.description}>
                    <Link
                      href={`/fields/${field.id}`}
                      className="text-zinc-200 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                    >
                      {field.label}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                    {field.type}
                    {field.values ? ` (${field.values.join(' | ')})` : ''}
                  </td>
                  <td className="py-2 text-zinc-400">
                    {consumers.length > 0 ? (
                      consumers.map((c, i) => (
                        <span key={c.moduleId}>
                          {i > 0 && ' · '}
                          <Link
                            href={c.href}
                            className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                            title={`${c.moduleLabel} — ${c.functions.join(', ')}`}
                          >
                            {c.moduleLabel}
                          </Link>
                          <span className="ml-1 font-mono text-xs text-zinc-500">
                            {c.functions.join(', ')}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span
                        className="text-xs text-zinc-500"
                        title="This identifier is consumed through the artifact: the processes under Needed by enter the value along the way — the field page lists them"
                      >
                        the processes that require this artifact (Needed by, above)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <ArtifactGeoNotes notes={artifact.geo ?? []} />

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Vendors around the steps that create it
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Computed, never picked: the corpus pins the exact step where this artifact comes into
          existence; that step&rsquo;s covering rankings (its function mapping and curated vendor
          options) each show their current leaderboard leaders with their Overall scores — the
          same judged order the ranking pages publish.
        </p>
        {arenas.length > 0 ? (
          <ArenaVendorList arenas={arenas} />
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            No populated ranking covers the producing step — this artifact is born in a government
            portal, a signature act, or another step no judged market serves yet. There is no
            vendor list to derive.
          </p>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        <a
          href="https://github.com/ultrametricai/ultrametric/blob/main/processes/artifacts.json"
          target="_blank"
          rel="noopener noreferrer"
          title="Registry source — processes/artifacts.json (one file holds the whole registry; JSON carries no per-entry anchor, so the link opens the file)"
          className="transition hover:text-emerald-300"
        >
          View the registry source in the repo ↗
        </a>
      </p>
    </div>
  )
}
