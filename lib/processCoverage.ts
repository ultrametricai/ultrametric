import { z } from 'zod'

const text = z.string().min(1)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const strings = z.array(text)
export const coverageReviewSchema = z.strictObject({
  reviewer: text, qualification: z.enum(['editorial', 'accounting', 'legal', 'employment', 'tax', 'security']),
  independent: z.boolean(), reviewedOn: date, reviewDue: date, evidenceUrl: z.string().url(),
})
export const completenessScopeSchema = z.strictObject({
  version: z.literal(1), snapshotDate: date, requestIssue: z.number().int().positive(),
  scope: text, countries: strings.min(1), businessModels: strings.min(1), includedWork: strings.min(1),
  exclusions: z.array(z.strictObject({ id: text, scope: text, reason: text })).min(1),
  independentScopeReview: coverageReviewSchema.nullable(),
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
    observedRuns: z.array(z.strictObject({ id: text, ranOn: date, independent: z.boolean(), receiptUrl: z.string().url(), outcome: z.enum(['passed', 'failed']) })),
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
