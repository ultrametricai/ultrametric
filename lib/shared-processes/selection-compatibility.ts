// Legacy selection ↔ shared selection (docs/PR171-EXTRACTION.md, bucket c): the existing
// ?via=/pa-lens picks and account-stack choices restore onto a shared selection contract
// through the SAME precedence and shutdown rules the canonical page uses
// (lib/processLens.ts resolveStepVendor) — no second URL encoding, no new store.
import type { ProcessCheckStep } from '../processCheck'
import { resolveStepVendor, type LensMap } from '../processLens'
import type { StackMap } from '../myStack'

export interface SelectionContract {
  regions?: { scope: string; options: string[] }
  groups: Array<{ scope: string; arenaId: string; candidates: string[] }>
  steps: Array<{ scope: string; choiceScope?: string; candidates: string[]; rememberedCandidates?: string[]; legacyStep?: ProcessCheckStep; extraStep?: Pick<ProcessCheckStep, 'arenas'> }>
}
export interface RestoredSelection { picks: Record<string, string>; overrides: Record<string, string | null> }

export function restoreLegacySelection(contract: SelectionContract, lens: LensMap, stack: StackMap): RestoredSelection {
  const picks: RestoredSelection['picks'] = {}
  const overrides: RestoredSelection['overrides'] = {}
  for (const group of contract.groups) {
    const candidate = `${group.arenaId}/${lens[group.arenaId]}`
    if (group.candidates.includes(candidate)) picks[group.scope] = candidate
  }
  for (const step of contract.steps) {
    const source = step.legacyStep ?? step.extraStep
    if (!source) continue
    // Reuse the existing explicit-lens/account-stack precedence and shutdown rules.
    const resolved = resolveStepVendor(source, lens, stack)
    if (!resolved) continue
    const candidate = `${resolved.vendor.arenaId}/${resolved.vendor.productId}`
    if (step.candidates.includes(candidate) && (!step.choiceScope || picks[step.choiceScope] !== candidate)) overrides[step.scope] = candidate
  }
  return { picks, overrides }
}

export function parseSavedSelection(raw: string | null, contract: SelectionContract): RestoredSelection | undefined {
  if (!raw) return
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const picks: RestoredSelection['picks'] = {}
    const overrides: RestoredSelection['overrides'] = {}
    for (const group of contract.groups) {
      const candidate = value.picks?.[group.scope]
      if (typeof candidate === 'string' && group.candidates.includes(candidate)) picks[group.scope] = candidate
    }
    for (const binding of [...contract.steps, ...contract.groups]) {
      // An explicit UI choice of a published zero-score row is remembered without
      // adding it to positive coverage candidates or automatic lens resolution.
      const candidates = 'rememberedCandidates' in binding ? binding.rememberedCandidates ?? binding.candidates : binding.candidates
      const scopes = [binding.scope, ...(contract.regions?.options ?? []).map(option => `${binding.scope}:regional:${contract.regions!.scope}:${option}`)]
      for (const scope of scopes) {
        const candidate = value.overrides?.[scope]
        if (candidate === null || (typeof candidate === 'string' && candidates.includes(candidate))) overrides[scope] = candidate
      }
    }
    return { picks, overrides }
  } catch { return }
}
