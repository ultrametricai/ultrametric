// Publish the open modules' worked examples as language-agnostic conformance vectors —
// open-modules/conformance/<module>.json — so an implementation in any language can test
// itself against the same published numbers these modules replay (being the reference
// others test against). Each case calls the module's registered entrypoint (the same one
// open-modules/registry.json documents) with literal JSON inputs and pins the fields the
// module's own tests assert, traced to the cited source or the committed test that derives
// them. Every case is executed at generation time: a vector that the repo's own
// implementation fails never gets written. The drift test
// (__tests__/conformance-vectors.test.ts) fails if the committed files ever diverge from
// what this script generates, or if a committed case stops passing.
// Regenerate with: npx tsx scripts/generate-conformance-vectors.ts
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import * as antiDilution from '../lib/openstartup/antiDilution'
import * as capTable from '../lib/openstartup/capTable'
import * as convertibleNote from '../lib/openstartup/convertibleNote'
import * as deFranchiseTax from '../lib/openstartup/deFranchiseTax'
import * as deadlines from '../lib/openstartup/deadlines'
import * as deferredRevenue from '../lib/openstartup/deferredRevenue'
import * as election83b from '../lib/openstartup/election83b'
import * as equityComp from '../lib/openstartup/equityComp'
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
export const CONFORMANCE_DIR = path.join(ROOT, 'open-modules', 'conformance')

export interface ConformanceCase {
  /** Unique within the module file; stable, kebab-case. */
  name: string
  /** What the case computes, with the published figures spelled out. */
  description: string
  /** The citation the case replays: the published source, or the committed test that derives it. */
  source: string
  /** Absolute tolerance for every numeric comparison in `expected`; omitted = exact. */
  tolerance?: number
  /** Positional arguments for the registered entrypoint (registry.json inputSchema order). */
  inputs: readonly unknown[]
  /** Partial deep match against the entrypoint's return value (see conformance/README.md). */
  expected: unknown
}

export interface ConformanceModuleDef {
  /** The module id = the lib/openstartup file basename (matches registry.json). */
  id: string
  /** The module's namespace, to resolve the entrypoint function. */
  ns: Record<string, unknown>
  /** The registered entrypoint's name (must equal registry.json's entrypoint.function). */
  fn: string
  cases: readonly ConformanceCase[]
}

/**
 * Partial deep match: every field listed in `expected` must match the actual value.
 * Objects compare the listed keys only (extra actual fields pass). Arrays compare
 * index-by-index and must have equal length; `{}` matches any element. Numbers must land
 * within `tolerance` of the expected value (absolute; exact when 0). Everything else is
 * strict equality. Returns the path of the first mismatch, or null on a full match.
 */
export function firstMismatch(expected: unknown, actual: unknown, tolerance: number, at = 'expected'): string | null {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') return `${at}: expected a number, got ${JSON.stringify(actual)}`
    const ok = tolerance > 0 ? Math.abs(actual - expected) <= tolerance : actual === expected
    return ok ? null : `${at}: expected ${expected}${tolerance > 0 ? ` within ${tolerance}` : ''}, got ${actual}`
  }
  if (expected === null || typeof expected !== 'object') {
    return expected === actual ? null : `${at}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${at}: expected an array, got ${JSON.stringify(actual)}`
    if (actual.length !== expected.length) return `${at}: expected length ${expected.length}, got ${actual.length}`
    for (let i = 0; i < expected.length; i += 1) {
      const mismatch = firstMismatch(expected[i], actual[i], tolerance, `${at}[${i}]`)
      if (mismatch !== null) return mismatch
    }
    return null
  }
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
    return `${at}: expected an object, got ${JSON.stringify(actual)}`
  }
  for (const [key, value] of Object.entries(expected)) {
    const mismatch = firstMismatch(value, (actual as Record<string, unknown>)[key], tolerance, `${at}.${key}`)
    if (mismatch !== null) return mismatch
  }
  return null
}

// Shared source strings (one citation, quoted wherever a case replays it).
const SPRINGMEYER =
  'Bryan Springmeyer, "Anti-Dilution Provisions in Venture Capital Transactions" ' +
  '(https://www.calstartuplawfirm.com/business-lawyer-blog/anti-dilution-provisions.php, verified 2026-10-01)'
const YC_GUIDE = 'YC Post-Money Safe User Guide, Feb 2023 (PDF linked from https://www.ycombinator.com/documents)'
const DE_DIVISION =
  'Delaware Division of Corporations, "How to Calculate Franchise Taxes" published examples ' +
  '(https://corp.delaware.gov/frtaxcalc/, verified 2026-10-01); 8 Del. C. § 503'
const REV_PROC_2012_29 =
  'Rev. Proc. 2012-29 § 5 (https://www.irs.gov/pub/irs-drop/rp-12-29.pdf): 25,000 shares transferred 2012-04-01, ' +
  'vesting 2014-04-01 at a $40,000 FMV'
const REG_1_422_4 = 'Treas. Reg. § 1.422-4(d) (https://www.law.cornell.edu/cfr/text/26/1.422-4, verified 2026-10-01)'

// The YC Appendix II Example 1 company, shared by the capTable and roundComposer cases:
// ABC, Inc. with 10,000,000 fully diluted shares before the round and two post-money SAFEs.
const ABC_HISTORY = [
  { kind: 'found', founders: [{ name: 'Founders', shares: 9_250_000 }], poolShares: 750_000 },
  { kind: 'grant', name: 'Options outstanding', shares: 300_000 },
  { kind: 'grant', name: 'Promised options', shares: 350_000 },
  { kind: 'safe', name: 'Investor A', amount: 200_000, cap: 4_000_000 },
  { kind: 'safe', name: 'Investor B', amount: 800_000, cap: 8_000_000, proRata: true },
] as const
const ABC_ROUND = { name: 'Series A', preMoney: 15_000_000, newMoney: 5_000_000, poolShares: 1_695_000 } as const

// The Springmeyer setup: Series A bought 4,000,000 preferred at $2.00 (conversion price
// $2.00); the dilutive round sells 5,000,000 new shares for $5,000,000 ($1.00 per share);
// the broad base is 8,000,000 founder/pool shares + 4,000,000 as-converted = 12,000,000.
const SPRINGMEYER_SERIES_A = { name: 'Series A', preferredShares: 4_000_000, originalIssuePrice: 2, conversionPriceBefore: 2 } as const
const SPRINGMEYER_DOWN_ROUND = { newShares: 5_000_000, considerationDollars: 5_000_000 } as const

export const CONFORMANCE_MODULES: readonly ConformanceModuleDef[] = [
  {
    id: 'antiDilution',
    ns: antiDilution,
    fn: 'applyAntiDilution',
    cases: [
      {
        name: 'springmeyer-broad-based',
        description:
          'Broad-based weighted average on the Springmeyer example: CP2 = $2.00 × (12,000,000 + 5,000,000/2.00) / ' +
          '(12,000,000 + 5,000,000) = $1.7059; the 4,000,000 preferred convert to 4,689,606 shares ' +
          '(the article\'s "roughly 4.69 million").',
        source: SPRINGMEYER,
        inputs: [SPRINGMEYER_SERIES_A, SPRINGMEYER_DOWN_ROUND, 'broad-based', 12_000_000],
        expected: {
          seriesName: 'Series A',
          basis: 'broad-based',
          conversionPriceBefore: 2,
          conversionPriceAfter: 1.7059,
          asConvertedBefore: 4_000_000,
          asConvertedAfter: 4_689_606,
          additionalCommonShares: 689_606,
          adjusted: true,
        },
      },
      {
        name: 'springmeyer-narrow-based',
        description:
          'Narrow-based weighted average on the same facts, base = only the series\' 4,000,000 as-converted shares: ' +
          'CP2 = $2.00 × (4,000,000 + 2,500,000) / (4,000,000 + 5,000,000) = $1.4444; conversion yields 5,538,631 shares ' +
          '(the article\'s "5.54 million").',
        source: SPRINGMEYER,
        inputs: [SPRINGMEYER_SERIES_A, SPRINGMEYER_DOWN_ROUND, 'narrow-based'],
        expected: { conversionPriceAfter: 1.4444, asConvertedAfter: 5_538_631, adjusted: true },
      },
      {
        name: 'springmeyer-full-ratchet',
        description:
          'Full ratchet on the same facts drops the conversion price to the $1.00 issue price: the Series A investor ' +
          'can convert their $8 million position into 8,000,000 shares.',
        source: SPRINGMEYER,
        inputs: [SPRINGMEYER_SERIES_A, SPRINGMEYER_DOWN_ROUND, 'full-ratchet'],
        expected: { conversionPriceAfter: 1, asConvertedAfter: 8_000_000, adjusted: true },
      },
      {
        name: 'cooley-full-ratchet',
        description:
          'The Cooley GO full-ratchet example: 1,000 shares bought at $10.00; a $5.00 down round (100,000 shares for ' +
          '$500,000) converts the $10,000 investment into 2,000 shares.',
        source:
          'Cooley GO, "What You Need to Know About Down Round Financings" ' +
          '(https://www.cooleygo.com/down-round-financings/, verified 2026-10-01)',
        inputs: [
          { name: 'Investor', preferredShares: 1_000, originalIssuePrice: 10, conversionPriceBefore: 10 },
          { newShares: 100_000, considerationDollars: 500_000 },
          'full-ratchet',
        ],
        expected: { conversionPriceAfter: 5, asConvertedAfter: 2_000, adjusted: true },
      },
      {
        name: 'springmeyer-up-round-no-adjustment',
        description:
          'The Springmeyer up-round (5,000,000 shares at $4.00 = $20,000,000, above the $2.00 conversion price) ' +
          'adjusts nothing: the conversion price stays $2.00.',
        source: SPRINGMEYER,
        inputs: [SPRINGMEYER_SERIES_A, { newShares: 5_000_000, considerationDollars: 20_000_000 }, 'broad-based', 12_000_000],
        expected: { conversionPriceAfter: 2, additionalCommonShares: 0, adjusted: false },
      },
    ],
  },
  {
    id: 'capTable',
    ns: capTable,
    fn: 'buildCapTable',
    cases: [
      {
        name: 'yc-appendix-ii-example-1',
        description:
          'YC Appendix II Example 1 end to end: $5,000,000 Series A at $15,000,000 pre with a 1,695,000-share pool ' +
          'increase. Company Capitalization 10,000,000 / 0.85 = 11,764,705; the SAFEs convert at their caps into ' +
          '588,235 (5%) and 1,176,470 (10%) shares; PPS = 15,000,000 / 13,459,705 = $1.1144; the round sells ' +
          '4,486,719 shares with Investor B\'s pro rata carved out at 448,671; final table 17,946,424 fully diluted ' +
          'with founders at 51.54% and the pool at 10.00%. Expected pins the sixth (final) snapshot; the five earlier ' +
          'snapshots match any value.',
        source: `${YC_GUIDE}, Appendix II Example 1`,
        tolerance: 0.0005,
        inputs: [[...ABC_HISTORY, { kind: 'priced', ...ABC_ROUND }]],
        expected: {
          snapshots: [
            {},
            {},
            {},
            {},
            {},
            {
              fullyDilutedShares: 17_946_424,
              rows: [
                { id: 'founder-Founders', shares: 9_250_000, pct: 51.5423 },
                { id: 'pool', shares: 1_795_000, pct: 10.002 },
                { id: 'grant-Options outstanding', shares: 300_000 },
                { id: 'grant-Promised options', shares: 350_000 },
                { id: 'safe-Investor A', shares: 588_235 },
                { id: 'safe-Investor B', shares: 1_625_141 },
                { id: 'round-Series A', shares: 4_038_048 },
              ],
              round: {
                pps: 1.1144,
                roundShares: 4_486_719,
                poolIncreaseShares: 1_695_000,
                conversions: [
                  { safeName: 'Investor A', shares: 588_235, method: 'cap', effectivePrice: 0.34 },
                  { safeName: 'Investor B', shares: 1_176_470, method: 'cap', effectivePrice: 0.68, proRataShares: 448_671 },
                ],
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'convertibleNote',
    ns: convertibleNote,
    fn: 'seriesPricingWithNotes',
    cases: [
      {
        name: 'cooley-three-methods',
        description:
          'The Cooley GO three-method pricing example: $8,000,000 pre-money, $2,000,000 new money, $1,000,000 of notes ' +
          'converting at a 30% discount, 1,000,000 pre-round fully diluted shares. Pre-money method: $8.00 round price, ' +
          '$5.60 conversion price, ownership 70% / 12.5% / 17.5%. Percentage-ownership method: $6.5714 (the article\'s ' +
          '$6.57), $4.60, ownership 65.71% / 14.29% / 20%. Dollars-invested method: $7.5714 ($7.57), $5.30, ownership ' +
          '68.83% / 12.99% / 18.18%.',
        source:
          'Cooley GO, "Calculating Share Price With Outstanding Convertible Notes or Safes" (Derek Colla; ' +
          'https://www.cooleygo.com/calculating-share-price-outstanding-convertible-notes-or-safes/, last reviewed 2022-01-24)',
        tolerance: 0.005,
        inputs: [
          { preMoney: 8_000_000, newMoney: 2_000_000, noteBalanceConverting: 1_000_000, discountPct: 30, preRoundFullyDiluted: 1_000_000 },
        ],
        expected: {
          'pre-money': {
            pps: 8,
            conversionPrice: 5.6,
            noteShares: 178_571,
            newMoneyShares: 250_000,
            ownershipPct: { existing: 70, notes: 12.5, newMoney: 17.5 },
          },
          'percentage-ownership': {
            pps: 6.5714,
            conversionPrice: 4.6,
            noteShares: 217_391,
            ownershipPct: { existing: 65.71, notes: 14.29, newMoney: 20 },
          },
          'dollars-invested': {
            pps: 7.5714,
            conversionPrice: 5.3,
            noteShares: 188_679,
            ownershipPct: { existing: 68.83, notes: 12.99, newMoney: 18.18 },
          },
        },
      },
    ],
  },
  {
    id: 'deFranchiseTax',
    ns: deFranchiseTax,
    fn: 'compareFranchiseTaxMethods',
    cases: [
      {
        name: 'division-published-example',
        description:
          'The Division\'s own example company: $1,000,000 gross assets, 485,000 issued shares, 1,000,000 authorized at ' +
          '$1.00 par plus 250,000 at $5.00 par. Authorized Shares Method on 1,250,000 shares bills $10,790; Assumed Par ' +
          'Value Capital Method carries $1,000,000 / 485,000 to six decimals ($2.061856), builds $3,311,856 of assumed ' +
          'par value capital, rounds up to 4 million, and bills 4 × $400 = $1,600, saving $9,190.',
        source: DE_DIVISION,
        inputs: [
          {
            totalGrossAssets: 1_000_000,
            totalIssuedShares: 485_000,
            authorizedClasses: [
              { shares: 1_000_000, parValue: 1 },
              { shares: 250_000, parValue: 5 },
            ],
          },
        ],
        expected: {
          authorizedShares: { tax: 10_790 },
          assumedPar: { tax: 1_600, assumedPar: 2.061856, assumedParValueCapital: 3_311_856, taxableMillions: 4 },
          cheaper: 'assumed-par-value-capital',
          saving: 9_190,
        },
      },
      {
        name: 'authorized-shares-cheaper',
        description:
          'The comparison going the other way: 1,000 authorized shares with $50,000,000 of gross assets. The default ' +
          'Authorized Shares bill is the $175 minimum; the assumed-par method reaches $20,000 (assumed par $50,000, ' +
          'capital $50,000,000, 50 × $400), so the default bill wins by $19,825.',
        source: '8 Del. C. § 503 arithmetic, hand-derived in lib/openstartup/__tests__/deFranchiseTax.test.ts',
        inputs: [
          { totalGrossAssets: 50_000_000, totalIssuedShares: 1_000, authorizedClasses: [{ shares: 1_000, parValue: 0.01 }] },
        ],
        expected: {
          authorizedShares: { tax: 175 },
          assumedPar: { tax: 20_000 },
          cheaper: 'authorized-shares',
          saving: 19_825,
        },
      },
    ],
  },
  {
    id: 'deadlines',
    ns: deadlines,
    fn: 'complianceCalendar',
    cases: [
      {
        name: 'calendar-year-2026-with-payroll',
        description:
          'The 2026 compliance clock for a calendar-year Delaware C corporation with payroll: Form 941 for 2025 Q4 due ' +
          '2026-01-31, the Delaware annual report and franchise tax due 2026-03-01, Form 1120 for 2025 due 2026-04-15, ' +
          'then the 2026 Q1-Q3 Form 941 dates (2026-04-30, 2026-07-31, 2026-10-31), in due-date order.',
        source:
          'The dated rule cards named by each entry\'s ruleId in open-law/ (IRS Instructions for Form 941 due-date ' +
          'table; IRS Instructions for Form 1120; 8 Del. C. § 502)',
        inputs: ['2026-01-01', '2026-12-31', { hasPayroll: true }],
        expected: [
          { id: 'form-941-2025-q4', due: '2026-01-31' },
          { id: 'de-franchise-tax-2025', due: '2026-03-01' },
          { id: 'form-1120-2025', due: '2026-04-15' },
          { id: 'form-941-2026-q1', due: '2026-04-30' },
          { id: 'form-941-2026-q2', due: '2026-07-31' },
          { id: 'form-941-2026-q3', due: '2026-10-31' },
        ],
      },
    ],
  },
  {
    id: 'deferredRevenue',
    ns: deferredRevenue,
    fn: 'recognitionReport',
    cases: [
      {
        name: 'stripe-monthly-subscription',
        description:
          'The Stripe monthly example: a $31 invoice for Jan 15 to Feb 14, 2026 recognizes $17 across the 17 January ' +
          'days and $14 across the 14 February days, leaving $14 deferred at the January close.',
        source:
          'Stripe Docs, "Revenue Recognition examples" (https://docs.stripe.com/revenue-recognition/examples, ' +
          'verified 2026-10-02)',
        inputs: [[{ amount: 31, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' }]],
        expected: {
          months: [
            { month: '2026-01', billed: 31, recognized: 17, deferredEnd: 14 },
            { month: '2026-02', billed: 0, recognized: 14, deferredEnd: 0 },
          ],
          totalBilled: 31,
          totalRecognized: 31,
        },
      },
      {
        name: 'cents-exact-largest-remainder',
        description:
          '$100 over the same Jan 15 to Feb 14 period: 100 × 17/31 = 54.8387... splits 54.84 + 45.16 under largest-' +
          'remainder cent allocation, conserving the $100.00 exactly.',
        source:
          'Largest-remainder cent conservation on the Stripe day-count convention, hand-derived in ' +
          'lib/openstartup/__tests__/deferredRevenue.test.ts',
        inputs: [[{ amount: 100, serviceStart: '2026-01-15', serviceEnd: '2026-02-14' }]],
        expected: {
          months: [
            { month: '2026-01', recognized: 54.84, deferredEnd: 45.16 },
            { month: '2026-02', recognized: 45.16, deferredEnd: 0 },
          ],
          totalRecognized: 100,
        },
      },
    ],
  },
  {
    id: 'election83b',
    ns: election83b,
    fn: 'compare83bScenario',
    cases: [
      {
        name: 'rev-proc-2012-29-examples-1-and-2',
        description:
          'Examples 1 and 2 ($25,000 paid at $25,000 FMV): with the election, $0 income at transfer and nothing at ' +
          'vesting, basis $25,000, holding period from transfer; without it, $15,000 compensation at vesting ' +
          '($40,000 FMV minus $25,000 paid) and basis $40,000.',
        source: `${REV_PROC_2012_29}, Examples 1 and 2`,
        inputs: [
          { shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 1 },
          [{ label: 'vest 2014-04-01', shares: 25_000, fmvPerShare: 1.6 }],
        ],
        expected: {
          withElection: { incomeAtTransfer: 0, incomeAtVesting: 0, basis: 25_000, holdingPeriodBegins: 'transfer' },
          withoutElection: { incomeAtTransfer: 0, incomeAtVesting: 15_000, basis: 40_000, holdingPeriodBegins: 'each vesting event' },
          zeroSpreadAtTransfer: true,
        },
      },
      {
        name: 'rev-proc-2012-29-examples-4-and-5',
        description:
          'Examples 4 and 5 ($0 paid for shares worth $25,000): with the election, $25,000 compensation at transfer ' +
          'and basis $25,000; without it, $40,000 compensation at vesting and basis $40,000.',
        source: `${REV_PROC_2012_29}, Examples 4 and 5`,
        inputs: [
          { shares: 25_000, pricePaidPerShare: 0, fmvAtTransferPerShare: 1 },
          [{ label: 'vest 2014-04-01', shares: 25_000, fmvPerShare: 1.6 }],
        ],
        expected: {
          withElection: { incomeAtTransfer: 25_000, incomeAtVesting: 0, basis: 25_000 },
          withoutElection: { incomeAtVesting: 40_000, basis: 40_000 },
          zeroSpreadAtTransfer: false,
        },
      },
    ],
  },
  {
    id: 'equityComp',
    ns: equityComp,
    fn: 'offerScenarioTable',
    cases: [
      {
        name: 'offer-three-scenarios',
        description:
          '50,000 options at a $0.40 strike on 10,000,000 fully diluted shares. Downside ($3,000,000 exit, no further ' +
          'dilution): $0.30 per share is under water, net $0. Base ($100,000,000, 20% further dilution): 12,500,000 ' +
          'shares at exit, $8.00 per share, gross $400,000 minus $20,000 exercise cost = $380,000. Upside ' +
          '($1,000,000,000, 33% further dilution): $67.00 per share, net $3,330,000.',
        source:
          'Holloway Guide to Equity Compensation and Index Ventures "Rewarding Talent" conventions; every number ' +
          'hand-derived in lib/openstartup/__tests__/equityComp.test.ts',
        inputs: [
          { optionShares: 50_000, strikePerShare: 0.4, fullyDilutedShares: 10_000_000 },
          [
            { label: 'downside', exitValuation: 3_000_000 },
            { label: 'base', exitValuation: 100_000_000, extraDilutionPct: 20 },
            { label: 'upside', exitValuation: 1_000_000_000, extraDilutionPct: 33 },
          ],
        ],
        expected: [
          { label: 'downside', sharePriceAtExit: 0.3, grossValue: 15_000, exerciseCost: 20_000, netBeforeTax: 0 },
          { label: 'base', fullyDilutedAtExit: 12_500_000, sharePriceAtExit: 8, grossValue: 400_000, netBeforeTax: 380_000 },
          { label: 'upside', sharePriceAtExit: 67, netBeforeTax: 3_330_000 },
        ],
      },
    ],
  },
  {
    id: 'optionTax',
    ns: optionTax,
    fn: 'iso100kAttribution',
    cases: [
      {
        name: 'reg-1-422-4d-example-2',
        description:
          'Example 2: a $100,000 option (April) and a $75,000 option (December) both first exercisable in 2004. The ' +
          'earlier grant absorbs the whole $100,000 limit, so the later grant is entirely nonstatutory.',
        source: `${REG_1_422_4}, Example 2`,
        inputs: [
          [
            { id: 'y-corp', grantDate: '2004-04-01', grantDateFmvPerShare: 1, firstExercisable: [{ year: 2004, shares: 100_000 }] },
            { id: 'z-corp', grantDate: '2004-12-31', grantDateFmvPerShare: 1, firstExercisable: [{ year: 2004, shares: 75_000 }] },
          ],
        ],
        expected: {
          slices: [
            { grantId: 'y-corp', isoValue: 100_000, nsoValue: 0 },
            { grantId: 'z-corp', isoValue: 0, nsoValue: 75_000 },
          ],
          remainingByYear: { '2004': 0 },
        },
      },
      {
        name: 'reg-1-422-4d-example-3',
        description:
          'Example 3: acceleration pulls $150,000 of grant-date value into 2004 across three options ($60,000 April, ' +
          '$50,000 May, $40,000 June, all at a $10 grant-date FMV). Attribution runs in grant order: $60,000 ISO, then ' +
          'a $40,000/$10,000 ISO/NSO bifurcation (4,000 ISO shares, 1,000 NSO), then $40,000 entirely nonstatutory. ' +
          'Inputs are deliberately out of order; § 422(d)(2) sorts by grant date.',
        source: `${REG_1_422_4}, Example 3`,
        inputs: [
          [
            { id: 'opt3', grantDate: '2004-06-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 4_000 }] },
            { id: 'opt1', grantDate: '2004-04-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 6_000 }] },
            { id: 'opt2', grantDate: '2004-05-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 5_000 }] },
          ],
        ],
        expected: {
          slices: [
            { grantId: 'opt1', isoValue: 60_000, nsoValue: 0 },
            { grantId: 'opt2', isoShares: 4_000, nsoShares: 1_000, isoValue: 40_000, nsoValue: 10_000 },
            { grantId: 'opt3', isoValue: 0, nsoValue: 40_000 },
          ],
          remainingByYear: { '2004': 0 },
        },
      },
    ],
  },
  {
    id: 'payrollTax',
    ns: payrollTax,
    fn: 'employerPayrollCostAnnual',
    cases: [
      {
        name: 'federal-cost-120k',
        description:
          'A $120,000 hire: employer FICA 6.2% + 1.45% = $9,180, net FUTA 0.6% on the first $7,000 = $42, federal ' +
          'employer total $129,222 and load factor 0.0769.',
        source:
          'IRS-published 2026 FICA figures and 2025 Form 940 instructions, pinned via rule cards ' +
          'us-fed.fica-rates-2026 and us-fed.futa-2025 in open-law/US-FED/; totals hand-derived in ' +
          'lib/openstartup/__tests__/payrollTax.test.ts',
        inputs: [120_000],
        expected: {
          fica: { employerSocialSecurity: 7_440, employerMedicare: 1_740, employerFicaTotal: 9_180 },
          futa: { netFuta: 42 },
          federalEmployerTotal: 129_222,
          federalLoadFactor: 0.0769,
        },
      },
    ],
  },
  {
    id: 'qsbs',
    ns: qsbs,
    fn: 'qsbsEligibilityChecklist',
    cases: [
      {
        name: 'post-applicable-date-75m-ceiling',
        description:
          'An issuance after the July 4, 2025 applicable date with $60,000,000 of aggregate gross assets: the ' +
          '$75,000,000 ceiling from P.L. 119-21 applies and the gross-assets condition is met, while the overall ' +
          'verdict stays needs_review (the active-business test is never computable).',
        source:
          '26 U.S.C. § 1202(d)(1) including the P.L. 119-21 (2025) amendments ' +
          '(https://www.law.cornell.edu/uscode/text/26/1202, verified 2026-10-01)',
        inputs: [{ issuanceDate: '2025-08-01', aggregateGrossAssetsAtIssuance: 60_000_000 }],
        expected: {
          overall: 'needs_review',
          grossAssetCeilingApplied: 75_000_000,
          conditions: [{}, {}, { status: 'met' }, { status: 'needs_review' }, {}],
        },
      },
      {
        name: 'applicable-date-boundary-50m-ceiling',
        description:
          'The same $60,000,000 of gross assets on the applicable date itself (2025-07-04, not after it): the classic ' +
          '$50,000,000 ceiling applies and the checklist reports not-met.',
        source:
          '26 U.S.C. § 1202(d)(1) including the P.L. 119-21 (2025) amendments ' +
          '(https://www.law.cornell.edu/uscode/text/26/1202, verified 2026-10-01)',
        inputs: [{ issuanceDate: '2025-07-04', aggregateGrossAssetsAtIssuance: 60_000_000 }],
        expected: { overall: 'not-met', grossAssetCeilingApplied: 50_000_000 },
      },
    ],
  },
  {
    id: 'rdCredit',
    ns: rdCredit,
    fn: 'quarterlyOffsetApplication',
    cases: [
      {
        name: 'form-8974-post-2022-two-quarters',
        description:
          'A $500,000 post-2022 election applied over two quarters: each quarter offsets its employer social security ' +
          'liability first (the election\'s first $250,000 is social-security-only) and Medicare next, carrying ' +
          '$463,000 then $414,000 forward; $86,000 applied in total.',
        source:
          'IRC § 41(h) and the Instructions for Form 8974 (https://www.irs.gov/instructions/i8974, verified ' +
          '2026-10-01), via rule card us-fed.rd-payroll-offset; arithmetic hand-derived in ' +
          'lib/openstartup/__tests__/rdCredit.test.ts',
        inputs: [
          {
            electedAmount: 500_000,
            taxYearBeginsAfter2022: true,
            quarters: [
              { label: '2026-Q2', employerSocialSecurityTax: 30_000, employerMedicareTax: 7_000 },
              { label: '2026-Q3', employerSocialSecurityTax: 40_000, employerMedicareTax: 9_000 },
            ],
          },
        ],
        expected: {
          quarters: [
            { label: '2026-Q2', appliedToSocialSecurity: 30_000, appliedToMedicare: 7_000, carryforwardAfter: 463_000 },
            { label: '2026-Q3', appliedToSocialSecurity: 40_000, appliedToMedicare: 9_000, carryforwardAfter: 414_000 },
          ],
          totalApplied: 86_000,
          remaining: 414_000,
        },
      },
      {
        name: 'form-8974-pre-2023-social-security-only',
        description:
          'A pre-2023 $250,000 election is social-security-only: the quarter\'s $50,000 social security liability is ' +
          'offset and its $20,000 Medicare liability goes untouched.',
        source:
          'IRC § 41(h) and the Instructions for Form 8974 (https://www.irs.gov/instructions/i8974, verified ' +
          '2026-10-01), via rule card us-fed.rd-payroll-offset',
        inputs: [
          {
            electedAmount: 250_000,
            taxYearBeginsAfter2022: false,
            quarters: [{ label: '2022-Q4', employerSocialSecurityTax: 50_000, employerMedicareTax: 20_000 }],
          },
        ],
        expected: {
          quarters: [{ label: '2022-Q4', appliedToSocialSecurity: 50_000, appliedToMedicare: 0 }],
          totalApplied: 50_000,
          remaining: 200_000,
        },
      },
    ],
  },
  {
    id: 'round',
    ns: round,
    fn: 'downRoundModel',
    cases: [
      {
        name: 'springmeyer-down-round-broad-based',
        description:
          'The Springmeyer down round on the full table: 8,000,000 founder/pool shares plus 4,000,000 Series A ' +
          'preferred, a 5,000,000-share $5,000,000 issuance at $1.00. Broad-based protection moves the conversion ' +
          'price to $1.7059 and the Series A to 4,689,606 as-converted shares; fully diluted lands at 17,689,606 with ' +
          'founders falling from 66.67% to 45.22%, the protected Series A at 26.51%, and the new money at 28.27%.',
        source: SPRINGMEYER,
        tolerance: 0.0005,
        inputs: [
          [
            { id: 'founders', name: 'Founders + pool', group: 'founder', shares: 8_000_000, pct: null },
            { id: 'series-a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: null },
          ],
          [{ seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 2, basis: 'broad-based' }],
          { newShares: 5_000_000, considerationDollars: 5_000_000, investorName: 'Series B' },
        ],
        expected: {
          pps: 1,
          adjustments: [{ conversionPriceAfter: 1.7059, asConvertedAfter: 4_689_606, adjusted: true }],
          fullyDilutedBefore: 12_000_000,
          fullyDilutedAfter: 17_689_606,
          rows: [
            { name: 'Founders + pool', pctBefore: 66.6667, pctAfter: 45.2243 },
            { name: 'Series A', pctBefore: 33.3333, pctAfter: 26.5105 },
            { name: 'Series B', pctBefore: 0, pctAfter: 28.2652 },
          ],
        },
      },
      {
        name: 'springmeyer-down-round-narrow-based',
        description:
          'The same down round under narrow-based protection: conversion price $1.4444, Series A at 5,538,631 ' +
          'as-converted shares, fully diluted 18,538,631.',
        source: SPRINGMEYER,
        inputs: [
          [
            { id: 'founders', name: 'Founders + pool', group: 'founder', shares: 8_000_000, pct: null },
            { id: 'series-a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: null },
          ],
          [{ seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 2, basis: 'narrow-based' }],
          { newShares: 5_000_000, considerationDollars: 5_000_000, investorName: 'Series B' },
        ],
        expected: {
          adjustments: [{ conversionPriceAfter: 1.4444, asConvertedAfter: 5_538_631 }],
          fullyDilutedAfter: 18_538_631,
        },
      },
    ],
  },
  {
    id: 'roundComposer',
    ns: roundComposer,
    fn: 'replayPricedRound',
    cases: [
      {
        name: 'yc-appendix-ii-example-1-replay',
        description:
          'YC Appendix II Example 1 replayed stage by stage: the term sheet ($20,000,000 post, 25% to new investors), ' +
          'the closing (PPS $1.1144, 4,486,719 round shares, 1,695,000-share pool increase, cap conversions of 588,235 ' +
          'and 1,176,470, wires of $4,500,000.69 to the new investors and $499,998.96 for Investor B\'s 448,671-share ' +
          'pro rata), and the post-close table (17,946,424 fully diluted, 6,251,424 new preferred, conversion terms ' +
          '$1.1144 at a 1.0 ratio).',
        source: `${YC_GUIDE}, Appendix II Example 1`,
        inputs: [[...ABC_HISTORY], ABC_ROUND],
        expected: {
          termSheet: { postMoney: 20_000_000, newInvestorsPct: 25 },
          closing: {
            round: { pps: 1.1144, roundShares: 4_486_719, poolIncreaseShares: 1_695_000 },
            conversions: [
              { safeName: 'Investor A', shares: 588_235, method: 'cap' },
              { safeName: 'Investor B', shares: 1_176_470, method: 'cap', proRataShares: 448_671 },
            ],
            wires: [
              { holder: 'Series A — new investors', shares: 4_038_048, dollars: 4_500_000.69 },
              { holder: 'Investor B (pro rata)', shares: 448_671, dollars: 499_998.96 },
            ],
            wireTotal: 4_999_999.65,
          },
          postClose: {
            fullyDilutedShares: 17_946_424,
            newPreferredShares: 6_251_424,
            conversionPriceAtClose: 1.1144,
            conversionRatioAtClose: 1,
          },
        },
      },
    ],
  },
  {
    id: 'runway',
    ns: runway,
    fn: 'hiringImpact',
    cases: [
      {
        name: 'default-alive-flips-default-dead',
        description:
          'The default-alive model\'s running example: $200,000 cash, $10,000 MRR growing 10% per month, $30,000 of ' +
          'constant monthly expenses. A $15,000-per-month hire from month 1 flips the plan from default alive to ' +
          'default dead: profitability moves to month 16 (1.1^m must reach 4.5) and cash crosses zero at month 7.',
        source:
          'Paul Graham, "Default Alive or Default Dead?" (October 2015, https://paulgraham.com/aord.html) for the ' +
          'model; arithmetic hand-derived in lib/openstartup/__tests__/runway.test.ts',
        inputs: [
          { cash: 200_000, monthlyRevenue: 10_000, monthlyExpenses: 30_000, revenueGrowthPctMoM: 10 },
          [{ monthlyCost: 15_000, startMonth: 1 }],
        ],
        expected: {
          base: { status: 'default-alive' },
          withHires: { status: 'default-dead', monthsToProfitability: 16, monthsToZeroCash: 7 },
          becomesDefaultDead: true,
          runwayDeltaMonths: null,
        },
      },
    ],
  },
  {
    id: 'unitEconomics',
    ns: unitEconomics,
    fn: 'burnMultiple',
    cases: [
      {
        name: 'sacks-two-x',
        description: 'The post\'s first example: $2,000,000 of net burn for $1,000,000 of net new ARR is a 2x burn multiple.',
        source:
          'David Sacks, "The Burn Multiple" (Craft Ventures, 2020-04-23, ' +
          'https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200)',
        inputs: [{ netBurn: 2_000_000, netNewArr: 1_000_000 }],
        expected: { multiple: 2, computable: true },
      },
      {
        name: 'sacks-five-x',
        description: 'The post\'s second example: $5,000,000 of net burn for the same $1,000,000 of net new ARR is 5x.',
        source:
          'David Sacks, "The Burn Multiple" (Craft Ventures, 2020-04-23, ' +
          'https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200)',
        inputs: [{ netBurn: 5_000_000, netNewArr: 1_000_000 }],
        expected: { multiple: 5, computable: true },
      },
    ],
  },
  {
    id: 'vesting',
    ns: vesting,
    fn: 'vestedAsOf',
    cases: [
      {
        name: 'standard-48-12-before-cliff',
        description:
          '4,800,000 shares on the standard 4-year schedule with a 1-year cliff, commencing 2026-01-15: nothing vests ' +
          'the day before the cliff (2027-01-14).',
        source:
          'Cooley GO, "Founder\'s Stock, Vesting and Founder Departures" ' +
          '(https://www.cooleygo.com/founder-basics-founders-stock/, verified 2026-10-01): the standard 4-year / ' +
          '1-year-cliff monthly convention; share arithmetic hand-derived in lib/openstartup/__tests__/vesting.test.ts',
        inputs: [
          { shares: 4_800_000, commencement: '2026-01-15', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 } },
          '2027-01-14',
        ],
        expected: { vestedShares: 0, unvestedShares: 4_800_000 },
      },
      {
        name: 'standard-48-12-at-cliff',
        description: 'Exactly 25% (12/48 of 4,800,000 = 1,200,000 shares) vests on the first anniversary, 2027-01-15.',
        source:
          'Cooley GO, "Founder\'s Stock, Vesting and Founder Departures" ' +
          '(https://www.cooleygo.com/founder-basics-founders-stock/, verified 2026-10-01); hand-derived in ' +
          'lib/openstartup/__tests__/vesting.test.ts',
        inputs: [
          { shares: 4_800_000, commencement: '2026-01-15', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 } },
          '2027-01-15',
        ],
        expected: { vestedShares: 1_200_000, unvestedShares: 3_600_000, nextVestingDate: '2027-02-15' },
      },
      {
        name: 'standard-48-12-month-13',
        description: 'One month past the cliff (2027-02-15), 13/48 of the grant has vested: 1,300,000 shares.',
        source:
          'Cooley GO, "Founder\'s Stock, Vesting and Founder Departures" ' +
          '(https://www.cooleygo.com/founder-basics-founders-stock/, verified 2026-10-01); hand-derived in ' +
          'lib/openstartup/__tests__/vesting.test.ts',
        inputs: [
          { shares: 4_800_000, commencement: '2026-01-15', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 } },
          '2027-02-15',
        ],
        expected: { vestedShares: 1_300_000, unvestedShares: 3_500_000 },
      },
      {
        name: 'standard-48-12-fully-vested',
        description: 'On the fourth anniversary (2030-01-15) the grant is fully vested at 4,800,000 shares.',
        source:
          'Cooley GO, "Founder\'s Stock, Vesting and Founder Departures" ' +
          '(https://www.cooleygo.com/founder-basics-founders-stock/, verified 2026-10-01); hand-derived in ' +
          'lib/openstartup/__tests__/vesting.test.ts',
        inputs: [
          { shares: 4_800_000, commencement: '2026-01-15', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 1 } },
          '2030-01-15',
        ],
        expected: { vestedShares: 4_800_000, unvestedShares: 0 },
      },
    ],
  },
  {
    id: 'waterfall',
    ns: waterfall,
    fn: 'liquidityWaterfall',
    cases: [
      {
        name: 'yc-appendix-ii-q3-10m-both-convert',
        description:
          'Appendix II Example 1 Q3, the $10,000,000 acquisition: both safes convert (561,764 and 1,123,529 shares on ' +
          'the 9,550,000 / 85% Liquidity Capitalization, at liquidity prices $0.3560 and $0.7120), the per-share ' +
          'consideration is $0.8901 over 11,235,293 shares, and the module allocates the actual price exactly in ' +
          'cents: $8,232,985.11 / $267,015.74 / $499,999.42 / $999,999.73.',
        source: `${YC_GUIDE}, Appendix II Example 1 Q3`,
        inputs: [
          {
            holders: [
              { name: 'Founders', shares: 9_250_000, group: 'common' },
              { name: 'Options outstanding', shares: 300_000, group: 'options' },
            ],
            safes: [
              { name: 'Investor A', amount: 200_000, postMoneyCap: 4_000_000 },
              { name: 'Investor B', amount: 800_000, postMoneyCap: 8_000_000 },
            ],
            unissuedPoolShares: 450_000,
          },
          10_000_000,
        ],
        expected: {
          residualShares: 11_235_293,
          perShare: 0.8901,
          safeConversions: [
            { name: 'Investor A', shares: 561_764, liquidityPrice: 0.356, allConvertPerShare: 0.8901, decision: 'convert' },
            { name: 'Investor B', shares: 1_123_529, liquidityPrice: 0.712, allConvertPerShare: 0.8901, decision: 'convert' },
          ],
          rows: [
            { name: 'Founders', total: 8_232_985.11 },
            { name: 'Options outstanding', total: 267_015.74 },
            { name: 'Investor A', total: 499_999.42 },
            { name: 'Investor B', total: 999_999.73 },
          ],
          unissuedPoolSharesExcluded: 450_000,
        },
      },
      {
        name: 'yc-appendix-ii-q4-3m-both-cash-out',
        description:
          'Appendix II Example 1 Q4, the $3,000,000 acquisition: at $0.2670 per all-convert share both safes\' ' +
          'as-converted values ($149,990.99 and $299,982.24) fall below their Purchase Amounts, so both cash out at ' +
          '$200,000 and $800,000 and the remaining $2,000,000 goes pro rata to the 9,550,000 outstanding shares.',
        source: `${YC_GUIDE}, Appendix II Example 1 Q4`,
        inputs: [
          {
            holders: [
              { name: 'Founders', shares: 9_250_000, group: 'common' },
              { name: 'Options outstanding', shares: 300_000, group: 'options' },
            ],
            safes: [
              { name: 'Investor A', amount: 200_000, postMoneyCap: 4_000_000 },
              { name: 'Investor B', amount: 800_000, postMoneyCap: 8_000_000 },
            ],
            unissuedPoolShares: 450_000,
          },
          3_000_000,
        ],
        expected: {
          safeConversions: [
            { name: 'Investor A', allConvertPerShare: 0.267, decision: 'cash-out' },
            { name: 'Investor B', allConvertPerShare: 0.267, decision: 'cash-out' },
          ],
          rows: [
            { name: 'Founders', total: 1_937_172.77 },
            { name: 'Options outstanding', total: 62_827.23 },
            { name: 'Investor A', total: 200_000 },
            { name: 'Investor B', total: 800_000 },
          ],
        },
      },
      {
        name: 'participating-preferred-30m',
        description:
          'Participating preferred on a $30,000,000 sale: 2,500,000 Series A shares (25%) for $5,000,000 at 1x take ' +
          'the $5,000,000 preference plus 25% of the remaining $25,000,000, totaling $11,250,000; common takes ' +
          '$18,750,000.',
        source:
          'Cooley GO glossary, "Preferred Stock" (https://www.cooleygo.com/glossary/preferred-stock/, verified ' +
          '2026-10-01) and Brad Feld, "Term Sheet: Liquidation Preference" (2005-01-04, ' +
          'https://feld.com/archives/2005/01/term-sheet-liquidation-preference/); arithmetic hand-derived in ' +
          'lib/openstartup/__tests__/waterfall.test.ts',
        inputs: [
          {
            holders: [{ name: 'Common', shares: 7_500_000, group: 'common' }],
            preferred: { name: 'Series A', shares: 2_500_000, invested: 5_000_000, participating: true },
          },
          30_000_000,
        ],
        expected: {
          rows: [
            { name: 'Common', total: 18_750_000 },
            { name: 'Series A', decision: 'participate', preferencePayout: 5_000_000, residualPayout: 6_250_000, total: 11_250_000 },
          ],
        },
      },
    ],
  },
]

/** Run one case through its module's registered entrypoint; null on success, else the mismatch. */
export function runConformanceCase(def: ConformanceModuleDef, c: ConformanceCase): string | null {
  const fn = def.ns[def.fn]
  if (typeof fn !== 'function') return `module ${def.id}: entrypoint ${def.fn} is not an exported function`
  const result = (fn as (...args: unknown[]) => unknown)(...(structuredClone(c.inputs) as unknown[]))
  return firstMismatch(c.expected, result, c.tolerance ?? 0)
}

/**
 * The committed JSON for one module's vector file. Every case is executed first; a case
 * the repo's own implementation fails throws instead of being written. Deterministic: the
 * cases are literals, the entrypoints are pure functions of them, and the sha256 is a pure
 * function of the committed module source.
 */
export function conformanceVectorJson(def: ConformanceModuleDef): string {
  const names = new Set<string>()
  for (const c of def.cases) {
    if (names.has(c.name)) throw new Error(`module ${def.id}: duplicate case name ${c.name}`)
    names.add(c.name)
    const mismatch = runConformanceCase(def, c)
    if (mismatch !== null) throw new Error(`${def.id}/${c.name}: ${mismatch}`)
  }
  const file = `lib/openstartup/${def.id}.ts`
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')
  const doc = {
    module: def.id,
    entrypoint: def.fn,
    implementation: { file, sha256 },
    readme: 'open-modules/conformance/README.md',
    cases: def.cases.map((c) => ({
      name: c.name,
      description: c.description,
      source: c.source,
      ...(c.tolerance === undefined ? {} : { tolerance: c.tolerance }),
      inputs: c.inputs,
      expected: c.expected,
    })),
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

function main(): void {
  fs.mkdirSync(CONFORMANCE_DIR, { recursive: true })
  const expectedFiles = new Set(CONFORMANCE_MODULES.map((def) => `${def.id}.json`))
  for (const stale of fs.readdirSync(CONFORMANCE_DIR)) {
    if (stale.endsWith('.json') && !expectedFiles.has(stale)) fs.unlinkSync(path.join(CONFORMANCE_DIR, stale))
  }
  let caseCount = 0
  for (const def of CONFORMANCE_MODULES) {
    fs.writeFileSync(path.join(CONFORMANCE_DIR, `${def.id}.json`), conformanceVectorJson(def))
    caseCount += def.cases.length
  }
  console.log(
    `wrote ${CONFORMANCE_MODULES.length} vector files (${caseCount} cases) to ${path.relative(ROOT, CONFORMANCE_DIR)}`,
  )
}

if (require.main === module) main()
