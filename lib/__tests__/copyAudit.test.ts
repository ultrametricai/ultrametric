import { describe, expect, it } from 'vitest'
import { copyAuditCounts, loadCopyAudit } from '@/lib/copyAudit'

// Gates for the curated copy audit behind the site's /admin (rankings/copy-audit.json): the
// schema must hold, ids must be unique, and every 'keep' must carry its honesty/legal reason.
// The cited file and route existence checks run in the private site repo, where app/ and
// components/ live since the split (the audit cites site surfaces).

describe('copy audit (rankings/copy-audit.json)', () => {
  const audit = loadCopyAudit()

  it('parses against the schema with unique ids', () => {
    const ids = audit.candidates.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every keep carries a reason, and counts add up', () => {
    for (const c of audit.candidates) {
      if (c.suggestion === 'keep') {
        expect(c.why.length, `${c.id}: keep needs its honesty/legal reason`).toBeGreaterThanOrEqual(8)
      }
    }
    const counts = copyAuditCounts(audit)
    expect(counts.cut + counts.tighten + counts.keep).toBe(counts.total)
    expect(counts.total).toBe(audit.candidates.length)
    // The whole point of the audit is finding superfluous copy — it must actually flag some.
    expect(counts.cut).toBeGreaterThan(0)
    expect(counts.tighten).toBeGreaterThan(0)
    // …and it must protect the honesty/legal floor.
    expect(counts.keep).toBeGreaterThan(0)
  })
})
