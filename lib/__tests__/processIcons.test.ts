import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLYPHS } from '@/components/icons/ProcessIcon'
import { loadChains, loadProcesses } from '@/lib/processes'
import {
  CADENCE_ICON, CHAIN_ICONS, chainIcon, parseProcessIconToken, PHASE_ICONS, phaseEmoji,
  phaseIcon, phaseTooltip, PROCESS_ICONS, processIcon, RANK_PRESET_ICONS, URGENCY_ICONS,
} from '@/lib/processIcons'
import { URGENCY_TIERS } from '@/lib/processSim'

const DATA_DIR = path.resolve(__dirname, '../../data')

// A curated icon must be a house token (`pi:<glyph>:<hue>`) naming a DESIGNED glyph — a token
// pointing at a glyph nobody drew would render the honest-fallback placeholder, which is a
// design failure, not a rendering choice. parseProcessIconToken also guarantees the hue.
const resolvesToDesignedGlyph = (s: string) => {
  const parsed = parseProcessIconToken(s)
  return parsed !== null && parsed.glyph in GLYPHS
}

describe('process icon coverage (totality over the live corpus)', () => {
  it('every live process has a curated icon resolving to a designed glyph', () => {
    for (const task of loadProcesses(DATA_DIR)) {
      const icon = processIcon(task.id)
      expect(
        resolvesToDesignedGlyph(icon),
        `process ${task.id} (${task.title}) needs a curated icon naming a designed glyph (got '${icon}')`,
      ).toBe(true)
    }
  })

  it('every live phase has a curated icon, a legacy emoji, and a tooltip naming the concept', () => {
    const phases = new Set(loadProcesses(DATA_DIR).map((t) => t.phase))
    for (const phase of phases) {
      expect(resolvesToDesignedGlyph(phaseIcon(phase)), `phase ${phase} needs a designed glyph`).toBe(true)
      // The emoji survives for text-only surfaces (ProcessesTable's native <select> labels).
      const emoji = phaseEmoji(phase)
      expect(emoji.length > 0 && [...emoji].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f), `phase ${phase} needs a legacy emoji`).toBe(true)
      expect(phaseTooltip(phase)).toContain(phase)
      expect(phaseTooltip(phase)).toContain('—')
    }
  })

  it('every live playbook (chain) has a curated icon resolving to a designed glyph', () => {
    for (const chain of loadChains(DATA_DIR)) {
      expect(resolvesToDesignedGlyph(chainIcon(chain.id)), `chain ${chain.id} needs a designed glyph`).toBe(true)
    }
  })

  it('no stale mappings: every curated key points at a live process/phase/chain', () => {
    const taskIds = new Set(loadProcesses(DATA_DIR).map((t) => t.id))
    for (const id of Object.keys(PROCESS_ICONS)) {
      expect(taskIds.has(id), `PROCESS_ICONS has stale task id ${id}`).toBe(true)
    }
    const phases = new Set(loadProcesses(DATA_DIR).map((t) => t.phase))
    for (const phase of Object.keys(PHASE_ICONS)) {
      expect(phases.has(phase), `PHASE_ICONS has stale phase ${phase}`).toBe(true)
    }
    const chainIds = new Set(loadChains(DATA_DIR).map((c) => c.id))
    for (const id of Object.keys(CHAIN_ICONS)) {
      expect(chainIds.has(id), `CHAIN_ICONS has stale chain id ${id}`).toBe(true)
    }
  })

  it('every urgency tier has a designed glyph in its tier hue (founder 2026-10-02: the 🚨/⏰/🗓 emoji retired)', () => {
    expect(Object.keys(URGENCY_ICONS).sort()).toEqual([...URGENCY_TIERS].sort())
    for (const tier of URGENCY_TIERS) {
      expect(resolvesToDesignedGlyph(URGENCY_ICONS[tier]), `urgency ${tier} needs a designed glyph`).toBe(true)
    }
    // The hue IS the tier semantics (UrgencyChip's red/amber/sky), pinned.
    expect(parseProcessIconToken(URGENCY_ICONS.hours)?.hue).toBe('red')
    expect(parseProcessIconToken(URGENCY_ICONS.days)?.hue).toBe('amber')
    expect(parseProcessIconToken(URGENCY_ICONS.weeks)?.hue).toBe('sky')
  })

  it('every rank-by preset has a designed glyph AND a text-only emoji stand-in (founder 2026-10-08: the dropdown emoji join the custom set)', () => {
    for (const [col, entry] of Object.entries(RANK_PRESET_ICONS)) {
      expect(resolvesToDesignedGlyph(entry.icon), `rank-by preset ${col} needs a designed glyph (got '${entry.icon}')`).toBe(true)
      // The emoji survives for the mobile native <select> only — same split as PHASE_ICONS.
      expect(
        entry.emoji.length > 0 && [...entry.emoji].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f),
        `rank-by preset ${col} needs its text-only emoji stand-in`,
      ).toBe(true)
    }
    // Same concept = same token: Regularity IS the cadence loop, Growth-focused the growth
    // phase's rising chart.
    expect(RANK_PRESET_ICONS.cadence.icon).toBe(CADENCE_ICON)
    expect(parseProcessIconToken(RANK_PRESET_ICONS.growth.icon)?.glyph)
      .toBe(parseProcessIconToken(PHASE_ICONS.growth.icon)?.glyph)
  })

  it('unknown ids resolve to empty string (callers render nothing, never a wrong icon)', () => {
    expect(processIcon('nope_999')).toBe('')
    expect(phaseIcon('nope')).toBe('')
    expect(phaseEmoji('nope')).toBe('')
    expect(chainIcon('nope')).toBe('')
  })
})

describe('the icon token scheme', () => {
  it('parses house tokens and rejects everything else', () => {
    expect(parseProcessIconToken('pi:flask:emerald')).toEqual({ glyph: 'flask', hue: 'emerald' })
    expect(parseProcessIconToken('🏦')).toBeNull()
    expect(parseProcessIconToken('')).toBeNull()
    expect(parseProcessIconToken('pi:')).toBeNull()
    // Unknown hue degrades to the neutral tone — the glyph is the concept, the hue is decoration.
    expect(parseProcessIconToken('pi:flask:crimson')).toEqual({ glyph: 'flask', hue: 'zinc' })
    expect(parseProcessIconToken('pi:flask')).toEqual({ glyph: 'flask', hue: 'zinc' })
  })

  it('same concept = same glyph everywhere (the lib/icons.ts consistency rule, spot-checked)', () => {
    // All three cap-table processes share the ownership pie.
    expect(processIcon('qs_051')).toBe(processIcon('qs_052'))
    expect(processIcon('qs_052')).toBe(processIcon('qs_053'))
    // Payroll setup and the payroll run share money-in-motion; SOC 2 I and II share the shield.
    expect(processIcon('qs_063')).toBe(processIcon('hr_002'))
    expect(processIcon('comp_001')).toBe(processIcon('comp_002'))
    // Chains that the curation ties to a process concept keep sharing its glyph.
    expect(parseProcessIconToken(chainIcon('raise-a-seed-round'))?.glyph)
      .toBe(parseProcessIconToken(processIcon('fund_001'))?.glyph)
    expect(parseProcessIconToken(chainIcon('set-up-compliance'))?.glyph)
      .toBe(parseProcessIconToken(processIcon('comp_001'))?.glyph)
  })

  it('every designed glyph keeps its guiding emoji as fallback/alias data', () => {
    for (const [id, glyph] of Object.entries(GLYPHS)) {
      expect(glyph.name.length, `glyph ${id} needs a human name`).toBeGreaterThan(0)
      expect(
        glyph.emoji.length > 0 && [...glyph.emoji].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f),
        `glyph ${id} needs its guiding emoji`,
      ).toBe(true)
    }
  })
})
