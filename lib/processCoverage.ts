import { z } from 'zod'

const text = z.string().min(1)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const strings = z.array(text)
export const coverageReviewSchema = z.strictObject({
  reviewer: text, qualification: z.enum(['editorial', 'accounting', 'legal', 'employment', 'tax', 'security']),
  independent: z.boolean(), contentDigest: z.string().regex(/^[a-f0-9]{64}$/), reviewedOn: date, reviewDue: date, evidenceUrl: z.string().url(),
})
export const completenessScopeSchema = z.strictObject({
  version: z.literal(1), snapshotDate: date, requestIssue: z.number().int().positive(),
  scope: text, countries: strings.min(1), businessModels: strings.min(1), includedWork: strings.min(1),
  exclusions: z.array(z.strictObject({ id: text, scope: text, reason: text })).min(1),
  independentScopeReview: coverageReviewSchema.nullable(),
  scenarioScopes: z.array(z.strictObject({ processId: text, country: text, assessmentIds: strings.min(1), limitation: text, independentReview: coverageReviewSchema.nullable() })),
  maintenance: z.strictObject({ owner: text.nullable(), sourceMaxAgeDays: z.number().int().positive(), instructionMaxAgeDays: z.number().int().positive(), missingOwnerIsBlocker: z.literal(true) }),
  qualificationByDomain: z.record(z.string(), z.array(z.enum(['editorial', 'accounting', 'legal', 'employment', 'tax', 'security'])).min(1)),
})
export const inventoryCrosscheckSchema = z.strictObject({
  version: z.literal(1), checkedOn: date, method: text, author: text,
  independentReview: coverageReviewSchema.nullable(),
  checks: z.array(z.strictObject({ id: text, sourceId: text, locator: text, needIds: strings.min(1), finding: text })).min(1),
})
export const LOCAL_REQUIREMENTS = ['applicability', 'prerequisites', 'authority', 'instructions', 'exceptions', 'approval', 'completion'] as const
export const localAssessmentsSchema = z.strictObject({
  version: z.literal(1), assessments: z.array(z.strictObject({
    id: text, processId: text, country: text, title: text, domain: text,
    facts: z.record(z.string(), text), exclusions: strings.min(1),
    checkedOn: date, owner: text.nullable(), professionalReview: coverageReviewSchema.nullable(),
    requirements: z.array(z.strictObject({
      id: z.enum(LOCAL_REQUIREMENTS), stepIds: strings.min(1), sourceIds: strings.min(1), locator: text,
      status: z.enum(['authored', 'missing']), completionEvidence: text,
    })).min(1),
    observedRuns: z.array(z.strictObject({ id: text, ranOn: date, independent: z.boolean(), receiptUrl: z.string().url(), operator: text, contentDigest: z.string().regex(/^[a-f0-9]{64}$/), outcome: z.enum(['passed', 'failed']) })),
  })),
})
export const coverageCasesSchema = z.strictObject({
  version: z.literal(1), fictional: z.literal(true), cases: z.array(z.strictObject({
    id: text, assessmentId: text, facts: z.record(z.string(), text.nullable()),
    expected: z.enum(['matches', 'needs-context', 'out-of-scope']), externalActionsAuthorized: z.literal(false),
  })).min(1),
})
export type CompletenessScope = z.infer<typeof completenessScopeSchema>
export type InventoryCrosscheck = z.infer<typeof inventoryCrosscheckSchema>
export type LocalAssessments = z.infer<typeof localAssessmentsSchema>
export type CoverageCases = z.infer<typeof coverageCasesSchema>

import { createHash } from 'node:crypto'
import type { Part, SharedRecord } from './shared-processes/schema'
import { GEO_COUNTRIES } from './geoPreference'

export interface CoverageSource { id: string; title: string; url: string; checkedOn: string }
export interface CoverageNeed { id: string; domain: string; need: string; status: string; processIds: string[]; sourceIds: string[] }
export interface CoverageInputs {
  scope: CompletenessScope; audit: InventoryCrosscheck; local: LocalAssessments; fixtures: CoverageCases
  records: SharedRecord[]; sources: CoverageSource[]; needs: CoverageNeed[]
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}
export function coverageDigest(value: unknown): string { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex') }
export function coverageDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid coverage date: ${value}`)
  const ms = Date.parse(value + 'T00:00:00Z')
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error(`Invalid coverage date: ${value}`)
  return ms / 86400000
}
function unique(ids: string[], label: string) { if (new Set(ids).size !== ids.length) throw new Error(`${label}: duplicate identity`) }
function partsOf(parts: Part[]): Part[] { return parts.flatMap(part => [part, ...part.options.flatMap(option => partsOf(option.parts))]) }
function resolutions(part: Part) { return (part.metadata.geoResolutions ?? []) as Array<{ country: string; kind: string; guidance?: string; label: string; actionUrl?: string }> }
export function validateCoverageInputs(input: CoverageInputs): void {
  completenessScopeSchema.parse(input.scope); inventoryCrosscheckSchema.parse(input.audit); localAssessmentsSchema.parse(input.local); coverageCasesSchema.parse(input.fixtures)
  coverageDay(input.scope.snapshotDate); coverageDay(input.audit.checkedOn)
  unique(input.scope.countries, 'scope countries'); unique(input.sources.map(s => s.id), 'sources'); unique(input.needs.map(n => n.id), 'needs')
  unique(input.records.map(r => r.id), 'records'); unique(input.local.assessments.map(a => a.id), 'assessments'); unique(input.fixtures.cases.map(c => c.id), 'fixtures')
  if ([...input.scope.countries].sort().join() !== [...GEO_COUNTRIES].sort().join()) throw new Error('Coverage countries must equal the full process country selector')
  const records = new Map(input.records.map(r => [r.id, r])); const sources = new Map(input.sources.map(s => [s.id, s])); const needs = new Map(input.needs.map(n => [n.id, n]))
  for (const source of input.sources) coverageDay(source.checkedOn)
  for (const need of input.needs) {
    if ((need.status === 'guide-present') !== (need.processIds.length > 0)) throw new Error(`${need.id}: guide status and mappings disagree`)
    for (const id of need.processIds) if (!records.has(id)) throw new Error(`${need.id}: unknown process ${id}`)
    for (const id of need.sourceIds) if (!sources.has(id)) throw new Error(`${need.id}: unknown source ${id}`)
  }
  const mapped = new Set(input.needs.flatMap(n => n.processIds))
  for (const record of input.records.filter(r => !r.taskIds)) if (!mapped.has(record.id)) throw new Error(`${record.id}: missing from the need inventory`)
  unique(input.audit.checks.map(c => c.id), 'audit checks')
  for (const check of input.audit.checks) {
    if (!sources.has(check.sourceId)) throw new Error(`${check.id}: unknown audit source`)
    for (const id of check.needIds) if (!needs.has(id)) throw new Error(`${check.id}: unknown audited need ${id}`)
  }
  for (const assessment of input.local.assessments) {
    const record = records.get(assessment.processId)
    if (!record || record.taskIds || !input.scope.countries.includes(assessment.country)) throw new Error(`${assessment.id}: invalid process/country`)
    if (assessment.facts.country !== assessment.country) throw new Error(`${assessment.id}: scenario country mismatch`)
    for (const field of ['registeredRegion', 'entityForm', 'taxResidency', 'crossBorder', 'sector']) if (!assessment.facts[field]) throw new Error(`${assessment.id}: missing scenario dimension ${field}`)
    if (!input.scope.qualificationByDomain[assessment.domain]?.length) throw new Error(`${assessment.id}: no professional qualification policy`)
    coverageDay(assessment.checkedOn); unique(assessment.requirements.map(r => r.id), `${assessment.id} requirements`)
    const parts = partsOf(record.parts)
    for (const requirement of assessment.requirements) {
      for (const id of requirement.sourceIds) if (!sources.has(id)) throw new Error(`${assessment.id}: unknown requirement source ${id}`)
      for (const id of requirement.stepIds) {
        const matches = parts.filter(p => p.id === id)
        if (matches.length !== 1) throw new Error(`${assessment.id}: missing or ambiguous step ${id}`)
        const part = matches[0]
        if (requirement.status === 'authored' && !resolutions(part).some(r => r.country === assessment.country && r.guidance?.trim())) throw new Error(`${assessment.id}/${id}: authored requirement has no local instructions`)
        for (const sourceId of requirement.sourceIds) {
          const url = sources.get(sourceId)!.url
          if (![...record.references, ...part.references].some(r => r.kind === 'url' && r.url === url)) throw new Error(`${assessment.id}/${id}: source is not cited in canonical instructions`)
        }
      }
    }
    if (assessment.professionalReview) { coverageDay(assessment.professionalReview.reviewedOn); coverageDay(assessment.professionalReview.reviewDue) }
    for (const run of assessment.observedRuns) coverageDay(run.ranOn)
  }
  for (const review of [input.scope.independentScopeReview, input.audit.independentReview]) if (review) { coverageDay(review.reviewedOn); coverageDay(review.reviewDue) }
  const assessments = new Map(input.local.assessments.map(a => [a.id, a]))
  for (const fixture of input.fixtures.cases) if (!assessments.has(fixture.assessmentId)) throw new Error(`${fixture.id}: unknown assessment`)
}
export function matchCoverageFacts(required: Record<string, string>, actual: Record<string, string | null>): 'matches' | 'needs-context' | 'out-of-scope' {
  if (Object.keys(required).some(key => actual[key] == null || actual[key]?.trim() === '')) return 'needs-context'
  return Object.entries(required).every(([key, value]) => actual[key] === value) ? 'matches' : 'out-of-scope'
}
function fresh(checkedOn: string, asOf: string, maxDays: number): boolean { const age = coverageDay(asOf) - coverageDay(checkedOn); return age >= 0 && age <= maxDays }
type Review = z.infer<typeof coverageReviewSchema>
export function coverageReviewState(review: Review | null, asOf: string, digest: string, qualifications: string[]): string {
  if (!review) return 'missing'
  if (!review.independent) return 'not-independent'
  if (!qualifications.includes(review.qualification)) return 'unqualified'
  if (review.contentDigest !== digest) return 'content-changed'
  if (coverageDay(review.reviewedOn) > coverageDay(asOf)) return 'future-dated'
  if (coverageDay(review.reviewDue) < coverageDay(review.reviewedOn) || coverageDay(review.reviewDue) < coverageDay(asOf)) return 'stale'
  return 'current'
}
export function assessmentDigest(input: CoverageInputs, assessment: LocalAssessments['assessments'][number]): string {
  return coverageDigest({ record: input.records.find(r => r.id === assessment.processId), scenario: assessment.facts, exclusions: assessment.exclusions,
    requirements: assessment.requirements, checkedOn: assessment.checkedOn,
    sources: [...new Set(assessment.requirements.flatMap(r => r.sourceIds))].sort().map(id => input.sources.find(s => s.id === id)) })
}
export function scopeDigest(input: CoverageInputs): string {
  const { independentScopeReview: _review, ...scope } = input.scope
  const { independentReview: _auditReview, ...audit } = input.audit
  return coverageDigest({ scope, audit, needs: input.needs, records: input.records.filter(r => !r.taskIds).map(r => r.id).sort() })
}
export function assessLocalProcedure(input: CoverageInputs, assessment: LocalAssessments['assessments'][number], asOf: string) {
  const digest = assessmentDigest(input, assessment)
  const missingRequirements = LOCAL_REQUIREMENTS.filter(id => !assessment.requirements.some(r => r.id === id && r.status === 'authored'))
  const sourceIds = [...new Set(assessment.requirements.flatMap(r => r.sourceIds))]
  const sourcesCurrent = sourceIds.every(id => { const source = input.sources.find(s => s.id === id); return source && fresh(source.checkedOn, asOf, input.scope.maintenance.sourceMaxAgeDays) })
  const instructionsCurrent = fresh(assessment.checkedOn, asOf, input.scope.maintenance.instructionMaxAgeDays)
  const review = coverageReviewState(assessment.professionalReview, asOf, digest, input.scope.qualificationByDomain[assessment.domain] ?? [])
  const cases = input.fixtures.cases.filter(c => c.assessmentId === assessment.id)
  const testsPass = cases.length > 0 && cases.every(c => matchCoverageFacts(assessment.facts, c.facts) === c.expected)
    && ['matches', 'needs-context', 'out-of-scope'].every(status => cases.some(c => c.expected === status))
  const observed = assessment.observedRuns.some(run => run.outcome === 'passed' && run.independent && run.contentDigest === digest && coverageDay(run.ranOn) <= coverageDay(asOf))
  const blockers = [!assessment.owner && 'owner-unassigned', missingRequirements.length > 0 && 'instructions-incomplete', !sourcesCurrent && 'sources-need-recheck',
    !instructionsCurrent && 'instructions-need-recheck', review !== 'current' && `professional-review-${review}`, !testsPass && 'scenario-tests-missing-or-failing'].filter((x): x is string => Boolean(x))
  return { id: assessment.id, processId: assessment.processId, country: assessment.country, title: assessment.title, facts: assessment.facts, exclusions: assessment.exclusions,
    contentDigest: digest, instructionChecklist: missingRequirements.length ? 'partial' : 'authored', sourcesCurrent, instructionsCurrent, owner: assessment.owner,
    professionalReview: review, fictionalTests: testsPass ? 'passed' : 'missing-or-failed', observedExecution: observed ? 'evidenced' : 'unverified', blockers,
    reviewedProcedureReady: blockers.length === 0, externalActionsAuthorized: false as const }
}
export function buildProcessCoverage(input: CoverageInputs, asOf: string) {
  validateCoverageInputs(input); coverageDay(asOf)
  const scopeReview = coverageReviewState(input.scope.independentScopeReview, asOf, scopeDigest(input), ['editorial'])
  const auditReview = coverageReviewState(input.audit.independentReview, asOf, scopeDigest(input), ['editorial'])
  const assessments = input.local.assessments.map(a => assessLocalProcedure(input, a, asOf))
  const ordinary = input.records.filter(r => !r.taskIds)
  const cells = ordinary.flatMap(record => input.scope.countries.map(country => {
    const notes = (record.metadata.geoNotes ?? []) as Array<{ country: string; kind: string; actionUrl: string }>
    const localNotes = notes.filter(n => n.country === country)
    const localSteps = partsOf(record.parts).flatMap(p => resolutions(p).filter(r => r.country === country).map(r => ({ stepId: p.id, kind: r.kind, sourceUrl: r.actionUrl ?? null })))
    const nativeUs = country === 'US' && ['us', 'us-state'].includes(String(record.metadata.geoScope))
    const procedures = assessments.filter(a => a.processId === record.id && a.country === country)
    return { processId: record.id, country, guidePresent: record.parts.length > 0, localMaterial: localNotes.length > 0 || localSteps.length > 0 || nativeUs,
      noteKinds: localNotes.map(n => n.kind), localStepIds: localSteps.map(s => s.stepId),
      sourceUrls: [...new Set([...localNotes.map(n => n.actionUrl), ...localSteps.flatMap(s => s.sourceUrl ? [s.sourceUrl] : [])])],
      scenarioIds: procedures.map(a => a.id), reviewedScenarioCount: procedures.filter(a => a.reviewedProcedureReady).length,
      wholeCountryCompleteness: 'unassessed' as const }
  }))
  const gaps = input.needs.filter(n => n.status === 'gap').map(n => ({ id: n.id, domain: n.domain, need: n.need, sourceIds: n.sourceIds }))
  const countries = input.scope.countries.map(country => ({ country, processCells: ordinary.length, withLocalMaterial: cells.filter(c => c.country === country && c.localMaterial).length,
    scopedProcedures: assessments.filter(a => a.country === country).length, reviewedProcedures: assessments.filter(a => a.country === country && a.reviewedProcedureReady).length,
    observedProcedures: assessments.filter(a => a.country === country && a.observedExecution === 'evidenced').length }))
  return { version: 1, asOf, scope: input.scope.scope, scopeDigest: scopeDigest(input), independentScopeReview: scopeReview, independentInventoryReview: auditReview,
    summary: { needs: input.needs.length, mappedNeeds: input.needs.filter(n => n.status === 'guide-present').length, explicitNeedGaps: gaps.length,
      processesAndSituations: ordinary.length, countries: input.scope.countries.length, matrixCells: cells.length,
      cellsWithLocalMaterial: cells.filter(c => c.localMaterial).length, scopedProcedures: assessments.length,
      reviewedProcedures: assessments.filter(a => a.reviewedProcedureReady).length, observedProcedures: assessments.filter(a => a.observedExecution === 'evidenced').length,
      wholeCountryCompleteCells: 0, comprehensive: false },
    metricDefinitions: { mappedNeeds: 'A canonical guide is linked; this measures entry points only.', localMaterial: 'An authored country note, step resolution or US-scoped baseline exists; this does not establish completeness or freshness.',
      reviewedProcedures: 'All required instruction sections, sources, dates, ownership, qualified independent review and fictional scope tests are current for the stated facts.',
      observedProcedures: 'A dated independent passed-run attestation identifies this exact procedure content. Public attestation links must be verified by the contributor; case-specific authorization remains separate.',
      wholeCountryCompleteness: 'Unassessed: the full entity, subnational, sector and cross-border scenario universe has not been independently established. No cell is excluded for missing or not-applicable notes.' },
    countries, assessments, gaps, cells }
}
