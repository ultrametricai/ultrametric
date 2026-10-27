import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { executionSchema, validateExecution, type Execution } from '../execution'
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
  it('requires complete authoring coverage but permits older additive-schema imports', () => {
    expect(() => validateExecutionCoverage(records)).not.toThrow()
    const copied = structuredClone(records)
    delete copied[0].parts[0].metadata.execution
    expect(() => validateExecutionCoverage(copied)).toThrow('missing execution assessment')
    expect(() => validateExecution({}, 'legacy import')).not.toThrow()
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
    expect(part('form_002', 'n3').metadata.execution).toMatchObject({ category: null, basis: 'unresolved', reviewRequired: true })
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
    // Personal authentication stays with the teammate; a browser restriction alone
    // is insufficient to turn an unresolved filing into Human Online.
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
    expect(message.category).toBeNull()
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
    expect(part('vc_003', 'n2').metadata.execution).toMatchObject({ category: null, reviewRequired: true })
  })
  it('uses the valuation provider correspondence without inventing a mail API', () => {
    const valuation = part('fund_003', 'n5').metadata.execution as Execution
    expect(valuation).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(valuation.rationale).toMatch(/questions and clarifications sent by email/)
    expect(valuation.evidence.some(source => source.includes('how-to-view-your-409a-valuation-status'))).toBe(true)
    expect(valuation.evidence.some(source => /gmail|graph\.microsoft|api\//.test(source))).toBe(false)
    // Following up on an offer does not establish that policy's binding route.
    expect(part('ins_001', 'n6').metadata.execution).toMatchObject({ category: null })
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
    expect(german.parts.find(part => part.id === 'de2')!.metadata.execution).toMatchObject({ category: null, reviewRequired: true })
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
      execution: { category: null, basis: 'unresolved', reviewRequired: true },
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
    expect(part('prod_012', 'n7').metadata.execution).toMatchObject({ category: null })
  })
  it('distinguishes a selected online human workflow from an unresolved execution alternative', () => {
    const review = part('scale_001', 'n5').metadata.execution as Execution
    expect(review).toMatchObject({ category: 'human-online', basis: 'human-work' })
    expect(review.evidence).toContain('open-processes/run-performance-reviews.json#/parts/1/references')
    expect(review.evidence.some(source => source.includes('help.bamboohr.com'))).toBe(true)
    // The separately authored calibration meeting has no selected medium.
    expect(part('scale_001', 'n6').metadata.execution).toMatchObject({ category: null })
    const signing = part('startup_002', 'n3b')
    expect(signing.metadata.legalSignature).toBe(true)
    // A named e-sign provider does not override this process's open notarial route.
    expect(signing.metadata.execution).toMatchObject({ category: null, reviewRequired: true })
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
    expect(llp.metadata.execution).toMatchObject({ category: null, reviewRequired: true })
    expect(part('qs_043', 'jny1').metadata.execution).toMatchObject({ category: null, reviewRequired: true })
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
      expect(llc).toMatchObject({ category: null, reviewRequired: true })
      expect(llc.evidence).toContain('https://help.clerky.com/article/2662-existing-entity')
    }
  })
  it('does not infer an online medium from responsibility or reuse an unrelated probe', () => {
    for (const [process, step] of [['sit_020', 'n4'], ['sit_022', 'n2']]) {
      expect(part(process, step).metadata.execution).toMatchObject({ category: null, basis: 'unresolved', reviewRequired: true })
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
    expect(part('qs_015', 'n4').metadata.execution).toMatchObject({ category: null })
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
  it('keeps board distribution unresolved when sending evidence omits access and questions', () => {
    const board = part('fin_010', 'n4')
    expect(board.references).toContainEqual({ kind: 'vendor', id: 'google_slides', role: 'stated-vendor' })
    expect(board.metadata.execution).toMatchObject({ category: null, basis: 'unresolved', reviewRequired: true })
    expect((board.metadata.execution as Execution).rationale).toMatch(/distribution method, document-access checks and collection of directors' questions/)
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
    expect(part('scale_010', 'n5').metadata.execution).toMatchObject({ category: null })
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
    expect(part('scale_004', 'n5').metadata.execution).toMatchObject({ category: null })
  })
  it('keeps IRS electronic and physical filing alternatives unresolved without a chosen method', () => {
    for (const [process, step] of [['form_012', 'n8'], ['equity.us-de.83b-election', 'file']]) {
      const assessment = part(process, step).metadata.execution as Execution
      expect(assessment).toMatchObject({ category: null, basis: 'unresolved', reviewRequired: true })
      expect(assessment.evidence).toContain('https://www.irs.gov/pub/irs-pdf/f15620.pdf')
      expect(assessment.evidence).toContain('https://www.irs.gov/forms-pubs/mobile-friendly-forms')
      expect(assessment.rationale).toMatch(/personal Online Account/)
    }
  })
  it('grounds online training and filing controls while preserving personal participation', () => {
    const training = part('comp_001', 'n7').metadata.execution as Execution
    expect(training).toMatchObject({ category: 'human-online', basis: 'human-work', reviewRequired: true })
    expect(training.evidence).toContain('open-processes/start-soc-2-type-i.json#/parts/0/options/0/references')
    expect(training.evidence).toContain('https://help.vanta.com/en/articles/11345841-managing-personnel-training-tasks')
    const fillip = part('form_011', 'n3').options.find(option => option.id === 'india-llp-fillip')!.metadata.execution as Execution
    expect(fillip).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    expect(fillip.rationale).toMatch(/personally apply their own digital signatures/)
    expect(fillip.evidence).toContain('https://www.mca.gov.in/content/mca/global/en/mca/dsc-services-v3/acquire-dsc.html')
    // An online employer-number form does not cover the combined payroll registrations.
    expect(part('qs_063', 'n3').options.find(option => option.id === 'germany-betriebsnummer')!.metadata.execution).toMatchObject({ category: null })
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
    expect(directories).toMatchObject({ category: null, reviewRequired: true })
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
    expect(part('sit_013', 'n8').metadata.execution).toMatchObject({ category: null })
    const shares = part('qs_051', 'n2').options.find(option => option.id === 'default')!.metadata.execution as Execution
    expect(shares).toMatchObject({ category: 'agent-computer-use', reviewRequired: true })
    for (const provider of ['support.carta.com', 'help.pulley.com']) {
      expect(shares.evidence.some(source => source.includes(provider))).toBe(true)
    }
    // Founding-share import controls do not establish every later investment operation.
    expect(part('qs_051', 'n3').metadata.execution).toMatchObject({ category: null })
    const cloud = part('sw_001', 'n3').options.find(option => option.id === 'cloud-autonomous-agent')!.metadata.execution as Execution
    expect(cloud).toMatchObject({ category: 'agent-computer-use', basis: 'browser-evidence', reviewRequired: true })
    for (const provider of ['code.claude.com', 'learn.chatgpt.com']) {
      expect(cloud.evidence.some(source => source.includes(provider))).toBe(true)
    }
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
    expect(report.explicitApprovals).toBe(257)
  })
})
