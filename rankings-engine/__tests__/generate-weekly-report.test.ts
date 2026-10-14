import { describe, expect, it } from 'vitest'
import type { ArenaHistoryInput, ChangeEvent } from '@/lib/changelog'
import {
  eventMarkdownLine, eventsInWindow, renderWeeklyReport, weeklyMovers,
} from '@/pipeline/scripts/generate-weekly-report'

const NOW = new Date('2026-09-06T12:00:00Z')
const SITE = 'https://example.test/site'

function entry(productId: string, date: string, aiEra: number | null) {
  return { productId, date, aiEra, agentReady: null }
}

const arenas: ArenaHistoryInput[] = [
  {
    categoryId: 'terminals',
    categoryName: 'Terminals',
    productNames: { warp: 'Warp', kitty: 'kitty', ghostty: 'Ghostty' },
    entries: [
      // warp: 40 in effect at the window start, latest 45.4 → +5.4.
      entry('warp', '2026-08-20T00:00:00Z', 40),
      entry('warp', '2026-09-04T00:00:00Z', 45.4),
      // kitty: down 2.1 inside the window.
      entry('kitty', '2026-08-20T00:00:00Z', 30),
      entry('kitty', '2026-09-03T00:00:00Z', 27.9),
      // ghostty: history STARTS inside the window — a new product, not a "mover".
      entry('ghostty', '2026-09-02T00:00:00Z', 10),
      entry('ghostty', '2026-09-05T00:00:00Z', 35),
    ],
  },
]

describe('weeklyMovers', () => {
  it('ranks up/down by 7-day aiEra delta and excludes products first tracked inside the window', () => {
    const { up, down } = weeklyMovers(arenas, NOW)
    expect(up).toEqual([
      { categoryId: 'terminals', categoryName: 'Terminals', productId: 'warp', productName: 'Warp', delta: 5.4, to: 45.4 },
    ])
    expect(down).toEqual([
      { categoryId: 'terminals', categoryName: 'Terminals', productId: 'kitty', productName: 'kitty', delta: -2.1, to: 27.9 },
    ])
  })

  it('keeps products tracked before the window even when aiEra measurement began inside it', () => {
    const arena: ArenaHistoryInput = {
      categoryId: 'ai-coding',
      categoryName: 'AI Coding Agents',
      productNames: { cc: 'Claude Code' },
      entries: [
        // Tracked (agentReady only) before the window; aiEra first measured inside it.
        { productId: 'cc', date: '2026-08-28T00:00:00Z', aiEra: null, agentReady: 28.2 },
        { productId: 'cc', date: '2026-09-01T00:00:00Z', aiEra: 29.5, agentReady: 44.4 },
        { productId: 'cc', date: '2026-09-04T00:00:00Z', aiEra: 41.9, agentReady: 69.7 },
      ],
    }
    expect(weeklyMovers([arena], NOW).up).toEqual([
      { categoryId: 'ai-coding', categoryName: 'AI Coding Agents', productId: 'cc', productName: 'Claude Code', delta: 12.4, to: 41.9 },
    ])
  })

  it('caps each direction', () => {
    const many: ArenaHistoryInput = {
      categoryId: 'c',
      categoryName: 'C',
      productNames: {},
      entries: Array.from({ length: 7 }, (_, i) => [
        entry(`p${i}`, '2026-08-01T00:00:00Z', 10),
        entry(`p${i}`, '2026-09-05T00:00:00Z', 20 + i),
      ]).flat(),
    }
    const { up } = weeklyMovers([many], NOW)
    expect(up).toHaveLength(5)
    expect(up[0].delta).toBe(16) // biggest first
  })
})

describe('eventsInWindow', () => {
  it('keeps only events inside the trailing window', () => {
    const mk = (date: string): ChangeEvent => ({ kind: 'arena-launched', date, categoryId: 'c', categoryName: 'C', productCount: 1 })
    const events = [mk('2026-08-20T00:00:00Z'), mk('2026-09-01T00:00:00Z'), mk('2026-09-06T00:00:00Z')]
    expect(eventsInWindow(events, NOW).map((e) => e.date)).toEqual(['2026-09-01T00:00:00Z', '2026-09-06T00:00:00Z'])
  })
})

describe('eventMarkdownLine', () => {
  it('renders every kind with absolute links', () => {
    expect(
      eventMarkdownLine(
        { kind: 'arena-launched', date: '2026-09-05T00:00:00Z', categoryId: 'terminals', categoryName: 'Terminals', productCount: 5 },
        SITE,
      ),
    ).toBe(`- [Terminals](${SITE}/arena/terminals) ranking launched (5 products)`)
    expect(
      eventMarkdownLine(
        {
          kind: 'overtake',
          date: '2026-09-05T00:00:00Z',
          categoryId: 'ai-coding',
          categoryName: 'AI Coding Agents',
          productId: 'opencode',
          productName: 'OpenCode',
          productAiEra: 64.2,
          overtookId: 'claude-code',
          overtookName: 'Claude Code',
          overtookAiEra: 63.8,
        },
        SITE,
      ),
    ).toBe(
      `- [OpenCode](${SITE}/arena/ai-coding/product/opencode) overtook [Claude Code](${SITE}/arena/ai-coding/product/claude-code) in [AI Coding Agents](${SITE}/arena/ai-coding) (64.2 vs 63.8)`,
    )
    expect(
      eventMarkdownLine(
        { kind: 'score-move', date: '2026-09-04T00:00:00Z', categoryId: 'terminals', categoryName: 'Terminals', productId: 'warp', productName: 'Warp', delta: 5.4, to: 45.4 },
        SITE,
      ),
    ).toBe(`- [Warp](${SITE}/arena/terminals/product/warp) +5.4 Overall score in [Terminals](${SITE}/arena/terminals) (→ 45.4)`)
    expect(
      eventMarkdownLine(
        { kind: 'product-added', date: '2026-09-02T00:00:00Z', categoryId: 'terminals', categoryName: 'Terminals', productId: 'ghostty', productName: 'Ghostty' },
        SITE,
      ),
    ).toBe(`- [Ghostty](${SITE}/arena/terminals/product/ghostty) entered the [Terminals](${SITE}/arena/terminals) ranking`)
  })
})

describe('renderWeeklyReport', () => {
  it('renders headline, movers, new products, close races, and day-by-day sections', () => {
    const md = renderWeeklyReport({
      weekEnding: '2026-09-06',
      historyBegins: '2026-08-28',
      events: [
        { kind: 'product-added', date: '2026-09-02T00:00:00Z', categoryId: 'terminals', categoryName: 'Terminals', productId: 'ghostty', productName: 'Ghostty' },
        { kind: 'score-move', date: '2026-09-04T00:00:00Z', categoryId: 'terminals', categoryName: 'Terminals', productId: 'warp', productName: 'Warp', delta: 5.4, to: 45.4 },
      ],
      movers: weeklyMovers(arenas, NOW),
      closeRaces: [
        {
          categoryId: 'ai-coding',
          categoryName: 'AI Coding Agents',
          top1Name: 'Claude Code',
          top1AiEra: 64.2,
          top2Name: 'OpenCode',
          top2AiEra: 63.1,
          contestedCells: 12,
          unstableCells: 4,
        },
      ],
      siteUrl: SITE,
    })
    expect(md).toContain('# Ultrametric Weekly — week ending Sep 6, 2026')
    expect(md).toContain('*Score history begins Aug 28, 2026')
    expect(md).toContain(`- [Warp](${SITE}/arena/terminals/product/warp) +5.4 → 45.4 in [Terminals](${SITE}/arena/terminals)`)
    expect(md).toContain(`- [kitty](${SITE}/arena/terminals/product/kitty) -2.1 → 27.9`)
    expect(md).toContain(`- [Ghostty](${SITE}/arena/terminals/product/ghostty) entered the [Terminals](${SITE}/arena/terminals) ranking`)
    expect(md).toContain('**Claude Code** 64.2 vs **OpenCode** 63.1 (gap 1.1) — 12 decisive cells triple-judged, 4 unstable')
    expect(md).toContain('### Sep 4')
    expect(md).toContain('### Sep 2')
    expect(md.endsWith('\n')).toBe(true)
  })

  it('says so honestly when nothing happened', () => {
    const md = renderWeeklyReport({
      weekEnding: '2026-09-06',
      historyBegins: null,
      events: [],
      movers: { up: [], down: [] },
      closeRaces: [],
      siteUrl: SITE,
    })
    expect(md).toContain('_No movers among established products this week')
    expect(md).toContain('_No new rankings or products this week._')
    expect(md).toContain('_A quiet week — nothing changed._')
  })
})
