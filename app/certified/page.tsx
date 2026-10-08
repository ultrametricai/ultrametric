import type { Metadata } from 'next'
import Link from 'next/link'
import CertificationChip from '@/components/CertificationChip'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import {
  CERT_LEVEL_LABELS,
  certificationExpires,
  isCertificationExpired,
  type Certification,
} from '@/lib/certifications'
import { loadAll } from '@/lib/data'
import type { Product } from '@/lib/schemas'
import { REPO } from '@/lib/site'

// The Agent-Ready certification registry: every product that has passed the self-serve
// conformance suite (`ultrametric-cli certify <url>`, protocol in docs/CERTIFICATION.md), with
// its level, date, and the committed machine-verifiable report. Static by construction — the
// registry is data/<arena>/certifications.json, read at build time like everything else.

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Certified Agent-Ready — Ultrametric',
  description:
    'Products certified through Ultrametric’s keyless Agent-Ready conformance suite — llms.txt, docs .md mirrors, OpenAPI, a real MCP handshake, robots posture, and structured errors — each with a dated, machine-verifiable report.',
}

const DOCS_URL = `https://github.com/${REPO}/blob/main/docs/CERTIFICATION.md`

interface CertRow {
  categoryId: string
  categoryName: string
  product: Product
  cert: Certification
  expired: boolean
}

function collectRows(): CertRow[] {
  const rows: CertRow[] = []
  for (const data of loadAll()) {
    for (const cert of data.certifications) {
      const product = data.products.find((p) => p.id === cert.productId)
      if (!product) continue
      rows.push({
        categoryId: data.category.id,
        categoryName: data.category.name,
        product,
        cert,
        expired: isCertificationExpired(cert),
      })
    }
  }
  // Native above ready, newest first within a level.
  return rows.sort(
    (a, b) =>
      Number(a.expired) - Number(b.expired) ||
      a.cert.level.localeCompare(b.cert.level) || // 'agent-native' < 'agent-ready'
      b.cert.date.localeCompare(a.cert.date) ||
      a.product.name.localeCompare(b.product.name),
  )
}

function ProgramExplainer() {
  return (
    <div className="max-w-2xl space-y-3 text-sm text-zinc-400">
      <p>
        Certification is <span className="text-zinc-200">self-serve and keyless</span>: a vendor runs{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
          npx ultrametric-cli certify &lt;url&gt; --report cert-report.json
        </code>{' '}
        against their own product. The suite checks the surfaces agents actually depend on — llms.txt, docs served as
        markdown, an OpenAPI spec, a real MCP initialize handshake, robots.txt posture, and structured JSON errors —
        and writes a machine-verifiable report (every check, timestamp, and response digest).
      </p>
      <p>
        {/* The two level marks: star-polygon seals seeded by the level id — the same marks
            CertificationChip wears wherever a certification renders. */}
        <span className="inline-flex items-center gap-1 text-emerald-300">
          <GeoMark seed="agent-ready" title="Certified Agent-Ready — llms.txt + (MCP or OpenAPI) + robots-ok" size={15} variant="star" />
          Certified Agent-Ready
        </span>{' '}
        = llms.txt + (MCP or OpenAPI) + robots-ok.{' '}
        <span className="inline-flex items-center gap-1 text-emerald-300">
          <GeoMark seed="agent-native" title="Certified Agent-Native — every conformance check passes" size={15} variant="star" />
          Certified Agent-Native
        </span>{' '}
        = every check passes. Submissions are
        domain-verified, a maintainer re-runs the identical suite from our side, and on a match the certification is
        committed with the report attached — dated, public, and expiring after 180 days.
      </p>
      <p>
        Full protocol, verification methods, and the submission form:{' '}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-300 underline decoration-emerald-300/40 hover:decoration-emerald-300"
        >
          docs/CERTIFICATION.md
        </a>
        .
      </p>
    </div>
  )
}

export default function CertifiedPage() {
  const rows = collectRows()
  const active = rows.filter((r) => !r.expired)
  const lapsed = rows.filter((r) => r.expired)

  return (
    <div className="space-y-10">
      <div>
        {/* seed "certified": same concept mark as the Explore menu's Certified entry. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="certified" title="Certified Agent-Ready — the certification registry" size={16} className="text-zinc-500" />
          Certification registry
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Certified Agent-Ready</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Products that passed Ultrametric&apos;s Agent-Ready conformance suite, each with a dated,
          machine-verifiable report anyone can re-run.
        </p>
      </div>

      <ProgramExplainer />

      {active.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">
          <p className="font-semibold text-zinc-200">No active certifications yet.</p>
          <p className="mt-2">
            The registry launches empty by design — a certification exists only once the suite has actually been run
            and verified. Vendors: run the one command above against your own product and{' '}
            <a
              href={`https://github.com/${REPO}/issues/new?template=certification.yml`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 underline decoration-emerald-300/40 hover:decoration-emerald-300"
            >
              submit the report
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map(({ categoryId, categoryName, product, cert }) => (
            <div
              key={`${categoryId}-${product.id}`}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 p-4"
            >
              <ProductLogo product={product} size={40} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/arena/${categoryId}/product/${product.id}`}
                    className="font-display text-lg font-semibold hover:text-emerald-300"
                  >
                    {product.name}
                  </Link>
                  <Link href={`/arena/${categoryId}`} className="text-xs text-zinc-500 hover:text-emerald-300">
                    {categoryName}
                  </Link>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {CERT_LEVEL_LABELS[cert.level]} · certified {cert.date} · expires {certificationExpires(cert)} ·{' '}
                  {cert.initiatedBy === 'vendor' ? 'vendor-submitted, maintainer-verified' : 'maintainer-initiated'}
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <CertificationChip cert={cert} />
              </div>
            </div>
          ))}
        </div>
      )}

      {lapsed.length > 0 && (
        <div>
          <h2 className="font-display leading-[1.1] mb-2 text-lg font-semibold text-zinc-400">Lapsed</h2>
          <p className="mb-3 max-w-2xl text-xs text-zinc-400">
            Certifications expire 180 days after their run date — an expired certification is simply not a
            certification anymore until the suite is re-run. These stay listed as the public record.
          </p>
          <ul className="space-y-1 text-sm text-zinc-500">
            {lapsed.map(({ categoryId, product, cert }) => (
              <li key={`${categoryId}-${product.id}`}>
                <Link href={`/arena/${categoryId}/product/${product.id}`} className="hover:text-emerald-300">
                  {product.name}
                </Link>{' '}
                — {CERT_LEVEL_LABELS[cert.level]} · certified {cert.date} · expired {certificationExpires(cert)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
