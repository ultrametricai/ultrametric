// Entry-point input validation for the registered open-module entrypoints
// (open-modules/registry.json — maintainer report 2026-10-21: an agent needed three
// attempts to call compareFranchiseTaxMethods because malformed input surfaced as a raw
// TypeError from inside a formula and the input field names were only discoverable by
// reading source).
//
// Each registered entrypoint declares its positional arguments once, as an EntrySpec
// pairing every argument name with a zod schema defined beside the module's TS types.
// The spec validates STRUCTURE only (field presence, primitive types, literal unions):
// every semantic rule (ranges, date parsing, share arithmetic, no-par refusals) stays in
// the module's own named RangeError checks, so behavior on type-correct inputs is
// unchanged. Malformed input raises a RangeError naming the function, the argument, and
// the failing field. scripts/generate-module-registry.ts publishes the same schemas as
// JSON Schema in open-modules/registry.json.

import type { z } from 'zod'

export interface EntryArg {
  /** Positional argument name, exactly as the function signature spells it. */
  name: string
  /** Structural zod schema for the argument (mirrors the TS type; no value rules). */
  schema: z.ZodType
  /** Trailing optional argument: undefined skips the schema. */
  optional?: boolean
}

export interface EntrySpec {
  /** The exported function name the spec guards. */
  fn: string
  args: readonly EntryArg[]
  /** Throws a RangeError naming the argument and field on structurally malformed input. */
  validate: (...values: unknown[]) => void
}

function fieldPath(argName: string, path: readonly PropertyKey[]): string {
  let out = argName
  for (const part of path) {
    out += typeof part === 'number' ? `[${part}]` : `.${String(part)}`
  }
  return out
}

/** Build the validator a registered entrypoint calls on its first line. */
export function entrySpec(fn: string, args: readonly EntryArg[]): EntrySpec {
  const validate = (...values: unknown[]): void => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const value = values[i]
      if (arg.optional && value === undefined) continue
      const parsed = arg.schema.safeParse(value)
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${fieldPath(arg.name, issue.path)}: ${issue.message}`)
          .join('; ')
        throw new RangeError(`${fn}: ${issues}`)
      }
    }
  }
  return { fn, args, validate }
}
