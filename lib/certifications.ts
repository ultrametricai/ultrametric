import { z } from 'zod'

// Agent-Ready certifications — the registry side of the self-serve conformance suite
// (`ultrametric-cli certify <url>`, protocol in docs/certification.md). One optional file per
// arena, `open-rankings/<category>/certifications.json`, loaded tolerant-optionally into CategoryData
// by lib/data.ts (same "absence is not an error" contract as popularity/claims/uncertainty/
// vendor-responses).
//
// Deliberately `node:fs`-free (schema + pure date math only) so client components can import
// the type and helpers — file reading stays in lib/data.ts, mirroring lib/data-helpers.ts.

export const CERTIFICATION_TTL_DAYS = 180

export const CertificationLevelSchema = z.enum(['agent-ready', 'agent-native'])
export type CertificationLevel = z.infer<typeof CertificationLevelSchema>

export const CertificationSchema = z.object({
  productId: z.string().min(1),
  level: CertificationLevelSchema,
  /** ISO date (YYYY-MM-DD) the suite was run and verified. Expiry = date + 180 days. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  /** The committed machine-verifiable cert-report.json (checks, timestamps, response digests). */
  reportUrl: z.string().min(1),
  /**
   * Who ran the suite: 'vendor' = the vendor ran it and submitted the report through the
   * certification issue form (domain-verified, maintainer re-ran and matched); 'maintainer' =
   * we ran it ourselves to seed/spot-check — labeled distinctly on the site, never passed off
   * as a vendor submission.
   */
  initiatedBy: z.enum(['vendor', 'maintainer']),
})
export type Certification = z.infer<typeof CertificationSchema>

export const CertificationsArraySchema = z.array(CertificationSchema)

export const CERT_LEVEL_LABELS: Record<CertificationLevel, string> = {
  'agent-ready': 'Certified Agent-Ready',
  'agent-native': 'Certified Agent-Native',
}

/** ISO date (YYYY-MM-DD) this certification lapses: date + CERTIFICATION_TTL_DAYS. */
export function certificationExpires(cert: Pick<Certification, 'date'>): string {
  const t = new Date(`${cert.date}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + CERTIFICATION_TTL_DAYS)
  return t.toISOString().slice(0, 10)
}

export function isCertificationExpired(cert: Pick<Certification, 'date'>, now: Date = new Date()): boolean {
  return now.toISOString().slice(0, 10) > certificationExpires(cert)
}

/**
 * The certification to display for one product, if any: the (single, enforced by lib/data.ts)
 * entry for that product — but only while unexpired. An expired certification is simply not a
 * certification anymore; the committed report stays in git history, the chip disappears.
 */
export function activeCertificationFor(
  certifications: Certification[],
  productId: string,
  now: Date = new Date(),
): Certification | undefined {
  return certifications.find((c) => c.productId === productId && !isCertificationExpired(c, now))
}
