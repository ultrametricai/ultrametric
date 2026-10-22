import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MODULE_REGISTRY_FILE, moduleRegistryJson, REGISTRY_ENTRIES, shapeOf } from '../scripts/generate-module-registry'
import { buildCapTable } from '../lib/openstartup/capTable'
import { compareFranchiseTaxMethods } from '../lib/openstartup/deFranchiseTax'
import { liquidityWaterfall } from '../lib/openstartup/waterfall'

// The open-module call-surface gate (maintainer report 2026-10-21: an agent needed three
// attempts to call compareFranchiseTaxMethods — no machine-readable entrypoint index, raw
// TypeErrors on malformed input, field names only in source). open-modules/registry.json is
// GENERATED from the entry specs beside each module by scripts/generate-module-registry.ts;
// these tests pin the contracts that make it trustworthy:
//   1. NO DRIFT — regenerating reproduces the committed bytes.
//   2. EVERY ENTRY RESOLVES — the file exists and every listed export is a real function.
//   3. EVERY EXAMPLE RUNS — the committed args call the real function and the result still
//      matches the committed shape.
//   4. COMPLETE BOTH WAYS — every lib/openstartup module appears exactly once, and every
//      registry id is a real module file.
//   5. NAMED ERRORS — every registered entrypoint rejects missing input with a RangeError
//      naming its first argument, never a raw TypeError from inside a formula.

const ROOT = path.resolve(__dirname, '..')

interface RegistryModuleJson {
  id: string
  title: string
  file: string
  readme: string
  status: string
  exports: string[]
  entrypoint: {
    function: string
    signature: string
    inputSchema: Record<string, unknown>
    example: { args: unknown[]; resultShape: unknown }
  }
}

const committedRaw = fs.readFileSync(MODULE_REGISTRY_FILE, 'utf8')
const committed = JSON.parse(committedRaw) as { modules: RegistryModuleJson[] }

describe('open-modules/registry.json', () => {
  it('regenerates byte-identical from the entry specs (no drift, no hand edits)', () => {
    expect(moduleRegistryJson()).toBe(committedRaw)
  })

  it('every entry resolves: the file exists, the entrypoint and every listed export are real functions', async () => {
    for (const mod of committed.modules) {
      expect(mod.file, `${mod.id}: file/id mismatch`).toBe(`lib/openstartup/${mod.id}.ts`)
      expect(fs.existsSync(path.join(ROOT, mod.file)), `${mod.id}: ${mod.file} does not exist`).toBe(true)
      const ns: Record<string, unknown> = await import(`../lib/openstartup/${mod.id}.ts`)
      expect(typeof ns[mod.entrypoint.function], `${mod.id}: entrypoint ${mod.entrypoint.function}`).toBe('function')
      expect(mod.exports, `${mod.id}: entrypoint missing from exports`).toContain(mod.entrypoint.function)
      for (const name of mod.exports) {
        expect(typeof ns[name], `${mod.id}: listed export ${name}`).toBe('function')
      }
    }
  })

  it('every example call runs against the real module and matches its committed result shape', async () => {
    for (const mod of committed.modules) {
      const ns: Record<string, unknown> = await import(`../lib/openstartup/${mod.id}.ts`)
      const fn = ns[mod.entrypoint.function] as (...args: unknown[]) => unknown
      const result = fn(...structuredClone(mod.entrypoint.example.args))
      expect(shapeOf(result), `${mod.id}: example result shape drifted`).toEqual(mod.entrypoint.example.resultShape)
    }
  })

  it('covers every lib/openstartup module, both ways', () => {
    // entryValidation.ts is the shared validation helper, not a calculation module.
    const infrastructure = new Set(['entryValidation.ts'])
    const moduleFiles = fs
      .readdirSync(path.join(ROOT, 'lib', 'openstartup'))
      .filter((f) => f.endsWith('.ts') && !infrastructure.has(f))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort()
    const registered = committed.modules.map((m) => m.id).sort()
    expect(registered).toEqual(moduleFiles)
    expect(new Set(registered).size).toBe(registered.length)
  })

  it('every published inputSchema accepts its own example call', () => {
    for (const mod of committed.modules) {
      const published = z.fromJSONSchema(mod.entrypoint.inputSchema)
      const parsed = published.safeParse(mod.entrypoint.example.args)
      expect(parsed.success, `${mod.id}: example args rejected by the published inputSchema`).toBe(true)
    }
  })

  it('the published schema accepts what the modules accept across composition (extra keys pass)', () => {
    // downRoundModel hands its issuance, investorName included, straight to
    // applyAntiDilution — the published schema must accept that call, so it is generated
    // from the input perspective (no additionalProperties: false).
    const antiDilution = committed.modules.find((m) => m.id === 'antiDilution')!
    const published = z.fromJSONSchema(antiDilution.entrypoint.inputSchema)
    const issuanceWithInvestor = { newShares: 5_000_000, considerationDollars: 5_000_000, investorName: 'Series B' }
    const series = { name: 'Series A', preferredShares: 4_000_000, originalIssuePrice: 2, conversionPriceBefore: 2 }
    expect(published.safeParse([series, issuanceWithInvestor, 'broad-based', 12_000_000]).success).toBe(true)
  })

  it('entry validation names the full field path: nested fields, array elements, later arguments', () => {
    const call = (fn: unknown, ...args: unknown[]) => () => (fn as (...a: unknown[]) => unknown)(...args)
    // Missing nested field on the first (object) argument — the failure that prompted the
    // registry: compareFranchiseTaxMethods without authorizedClasses used to reduce over
    // undefined and throw a raw TypeError.
    expect(call(compareFranchiseTaxMethods, { totalGrossAssets: 1_000_000, totalIssuedShares: 485_000 })).toThrow(RangeError)
    expect(call(compareFranchiseTaxMethods, { totalGrossAssets: 1_000_000, totalIssuedShares: 485_000 })).toThrow(
      /compareFranchiseTaxMethods: inputs\.authorizedClasses/,
    )
    // Malformed element inside an argument array: the path names the index and field.
    expect(call(buildCapTable, [{ kind: 'safe', name: 'Angel SAFE' }])).toThrow(RangeError)
    expect(call(buildCapTable, [{ kind: 'safe', name: 'Angel SAFE' }])).toThrow(/buildCapTable: events\[0\]\.amount/)
    // Missing later required argument.
    expect(call(liquidityWaterfall, { holders: [{ name: 'Founders', shares: 100 }] })).toThrow(RangeError)
    expect(call(liquidityWaterfall, { holders: [{ name: 'Founders', shares: 100 }] })).toThrow(/liquidityWaterfall: price/)
  })

  it('every registered entrypoint rejects missing input with a RangeError naming its first argument', () => {
    for (const def of REGISTRY_ENTRIES) {
      const fn = def.ns[def.entry.fn] as (...args: unknown[]) => unknown
      let thrown: unknown
      try {
        fn()
      } catch (err) {
        thrown = err
      }
      expect(thrown, `${def.id}: ${def.entry.fn}() must throw`).toBeInstanceOf(RangeError)
      expect((thrown as Error).message, `${def.id}: error must name the function`).toContain(def.entry.fn)
      expect((thrown as Error).message, `${def.id}: error must name the argument`).toContain(def.entry.args[0].name)
    }
  })
})
