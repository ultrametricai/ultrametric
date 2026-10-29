import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { EXECUTION_CATEGORIES, executionSchema, validateExecution, type Execution } from '../execution'
import { buildManifestStep, MANIFEST_VERSION } from '../processManifest'
import { loadProcesses } from '../processes'
import { loadProcessCatalog, validateExecutionCoverage } from '../shared-processes/catalog'
import { graphExecutionType } from '../shared-processes/graph'
import { processSummary } from '../shared-processes/summary'
import type { Part } from '../shared-processes/schema'

const records = loadProcessCatalog().processes.map(process => process.record)
function scopes(parts: Part[]): Array<{ metadata: Record<string, unknown> }> {
  return parts.flatMap(part => [part, ...part.options.flatMap(option => [option, ...scopes(option.parts)])])
}
const execution = (category: Execution['category'], basis: Execution['basis']): Execution => ({
  category, basis, rationale: 'Fixture assessment', evidence: ['fixture'], reviewRequired: category === null,
})
const part = (id: string, step: string) => records.find(record => record.id === id)!.parts.find(part => part.id === step)!

describe('execution assessments', () => {
  it('separates automation documentation from observed verification without requiring it on legacy imports', () => {
    const legacy = execution('human-online', 'human-work')
    expect(executionSchema.parse(legacy).automationEvidence).toBeUndefined()
    expect(() => validateExecution({ execution: { ...legacy, automationEvidence: { status: 'unverified' } } }, 'fixture')).not.toThrow()
    const documented = { ...execution('agent-native', 'documented-interface'), automationEvidence: { status: 'documented' } }
    expect(() => validateExecution({ execution: documented }, 'fixture')).not.toThrow()
    expect(executionSchema.safeParse({ ...documented, automationEvidence: { status: 'observed' } }).success).toBe(false)
    const observed = { status: 'observed', scope: 'Fictional read-only status retrieval', observedAt: '2026-01-01T00:00:00Z', receipt: 'fixture-receipt' }
    expect(() => validateExecution({ execution: { ...documented, automationEvidence: observed } }, 'fixture')).toThrow('receipt')
    expect(() => validateExecution({ execution: { ...documented, evidence: ['fixture-receipt'], automationEvidence: observed } }, 'fixture')).not.toThrow()
    expect(() => validateExecution({ execution: { ...documented, automationEvidence: { status: 'unverified' } } }, 'fixture')).toThrow('supported automation evidence')
    expect(() => validateExecution({ legalSignature: true, execution: { ...documented, evidence: ['fixture-receipt'], automationEvidence: observed } }, 'fixture')).toThrow('human signature')
  })
  it('requires complete authoring coverage but permits older additive-schema imports', () => {
    expect(() => validateExecutionCoverage(records)).not.toThrow()
    const copied = structuredClone(records)
    delete copied[0].parts[0].metadata.execution
    expect(() => validateExecutionCoverage(copied)).toThrow('missing execution assessment')
    expect(() => validateExecution({}, 'legacy import')).not.toThrow()
  })
  it('rejects incomplete canonical classifications without rejecting nullable legacy imports', () => {
    const copied = structuredClone(records)
    const target = copied[0].parts[0]
    target.metadata.execution = execution(null, 'unresolved')
    expect(() => validateExecution(target.metadata, 'legacy import')).not.toThrow()
    expect(() => validateExecutionCoverage(copied)).toThrow('four categories')
    target.metadata.execution = execution('human-online', 'human-work')
    expect(() => validateExecutionCoverage(copied)).toThrow('automation evidence status')
    target.metadata.execution = { ...execution('human-online', 'human-work'), automationEvidence: { status: 'unverified' } }
    expect(() => validateExecutionCoverage(copied)).not.toThrow()
    const option = copied.flatMap(record => record.parts).flatMap(part => part.options)[0]
    option.metadata.execution = execution(null, 'unresolved')
    expect(() => validateExecutionCoverage(copied)).toThrow('four categories')
  })
  it('assigns every canonical scope a category independently of automation verification and review', () => {
    const assessments = records.flatMap(record => scopes(record.parts)).flatMap(scope => scope.metadata.execution ? [scope.metadata.execution as Execution] : [])
    // Startup lifecycle expansion, 2026-10-29: 353 additional authored step assessments.
    expect(assessments).toHaveLength(1495)
    for (const assessment of assessments) {
      expect(EXECUTION_CATEGORIES).toContain(assessment.category)
      expect(assessment.automationEvidence).toBeDefined()
      expect(assessment.automationEvidence?.status).not.toBe('observed')
    }
    for (const record of records) for (const scope of scopes(record.parts)) {
      if (scope.metadata.legalSignature === true) {
        expect((scope.metadata.execution as Execution).category).toMatch(/^human-/)
      }
    }
    expect(part('opp_008', 'n2').metadata.execution).toMatchObject({ category: 'human-online', automationEvidence: { status: 'unverified' }, reviewRequired: true })
    expect(part('growth_014', 'n4').metadata.execution).toMatchObject({ category: 'agent-native', automationEvidence: { status: 'documented' } })
    expect(part('form_001', 'n3').metadata.execution).toMatchObject({ category: 'agent-computer-use', automationEvidence: { status: 'documented' }, reviewRequired: true })
  })
  it('accounts for physical work in combined scopes without treating digital evidence gaps as physical', () => {
    for (const [process, step] of [['sit_019', 'n6'], ['ops_013', 'n3'], ['sit_018', 'n2']]) {
      expect(part(process, step).metadata.execution).toMatchObject({ category: 'human-offline', basis: 'human-work', automationEvidence: { status: 'unverified' } })
    }
    for (const [process, step] of [['growth_015', 'n6'], ['sit_022', 'n2'], ['site_001', 'n2']]) {
      expect(part(process, step).metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work', automationEvidence: { status: 'unverified' } })
    }
    const eor = part('hr_001', 'n4').options.find(option => option.id === 'eor-hire')!
    expect(eor.metadata.execution).toMatchObject({ category: 'human-online', automationEvidence: { status: 'unverified' } })
    const comparison = part('qs_051', 'n2').options.find(option => option.id === 'germany-gesellschafterliste')!
    expect(comparison.metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('classifies new phone and nonprofit work without confusing API selection, drafting or personal execution', () => {
    const phone = 'set-up-a-business-phone-number'
    const nonprofit = 'set-up-a-non-profit'
    const apiChoice = part(phone, 'n1').options.find(option => option.id === 'programmable-api')!
    expect(apiChoice.metadata.execution).toMatchObject({ category: 'human-online', automationEvidence: { status: 'unverified' } })
    const port = part(phone, 'n2').options.find(option => option.id === 'port-existing')!
    expect(port.metadata.execution).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect((port.metadata.execution as Execution).rationale).toMatch(/personally signs/)
    for (const step of ['n5', 'n6']) {
      expect(part(phone, step).metadata.execution).toMatchObject({ category: 'human-online', automationEvidence: { status: 'unverified' } })
    }
    expect(part(nonprofit, 'n3').metadata.execution).toMatchObject({ category: 'agent-native', basis: 'local-work', reviewRequired: true, automationEvidence: { status: 'documented' } })
    for (const step of ['n5', 'n7']) {
      expect(part(nonprofit, step).metadata).toMatchObject({ approvalRequired: true, execution: { category: 'human-online', reviewRequired: true } })
    }
  })
  it('includes provider-side webhook verification and the complete payment run in classification', () => {
    const webhook = part('growth_001', 'n4').metadata.execution as Execution
    expect(webhook).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true, automationEvidence: { status: 'documented' } })
    expect(webhook.evidence).toContain('open-processes/set-up-subscription-billing.json#/parts/3/metadata/verify')
    expect(webhook.evidence).toContain('https://docs.stripe.com/webhooks')
    const payment = part('fin_001', 'n3')
    expect(payment.metadata).toMatchObject({ approvalRequired: true, execution: { category: 'human-online', reviewRequired: true, automationEvidence: { status: 'unverified' } } })
    expect((payment.metadata.execution as Execution).evidence).toContain('open-processes/pay-vendor-invoices.json#/parts/2/metadata/verify')
  })
  it('keeps personal declarations and signing inside combined filing scopes human-operated', () => {
    for (const [process, step, optionId] of [['form_011', 'n3', 'france-sarl-eurl'], ['legal_002', 'n5', 'india-ipindia']]) {
      const option = part(process, step).options.find(option => option.id === optionId)!
      expect(option.metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true, automationEvidence: { status: 'unverified' } })
      expect((option.metadata.execution as Execution).rationale).toMatch(/personally signs|signing responsibility/)
    }
  })
  it('rejects properties as categories and unsupported evidence bases', () => {
    for (const category of ['signature', 'approval', 'action', 'choice', 'agent', 'form', 'person']) {
      expect(executionSchema.safeParse({ ...execution(null, 'unresolved'), category }).success).toBe(false)
    }
    expect(() => validateExecution({ execution: execution('agent-native', 'human-work') }, 'fixture')).toThrow('documented interface')
    expect(() => validateExecution({ execution: { ...execution(null, 'unresolved'), reviewRequired: false } }, 'fixture')).toThrow('review')
    expect(() => validateExecution({ execution: execution('agent-native', 'local-work'), legalSignature: true }, 'fixture')).toThrow('human signature')
  })
  it('keeps browser evidence, IRS access limits, physical acts and local tools distinct', () => {
    expect(part('form_001', 'n3').metadata.execution).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(part('form_002', 'n3').metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(part('form_002', 'n3').metadata.execution).toHaveProperty('evidence', expect.arrayContaining(['open-rankings/experiments/computer-use/irs-ein-online.json']))
    expect(part('hr_005', 'n8').metadata.execution).toMatchObject({ category: 'human-offline' })
    const logo = part('brand_002', 'n1')
    expect(logo.options.find(option => option.id === 'design-tool-logo')!.metadata.execution).toMatchObject({ category: 'agent-native', basis: 'local-work' })
    expect(part('qs_050', 'n3').metadata.execution).toHaveProperty('evidence', expect.arrayContaining(['lib/openstartup/runway.ts']))
  })
  it('classifies documented controls independently of human permission and personal test receipts', () => {
    for (const [process, step] of [['comp_001', 'n5'], ['qs_063', 'n4'], ['scale_004', 'n3'], ['sw_011', 'n1']]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence' })
      expect(assessment.evidence.some(source => source.startsWith('https://'))).toBe(true)
    }
    expect(part('form_002', 'n2').metadata.execution).toMatchObject({ category: 'agent-native', basis: 'local-work' })
    expect(part('growth_014', 'n4').metadata.execution).toMatchObject({ category: 'agent-native', basis: 'documented-interface' })
    // Personal authentication stays with the teammate; known browser capability
    // remains distinct from a human-operated digital path.
    expect(part('team_001', 'n2').metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work' })
  })
  it('requires the retained provider and covers live operations beyond drafting', () => {
    const contractor = part('hr_003', 'n4').metadata.execution as Execution
    expect(contractor.category).toBe('agent-computer-use')
    expect(contractor.evidence.some(source => source.includes('help.letsdeel.com'))).toBe(true)
    expect(contractor.evidence.some(source => source.includes('docusign.com'))).toBe(false)
    const kickoff = part('scale_012', 'n5').metadata.execution as Execution
    expect(kickoff.evidence.some(source => source.includes('slack.dev'))).toBe(true)
    expect(kickoff.evidence.some(source => source.includes('notion.com'))).toBe(true)
    const message = part('opp_008', 'n2').metadata.execution as Execution
    expect(message.category).toBe('human-online')
    expect(message.evidence.some(source => source.includes('fastmail.com'))).toBe(true)
    expect(message.evidence.some(source => source.includes('gmail'))).toBe(false)
    const groups = part('scale_007', 'n2').metadata.execution as Execution
    expect(groups.basis).toBe('documented-interface')
    expect(groups.evidence.some(source => source.includes('developer.okta.com'))).toBe(true)
    const exports = part('sit_013', 'n2').metadata.execution as Execution
    expect(exports.category).toBe('agent-native')
    for (const resource of ['charges', 'customers', 'subscriptions', 'disputes', 'payouts']) {
      expect(exports.evidence).toContain(`https://docs.stripe.com/api/${resource}/list`)
    }
  })
  it('assesses monitoring work separately from the institution deciding its outcome', () => {
    for (const [process, step] of [['prod_012', 'n5'], ['fund_007', 'n6'], ['fund_003', 'n5'], ['ins_001', 'n4'], ['sit_002', 'n9'], ['sit_006', 'n7'], ['sit_016', 'n7']]) {
      const node = part(process, step)
      expect(node.metadata.execution).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence' })
      expect(node.metadata.async).toBe(true)
      expect(node.metadata.route).toBe('person')
    }
    // A monitoring label does not prove every channel in a combined workflow.
    expect(part('vc_003', 'n2').metadata.execution).toMatchObject({ category: 'human-online', reviewRequired: true })
  })
  it('uses the valuation provider correspondence without inventing a mail API', () => {
    const valuation = part('fund_003', 'n5').metadata.execution as Execution
    expect(valuation).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(valuation.rationale).toMatch(/questions and clarifications sent by email/)
    expect(valuation.evidence.some(source => source.includes('how-to-view-your-409a-valuation-status'))).toBe(true)
    expect(valuation.evidence.some(source => /gmail|graph\.microsoft|api\//.test(source))).toBe(false)
    // Following up on an offer does not establish that policy's binding route.
    expect(part('ins_001', 'n6').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('uses explicit filing media and keeps electronic signing a human act', () => {
    expect(part('qs_047', 'jny1').metadata.execution).toMatchObject({ category: 'agent-computer-use' })
    expect(part('qs_043', 'jwy1').metadata.execution).toMatchObject({ category: 'human-offline' })
    for (const [process, step] of [['fund_002', 'n5b'], ['vendor_011', 'n8'], ['vc_002', 'n3'], ['hr_013', 'n3'], ['hr_003', 'n6'], ['form_001', 'n6b']]) {
      const node = part(process, step)
      expect(node.metadata).toMatchObject({ legalSignature: true, execution: { category: 'human-online', basis: 'human-work' } })
      expect(() => validateExecution(node.metadata, `${process}/${step}`)).not.toThrow()
      expect(() => validateExecution({ ...node.metadata, execution: execution('agent-native', 'documented-interface') }, 'signature')).toThrow('human signature')
    }
    const german = part('form_001', 'n4').options.find(option => option.id === 'germany-notary-gmbh')!
    expect(german.parts.find(part => part.id === 'de2')!.metadata.execution).toMatchObject({ category: 'human-offline', reviewRequired: true })
  })
  it('separates documented mail preparation from the applicant witnessing procedure', () => {
    const preparation = part('qs_044', 'n4a').metadata.execution as Execution
    expect(preparation).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    for (const provider of ['support.usestable.com', 'help.earthclassmail.com', 'help.virtualpostmail.com']) {
      expect(preparation.evidence.some(source => source.includes(provider))).toBe(true)
    }
    expect(preparation.rationale).toMatch(/applicant supplies personal identity evidence/)
    expect(part('qs_044', 'n4').metadata).toMatchObject({
      legalSignature: true,
      execution: { category: 'human-offline', basis: 'human-work', reviewRequired: true },
    })
  })
  it('classifies a documented CLI pipeline without claiming the app-specific trial has run', () => {
    const pipeline = part('prod_012', 'n3').metadata.execution as Execution
    expect(pipeline).toMatchObject({ category: 'agent-native', basis: 'documented-interface', reviewRequired: true })
    for (const provider of ['docs.fastlane.tools', 'docs.expo.dev']) {
      expect(pipeline.evidence.some(source => source.includes(provider))).toBe(true)
    }
    expect(pipeline.rationale).toMatch(/failure tests and manual recovery procedure still require validation/)
    // Upload tooling does not establish the separate production device trial.
    expect(part('prod_012', 'n7').metadata.execution).toMatchObject({ category: 'human-offline' })
  })
  it('uses conservative remote human reviews and preserves personal signing', () => {
    const review = part('scale_001', 'n5').metadata.execution as Execution
    expect(review).toMatchObject({ category: 'human-online', basis: 'human-work' })
    expect(review.evidence).toContain('open-processes/run-performance-reviews.json#/parts/1/references')
    expect(review.evidence.some(source => source.includes('help.bamboohr.com'))).toBe(true)
    // The separately authored calibration meeting uses a feasible remote human path.
    expect(part('scale_001', 'n6').metadata.execution).toMatchObject({ category: 'human-online' })
    const signing = part('startup_002', 'n3b')
    expect(signing.metadata.legalSignature).toBe(true)
    // The human signing path retains any separately required notarial prerequisite.
    expect(signing.metadata.execution).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect((signing.metadata.execution as Execution).evidence).toContain('open-processes/sign-the-founder-agreement-split-equity.json#/parts/2/guidance')
  })
  it('distinguishes online form preparation from physical filing and unselected alternatives', () => {
    for (const [process, step] of [['form_001', 'jny1'], ['form_001', 'jfl1'], ['qs_043', 'jfl1']]) {
      expect(part(process, step).metadata.execution).toMatchObject({ category: 'human-offline', basis: 'human-work' })
    }
    const emi = part('fund_003', 'n3').options.find(option => option.id === 'uk-emi-valuation')!
    expect(emi.metadata.execution).toMatchObject({ category: 'human-offline' })
    expect((emi.metadata.execution as Execution).evidence).toContain('https://www.gov.uk/government/publications/asset-valuation-request-for-a-share-valuation-val231')
    const allotment = part('fund_002', 'n8').options.find(option => option.id === 'uk-sh01')!
    expect(allotment.metadata.execution).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    // An unrelated online Companies House service cannot establish LLP formation.
    const llp = part('form_011', 'n3').options.find(option => option.id === 'uk-llp')!
    expect(llp.metadata.execution).toMatchObject({ category: 'human-offline', reviewRequired: true })
    expect(part('qs_043', 'jny1').metadata.execution).toMatchObject({ category: 'human-offline', reviewRequired: true })
  })
  it('uses the surrounding selected provider without substituting a reference vendor', () => {
    const routing = part('opp_011', 'n3')
    const assessment = routing.metadata.execution as Execution
    expect(assessment.category).toBe('agent-computer-use')
    expect(assessment.evidence).toContain('open-processes/set-up-email-routing-on-your-domain.json#/parts/1/references')
    expect(assessment.evidence.some(source => source.includes('fastmail.help'))).toBe(true)
    // The general Microsoft reference remains source content, not proof that
    // this process's selected Fastmail mailbox is a Microsoft mailbox.
    expect(routing.references.some(ref => ref.kind === 'url' && ref.url.includes('learn.microsoft.com'))).toBe(true)
    expect(assessment.evidence.some(source => source.includes('learn.microsoft.com'))).toBe(false)
  })
  it('covers conversion operations rather than treating a forecast as an issued holding', () => {
    const conversion = part('fund_006', 'n5').metadata.execution as Execution
    expect(conversion).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(conversion.evidence.some(source => source.includes('how-to-convert-convertibles-into-certificates'))).toBe(true)
    expect(conversion.evidence.some(source => source.includes('portfolio-management-safes-and-notes'))).toBe(false)
    // A provider listing does not override an explicit unsupported-operation
    // boundary for a different kind of conversion.
    for (const step of ['n5', 'n7']) {
      const llc = part('form_012', step).metadata.execution as Execution
      expect(llc).toMatchObject({ category: 'human-online', reviewRequired: true })
      expect(llc.evidence).toContain('https://help.clerky.com/article/2662-existing-entity')
    }
  })
  it('classifies feasible remote human decisions without reusing an unrelated probe', () => {
    for (const [process, step] of [['sit_020', 'n4'], ['sit_022', 'n2']]) {
      expect(part(process, step).metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    }
    const availability = part('form_001', 'n3').metadata.execution as Execution
    expect(availability.evidence).toContain('https://icis.corp.delaware.gov/Ecorp/NameReserv/NameReservation.aspx')
    expect(availability.rationale).toMatch(/image-code challenge/)
    expect(availability.rationale).toMatch(/existing-entity lookup probe did not test availability/)
  })
  it('requires evidence across retained alternatives when their shared mechanism resolves a scope', () => {
    for (const [process, step] of [['qs_015', 'n2'], ['qs_015', 'n3'], ['fund_005', 'n3']]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
      for (const provider of ['support.google.com', 'help.dropbox.com', 'www.notion.com']) {
        expect(assessment.evidence.some(source => source.includes(provider))).toBe(true)
      }
    }
    // Sharing evidence does not establish the separate document-migration operation.
    expect(part('qs_015', 'n4').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('separates provider paper fulfilment from company physical work and retains release approval', () => {
    const filing = part('tax_003', 'n5')
    expect(filing.metadata).toMatchObject({ approvalRequired: true, execution: { category: 'agent-computer-use', reviewRequired: true } })
    expect((filing.metadata.execution as Execution).evidence).toContain('https://support.gusto.com/article/106622233100000/distribute-1099-nec-forms-to-your-contractors')
    expect(part('qs_043', 'jwy1').metadata.execution).toMatchObject({ category: 'human-offline' })
    const email = part('growth_002', 'n4')
    expect(email.metadata.approvalRequired).toBe(true)
    const evidence = (email.metadata.execution as Execution).evidence
    expect(evidence.some(source => source.includes('support.google.com/mail'))).toBe(true)
    expect(evidence).toContain('https://knowledge.hubspot.com/tasks/create-tasks')
  })
  it('requires board distribution evidence to cover access and questions as well as sending', () => {
    const board = part('fin_010', 'n4')
    expect(board.references).toContainEqual({ kind: 'vendor', id: 'google_slides', role: 'stated-vendor' })
    const assessment = board.metadata.execution as Execution
    expect(assessment).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(assessment.evidence).toEqual(expect.arrayContaining([
      'https://support.google.com/drive/answer/7166529',
      'https://support.google.com/docs/answer/65129?hl=en',
      'https://support.google.com/docs/answer/16722399?hl=en',
    ]))
    // Retain the original partial evidence without using it as proof of the
    // access checks and question collection supplied by the browser workflow.
    expect(assessment.rationale).toMatch(/Gmail send source covers only message transmission/)
    expect(part('fin_010', 'n5').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('uses the authored code host and preserves review-trigger limitations', () => {
    for (const [process, step, slug] of [
      ['sw_011', 'n4', 'set-up-ai-code-review'],
      ['sw_001', 'n5', 'ship-a-feature-spec-to-deploy'],
    ]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'agent-native', basis: 'documented-interface', reviewRequired: true })
      expect(records.find(record => record.id === process)!.references).toContainEqual({ kind: 'vendor', id: 'github', role: 'involves' })
      expect(assessment.evidence).toContain(`open-processes/${slug}.json#/references`)
      for (const provider of ['docs.github.com', 'docs.coderabbit.ai', 'www.greptile.com', 'cursor.com']) {
        expect(assessment.evidence.some(source => source.includes(provider))).toBe(true)
      }
      expect(assessment.rationale).toMatch(/Bugbot.*manual trigger comments/)
    }
    expect(part('sw_011', 'n4').metadata.approvalRequired).toBe(true)
    // A remote team decision remains human even when the technical test is documented.
    expect(part('sw_011', 'n5').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('separates local deadline analysis from human reporting and identity checks', () => {
    expect(part('sit_021', 'n2').metadata).toMatchObject({
      riskLevel: 'high',
      execution: { category: 'agent-native', basis: 'local-work', reviewRequired: true },
    })
    expect(part('sit_021', 'n3').metadata.execution).toMatchObject({ category: 'human-online' })
    const identity = part('qs_023', 'n5').metadata.execution as Execution
    expect(identity).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(identity.evidence).toContain('open-processes/open-bank-account.json#/parts/2/metadata/geoResolutions')
    expect(identity.rationale).toMatch(/personal verification/)
  })
  it('distinguishes documented analytics controls from human survey delivery', () => {
    const survey = part('startup_001', 'n2').options.find(option => option.id === 'sean-ellis-survey')!
    const population = survey.parts.find(node => node.id === 'se1')!.metadata.execution as Execution
    expect(population).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    for (const provider of ['posthog.com', 'www.amplitude.com', 'docs.mixpanel.com']) {
      expect(population.evidence.some(source => source.includes(provider))).toBe(true)
    }
    expect(survey.parts.find(node => node.id === 'se2')!.metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('distinguishes documented infrastructure operations from browser controls and sample limits', () => {
    const warehouse = part('scale_010', 'n1')
    const snowflake = warehouse.options.find(option => option.id === 'default')!.metadata.execution as Execution
    expect(snowflake).toMatchObject({ category: 'agent-native', basis: 'documented-interface', reviewRequired: true })
    expect(snowflake.evidence).toContain('https://docs.snowflake.com/en/sql-reference/organization-usage/usage_in_currency_daily')
    const motherduck = warehouse.options.find(option => option.id === 'motherduck-small-data')!.metadata.execution as Execution
    expect(motherduck).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(motherduck.rationale).toMatch(/full database copying is restricted in the web UI/)
    const events = part('scale_010', 'n2').metadata.execution as Execution
    expect(events).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(events.rationale).toMatch(/samples incoming events/)
    // Documented source controls do not establish the separate recovery trial.
    expect(part('scale_010', 'n5').metadata.execution).toMatchObject({ category: 'human-online' })
    const dashboard = part('scale_010', 'n7').metadata.execution as Execution
    expect(dashboard.evidence).toContain('open-processes/stand-up-a-data-warehouse-bi.json#/parts/5/references')
    expect(dashboard.evidence).toContain('https://www.metabase.com/docs/latest/dashboards/subscriptions')
  })
  it('preserves acceptance and personal judgment in documented communications workflows', () => {
    const booking = part('growth_012', 'n5').metadata.execution as Execution
    expect(booking).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(booking.evidence).toContain('https://knowledge.hubspot.com/sequences/unenroll-from-sequence')
    expect(booking.rationale).toMatch(/reply alone is not acceptance/)
    expect(part('growth_012', 'n6').metadata.execution).toMatchObject({ category: 'human-online', basis: 'human-work' })
    const close = part('fin_002', 'n8')
    expect(close.metadata).toMatchObject({ approvalRequired: true, execution: { category: 'human-online' } })
    expect((close.metadata.execution as Execution).evidence).toContain('open-processes/bookkeeping-close.json#/parts/5/references')
    // Nearby finance alerts do not select the employee policy channel.
    expect(part('scale_004', 'n5').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('selects the conservative paper filing route while preserving electronic alternatives', () => {
    for (const [process, step] of [['form_012', 'n8'], ['equity.us-de.83b-election', 'file']]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'human-offline', basis: 'human-work', reviewRequired: true })
      expect(assessment.evidence).toContain('https://www.irs.gov/pub/irs-pdf/f15620.pdf')
      expect(assessment.evidence).toContain('https://www.irs.gov/forms-pubs/mobile-friendly-forms')
      expect(assessment.rationale).toMatch(/signed-paper/)
    }
  })
  it('grounds online training and filing controls while preserving personal participation', () => {
    const training = part('comp_001', 'n7').metadata.execution as Execution
    expect(training).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(training.evidence).toContain('open-processes/start-soc-2-type-i.json#/parts/0/options/0/references')
    expect(training.evidence).toContain('https://help.vanta.com/en/articles/11345841-managing-personnel-training-tasks')
    const fillip = part('form_011', 'n3').options.find(option => option.id === 'india-llp-fillip')!.metadata.execution as Execution
    expect(fillip).toMatchObject({ category: 'human-online', basis: 'human-work', automationEvidence: { status: 'unverified' }, reviewRequired: true })
    expect(fillip.rationale).toMatch(/personal signatures/)
    expect(fillip.evidence).toContain('https://www.mca.gov.in/content/mca/global/en/mca/dsc-services-v3/acquire-dsc.html')
    // An online employer-number form does not cover the combined payroll registrations.
    expect(part('qs_063', 'n3').options.find(option => option.id === 'germany-betriebsnummer')!.metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('covers tax imports and recurring filing authority separately from legal conclusions', () => {
    const study = part('tax_011', 'n2').metadata.execution as Execution
    expect(study).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(study.evidence).toContain('https://docs.stripe.com/tax/imports')
    expect(study.rationale).toMatch(/physical presence, marketplace treatment and registration conclusions/)
    const filing = part('tax_011', 'n6').metadata.execution as Execution
    expect(filing).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(filing.rationale).toMatch(/Automatic approval/)
    expect(filing.rationale).toMatch(/authority must be settled before activation/)
    expect(filing.evidence.some(source => source.endsWith('/View_an_ACH_debit_confirmation.html'))).toBe(true)
    // A browser directory does not establish the same actor for the retained human community.
    const directories = part('growth_010', 'n3').metadata.execution as Execution
    expect(directories).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(directories.evidence).toContain('https://news.ycombinator.com/newsguidelines.html')
  })
  it('uses the selected surrounding provider without claiming its external decision or other operations', () => {
    const audit = part('comp_002', 'n7').metadata.execution as Execution
    expect(audit).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(audit.evidence).toContain('open-processes/complete-soc-2-type-ii.json#/parts/1/references')
    expect(audit.evidence).toContain('https://help.vanta.com/en/articles/12293647-managing-an-information-request-list-irl')
    const appeal = part('sit_013', 'n3').metadata.execution as Execution
    expect(appeal).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(appeal.evidence).toContain('https://support.stripe.com/questions/why-was-my-stripe-account-closed')
    expect(appeal.rationale).toMatch(/does not establish reinstatement or reserve release/)
    expect(part('sit_013', 'n8').metadata.execution).toMatchObject({ category: 'human-online' })
    const shares = part('qs_051', 'n2').options.find(option => option.id === 'default')!.metadata.execution as Execution
    expect(shares).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    for (const provider of ['support.carta.com', 'help.pulley.com']) {
      expect(shares.evidence.some(source => source.includes(provider))).toBe(true)
    }
    // Founding-share import controls do not establish every later investment operation.
    expect(part('qs_051', 'n3').metadata.execution).toMatchObject({ category: 'human-online' })
    const cloud = part('sw_001', 'n3').options.find(option => option.id === 'cloud-autonomous-agent')!.metadata.execution as Execution
    expect(cloud).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    for (const provider of ['code.claude.com', 'learn.chatgpt.com']) {
      expect(cloud.evidence.some(source => source.includes(provider))).toBe(true)
    }
  })
  it('covers both billing comparison providers and preserves sandbox restrictions', () => {
    const comparison = part('growth_001', 'n1').options.find(option => option.id === 'billing-platform')!
    const assessment = comparison.metadata.execution as Execution
    expect(assessment).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    for (const provider of ['www.chargebee.com', 'docs.recurly.com']) {
      expect(assessment.evidence.some(source => source.includes(provider) && source.includes('entitlements'))).toBe(true)
    }
    expect(assessment.evidence).toContain('https://docs.recurly.com/recurly-subscriptions/docs/accounts-receivable-export')
    expect(assessment.rationale).toMatch(/automated exports are unavailable in sandbox mode/)
    // Provider comparison does not establish the other option's legal review
    // and application-access implementation.
    expect(part('growth_001', 'n1').options.find(option => option.id === 'merchant-of-record')!.metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('inherits the authored ECS method without claiming other clouds or completed trials', () => {
    for (const step of ['n7', 'n8']) {
      const assessment = part('prod_001', step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: 'agent-native', basis: 'documented-interface', reviewRequired: true })
      expect(assessment.evidence).toContain('open-processes/set-up-cloud-infrastructure.json#/parts/4/guidance')
      expect(assessment.evidence).toContain('https://docs.aws.amazon.com/cli/latest/reference/ecs/stop-task.html')
      expect(assessment.rationale).toMatch(/validation/)
    }
    const monitoring = part('prod_001', 'n7').metadata.execution as Execution
    expect(monitoring.rationale).toMatch(/responder must confirm any new email subscription/)
    expect(monitoring.rationale).toMatch(/masking does not cover earlier records/)
    for (const option of part('prod_001', 'n2').options.filter(option => option.id !== 'default')) {
      // Account administration is already supported; it does not establish
      // an implementation of the later AWS-specific resource steps.
      expect(option.metadata.execution).toMatchObject({ category: 'agent-computer-use' })
      expect(option.summary).toMatch(/downstream AWS-specific.*unresolved/)
    }
  })
  it('uses the selected deployment host while retaining complete release boundaries', () => {
    const pipeline = part('prod_002', 'n6').metadata.execution as Execution
    expect(pipeline).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(pipeline.evidence).toContain('open-processes/set-up-ci-cd.json#/summary')
    expect(pipeline.evidence).toContain('https://vercel.com/docs/instant-rollback')
    expect(pipeline.rationale).toMatch(/actor subject to branch protection/)
    expect(pipeline.rationale).toMatch(/does not establish recovery of external data/)
    const site = part('site_001', 'n2').metadata.execution as Execution
    expect(site).toMatchObject({ category: 'human-online', reviewRequired: true })
    for (const provider of ['developers.cloudflare.com', 'vercel.com']) {
      expect(site.evidence.some(source => source.includes(provider))).toBe(true)
    }
    expect(site.rationale).toMatch(/live domain and primary-action destination/)
  })
  it('grounds the Atlas LLC default without choosing a registry for the earlier name search', () => {
    const filing = part('form_011', 'n3').options.find(option => option.id === 'default')!
    expect(filing.metadata).toMatchObject({
      approvalRequired: true,
      execution: { category: 'agent-computer-use', reviewRequired: true },
    })
    const assessment = filing.metadata.execution as Execution
    expect(assessment.evidence).toContain('https://docs.stripe.com/atlas/company-types.md')
    expect(assessment.rationale).toMatch(/Founders approve.*electronic signature/)
    expect(assessment.rationale).toMatch(/another state's filing/)
    const issued = part('form_011', 'n4').metadata.execution as Execution
    expect(issued).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(issued.evidence).toContain('open-processes/set-up-an-llc.json#/parts/2/options/0')
    expect(issued.rationale).toMatch(/document must establish registry acceptance/)
    expect(part('form_011', 'n2').metadata.execution).toMatchObject({ category: 'human-online' })
    expect(part('form_011', 'n7').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('distinguishes personal online launch participation and supported UK accounting setup', () => {
    const outreach = part('growth_010', 'n4').metadata.execution as Execution
    expect(outreach).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(outreach.evidence).toContain('https://news.ycombinator.com/newsguidelines.html')
    expect(outreach.rationale).toMatch(/person with product experience/)
    const accounting = part('qs_073', 'n2').options.find(option => option.id === 'uk-frs')!.metadata.execution as Execution
    expect(accounting).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(accounting.evidence).toContain('https://central.xero.com/0/article/Enter-conversion-balances-US')
    expect(accounting.rationale).toMatch(/FRS 105 or FRS 102 1A/)
    expect(accounting.rationale).toMatch(/accountant determines/)
    expect(part('qs_073', 'n2').options.find(option => option.id === 'default')!.metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('keeps partial access evidence separate from application changes and outcomes', () => {
    const testing = part('scale_007', 'n6').metadata.execution as Execution
    expect(testing).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(testing.evidence).toContain('open-processes/set-up-sso-access-management.json#/parts/2/references')
    expect(testing.automationEvidence).toEqual({ status: 'unverified' })
    const access = part('comp_002', 'n4').metadata.execution as Execution
    expect(access).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(access.evidence).toContain('https://help.vanta.com/en/articles/11345416-access-reviews')
    expect(access.automationEvidence).toEqual({ status: 'unverified' })
  })
  it('keeps combined platform closings and the CPA’s e-file work human', () => {
    const vehicle = part('fund_001', 'n4').options.find(option => option.id === 'platform-syndicate')!.metadata.execution as Execution
    expect(vehicle).toMatchObject({ category: 'human-online', basis: 'human-work', automationEvidence: { status: 'unverified' }, reviewRequired: true })
    expect(vehicle.evidence).toContain('https://help.angelliststack.com/raise/ruv/closing-an-ruv')
    expect(vehicle.rationale).toMatch(/personal execution/)
    expect(vehicle.rationale).toMatch(/other syndicate structures/)
    const filing = part('tax_002', 'n6').metadata.execution as Execution
    expect(filing).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(filing.evidence).toContain('open-processes/file-federal-tax-return.json#/parts/5/metadata/verify')
    expect(filing.rationale).toMatch(/CPA retains filing responsibility/)
    expect(filing.rationale).toMatch(/paper attachments or an e-file exception/)
  })
  it('requires stored-form evidence and separates network standing from ordinary dispute rates', () => {
    const waitlist = part('startup_001', 'n2').options.find(option => option.id === 'waitlist-ad-test')!
    const page = waitlist.parts.find(scope => scope.id === 'wl1')!.metadata.execution as Execution
    expect(page).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(page.evidence).toContain('https://docs.lovable.dev/features/database')
    expect(page.rationale).toMatch(/rendered form alone does not prove storage/)
    expect(page.rationale).toMatch(/Other builder or storage choices/)
    const monitoring = part('sit_006', 'n6').metadata.execution as Execution
    expect(monitoring).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    expect(monitoring.evidence).toContain('https://docs.stripe.com/disputes/monitoring-programs')
    expect(monitoring.rationale).toMatch(/network-reported standing and Stripe estimates/)
    expect(monitoring.rationale).toMatch(/ordinary dispute rates can omit cases/)
  })
  it('resolves every local evidence reference to retained content', () => {
    for (const record of records) for (const scope of scopes(record.parts)) {
      const assessment = scope.metadata.execution as Execution | undefined
      if (!assessment) continue
      for (const evidence of assessment.evidence.filter(ref => !ref.startsWith('https://'))) {
        const [file, pointer] = evidence.split('#')
        const text = readFileSync(file, 'utf8')
        if (!pointer) { expect(text.length).toBeGreaterThan(0); continue }
        let value: unknown = JSON.parse(text)
        for (const key of pointer.slice(1).split('/')) value = (value as Record<string, unknown>)[key.replaceAll('~1', '/').replaceAll('~0', '~')]
        expect(value, evidence).not.toBeNull()
        expect(value, evidence).not.toBeUndefined()
        expect(value, evidence).not.toBe('')
      }
    }
  })
  it('leaves v2 executor kinds and approval semantics unchanged across the corpus', () => {
    expect(MANIFEST_VERSION).toBe(2)
    for (const task of loadProcesses()) for (const node of task.dag.nodes) {
      const { execution: assessment, ...legacyNode } = node
      const { execution: projected, ...step } = buildManifestStep(node)
      expect(projected).toEqual(assessment)
      expect(step).toEqual(buildManifestStep(legacyNode))
    }
  })
  it('supports documented browser review without requiring automatic dependency tracking', () => {
    const filing = part('comp_014', 'n6').metadata.execution as Execution
    expect(filing).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(filing.evidence).toContain('open-processes/answer-a-security-questionnaire.json#/parts/1/references')
    expect(filing.evidence).toContain('https://help.vanta.com/en/articles/11345451-completing-spreadsheet-and-document-questionnaires')
    expect(filing.rationale).toMatch(/manual browser review/)
    expect(filing.rationale).toMatch(/New disclosures retain their own approval/)
    // Resource review does not prove Vanta can execute a downstream access removal.
    expect(part('comp_002', 'n4').metadata.execution).toMatchObject({ category: 'human-online' })
  })
  it('covers design-tool alternatives while preserving the separate production-delivery gap', () => {
    const assessment = part('site_001', 'n1').options.find(option => option.id === 'design-tool-publish')!.metadata.execution as Execution
    expect(assessment).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    for (const provider of ['www.framer.com', 'help.figma.com', 'www.canva.com']) {
      expect(assessment.evidence.some(source => source.includes(provider))).toBe(true)
    }
    expect(assessment.rationale).toMatch(/anonymous responses/)
    expect(part('site_001', 'n2').metadata.execution).toMatchObject({ category: 'human-online' })
    const migration = part('qs_015', 'n4').metadata.execution as Execution
    expect(migration).toMatchObject({ category: 'human-online', reviewRequired: true })
    expect(migration.rationale).toMatch(/reconciles links, access and recorded losses/)
    expect(migration.automationEvidence).toEqual({ status: 'unverified' })
  })
  it('counts signature and approval as properties alongside execution categories', () => {
    const record = structuredClone(records.find(record => record.id === 'brand_002')!)
    record.parts = [{ ...record.parts[0], options: [], metadata: { route: 'person', execution: execution('human-online', 'human-work'), legalSignature: true, approvalRequired: true } }]
    const summary = processSummary(record)
    expect(summary.executionCounts['human-online']).toBe(1)
    expect(summary.executionSignatures).toBe(1)
    expect(summary.executionApprovals).toBe(1)
    expect(graphExecutionType({ id: 'one', title: 'Sign', metadata: record.parts[0].metadata, when: null, scope: 'fixture' }).label).toBe('Signature — legally human')
  })
  it('counts scoped approvals alongside booleans without changing legacy route counts', () => {
    for (const id of ['equity.us-de.83b-election', 'equity.us-de.409a-valuation']) {
      expect(processSummary(records.find(record => record.id === id)!).executionApprovals).toBe(2)
    }
    const record = structuredClone(records.find(record => record.id === 'brand_002')!)
    record.parts = [{ ...record.parts[0], options: [], metadata: { route: 'agent', approvalRequired: false, approval: { role: 'signer', scope: 'this filing' } } }]
    expect(processSummary(record)).toMatchObject({ executionApprovals: 1, approvals: null })
    record.parts[0].metadata.approvalRequired = true
    expect(processSummary(record)).toMatchObject({ executionApprovals: 1, approvals: 1 })
    record.parts[0].metadata = { route: 'agent', approval: {} }
    expect(processSummary(record).executionApprovals).toBe(0)
  })
  it('includes scoped approvals in the execution audit', () => {
    const report = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/shared-processes/execution-audit.ts'], { encoding: 'utf8' }))
    // Lifecycle expansion adds 175 scoped human approvals (2026-10-29).
    expect(report.explicitApprovals).toBe(434)
  })
})
