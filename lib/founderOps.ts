import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { processDefinitionSchema } from './shared-processes/catalog'

// The founder-ops corpus validator + conservative planner — a faithful TypeScript port of the
// founder-ops-open starter's tools/validate.py (ingested 2026-09-28), rehomed into the repo's
// toolchain so the corpus invariants run inside the normal vitest gates instead of a parallel
// Python step. Structural checks and planning only, NOT a legal engine: it verifies that every
// legal rule resolves to a primary source with a precise locator, every process step with an
// external effect carries a scoped human approval, coverage claims match process maturity, and
// fixtures are synthetic. plan() matches events on exact jurisdiction dimensions only — an
// unknown combination is `unsupported`, never inherited from a neighboring jurisdiction.

const ROOT = process.cwd()
const MATCH_KEYS = ['entity_jurisdiction', 'tax_jurisdiction', 'entity_type', 'event_type'] as const

// open-processes/ holds TWO layers (see open-processes/README.md): the jurisdiction-scoped legal
// workflows this validator owns, and — since stage 2 of the corpus lift — the operational
// corpus (open-processes/corpus.json, the 123-process array behind /processes). The corpus has its
// own schema, loader and gates (lib/processes.ts, schemas/operational-process.schema.json,
// lib/__tests__/processes.test.ts), so the workflow walker skips it rather than misreading a
// task array as a workflow record.
const OPERATIONAL_CORPUS = path.join('open-processes', 'corpus.json')
// The corpus's vendor registry (SSOT migration 2026-09-30) is the operational layer too — its
// own schema/loader/tests live in lib/processes.ts + schemas/process-vendor-registry.schema.json
// + lib/__tests__/vendorRegistry.test.ts, so the workflow walker skips it like corpus.json.
const OPERATIONAL_VENDOR_REGISTRY = path.join('open-processes', 'vendor-registry.json')
// The artifact registry and the company-fields registry moved to open-artifacts/
// (registry.json + fields.json) — outside this walker's tree, with their own
// schema/loader/tests in lib/processes.ts + lib/companyFields.ts.
// The corpus's business-logic ↔ process map (founder 2026-10-02) is the operational layer too —
// its own schema/loader/tests live in lib/businessLogicMap.ts +
// lib/__tests__/businessLogicMap.test.ts, so the workflow walker skips it like the other
// operational registries.
const OPERATIONAL_BUSINESS_LOGIC_MAP = path.join('open-processes', 'business-logic-map.json')
// The corpus's chain list (folded in from the old top-level journeys/) is the operational
// layer too — its own loader/tests live in lib/processes.ts (loadChains) +
// lib/__tests__/processes.test.ts, so the workflow walker skips it like the other
// operational registries.
const OPERATIONAL_CHAINS = path.join('open-processes', 'chains.json')

// The startup-law map (open-law/map.json, schemas/law-map.schema.json) is the domain taxonomy
// OVER the rule cards, not a card itself, so the rule walkers skip it; its own invariants
// (every card placed, every reference resolving, maturity grades consistent with the cards
// present) run inside validateFounderOps below.
const LAW_MAP = path.join('open-law', 'map.json')

// The authority citation registry (folded in from the old top-level citations/) lives
// beside the rule cards that cite it, so the rule walkers skip the subtree; its records
// validate against schemas/citation.schema.json in the source loop below.
const LAW_CITATIONS_SUBTREE = path.join('open-law', 'citations') + path.sep

// The founder-journey workflow files (folded in from the old coverage/ pair) sit beside
// the cards they grade; they validate in the workflow loop, not as rule cards.
const WORKFLOW_FILES = [
  path.join('open-law', 'workflow-coverage.json'),
  path.join('open-law', 'workflow-domains.json'),
]

function ruleCardJson(dir: string): string[] {
  return listJson(dir).filter(
    (f) => !f.endsWith(LAW_MAP) && !f.includes(LAW_CITATIONS_SUBTREE) && !WORKFLOW_FILES.some((w) => f.endsWith(w)),
  )
}

// Fictional scenario fixtures live under open-processes/fixtures/ (folded in from the old
// top-level fixtures/). They validate separately below, so the workflow walker skips the
// whole subtree like it skips the operational registries.
const FIXTURES_DIR = path.join('open-processes', 'fixtures')
const FIXTURES_SUBTREE = FIXTURES_DIR + path.sep

function workflowJson(dir: string): string[] {
  return listJson(dir).filter(
    (f) =>
      !f.includes(FIXTURES_SUBTREE) &&
      !f.endsWith(OPERATIONAL_CORPUS) &&
      !f.endsWith(OPERATIONAL_VENDOR_REGISTRY) &&
      !f.endsWith(OPERATIONAL_BUSINESS_LOGIC_MAP) &&
      !f.endsWith(OPERATIONAL_CHAINS) &&
      !f.endsWith(path.join('open-processes', 'catalog.json')),
  )
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

function isObj(v: Json | undefined): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isProcessDefinition(value: Json): boolean {
  return isObj(value) && value.schemaVersion === 1 && (value.kind === 'process' || value.kind === 'situation')
}

function read(file: string): Json {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Json
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listJson(full))
    else if (entry.name.endsWith('.json')) out.push(full)
  }
  return out.sort()
}

function isoDate(value: Json | undefined, where: string, errors: string[]): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${where}: invalid ISO date ${JSON.stringify(value)}`)
    return null
  }
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    errors.push(`${where}: invalid ISO date ${JSON.stringify(value)}`)
    return null
  }
  return d
}

function indexed(files: string[], errors: string[], name: string): Map<string, JsonObject> {
  const records = new Map<string, JsonObject>()
  for (const file of files) {
    let record: Json
    try {
      record = read(file)
    } catch {
      errors.push(`${path.relative(ROOT, file)}: unreadable JSON`)
      continue
    }
    if (name === 'process' && isProcessDefinition(record)) {
      if (!processDefinitionSchema.safeParse(record).success) errors.push(`${path.relative(ROOT, file)}: invalid process definition`)
      continue
    }
    if (!isObj(record) || typeof record.id !== 'string') {
      errors.push(`${path.relative(ROOT, file)}: missing id`)
      continue
    }
    if (records.has(record.id)) errors.push(`duplicate ${name} id ${record.id}`)
    records.set(record.id, record)
  }
  return records
}

// Small, deterministic JSON Schema subset — mirrors the starter's checker; the schemas/ files
// stay the canonical draft-2020-12 contracts for any external consumer with a full validator.
// Exported since stage 2 of the corpus lift so the corpus-schema drift test
// (__tests__/corpus-schemas.test.ts) can validate every committed operational-process record
// against the published schemas/operational-process.schema.json with the same checker.
export function shape(value: Json | undefined, schema: JsonObject, where: string, errors: string[], root?: JsonObject): void {
  const schemaRoot = root ?? schema
  if (typeof schema.$ref === 'string') {
    if (!schema.$ref.startsWith('#/$defs/')) {
      errors.push(`${where}: unsupported local schema reference`)
      return
    }
    const defs = schemaRoot.$defs
    const def = isObj(defs) ? defs[schema.$ref.split('/').pop() as string] : undefined
    if (!isObj(def)) {
      errors.push(`${where}: unresolved schema reference`)
      return
    }
    shape(value, def, where, errors, schemaRoot)
    return
  }
  if (Array.isArray(schema.oneOf)) {
    const matched = schema.oneOf.some((option) => {
      if (!isObj(option)) return false
      const trial: string[] = []
      shape(value, option, where, trial, schemaRoot)
      return trial.length === 0
    })
    if (!matched) errors.push(`${where}: no permitted shape matched`)
    return
  }
  const types = typeof schema.type === 'string' ? [schema.type] : Array.isArray(schema.type) ? schema.type : []
  if (types.length > 0) {
    const ok = types.some((t) =>
      t === 'object' ? isObj(value ?? null)
      : t === 'array' ? Array.isArray(value)
      : t === 'string' ? typeof value === 'string'
      : t === 'null' ? value === null
      : t === 'number' ? typeof value === 'number'
      // The operational-process schema (zod-generated) uses these two; the starter's hand-written
      // schemas never did, so supporting them is a strict superset of the original checker.
      : t === 'boolean' ? typeof value === 'boolean'
      : t === 'integer' ? typeof value === 'number' && Number.isInteger(value)
      : false,
    )
    if (!ok) {
      errors.push(`${where}: expected ${types.join('|')}`)
      return
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => e === value)) {
    errors.push(`${where}: outside permitted enum`)
  }
  if (isObj(value ?? null)) {
    const obj = value as JsonObject
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (typeof key === 'string' && !(key in obj)) errors.push(`${where}: missing ${key}`)
    }
    const properties = isObj(schema.properties) ? schema.properties : {}
    for (const [key, sub] of Object.entries(properties)) {
      if (key in obj && isObj(sub)) shape(obj[key], sub, `${where}.${key}`, errors, schemaRoot)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) errors.push(`${where}: unexpected ${key}`)
      }
    }
  } else if (Array.isArray(value)) {
    const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0
    if (value.length < minItems) errors.push(`${where}: too few items`)
    if (isObj(schema.items)) {
      value.forEach((item, i) => shape(item, schema.items as JsonObject, `${where}[${i}]`, errors, schemaRoot))
    }
  } else if (typeof value === 'string') {
    const minLength = typeof schema.minLength === 'number' ? schema.minLength : 0
    if (value.length < minLength) errors.push(`${where}: too short`)
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${where}: invalid pattern`)
    }
    if (schema.format === 'date') isoDate(value, where, errors)
    if (schema.format === 'uri' && !value.startsWith('https://')) errors.push(`${where}: require HTTPS URI`)
  }
}

function str(v: Json | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined
}

// The rule-card contract (maintainer decision 2026-10-19): the published
// schemas/rule.schema.json file was retired because this zod schema is where the shape is
// enforced; rule cards validate here, inside the normal test gates. One dated legal
// proposition per card, every field required, nothing extra; the semantic checks (sources
// resolve to primary authorities, jurisdiction registered, review dates ordered) run in the
// rule loop below.
export const RuleCardSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['legal', 'operating-practice']),
  statement: z.string(),
  source_ids: z.array(z.string()).min(1),
  caveat: z.string(),
  jurisdiction: z.string(),
  version: z.string(),
  status: z.enum(['draft', 'demonstration', 'reviewed', 'deprecated']),
  reviewed_on: z.iso.date(),
  review_due: z.iso.date(),
  reviewer: z.string(),
  valid_from: z.iso.date().nullable(),
  valid_until: z.iso.date().nullable(),
})

export function validateFounderOps(asOf?: Date): string[] {
  const today = asOf ?? new Date()
  const errors: string[] = []
  const schemas = new Map<string, JsonObject>()
  for (const file of listJson(path.join(ROOT, 'schemas'))) {
    const schema = read(file)
    if (isObj(schema)) schemas.set(path.basename(file, '.json'), schema)
  }
  const need = (name: string): JsonObject => {
    const s = schemas.get(name)
    if (!s) throw new Error(`founder-ops: schemas/${name}.json missing`)
    return s
  }

  const registry = read(path.join(ROOT, 'jurisdictions/registry.json'))
  const jurisdictions = new Set<string>()
  if (isObj(registry) && Array.isArray(registry.jurisdictions)) {
    for (const j of registry.jurisdictions) {
      if (isObj(j) && typeof j.code === 'string') jurisdictions.add(j.code)
    }
  }

  const citationsDoc = read(path.join(ROOT, 'open-law/citations/registry.json'))
  const sourceMap = new Map<string, JsonObject>()
  const citationList = isObj(citationsDoc) && Array.isArray(citationsDoc.citations) ? citationsDoc.citations : []
  for (const source of citationList) {
    if (!isObj(source) || typeof source.id !== 'string') {
      errors.push('open-law/citations/registry.json: citation without id')
      continue
    }
    const sid = source.id
    shape(source, need('citation.schema'), `citation ${sid}`, errors)
    if (sourceMap.has(sid)) errors.push(`duplicate source id ${sid}`)
    sourceMap.set(sid, source)
    const url = str(source.url) ?? ''
    if (!url.startsWith('https://') || !str(source.locator)) {
      errors.push(`source ${sid}: require HTTPS URL and precise locator`)
    }
    if (!jurisdictions.has(str(source.jurisdiction) ?? '')) errors.push(`source ${sid}: unknown jurisdiction`)
    const checked = isoDate(source.checked_on, `source ${sid}.checked_on`, errors)
    if (checked && checked > today) errors.push(`source ${sid}: checked date is in the future`)
  }

  const rules = indexed(ruleCardJson(path.join(ROOT, 'open-law')), errors, 'rule')
  for (const [rid, rule] of rules) {
    const parsed = RuleCardSchema.safeParse(rule)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`rule ${rid}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`)
      }
    }
    if (!jurisdictions.has(str(rule.jurisdiction) ?? '')) errors.push(`rule ${rid}: unknown jurisdiction`)
    const reviewed = isoDate(rule.reviewed_on, `rule ${rid}.reviewed_on`, errors)
    const due = isoDate(rule.review_due, `rule ${rid}.review_due`, errors)
    if (reviewed && due && due < reviewed) errors.push(`rule ${rid}: review due before reviewed`)
    const sourceIds = Array.isArray(rule.source_ids) ? rule.source_ids : []
    if (sourceIds.length === 0) errors.push(`rule ${rid}: missing sources`)
    for (const sidValue of sourceIds) {
      const sid = typeof sidValue === 'string' ? sidValue : ''
      const source = sourceMap.get(sid)
      if (!source) errors.push(`rule ${rid}: unknown source ${sid}`)
      else if (rule.kind === 'legal' && !(str(source.kind) ?? '').startsWith('primary-')) {
        errors.push(`rule ${rid}: legal claim lacks primary source ${sid}`)
      } else if (source.jurisdiction !== rule.jurisdiction) {
        errors.push(`rule ${rid}: source ${sid} jurisdiction mismatch`)
      }
    }
  }

  const processes = indexed(workflowJson(path.join(ROOT, 'open-processes')), errors, 'process')
  for (const [pid, process] of processes) {
    shape(process, need('process.schema'), `process ${pid}`, errors)
    const scope = isObj(process.applicability) ? process.applicability : {}
    for (const key of MATCH_KEYS) {
      if (!str(scope[key])) errors.push(`process ${pid}: missing applicability.${key}`)
    }
    for (const key of ['entity_jurisdiction', 'tax_jurisdiction'] as const) {
      if (!jurisdictions.has(str(scope[key]) ?? '')) errors.push(`process ${pid}: unknown ${key}`)
    }
    const reviewed = isoDate(process.reviewed_on, `process ${pid}.reviewed_on`, errors)
    const due = isoDate(process.review_due, `process ${pid}.review_due`, errors)
    if (reviewed && due && due < reviewed) errors.push(`process ${pid}: review due before reviewed`)
    const ruleIds = Array.isArray(process.rule_ids) ? process.rule_ids : []
    if (ruleIds.length === 0) errors.push(`process ${pid}: missing rule IDs`)
    for (const rid of ruleIds) {
      if (typeof rid !== 'string' || !rules.has(rid)) errors.push(`process ${pid}: unknown rule ${String(rid)}`)
    }
    const seenSteps = new Set<string>()
    const steps = Array.isArray(process.steps) ? process.steps : []
    for (const stepValue of steps) {
      const step = isObj(stepValue) ? stepValue : {}
      const sid = str(step.id)
      if (!sid || seenSteps.has(sid)) errors.push(`process ${pid}: duplicate or absent step ID ${JSON.stringify(sid)}`)
      if (sid) seenSteps.add(sid)
      if (!['read_only', 'prepare_draft', 'external_effect'].includes(str(step.mode) ?? '')) {
        errors.push(`process ${pid}, step ${sid}: unknown mode`)
      }
      if (step.mode === 'external_effect') {
        const approval = step.approval
        if (!isObj(approval) || !str(approval.role) || !str(approval.scope)) {
          errors.push(`process ${pid}, step ${sid}: missing scoped human approval`)
        }
      }
    }
  }

  // The startup-law map: every committed card appears in the taxonomy, every rule and
  // process reference resolves, and the editorial maturity grades stay consistent with the
  // cards actually present (no cards cannot grade better than unmapped; cards cannot grade
  // unmapped; partial and unmapped sub-areas state their gaps).
  const mapDoc = read(path.join(ROOT, LAW_MAP))
  shape(mapDoc, need('law-map.schema'), 'law map', errors)
  const linkableProcessIds = new Set<string>(processes.keys())
  const corpusDoc = read(path.join(ROOT, OPERATIONAL_CORPUS))
  if (Array.isArray(corpusDoc)) {
    for (const p of corpusDoc) if (isObj(p) && typeof p.id === 'string') linkableProcessIds.add(p.id)
  }
  const mappedRules = new Set<string>()
  if (isObj(mapDoc)) {
    const updated = isoDate(mapDoc.updated_on, 'law map.updated_on', errors)
    if (updated && updated > today) errors.push('law map: updated_on is in the future')
    const domainIds = new Set<string>()
    for (const domainValue of Array.isArray(mapDoc.domains) ? mapDoc.domains : []) {
      const domain = isObj(domainValue) ? domainValue : {}
      const did = str(domain.id) ?? ''
      if (domainIds.has(did)) errors.push(`law map: duplicate domain ${did}`)
      domainIds.add(did)
      const subMaturities: string[] = []
      const subIds = new Set<string>()
      for (const subValue of Array.isArray(domain.subareas) ? domain.subareas : []) {
        const sub = isObj(subValue) ? subValue : {}
        const sid = `${did}/${str(sub.id) ?? ''}`
        if (subIds.has(sid)) errors.push(`law map: duplicate sub-area ${sid}`)
        subIds.add(sid)
        const maturity = str(sub.maturity) ?? ''
        subMaturities.push(maturity)
        const ruleIds = Array.isArray(sub.rule_ids) ? sub.rule_ids : []
        const seen = new Set<string>()
        for (const ridValue of ruleIds) {
          const rid = typeof ridValue === 'string' ? ridValue : ''
          if (seen.has(rid)) errors.push(`law map ${sid}: duplicate rule ${rid}`)
          seen.add(rid)
          if (!rules.has(rid)) errors.push(`law map ${sid}: unknown rule ${rid}`)
          mappedRules.add(rid)
        }
        if (ruleIds.length === 0 && maturity !== 'unmapped') errors.push(`law map ${sid}: no cards, so maturity must be unmapped`)
        if (ruleIds.length > 0 && maturity === 'unmapped') errors.push(`law map ${sid}: carries cards, so maturity cannot be unmapped`)
        const gaps = Array.isArray(sub.gaps) ? sub.gaps : []
        if (maturity !== 'mapped' && gaps.length === 0) errors.push(`law map ${sid}: ${maturity} maturity requires stated gaps`)
        for (const pidValue of Array.isArray(sub.process_ids) ? sub.process_ids : []) {
          const pid = typeof pidValue === 'string' ? pidValue : ''
          if (!linkableProcessIds.has(pid)) errors.push(`law map ${sid}: unknown process ${pid}`)
        }
      }
      const maturity = str(domain.maturity) ?? ''
      if (maturity === 'mapped' && subMaturities.some((m) => m !== 'mapped')) {
        errors.push(`law map ${did}: mapped requires every sub-area mapped`)
      }
      if (maturity === 'unmapped' && subMaturities.some((m) => m !== 'unmapped')) {
        errors.push(`law map ${did}: unmapped requires every sub-area unmapped`)
      }
      if (maturity === 'partial' && (subMaturities.every((m) => m === 'mapped') || subMaturities.every((m) => m === 'unmapped'))) {
        errors.push(`law map ${did}: partial misstates uniformly ${subMaturities[0] ?? 'absent'} sub-areas`)
      }
    }
  }
  for (const rid of rules.keys()) {
    if (!mappedRules.has(rid)) errors.push(`rule ${rid}: absent from the law map (open-law/map.json)`)
  }

  const coverageDoc = read(path.join(ROOT, 'open-law/workflow-coverage.json'))
  const coverage = isObj(coverageDoc) && Array.isArray(coverageDoc.coverage) ? coverageDoc.coverage : []
  const covered = new Set<string>()
  for (const itemValue of coverage) {
    const item = isObj(itemValue) ? itemValue : {}
    const pid = str(item.process_id) ?? ''
    covered.add(pid)
    const process = processes.get(pid)
    if (!process) errors.push(`coverage: unknown process ${pid}`)
    else if (item.status === 'reviewed' && process.status !== 'reviewed') {
      errors.push(`coverage: cannot claim reviewed status for ${pid}`)
    }
  }
  for (const pid of processes.keys()) {
    if (!covered.has(pid)) errors.push(`process ${pid}: absent from coverage registry`)
  }

  for (const file of listJson(path.join(ROOT, 'open-rankings/reviews'))) {
    shape(read(file), need('vendor-review.schema'), `vendor ${path.basename(file)}`, errors)
  }

  for (const file of listJson(path.join(ROOT, FIXTURES_DIR))) {
    const event = read(file)
    const obj = isObj(event) ? event : {}
    if (obj.synthetic !== true) errors.push(`fixture ${path.basename(file)}: must assert synthetic=true`)
    if (!str(obj.id) || MATCH_KEYS.some((key) => !(key in obj))) {
      errors.push(`fixture ${path.basename(file)}: missing scenario dimensions`)
    }
  }
  return errors
}

export interface FounderOpsPlan {
  status: 'needs_review' | 'unsupported' | 'plan_only'
  reason?: string
  missing?: string[]
  may_execute: false
  as_of?: string
  event_id?: string
  warning?: string
  matches?: JsonObject[]
}

// Exact dimension match only. Unknowns never inherit another jurisdiction.
export function planFounderOps(event: JsonObject, asOf?: Date): FounderOpsPlan {
  const today = asOf ?? new Date()
  const missing = MATCH_KEYS.filter((key) => !str(event[key]))
  if (missing.length > 0) {
    return { status: 'needs_review', reason: 'missing dimensions', missing: [...missing], may_execute: false }
  }
  const processes = workflowJson(path.join(ROOT, 'open-processes'))
    .map(read)
    .filter(isObj)
    .filter(record => !isProcessDefinition(record))
  const matches = processes.filter((p) => {
    const scope = isObj(p.applicability) ? p.applicability : {}
    return MATCH_KEYS.every((key) => scope[key] === event[key])
  })
  if (matches.length === 0) {
    return { status: 'unsupported', reason: 'no exact covered scenario', may_execute: false }
  }
  const ruleMap = indexed(ruleCardJson(path.join(ROOT, 'open-law')), [], 'rule')
  const citationsDoc = read(path.join(ROOT, 'open-law/citations/registry.json'))
  const sources = new Map<string, JsonObject>()
  for (const s of isObj(citationsDoc) && Array.isArray(citationsDoc.citations) ? citationsDoc.citations : []) {
    if (isObj(s) && typeof s.id === 'string') sources.set(s.id, s)
  }
  const output: JsonObject[] = matches.map((process) => {
    const due = new Date(`${str(process.review_due)}T00:00:00Z`)
    const ruleIds = Array.isArray(process.rule_ids) ? process.rule_ids : []
    const steps = Array.isArray(process.steps) ? process.steps : []
    return {
      process_id: process.id ?? null,
      version: process.version ?? null,
      status: due < today ? 'stale' : (process.status ?? null),
      review_due: process.review_due ?? null,
      rules: ruleIds.flatMap((ridValue) => {
        const rule = typeof ridValue === 'string' ? ruleMap.get(ridValue) : undefined
        if (!rule) return []
        const sourceIds = Array.isArray(rule.source_ids) ? rule.source_ids : []
        return [{
          id: rule.id ?? null,
          statement: rule.statement ?? null,
          caveat: rule.caveat ?? null,
          sources: sourceIds.flatMap((sidValue) => {
            const source = typeof sidValue === 'string' ? sources.get(sidValue) : undefined
            return source
              ? [{ url: source.url ?? null, locator: source.locator ?? null, checked_on: source.checked_on ?? null }]
              : []
          }),
        }]
      }),
      decisions: process.decisions ?? [],
      stop_conditions: process.stop_conditions ?? [],
      steps: steps.flatMap((s) =>
        isObj(s) ? [{ id: s.id ?? null, action: s.action ?? null, mode: s.mode ?? null, approval: s.approval ?? null }] : [],
      ),
    }
  })
  return {
    status: 'plan_only',
    as_of: today.toISOString().slice(0, 10),
    event_id: str(event.id),
    may_execute: false,
    warning: 'Demonstration plans; verify current law, case facts, deadlines and authorizations.',
    matches: output,
  }
}
