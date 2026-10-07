import { describe, expect, it } from 'vitest'
import type { ChangeEvent } from '@/lib/changelog'
import { escapeXml, eventToItem, renderRss, type FeedItem } from '@/lib/feed'

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;')
  })

  it('leaves plain text unchanged', () => {
    expect(escapeXml('Claude Code +14.9 to 41.9')).toBe('Claude Code +14.9 to 41.9')
  })
})

describe('eventToItem', () => {
  const base = { date: '2026-09-04T06:00:00Z', categoryId: 'ai-coding', categoryName: 'AI Coding' }

  it('maps an overtake with both products and a stable guid', () => {
    const e: ChangeEvent = {
      kind: 'overtake', ...base,
      productId: 'codex', productName: 'Codex', productAiEra: 55.1,
      overtookId: 'copilot', overtookName: 'Copilot', overtookAiEra: 54.2,
    }
    const item = eventToItem(e)
    expect(item.title).toBe('Codex overtook Copilot in AI Coding')
    expect(item.link).toContain('/arena/ai-coding')
    expect(item.guid).toBe('overtake:ai-coding:codex:copilot:2026-09-04T06:00:00Z')
  })

  it('maps a score-move with signed delta and product link', () => {
    const e: ChangeEvent = { kind: 'score-move', ...base, productId: 'claude-code', productName: 'Claude Code', delta: 14.9, to: 41.9 }
    const item = eventToItem(e)
    expect(item.title).toBe('Claude Code +14.9 to 41.9 in AI Coding')
    expect(item.link).toContain('/arena/ai-coding/product/claude-code')
  })

  it('maps arena-launched and product-added', () => {
    expect(eventToItem({ kind: 'arena-launched', ...base, productCount: 5 }).title)
      .toBe('New ranking: AI Coding (5 products)')
    expect(eventToItem({ kind: 'product-added', ...base, productId: 'x', productName: 'X' }).title)
      .toBe('X added to AI Coding')
  })
})

describe('renderRss', () => {
  const item: FeedItem = {
    title: 'A <b>bold</b> & "quoted" move',
    link: 'https://example.com/arena/x',
    date: '2026-09-04T06:00:00Z',
    description: "It's a test",
    guid: 'overtake:x:a:b:2026-09-04T06:00:00Z',
  }

  it('produces escaped, well-formed channel + item XML', () => {
    const xml = renderRss([item])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<title>A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; move</title>')
    expect(xml).toContain('<guid isPermaLink="false">overtake:x:a:b:2026-09-04T06:00:00Z</guid>')
    expect(xml).toContain('<pubDate>Fri, 04 Sep 2026 06:00:00 GMT</pubDate>')
    expect(xml).not.toContain('<b>bold</b>')
  })

  it('renders an empty channel without items', () => {
    const xml = renderRss([])
    expect(xml).toContain('</channel>')
    expect(xml).not.toContain('<item>')
  })
})
