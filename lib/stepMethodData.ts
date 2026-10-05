// Method variants, SERVER half (node:fs — the lib/jurisdictions.ts split convention; client
// shapes + the selection store live in lib/stepMethods.ts). Builds the serializable
// StepMethodView props components/StepMethodGeo.tsx renders: every vendor chip is resolved
// against the live judged market at build time (lib/processes.ts vendorChipInfo /
// stepVendorOptions — the same machinery the default "via:" rows use), logos are resolved here
// so the client bundle never touches disk, and each variant's "with this method" ceiling is
// precomputed with lib/processes.ts computeCeiling arithmetic.
//
// DERIVED-ARTIFACT DECISION (this phase): the generated per-step artifacts —
// data/step-prompts.json and data/step-vendor-calls.json — key on (taskId, nodeId) and describe
// the node's DEFAULT method; method variants are deliberately EXCLUDED from them. A variant
// panel therefore shows only corpus-committed functionCalls (never a regenerated prompt or
// per-vendor call table), and the default panel's prompt/vendor-call blocks hide while a
// variant is selected. Regeneration for variants is a later, unscoped pass per the lane-merge
// playbook; pipeline/scripts/recompute-check.ts is untouched either way (it covers arena
// rankings only).

import { hasLogo } from './logos'
import {
  computeCeiling, loadProcesses, stepVendorOptions, vendorChipInfo,
  type DagNode, type DagSubStep, type StepMethod,
} from './processes'
import type { StepMethodChipView, StepMethodSubStepView, StepMethodView } from './stepMethods'

export interface StepMethodViews {
  defaultView: StepMethodView
  variants: StepMethodView[]
}

// The step's resolved market chips: the canonical vendor first (when it isn't already in the
// roster), then the derived/curated roster — the same list the default "via:" row shows.
function chipsFor(
  node: Pick<DagNode, 'vendor' | 'vendorOptions' | 'optionsArenaId'>,
  dir?: string,
): StepMethodChipView[] {
  const roster = stepVendorOptions(node, dir)
  const infos = node.vendor && !roster.some((c) => c.vendor === node.vendor || c.productId === node.vendor)
    ? [vendorChipInfo(node.vendor, dir), ...roster]
    : roster
  return infos.map((c) => ({ ...c, hasLogo: hasLogo(c.productId ?? c.vendor) }))
}

function subStepView(s: DagSubStep, dir?: string): StepMethodSubStepView {
  return {
    id: s.id,
    label: s.label,
    route: s.route,
    legalSignature: s.legalSignature ?? false,
    async: s.async ?? false,
    estimatedMinutes: s.estimatedMinutes,
    calls: (s.functionCalls ?? []).map((fc) => fc.method),
    actionUrl: s.actionUrl ?? null,
    actionLabel: s.actionLabel ?? null,
    chips: chipsFor(s, dir),
  }
}

type Ceiling = { agentSteps: number; totalSteps: number; pct: number }

// The whole process's ceiling with `method` substituted for `node`: the variant's sub-DAG
// replaces the node outright, else the node runs with the variant's route. Same computeCeiling
// math as every committed number — but this result is DISPLAY-ONLY and always labelled
// "with this method" (the committed ceiling keeps describing the default).
function ceilingWith(taskNodes: DagNode[], node: DagNode, method: StepMethod): Ceiling {
  const substituted = taskNodes.flatMap((n) =>
    n.id === node.id ? (method.subSteps ?? [{ ...n, route: method.route ?? n.route }]) : [n],
  )
  const c = computeCeiling(substituted)
  return { agentSteps: c.agentSteps, totalSteps: c.totalSteps, pct: c.pct }
}

// All selectable methods for one method-bearing node: the synthesized DEFAULT entry (the node's
// own committed fields — label, route, market, calls, time) plus the corpus variants. Returns
// null for the many nodes without variants, so callers render exactly the pre-variant output.
export function buildStepMethodViews(
  node: DagNode,
  taskId?: string,
  dir?: string,
): StepMethodViews | null {
  const methods = node.methods ?? []
  if (methods.length === 0) return null
  const task = taskId ? loadProcesses(dir).find((t) => t.id === taskId) ?? null : null
  const baseCeiling = task ? computeCeiling(task.dag.nodes) : null
  const defaultView: StepMethodView = {
    id: 'default',
    label: node.label,
    summary: null,
    context: null,
    route: node.route,
    estimatedMinutes: node.estimatedMinutes,
    calls: (node.functionCalls ?? []).map((fc) => fc.method),
    chips: chipsFor(node, dir),
    subSteps: [],
    actionUrl: node.actionUrl ?? null,
    actionLabel: node.actionLabel ?? null,
    ceiling: baseCeiling
      ? { agentSteps: baseCeiling.agentSteps, totalSteps: baseCeiling.totalSteps, pct: baseCeiling.pct }
      : null,
  }
  const variants = methods.map((m): StepMethodView => {
    const subSteps = (m.subSteps ?? []).map((s) => subStepView(s, dir))
    const derivedMinutes = subSteps.length > 0
      ? subSteps.reduce((acc, s) => acc + s.estimatedMinutes, 0)
      : null
    return {
      id: m.id,
      label: m.label,
      summary: m.summary,
      context: {
        kind: m.context.kind,
        when: m.context.when,
        countries: [...(m.context.countries ?? [])],
      },
      route: m.route ?? node.route,
      // Honest time only: the corpus value (load-validated to equal the sub-step sum when both
      // exist), else the sum derived from sub-steps, else nothing.
      estimatedMinutes: m.estimatedMinutes ?? derivedMinutes,
      calls: (m.functionCalls ?? []).map((fc) => fc.method),
      chips: chipsFor(m, dir),
      subSteps,
      // Never inherited from the default — a variant's canonical page is its own (a UK filing
      // portal must not fall back to the Delaware one).
      actionUrl: m.actionUrl ?? null,
      actionLabel: m.actionLabel ?? null,
      ceiling: task ? ceilingWith(task.dag.nodes, node, m) : null,
    }
  })
  return { defaultView, variants }
}
