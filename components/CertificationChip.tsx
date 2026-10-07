import { CERT_LEVEL_LABELS, certificationExpires, type Certification } from '@/lib/certifications'
import GeoMark from '@/components/GeoMark'
import { withBase } from '@/lib/site'

// The Agent-Ready certification chip (docs/CERTIFICATION.md): level + certification date +
// a link to the committed machine-verifiable cert-report.json. Rendered near the product
// header (and reused on /certified). Only ever given an ACTIVE certification — expiry
// filtering happens at the call site via activeCertificationFor(), so this component never
// needs to render an "expired" state.
//
// Maintainer-initiated seeds are labeled distinctly from vendor submissions: an earned level
// is an earned level either way, but who ran the suite is part of the public record.
export default function CertificationChip({ cert }: { cert: Certification }) {
  const reportHref = cert.reportUrl.startsWith('/') ? withBase(cert.reportUrl) : cert.reportUrl
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-400/5 px-2.5 py-0.5 text-xs text-emerald-300"
      title={`${CERT_LEVEL_LABELS[cert.level]} — conformance suite passed on ${cert.date} (${
        cert.initiatedBy === 'vendor' ? 'vendor-submitted, maintainer-verified' : 'maintainer-initiated'
      }); expires ${certificationExpires(cert)} — every check is in the linked report`}
    >
      {/* The level's star-polygon seal (components/GeoMark.tsx), seeded by the level id so
          agent-ready and agent-native each wear one distinct mark site-wide. */}
      <GeoMark seed={cert.level} title={CERT_LEVEL_LABELS[cert.level]} size={14} variant="star" />
      <span className="rounded border border-emerald-400/60 px-1 text-[9px] font-semibold uppercase tracking-wide">
        Certified
      </span>
      {CERT_LEVEL_LABELS[cert.level].replace(/^Certified /, '')} · {cert.date}
      <a
        href={reportHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-200"
      >
        report
      </a>
    </span>
  )
}
