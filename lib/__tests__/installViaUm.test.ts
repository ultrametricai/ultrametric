import { describe, expect, it } from 'vitest'
import { installProcessForVendor } from '@/lib/installViaUm'
import { loadProcesses } from '@/lib/processes'
import { coveringArenaId } from '@/lib/processRankings'
import { processesForVendor } from '@/lib/vendorProcesses'

// greptile #221 regression: the install prompt maps a product to the process that sets THAT
// product up, not to any setup-titled process the product serves a step of. A coding agent
// serves "Install SDK in codebase" steps inside other arenas' setup processes (error tracking,
// payments, analytics) and must not inherit their prompts — an agent pasted that prompt would
// start another product's setup.

const SETUP_TITLE = /^(set up|open|connect|stand up)\b/i

// The target test the mapping uses: the first DAG step with a covering arena names the market
// the setup process is about.
function setupTargetArena(taskId: string): string | null {
  const task = loadProcesses().find((t) => t.id === taskId)
  if (!task) return null
  return task.dag.nodes.map((n) => coveringArenaId(n)).find((a) => a !== null) ?? null
}

describe('installProcessForVendor — the process must SET UP the product, not merely use it', () => {
  it('cursor (ai-coding) serves steps of other arenas\' setup processes and gets NO prompt', () => {
    // Precondition that makes this a real regression guard: cursor DOES appear in setup-titled
    // processes (the prod_004-class SDK-install step surface). Without the target test, the
    // mapping would hand it one of these.
    const setupAppearances = processesForVendor('ai-coding', 'cursor')
      .filter((a) => !(a.kinds.length === 1 && a.kinds[0] === 'computer-use'))
      .filter((a) => SETUP_TITLE.test(a.title))
    expect(setupAppearances.length).toBeGreaterThan(0)
    // Every one of them targets some OTHER arena — none sets up a coding agent.
    for (const a of setupAppearances) {
      expect(setupTargetArena(a.taskId), `${a.taskId} "${a.title}" targets another arena`).not.toBe('ai-coding')
    }
    expect(installProcessForVendor('ai-coding', 'cursor')).toBeNull()
  })

  it('a true positive stays: sentry (error-tracking) maps to "Set up error tracking"', () => {
    const mapped = installProcessForVendor('error-tracking', 'sentry')
    expect(mapped).not.toBeNull()
    expect(mapped!.target.id).toBe('prod_004')
    expect(mapped!.title).toBe('Set up error tracking')
    expect(setupTargetArena('prod_004')).toBe('error-tracking')
  })

  it('every mapped install process targets the product\'s own arena', () => {
    // Sweep over a representative roster of (arena, product) pairs with mappings today.
    for (const [arenaId, productId] of [
      ['payments', 'stripe'],
      ['error-tracking', 'sentry'],
      ['team-chat', 'slack'],
      ['startup-banking', 'mercury'],
    ] as const) {
      const mapped = installProcessForVendor(arenaId, productId)
      expect(mapped, `${arenaId}:${productId} keeps an install process`).not.toBeNull()
      expect(setupTargetArena(mapped!.target.id)).toBe(arenaId)
    }
  })
})
