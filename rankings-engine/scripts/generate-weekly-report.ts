// Weekly Arena Report generator: renders the last 7 days of changelog events (see
// lib/changelog.ts — the same derivation /changelog uses), the biggest Overall score movers, new
// arenas/products, and the current close races (arenas the multi-judge uncertainty pass covers)
// into clean, newsletter-ready markdown at reports/YYYY-MM-DD.md (committed — app/reports lists
// them). Deterministic given the data files and the clock; safe to re-run (same-day re-runs
// overwrite the same file).
//
//   pnpm tsx pipeline/scripts/generate-weekly-report.ts
//
// The render/compute helpers are pure (exported for pipeline/__tests__/generate-weekly-report
// .test.ts); only main() at the bottom touches fs/loadAll.
import fs from 'node:fs'
import path from 'node:path'
import {
  collectArenaHistories, dayOf, deriveChangelog, groupByDay, historyBegins,
  type ArenaHistoryInput, type ChangeEvent,
} from '../../lib/changelog'
import { loadAll } from '../../lib/data'
import { SITE_URL } from '../../lib/site'
import { seriesFor, trendDelta } from '../../lib/scoreTrend'
import { isCloseRace, isUncertain } from '../../lib/uncertainty'
import { DATA_DIR, ROOT } from '../paths'

export const REPORT_WINDOW_DAYS = 7
export const MOVERS_PER_DIRECTION = 5

export interface Mover {
  categoryId: string
  categoryName: string
  productId: string
  productName: string
  delta: number
  to: number
}

export interface CloseRace {
  categoryId: string
  categoryName: string
  top1Name: string
  top1AiEra: number
  top2Name: string
  top2AiEra: number
  /** How many decisive cells the uncertainty pass re-judged / how many came back unstable. */
  contestedCells: number
  unstableCells: number
}

export interface WeeklyReportInput {
  /** YYYY-MM-DD the report window ends on (inclusive — "week ending"). */
  weekEnding: string
  historyBegins: string | null
  /** Events already windowed to the report's 7 days (see eventsInWindow). */
  events: ChangeEvent[]
  movers: { up: Mover[]; down: Mover[] }
  closeRaces: CloseRace[]
  siteUrl: string
}

export function eventsInWindow(events: ChangeEvent[], now: Date, windowDays: number = REPORT_WINDOW_DAYS): ChangeEvent[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  return events.filter((e) => {
    const t = new Date(e.date).getTime()
    return t > cutoff && t <= now.getTime()
  })
}

// Biggest Overall score movers over the window: latest aiEra minus the value in effect at the
// window's start (trendDelta with a 7-day window — the change-only series carries values
// forward; a series that only starts mid-window falls back to its earliest point). Products
// whose TRACKING (any metric, not just aiEra) starts inside the window are excluded — their
// "delta" is launch settling, and they're already listed under new arenas/products.
export function weeklyMovers(
  arenas: ArenaHistoryInput[],
  now: Date,
  windowDays: number = REPORT_WINDOW_DAYS,
  perDirection: number = MOVERS_PER_DIRECTION,
): { up: Mover[]; down: Mover[] } {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  const movers: Mover[] = []
  for (const arena of arenas) {
    const byProduct = new Map<string, ArenaHistoryInput['entries']>()
    for (const e of arena.entries) {
      const list = byProduct.get(e.productId)
      if (list) list.push(e)
      else byProduct.set(e.productId, [e])
    }
    for (const [productId, entries] of byProduct) {
      const firstTracked = Math.min(...entries.map((e) => new Date(e.date).getTime()))
      if (firstTracked > cutoff) continue // first tracked inside the window: launch settling
      const series = seriesFor(entries, 'aiEra')
      if (series.length < 2) continue
      const delta = trendDelta(series, now, windowDays)
      if (delta === null || delta === 0) continue
      movers.push({
        categoryId: arena.categoryId,
        categoryName: arena.categoryName,
        productId,
        productName: arena.productNames[productId] ?? productId,
        delta,
        to: series[series.length - 1].value,
      })
    }
  }
  const byDelta = (dir: 1 | -1) => (a: Mover, b: Mover) =>
    dir * (b.delta - a.delta) || a.productName.localeCompare(b.productName)
  return {
    up: movers.filter((m) => m.delta > 0).sort(byDelta(1)).slice(0, perDirection),
    down: movers.filter((m) => m.delta < 0).sort(byDelta(-1)).slice(0, perDirection),
  }
}

function fmtDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`
}

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function arenaLink(e: { categoryId: string; categoryName: string }, siteUrl: string): string {
  return `[${e.categoryName}](${siteUrl}/arena/${e.categoryId})`
}

function productLink(e: { categoryId: string; productId: string; productName: string }, siteUrl: string): string {
  return `[${e.productName}](${siteUrl}/arena/${e.categoryId}/product/${e.productId})`
}

export function eventMarkdownLine(event: ChangeEvent, siteUrl: string): string {
  switch (event.kind) {
    case 'arena-launched':
      return `- ${arenaLink(event, siteUrl)} ranking launched (${event.productCount} ${event.productCount === 1 ? 'product' : 'products'})`
    case 'overtake':
      return `- ${productLink(event, siteUrl)} overtook [${event.overtookName}](${siteUrl}/arena/${event.categoryId}/product/${event.overtookId}) in ${arenaLink(event, siteUrl)} (${event.productAiEra.toFixed(1)} vs ${event.overtookAiEra.toFixed(1)})`
    case 'score-move':
      return `- ${productLink(event, siteUrl)} ${fmtDelta(event.delta)} Overall score in ${arenaLink(event, siteUrl)} (→ ${event.to.toFixed(1)})`
    case 'product-added':
      return `- ${productLink(event, siteUrl)} entered the ${arenaLink(event, siteUrl)} ranking`
  }
}

export function renderWeeklyReport(input: WeeklyReportInput): string {
  const { weekEnding, events, movers, closeRaces, siteUrl } = input
  const lines: string[] = []
  lines.push(`# Ultrametric Weekly — week ending ${dayLabel(weekEnding)}, ${weekEnding.slice(0, 4)}`)
  lines.push('')
  lines.push(
    `The last ${REPORT_WINDOW_DAYS} days across every [Ultrametric](${siteUrl}) ranking — rank flips, Overall score` +
      ` moves, new rankings and products, derived from the committed score history` +
      ` ([how scoring works](${siteUrl}/methodology)). Scores only move when evidence and verdicts are re-derived.`,
  )
  if (input.historyBegins) {
    lines.push('')
    lines.push(`*Score history begins ${dayLabel(input.historyBegins)}, ${input.historyBegins.slice(0, 4)} — earlier movement isn't recorded.*`)
  }
  lines.push('')

  lines.push('## Biggest movers (Overall score)')
  lines.push('')
  if (movers.up.length === 0 && movers.down.length === 0) {
    lines.push(
      '_No movers among established products this week — products first tracked inside the week settle their launch scores under "New this week" instead._',
    )
  } else {
    if (movers.up.length > 0) {
      lines.push('**Up**')
      for (const m of movers.up) {
        lines.push(`- ${productLink(m, siteUrl)} ${fmtDelta(m.delta)} → ${m.to.toFixed(1)} in ${arenaLink(m, siteUrl)}`)
      }
      lines.push('')
    }
    if (movers.down.length > 0) {
      lines.push('**Down**')
      for (const m of movers.down) {
        lines.push(`- ${productLink(m, siteUrl)} ${fmtDelta(m.delta)} → ${m.to.toFixed(1)} in ${arenaLink(m, siteUrl)}`)
      }
      lines.push('')
    }
  }
  if (lines[lines.length - 1] !== '') lines.push('')

  const launches = events.filter((e) => e.kind === 'arena-launched')
  const additions = events.filter((e) => e.kind === 'product-added')
  lines.push('## New this week')
  lines.push('')
  if (launches.length === 0 && additions.length === 0) {
    lines.push('_No new rankings or products this week._')
  } else {
    for (const e of launches) lines.push(eventMarkdownLine(e, siteUrl))
    for (const e of additions) lines.push(eventMarkdownLine(e, siteUrl))
  }
  lines.push('')

  lines.push('## Close races')
  lines.push('')
  if (closeRaces.length === 0) {
    lines.push('_No ranking currently has its #1 and #2 within striking distance._')
  } else {
    lines.push(
      'Rankings where #1 and #2 are close enough that the ordering itself gets re-checked with extra' +
        ` judge samples ([uncertainty pass](${siteUrl}/methodology)):`,
    )
    lines.push('')
    for (const r of closeRaces) {
      const gap = Math.abs(r.top1AiEra - r.top2AiEra)
      lines.push(
        `- ${arenaLink(r, siteUrl)}: **${r.top1Name}** ${r.top1AiEra.toFixed(1)} vs **${r.top2Name}** ${r.top2AiEra.toFixed(1)}` +
          ` (gap ${gap.toFixed(1)}) — ${r.contestedCells} decisive cells triple-judged, ${r.unstableCells} unstable`,
      )
    }
  }
  lines.push('')

  lines.push('## Day by day')
  const days = groupByDay(events)
  if (days.length === 0) {
    lines.push('')
    lines.push('_A quiet week — nothing changed._')
  }
  for (const [day, dayEvents] of days) {
    lines.push('')
    lines.push(`### ${dayLabel(day)}`)
    lines.push('')
    for (const e of dayEvents) lines.push(eventMarkdownLine(e, siteUrl))
  }
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push(
    `*Generated from [Ultrametric](${siteUrl})'s committed score history — evidence in, rankings out.` +
      ` Full changelog: ${siteUrl}/changelog · Methodology: ${siteUrl}/methodology*`,
  )
  return lines.join('\n').trimEnd() + '\n'
}

// The current close races, from data: arenas the uncertainty pass has covered (non-empty
// uncertainty.json) whose #1/#2 gap still qualifies, closest first.
export function collectCloseRaces(dir: string = DATA_DIR): CloseRace[] {
  const races: CloseRace[] = []
  for (const data of loadAll(dir)) {
    if (data.uncertainty.length === 0) continue
    const [top1, top2] = data.rankings.leaderboard
    if (!top1 || !top2 || !isCloseRace(top1.aiEra, top2.aiEra)) continue
    const nameOf = (pid: string) => data.products.find((p) => p.id === pid)?.name ?? pid
    races.push({
      categoryId: data.category.id,
      categoryName: data.category.name,
      top1Name: nameOf(top1.productId),
      top1AiEra: top1.aiEra!,
      top2Name: nameOf(top2.productId),
      top2AiEra: top2.aiEra!,
      contestedCells: data.uncertainty.length,
      unstableCells: data.uncertainty.filter((u) => isUncertain(u.agreement)).length,
    })
  }
  return races.sort(
    (a, b) => Math.abs(a.top1AiEra - a.top2AiEra) - Math.abs(b.top1AiEra - b.top2AiEra) || a.categoryId.localeCompare(b.categoryId),
  )
}

function main(): void {
  const now = new Date()
  const weekEnding = dayOf(now.toISOString())
  const arenas = collectArenaHistories(DATA_DIR)
  const events = eventsInWindow(deriveChangelog(arenas), now)
  const report = renderWeeklyReport({
    weekEnding,
    historyBegins: historyBegins(arenas),
    events,
    movers: weeklyMovers(arenas, now),
    closeRaces: collectCloseRaces(),
    siteUrl: SITE_URL,
  })
  const outDir = path.join(ROOT, 'reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `${weekEnding}.md`)
  fs.writeFileSync(outFile, report)
  console.log(`generate-weekly-report: ${events.length} events → ${path.relative(ROOT, outFile)}`)
}

if (require.main === module) {
  main()
}
