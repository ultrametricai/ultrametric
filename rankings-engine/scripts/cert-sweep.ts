// Weekly certification sweep (.github/workflows/cert-sweep.yml) — keeps /certified
// self-sustaining with the same keyless conformance suite vendors run themselves
// (pipeline/scripts/certify.ts, protocol in docs/CERTIFICATION.md). Two passes:
//
//   1. Re-verify every currently certified product against its committed report's target.
//      Pass at the same level        → refresh (new date + report) only when the certification
//                                      is expired or inside the renewal window, so quiet weeks
//                                      stay diff-free (expiry math: lib/certifications.ts).
//      Pass at a different level     → update the registry entry to the level earned TODAY.
//      Fail (no level earned)        → remove the entry and commit the failing report next to
//                                      it — the schema has no "revoked" state; absence is how a
//                                      lapsed certification is expressed (lib/certifications.ts),
//                                      and the committed failing report makes the removal
//                                      auditable in the PR diff.
//
//   2. Certify new passers from the probe-evidence candidate queue
//      (pipeline/scripts/cert-candidates.ts), capped at CANDIDATE_CAP per run so the weekly
//      job stays bounded; everything past the cap is logged and, because certified products
//      leave the queue, the deterministic ordering pages through the backlog week by week.
//
// Every certification written here is initiatedBy 'maintainer' — the suite ran in our CI, not
// submitted by the vendor (see lib/certifications.ts). Keyless by construction: runCertify
// only GETs/POSTs public vendor surfaces. Run manually with
//
//   pnpm tsx pipeline/scripts/cert-sweep.ts
//
// then `node scripts/generate-badges.mjs` to re-render the /badges SVGs from the updated
// registry (the workflow does both).
import fs from 'node:fs'
import path from 'node:path'
import { runCertify, type CertReport } from './certify'
import { certificationExpires, CertificationsArraySchema, type Certification } from '../../lib/certifications'
import { ProductSchema } from '../../lib/schemas'
import { DATA_DIR, readCategories, readJson, writeJson } from '../paths'
import { collectCertCandidates, type CertCandidate } from './cert-candidates'

/** Weekly new-candidate budget — keeps a run to a bounded number of live suites. */
export const CANDIDATE_CAP = 15

/** Refresh a passing certification only when it expires within this window (or already has);
 * outside it a clean pass writes nothing, keeping the weekly diff quiet. */
export const RENEW_WINDOW_DAYS = 45

const today = () => new Date().toISOString().slice(0, 10)

/** True when the certification is expired, or will be within RENEW_WINDOW_DAYS. */
export function needsRenewal(cert: Pick<Certification, 'date'>, todayIso: string = today()): boolean {
  const horizon = new Date(`${todayIso}T00:00:00.000Z`)
  horizon.setUTCDate(horizon.getUTCDate() + RENEW_WINDOW_DAYS)
  return certificationExpires(cert) <= horizon.toISOString().slice(0, 10)
}

const certsFile = (arena: string) => path.join(DATA_DIR, arena, 'certifications.json')
const reportFile = (arena: string, productId: string) => path.join(DATA_DIR, arena, 'cert-reports', `${productId}.json`)

function writeCerts(arena: string, certs: Certification[]): void {
  writeJson(certsFile(arena), [...certs].sort((a, b) => a.productId.localeCompare(b.productId)))
}

/** The URL to re-run the suite against: the committed report's own target (byte-for-byte what
 * was verified last time), falling back to the product's docs/site URL. */
function reverifyTarget(arena: string, productId: string): string | null {
  const rf = reportFile(arena, productId)
  if (fs.existsSync(rf)) {
    const report = JSON.parse(fs.readFileSync(rf, 'utf8')) as { target?: unknown }
    if (typeof report.target === 'string' && report.target.length > 0) return report.target
  }
  const productsFile = path.join(DATA_DIR, arena, 'products.json')
  if (!fs.existsSync(productsFile)) return null
  const product = readJson(ProductSchema.array(), productsFile).find((p) => p.id === productId)
  return product ? (product.urls.docs ?? product.urls.site) : null
}

async function certifyOrNull(target: string): Promise<CertReport | null> {
  try {
    return await runCertify(target)
  } catch (err) {
    console.log(`  suite error for ${target}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function reverifyPass(): Promise<{ verified: number; renewed: number; removed: string[] }> {
  const date = today()
  let verified = 0
  let renewed = 0
  const removed: string[] = []
  for (const cat of readCategories()) {
    const file = certsFile(cat.id)
    if (!fs.existsSync(file)) continue
    const certs = readJson(CertificationsArraySchema, file)
    let dirty = false
    const kept: Certification[] = []
    for (const cert of certs) {
      const target = reverifyTarget(cat.id, cert.productId)
      if (!target) {
        console.log(`  KEEP ${cat.id}/${cert.productId}: no report target or product URL to re-verify against`)
        kept.push(cert)
        continue
      }
      const report = await certifyOrNull(target)
      if (!report) {
        // Suite could not run at all (e.g. transient DNS failure) — never drop a certification
        // on our own infrastructure hiccup; the entry still expires on schedule if this persists.
        kept.push(cert)
        continue
      }
      if (report.level === null) {
        // Former passer fails today: commit the failing report (auditable evidence) and remove
        // the registry entry — expiry-by-absence is the only lapse the schema supports.
        writeJson(reportFile(cat.id, cert.productId), report)
        removed.push(`${cat.id}/${cert.productId}`)
        dirty = true
        const failing = report.checks.filter((c) => c.status === 'fail').map((c) => c.id)
        console.log(`  REMOVED ${cat.id}/${cert.productId}: no level earned today (failing: ${failing.join(', ')})`)
        continue
      }
      if (report.level !== cert.level || needsRenewal(cert, date)) {
        writeJson(reportFile(cat.id, cert.productId), report)
        kept.push({ ...cert, level: report.level, date })
        dirty = true
        renewed++
        const why = report.level !== cert.level ? `level ${cert.level} -> ${report.level}` : `renewed (was expiring ${certificationExpires(cert)})`
        console.log(`  RENEWED ${cat.id}/${cert.productId}: ${why}`)
        continue
      }
      kept.push(cert)
      verified++
      console.log(`  ok ${cat.id}/${cert.productId}: ${report.level} re-verified (expires ${certificationExpires(cert)})`)
    }
    if (dirty) writeCerts(cat.id, kept)
  }
  return { verified, renewed, removed }
}

async function candidatePass(): Promise<{ certified: string[]; failed: string[]; skipped: CertCandidate[] }> {
  const queue = collectCertCandidates()
  const batch = queue.slice(0, CANDIDATE_CAP)
  const skipped = queue.slice(CANDIDATE_CAP)
  console.log(`cert-sweep: candidate queue has ${queue.length} product(s); running ${batch.length} (cap ${CANDIDATE_CAP})`)
  if (skipped.length > 0) {
    console.log(`  skipped this week (${skipped.length}, queued for future runs): ${skipped.map((c) => `${c.arena}/${c.productId}`).join(', ')}`)
  }
  const date = today()
  const certified: string[] = []
  const failed: string[] = []
  for (const cand of batch) {
    const report = await certifyOrNull(cand.target)
    if (!report || report.level === null) {
      failed.push(`${cand.arena}/${cand.productId}`)
      const failing = report ? report.checks.filter((c) => c.status === 'fail').map((c) => c.id).join(', ') : 'suite error'
      console.log(`  no cert ${cand.arena}/${cand.productId} (${cand.target}): ${failing}`)
      continue
    }
    writeJson(reportFile(cand.arena, cand.productId), report)
    const file = certsFile(cand.arena)
    const certs = fs.existsSync(file) ? readJson(CertificationsArraySchema, file) : []
    writeCerts(cand.arena, [
      ...certs.filter((c) => c.productId !== cand.productId),
      {
        productId: cand.productId,
        level: report.level,
        date,
        reportUrl: `/data/${cand.arena}/cert-reports/${cand.productId}.json`,
        initiatedBy: 'maintainer',
      },
    ])
    certified.push(`${cand.arena}/${cand.productId} (${report.level})`)
    console.log(`  CERTIFIED ${cand.arena}/${cand.productId}: ${report.level}`)
  }
  return { certified, failed, skipped }
}

async function run(): Promise<void> {
  console.log('cert-sweep: re-verifying current certifications')
  const reverify = await reverifyPass()
  const candidates = await candidatePass()
  console.log(
    `cert-sweep: done — ${reverify.verified} re-verified unchanged, ${reverify.renewed} renewed/releveled, ` +
      `${reverify.removed.length} removed, ${candidates.certified.length} newly certified, ` +
      `${candidates.failed.length} candidate(s) failed, ${candidates.skipped.length} deferred past the cap`,
  )
  if (reverify.removed.length > 0) console.log(`  removed: ${reverify.removed.join(', ')}`)
  if (candidates.certified.length > 0) console.log(`  new: ${candidates.certified.join(', ')}`)
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
