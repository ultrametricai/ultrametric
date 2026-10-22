// Publish the open-module call surface as machine-readable JSON — open-modules/registry.json —
// so an agent can find a module's entrypoint, its input field names, and a runnable example
// without reading TypeScript source (maintainer report 2026-10-21: calling
// compareFranchiseTaxMethods took three attempts without this). The entry specs beside each
// module (lib/openstartup/entryValidation.ts) stay the single source of truth: this file is
// GENERATED from them via zod's native z.toJSONSchema, the example calls are executed at
// generation time to pin each result shape, and the drift test
// (__tests__/module-registry.test.ts) fails if the committed output ever diverges from what
// the live specs generate. Regenerate with: npx tsx scripts/generate-module-registry.ts
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { loadBusinessLogicMap } from '../lib/businessLogicMap'
import type { EntrySpec } from '../lib/openstartup/entryValidation'
import * as antiDilution from '../lib/openstartup/antiDilution'
import * as capTable from '../lib/openstartup/capTable'
import * as capTableCodec from '../lib/openstartup/capTableCodec'
import * as convertibleNote from '../lib/openstartup/convertibleNote'
import * as deFranchiseTax from '../lib/openstartup/deFranchiseTax'
import * as deadlines from '../lib/openstartup/deadlines'
import * as deferredRevenue from '../lib/openstartup/deferredRevenue'
import * as election83b from '../lib/openstartup/election83b'
import * as equityComp from '../lib/openstartup/equityComp'
import * as grant409aSanity from '../lib/openstartup/grant409aSanity'
import * as optionTax from '../lib/openstartup/optionTax'
import * as payrollTax from '../lib/openstartup/payrollTax'
import * as qsbs from '../lib/openstartup/qsbs'
import * as rdCredit from '../lib/openstartup/rdCredit'
import * as round from '../lib/openstartup/round'
import * as roundComposer from '../lib/openstartup/roundComposer'
import * as runway from '../lib/openstartup/runway'
import * as unitEconomics from '../lib/openstartup/unitEconomics'
import * as vesting from '../lib/openstartup/vesting'
import * as waterfall from '../lib/openstartup/waterfall'

const ROOT = path.resolve(__dirname, '..')
export const MODULE_REGISTRY_FILE = path.join(ROOT, 'open-modules', 'registry.json')

export interface RegistryEntryDef {
  /** The module id = the lib/openstartup file basename (the business-logic-map key). */
  id: string
  /** The module's namespace (its exported functions become the entry's `exports` list). */
  ns: Record<string, unknown>
  /** The registered entrypoint's argument spec (defined beside the module's types). */
  entry: EntrySpec
  /** Literal JSON arguments for the runnable example; the call runs at generation time. */
  exampleArgs: readonly unknown[]
  /** Catalog overrides for modules without their own business-logic-map entry. */
  title?: string
  anchor?: string
  note?: string
}

// Example inputs replay the modules' own cited worked examples where one fits in a literal
// call (YC Appendix II, Rev. Proc. 2012-29, Springmeyer, the Delaware Division example,
// Cooley GO, Reg. § 1.422-4(d) Ex. 3, Stripe, Sacks); the rest are fictional fixtures.
export const REGISTRY_ENTRIES: readonly RegistryEntryDef[] = [
  {
    id: 'antiDilution',
    ns: antiDilution,
    entry: antiDilution.applyAntiDilutionEntry,
    exampleArgs: [
      { name: 'Series A', preferredShares: 4_000_000, originalIssuePrice: 2, conversionPriceBefore: 2 },
      { newShares: 5_000_000, considerationDollars: 5_000_000 },
      'broad-based',
      12_000_000,
    ],
  },
  {
    id: 'capTable',
    ns: capTable,
    entry: capTable.buildCapTableEntry,
    note: 'Structurally malformed events throw; semantically invalid events (bad amounts, overdrawn pools) report via the returned report.error with earlier snapshots preserved.',
    exampleArgs: [
      [
        { kind: 'found', founders: [{ name: 'Founder A', shares: 4_500_000 }, { name: 'Founder B', shares: 4_500_000 }], poolShares: 1_000_000 },
        { kind: 'safe', name: 'Angel SAFE', amount: 500_000, cap: 5_000_000 },
        { kind: 'priced', name: 'Series A', preMoney: 8_000_000, newMoney: 2_000_000, poolTargetPct: 10 },
      ],
    ],
  },
  {
    id: 'capTableCodec',
    ns: capTableCodec,
    entry: capTableCodec.encodeCapTableStateEntry,
    title: 'Cap table permalink codec',
    anchor: 'cap-table',
    note: 'decodeCapTableState is the inverse and returns null on any malformed token.',
    exampleArgs: [
      [
        { kind: 'found', founders: [{ name: 'Founder A', shares: 4_500_000 }], poolShares: 500_000 },
        { kind: 'safe', name: 'Angel SAFE', amount: 500_000, cap: 5_000_000 },
      ],
    ],
  },
  {
    id: 'convertibleNote',
    ns: convertibleNote,
    entry: convertibleNote.seriesPricingWithNotesEntry,
    exampleArgs: [
      { preMoney: 8_000_000, newMoney: 2_000_000, noteBalanceConverting: 1_000_000, discountPct: 30, preRoundFullyDiluted: 1_000_000 },
    ],
  },
  {
    id: 'deFranchiseTax',
    ns: deFranchiseTax,
    entry: deFranchiseTax.compareFranchiseTaxMethodsEntry,
    exampleArgs: [
      {
        totalGrossAssets: 1_000_000,
        totalIssuedShares: 485_000,
        authorizedClasses: [
          { shares: 1_000_000, parValue: 1 },
          { shares: 250_000, parValue: 5 },
        ],
      },
    ],
  },
  {
    id: 'deadlines',
    ns: deadlines,
    entry: deadlines.complianceCalendarEntry,
    exampleArgs: ['2026-01-01', '2026-12-31', { hasPayroll: true }],
  },
  {
    id: 'deferredRevenue',
    ns: deferredRevenue,
    entry: deferredRevenue.recognitionReportEntry,
    exampleArgs: [
      [{ description: 'Monthly subscription', amount: 31, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' }],
    ],
  },
  {
    id: 'election83b',
    ns: election83b,
    entry: election83b.compare83bScenarioEntry,
    exampleArgs: [
      { shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 1 },
      [{ label: 'vesting', shares: 25_000, fmvPerShare: 1.6 }],
    ],
  },
  {
    id: 'equityComp',
    ns: equityComp,
    entry: equityComp.offerScenarioTableEntry,
    exampleArgs: [
      { optionShares: 50_000, strikePerShare: 0.4, fullyDilutedShares: 10_000_000 },
      [{ label: '$100M exit', exitValuation: 100_000_000, extraDilutionPct: 20 }],
    ],
  },
  {
    id: 'grant409aSanity',
    ns: grant409aSanity,
    entry: grant409aSanity.grantSanityReportEntry,
    exampleArgs: [
      { strikePerShare: 0.4, fmvPerShare: 0.4, fmvAsOf: '2026-06-01', grantOn: '2026-09-01', independentAppraisalOn: '2026-06-01' },
    ],
  },
  {
    id: 'optionTax',
    ns: optionTax,
    entry: optionTax.iso100kAttributionEntry,
    exampleArgs: [
      [
        { id: 'option-1', grantDate: '2026-04-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2026, shares: 6000 }] },
        { id: 'option-2', grantDate: '2026-05-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2026, shares: 5000 }] },
      ],
    ],
  },
  {
    id: 'payrollTax',
    ns: payrollTax,
    entry: payrollTax.employerPayrollCostAnnualEntry,
    exampleArgs: [120_000],
  },
  {
    id: 'qsbs',
    ns: qsbs,
    entry: qsbs.qsbsEligibilityChecklistEntry,
    exampleArgs: [
      {
        issuanceDate: '2026-01-15',
        isCCorporation: true,
        acquiredAtOriginalIssuance: true,
        aggregateGrossAssetsAtIssuance: 2_000_000,
        inExcludedField: false,
      },
    ],
  },
  {
    id: 'rdCredit',
    ns: rdCredit,
    entry: rdCredit.quarterlyOffsetApplicationEntry,
    exampleArgs: [
      {
        electedAmount: 500_000,
        taxYearBeginsAfter2022: true,
        quarters: [
          { label: '2026-Q1', employerSocialSecurityTax: 80_000, employerMedicareTax: 20_000 },
          { label: '2026-Q2', employerSocialSecurityTax: 80_000, employerMedicareTax: 20_000 },
        ],
      },
    ],
  },
  {
    id: 'round',
    ns: round,
    entry: round.downRoundModelEntry,
    exampleArgs: [
      [
        { id: 'founders', name: 'Founders & pool', group: 'founder', shares: 8_000_000, pct: 66.67 },
        { id: 'series-a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: 33.33 },
      ],
      [{ seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 2, basis: 'broad-based' }],
      { newShares: 5_000_000, considerationDollars: 5_000_000, investorName: 'Series B' },
    ],
  },
  {
    id: 'roundComposer',
    ns: roundComposer,
    entry: roundComposer.replayPricedRoundEntry,
    exampleArgs: [
      [
        { kind: 'found', founders: [{ name: 'Founder A', shares: 4_500_000 }, { name: 'Founder B', shares: 4_500_000 }], poolShares: 1_000_000 },
        { kind: 'safe', name: 'Angel SAFE', amount: 500_000, cap: 5_000_000 },
      ],
      { name: 'Series A', preMoney: 8_000_000, newMoney: 2_000_000, poolTargetPct: 10 },
    ],
  },
  {
    id: 'runway',
    ns: runway,
    entry: runway.hiringImpactEntry,
    exampleArgs: [
      { cash: 200_000, monthlyRevenue: 10_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 10 },
      [{ monthlyCost: 15_000, startMonth: 3 }],
    ],
  },
  {
    id: 'unitEconomics',
    ns: unitEconomics,
    entry: unitEconomics.burnMultipleEntry,
    exampleArgs: [{ netBurn: 2_000_000, netNewArr: 1_000_000 }],
  },
  {
    id: 'vesting',
    ns: vesting,
    entry: vesting.vestedAsOfEntry,
    exampleArgs: [
      { shares: 4_800_000, commencement: '2026-01-15', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 } },
      '2028-01-15',
    ],
  },
  {
    id: 'waterfall',
    ns: waterfall,
    entry: waterfall.liquidityWaterfallEntry,
    exampleArgs: [
      {
        holders: [
          { name: 'Founders', shares: 9_250_000 },
          { name: 'Options outstanding', shares: 300_000, group: 'options' },
        ],
        safes: [
          { name: 'Safe 1', amount: 200_000, postMoneyCap: 4_000_000 },
          { name: 'Safe 2', amount: 800_000, postMoneyCap: 8_000_000 },
        ],
        unissuedPoolShares: 450_000,
      },
      10_000_000,
    ],
  },
]

/** The recursive type skeleton of a value: primitives become their typeof name, arrays
 * list their DISTINCT element shapes in first-appearance order (so a trajectory of
 * identical months collapses to one shape while a snapshot list whose last element adds
 * `round`, or a findings list mixing finding kinds, records every variant), objects map
 * field → shape (undefined fields dropped, matching JSON). The drift test re-runs each
 * example and compares shapes. */
export function shapeOf(value: unknown): unknown {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    const shapes: unknown[] = []
    const seen = new Set<string>()
    for (const element of value) {
      const shape = shapeOf(element)
      const key = JSON.stringify(shape)
      if (!seen.has(key)) {
        seen.add(key)
        shapes.push(shape)
      }
    }
    return shapes
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = shapeOf(v)
    }
    return out
  }
  return typeof value
}

/** The index-table status cell per anchor, read from the open-modules/README.md catalog. */
function statusByAnchor(readme: string): Map<string, string> {
  const statuses = new Map<string, string>()
  const row = /^\| \[[^\]]+\]\(#([^)]+)\)(?: \|[^|]*){3} \| ([^|]+) \|$/gm
  for (const match of readme.matchAll(row)) statuses.set(match[1], match[2].trim())
  return statuses
}

// io: 'input' — the published schema is the contract for what a CALLER may pass. Runtime
// validation tolerates extra keys and keeps the original objects (downRoundModel hands its
// issuance, investorName included, straight to applyAntiDilution), so the output
// perspective's additionalProperties: false would reject calls the modules accept. The
// explicit $schema declares the 2020-12 dialect each standalone inputSchema relies on
// (prefixItems with items: false reads as reject-everything under draft-07).
function inputSchemaOf(entry: EntrySpec): Record<string, unknown> {
  const prefixItems = entry.args.map((arg) => {
    const { $schema: _dropped, ...schema } = z.toJSONSchema(arg.schema, { io: 'input' })
    return { title: arg.name, ...schema }
  })
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'array',
    description: `Positional arguments of ${entry.fn}`,
    prefixItems,
    items: false,
    minItems: entry.args.filter((a) => !a.optional).length,
    maxItems: entry.args.length,
  }
}

// Deterministic: the catalog labels/anchors come from committed files, z.toJSONSchema walks
// the zod shapes in declaration order, the example calls are pure functions of their literal
// arguments, and JSON.stringify preserves insertion order — no dates, no environment reads.
export function moduleRegistryJson(): string {
  const map = loadBusinessLogicMap()
  const readme = fs.readFileSync(path.join(ROOT, 'open-modules', 'README.md'), 'utf8')
  const statuses = statusByAnchor(readme)

  const modules = [...REGISTRY_ENTRIES]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((def) => {
      const mapped = map[def.id]
      const title = def.title ?? mapped?.label
      const anchor = def.anchor ?? mapped?.anchor
      if (!title || !anchor) throw new Error(`module ${def.id}: no catalog label/anchor (business-logic-map or override)`)
      const status = statuses.get(anchor)
      if (!status) throw new Error(`module ${def.id}: no index-table status row for #${anchor} in open-modules/README.md`)
      const fn = def.ns[def.entry.fn]
      if (typeof fn !== 'function') throw new Error(`module ${def.id}: entrypoint ${def.entry.fn} is not an exported function`)
      const result = (fn as (...args: unknown[]) => unknown)(...structuredClone(def.exampleArgs) as unknown[])
      const exports = Object.entries(def.ns)
        .filter(([, value]) => typeof value === 'function')
        .map(([name]) => name)
        .sort()
      return {
        id: def.id,
        title,
        file: `lib/openstartup/${def.id}.ts`,
        readme: `open-modules/README.md#${anchor}`,
        status,
        exports,
        entrypoint: {
          function: def.entry.fn,
          signature: `${def.entry.fn}(${def.entry.args.map((a) => (a.optional ? `${a.name}?` : a.name)).join(', ')})`,
          inputSchema: inputSchemaOf(def.entry),
          ...(def.note === undefined ? {} : { note: def.note }),
          example: { args: def.exampleArgs, resultShape: shapeOf(result) },
        },
      }
    })

  const doc = {
    description:
      'Machine-readable index of the open modules in lib/openstartup/: per module its entrypoint ' +
      'file, exported functions, the registered entrypoint with a JSON Schema for its positional ' +
      'arguments, a runnable example call with its result shape, and the catalog status line from ' +
      'open-modules/README.md. Generated from the entry specs beside each module by ' +
      'scripts/generate-module-registry.ts — edit the specs or the catalog, never this file.',
    invalidInput:
      'Registered entrypoints validate their positional arguments against inputSchema and raise a ' +
      'RangeError naming the function, argument, and field on structurally malformed input; semantic ' +
      'rules (ranges, dates, share arithmetic) raise their own named RangeErrors.',
    modules,
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

function main(): void {
  fs.writeFileSync(MODULE_REGISTRY_FILE, moduleRegistryJson())
  console.log(`wrote ${path.relative(ROOT, MODULE_REGISTRY_FILE)}`)
}

if (require.main === module) main()
