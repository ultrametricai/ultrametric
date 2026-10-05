import type { SharedRecord } from './schema'

export function processSummary(record: SharedRecord, records: SharedRecord[] = []) {
  let agent = 0, unverified = 0, approvals = 0, steps = 0, subprocesses = 0, manual = 0, person = 0, signature = 0
  let resolved = true, classified = true
  function visit(current: SharedRecord, ancestors: Set<string>) {
    if (ancestors.has(current.id)) { resolved = false; return }
    const next = new Set(ancestors).add(current.id)
    for (const part of current.parts) {
      // Conditional add-ons and alternative methods are not part of the default scope.
      if (part.when || part.metadata.jurisdictions) continue
      if (part.kind === 'reference') {
        const referenced = records.find(record => record.id === part.ref)
        if (!referenced) { resolved = false; continue }
        subprocesses++
        visit(referenced, next)
        continue
      }
      steps++
      const metadata = part.kind === 'decision' ? part.options.find(option => option.id === 'default')?.metadata ?? part.metadata : part.metadata
      if (!metadata || !['agent', 'form', 'person'].includes(String(metadata.route))) { classified = false; continue }
      if (metadata.legalSignature === true) { signature++; continue }
      if (metadata.route === 'form') { manual++; continue }
      if (metadata.route === 'person') { person++; continue }
      if (current.id === 'form_001' && part.id === 'n3') unverified++
      else { agent++; if (metadata.approvalRequired === true) approvals++ }
    }
  }
  visit(record, new Set())
  const supported = resolved && classified
  return {
    automation: null, completionTime: null, cost: null,
    // Same default-path route arithmetic as lib/processes.ts computeCeiling.
    // Retained agent classifications include unverified bindings; this is not
    // a provider coverage score or a verified execution percentage.
    agentCeiling: supported && steps > 0 ? Math.round(((agent + unverified) / steps) * 100) : null,
    steps: resolved && steps > 0 ? steps : null,
    subprocesses: resolved && subprocesses > 0 ? subprocesses : null,
    approvals: supported && approvals > 0 ? approvals : null,
    agent: supported && agent > 0 ? agent : null,
    unverified: supported && unverified > 0 ? unverified : null,
    manual: supported && manual > 0 ? manual : null,
    person: supported && person > 0 ? person : null,
    signature: supported && signature > 0 ? signature : null,
  }
}
