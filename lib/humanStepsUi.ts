import type { ComputerUseFeasibility } from './humanSteps'
import { FEASIBILITY_ICONS } from './processIcons'

// Display language for the human-step audit verdicts (data/human-step-audit.json). One place so
// the step blocks (components/ProcessDag.tsx) and the agent-ceiling box
// (components/ProcessVerdict.tsx) say exactly the same thing about the same node. Tones follow
// the founder's 2026-09-21 softening: human work is not an error state, so nothing here is red —
// authority gates read violet (matching the legally-human signature styling), waits read zinc.
// Icons are house `pi:` tokens since the 2026-10-08 sweep (FEASIBILITY_ICONS — the old 🖥/⛔/
// 🚫/⏳ emoji are the semantic guides on the map); render them via IconGlyph, next to `label`.
export const FEASIBILITY_META: Record<ComputerUseFeasibility, { icon: string; label: string; tone: 'emerald' | 'amber' | 'violet' | 'zinc' }> = {
  drivable: { icon: FEASIBILITY_ICONS.drivable, label: 'computer-use drivable', tone: 'emerald' },
  assist: { icon: FEASIBILITY_ICONS.assist, label: 'agent preps, human decides', tone: 'amber' },
  'policy-gate': { icon: FEASIBILITY_ICONS['policy-gate'], label: 'policy gate — not an agent’s call', tone: 'violet' },
  'no-screen': { icon: FEASIBILITY_ICONS['no-screen'], label: 'no screen to drive', tone: 'zinc' },
  'third-party-wait': { icon: FEASIBILITY_ICONS['third-party-wait'], label: 'third party’s clock', tone: 'zinc' },
}

// Whether the judged computer-use fleet chips are honest capability evidence for this node:
// only where the blocker is mechanical (an agent could drive or prep it). Where the blocker is
// authority, physics, or someone else's clock, showing "could attempt it today" misleads —
// and a legally-required signature act (DagNode.legalSignature, the founder's true human
// floor) NEVER shows chips, whatever its audited feasibility says about the mechanical part.
export function showComputerUseChips(
  feasibility: ComputerUseFeasibility | undefined,
  legalSignature?: boolean,
): boolean {
  if (legalSignature) return false
  return feasibility === undefined || feasibility === 'drivable' || feasibility === 'assist'
}
