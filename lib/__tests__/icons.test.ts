import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasBespokeThemeExplanation,
  humanizeTheme,
  metricIcon,
  metricTooltip,
  THEME_FALLBACK_ICON,
  themeExplanation,
  themeIcon,
  themeTooltip,
} from '../icons'

// Every theme id actually judged in data/*/stories.json, with how many stories carry it — the
// live taxonomy the icon rules must cover. Read directly (not via loadAll) so a data-validation
// failure elsewhere can't mask an icon gap.
function liveThemeCounts(): Map<string, number> {
  const dataDir = path.join(process.cwd(), 'data')
  const counts = new Map<string, number>()
  for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(dataDir, entry.name, 'stories.json')
    if (!fs.existsSync(file)) continue
    for (const story of JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ theme: string }>) {
      counts.set(story.theme, (counts.get(story.theme) ?? 0) + 1)
    }
  }
  return counts
}

function liveThemes(): string[] {
  return [...liveThemeCounts().keys()]
}

describe('themeIcon', () => {
  it('covers every live theme (no fallback) — extend THEME_RULES when adding a theme', () => {
    const themes = liveThemes()
    expect(themes.length).toBeGreaterThan(100)
    const missing = themes.filter((t) => themeIcon(t) === THEME_FALLBACK_ICON)
    expect(missing).toEqual([])
  })

  it('keeps one icon per concept, matching the metric icons', () => {
    expect(themeIcon('privacy-posture')).toBe(metricIcon('privacy'))
    expect(themeIcon('openness')).toBe(metricIcon('openness'))
    expect(themeIcon('automation-depth')).toBe(metricIcon('automation'))
    expect(themeIcon('agent-access')).toBe(metricIcon('agentReady'))
    expect(themeIcon('api-quality')).toBe(metricIcon('apiQuality'))
  })

  it('falls back honestly for an unknown theme', () => {
    expect(themeIcon('zzz-not-a-real-theme-zzz')).toBe(THEME_FALLBACK_ICON)
  })
})

describe('themeTooltip', () => {
  it('always names the humanized concept, never the kebab id', () => {
    expect(themeTooltip('privacy-posture')).toBe('Privacy posture — data-handling and privacy stories')
    expect(themeTooltip('privacy-posture')).not.toContain('privacy-posture')
    // Generic themes still get an honest tooltip.
    expect(themeTooltip('billing-invoicing')).toContain('Billing invoicing — ')
  })
})

describe('themeExplanation', () => {
  it('sentence-cases a bespoke description without repeating the theme name', () => {
    expect(themeExplanation('privacy-posture')).toBe('Data-handling and privacy stories')
    expect(themeExplanation('agent-access')).toBe('MCP, CLI, and API access for agents')
  })

  it('falls back to an honest arena-scoped generic for niche themes', () => {
    expect(themeExplanation('zzz-not-a-real-theme-zzz')).toBe(
      'Stories about zzz not a real theme zzz in this ranking',
    )
    expect(hasBespokeThemeExplanation('zzz-not-a-real-theme-zzz')).toBe(false)
  })

  it('covers the 40 most-used live themes with bespoke (non-generic) explanations', () => {
    const top40 = [...liveThemeCounts().entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([theme]) => theme)
    expect(top40.length).toBe(40)
    const generic = top40.filter((t) => !hasBespokeThemeExplanation(t))
    expect(generic).toEqual([])
  })
})

describe('metricIcon / metricTooltip', () => {
  it('has an icon and tooltip for every comparison metric', () => {
    const metrics = [
      'overallScore',
      'agentReady',
      'aiNative',
      'apiQuality',
      'openness',
      'automation',
      'privacy',
      'popularity',
      'confidence',
      'access',
      'coverage',
    ]
    for (const m of metrics) {
      expect(metricIcon(m), m).not.toBe('')
      expect(metricTooltip(m), m).not.toBe('')
    }
  })

  it('resolves field-name aliases to the same concept', () => {
    expect(metricIcon('aiEra')).toBe(metricIcon('overallScore'))
    expect(metricIcon('paScore')).toBe(metricIcon('overallScore')) // legacy, pre-rename spelling
    expect(metricIcon('agenticApp')).toBe(metricIcon('aiNative'))
    expect(metricIcon('stars')).toBe(metricIcon('popularity'))
    expect(metricIcon('openSource')).toBe(metricIcon('openness'))
  })

  it('returns empty strings for unknown metrics (render nothing, not a wrong icon)', () => {
    expect(metricIcon('nope')).toBe('')
    expect(metricTooltip('nope')).toBe('')
  })
})

describe('humanizeTheme', () => {
  it('replaces dashes with spaces and capitalizes the first word only', () => {
    expect(humanizeTheme('privacy-posture')).toBe('Privacy posture')
    expect(humanizeTheme('agent-access')).toBe('Agent access')
    expect(humanizeTheme('openness')).toBe('Openness')
    expect(humanizeTheme('ai-in-notes')).toBe('Ai in notes')
  })

  it('renders plain-language overrides for jargon ids (founder 2026-09-30)', () => {
    // "Action primitives" means nothing to buyers — the display name is plain language while
    // the machine id stays 'action-primitives' in data files, URLs, and schema fields.
    expect(humanizeTheme('action-primitives')).toBe('Agent actions')
  })
})
