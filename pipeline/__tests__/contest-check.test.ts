import { describe, expect, it } from 'vitest'
import { contestEvidenceIds, parseIssueBody } from '@/pipeline/contest-check'

const TEMPLATE_BODY = `<!--
Before filing: find the exact category, product, and story ids in
rankings/categories.json, rankings/{category}/products.json, and rankings/{category}/stories.json.
Find the current verdict in rankings/{category}/verdicts.json.
-->

**Category**
ai-coding

**Product**
claude-code

**Story id**
live-app-debugging

**Current verdict**
<!-- tier + quality + confidence -->
partial, quality 5, confidence medium

**Proposed verdict**
full, quality 8 — the official docs now show a full debugging workflow

**Evidence URLs**
https://docs.claude.com/en/docs/claude-code/debugging
https://github.com/anthropics/claude-code/issues/123

**Quotes**
"Claude Code can attach to a live running process and set breakpoints."
`

describe('parseIssueBody', () => {
  it('parses category, product, story id, and evidence URLs from a filled-in template', () => {
    expect(parseIssueBody(TEMPLATE_BODY)).toEqual({
      category: 'ai-coding',
      productId: 'claude-code',
      storyId: 'live-app-debugging',
      urls: ['https://docs.claude.com/en/docs/claude-code/debugging', 'https://github.com/anthropics/claude-code/issues/123'],
    })
  })

  it('returns null when the category section is missing', () => {
    const body = TEMPLATE_BODY.replace('**Category**\nai-coding\n\n', '')
    expect(parseIssueBody(body)).toBeNull()
  })

  it('returns null when the product section is empty', () => {
    const body = TEMPLATE_BODY.replace('**Product**\nclaude-code', '**Product**\n')
    expect(parseIssueBody(body)).toBeNull()
  })

  it('returns null for a completely empty body', () => {
    expect(parseIssueBody('')).toBeNull()
  })

  it('returns an empty urls array when no URLs are present, without failing to parse the ids', () => {
    const body = TEMPLATE_BODY.replace(
      '**Evidence URLs**\nhttps://docs.claude.com/en/docs/claude-code/debugging\nhttps://github.com/anthropics/claude-code/issues/123',
      '**Evidence URLs**\n<!-- one or more source URLs -->',
    )
    expect(parseIssueBody(body)).toEqual({
      category: 'ai-coding',
      productId: 'claude-code',
      storyId: 'live-app-debugging',
      urls: [],
    })
  })

  it('does not pick up URLs from unrelated sections (e.g. Quotes)', () => {
    const body = TEMPLATE_BODY.replace(
      '**Evidence URLs**\nhttps://docs.claude.com/en/docs/claude-code/debugging\nhttps://github.com/anthropics/claude-code/issues/123',
      '**Evidence URLs**\n<!-- none -->',
    ).replace('**Quotes**\n', '**Quotes**\nSee https://example.com/unrelated for context.\n')
    expect(parseIssueBody(body)?.urls).toEqual([])
  })

  it('is tolerant of CRLF line endings and extra surrounding whitespace', () => {
    const crlf = TEMPLATE_BODY.replace(/\n/g, '\r\n')
    expect(parseIssueBody(crlf)).toEqual({
      category: 'ai-coding',
      productId: 'claude-code',
      storyId: 'live-app-debugging',
      urls: ['https://docs.claude.com/en/docs/claude-code/debugging', 'https://github.com/anthropics/claude-code/issues/123'],
    })
  })

  it('strips leftover HTML comments so they never leak into a parsed field', () => {
    const body = '**Category**\n<!-- e.g. ai-coding -->\nai-coding\n\n**Product**\nclaude-code\n\n**Story id**\nlive-app-debugging\n\n**Evidence URLs**\nhttps://x.example/a\n'
    expect(parseIssueBody(body)).toEqual({
      category: 'ai-coding',
      productId: 'claude-code',
      storyId: 'live-app-debugging',
      urls: ['https://x.example/a'],
    })
  })
})

describe('contestEvidenceIds', () => {
  it('mints one namespaced id per URL, indexed from 1', () => {
    expect(contestEvidenceIds('claude-code', '42', 3)).toEqual([
      'claude-code-contest-42-1',
      'claude-code-contest-42-2',
      'claude-code-contest-42-3',
    ])
  })

  it('returns an empty array for zero URLs', () => {
    expect(contestEvidenceIds('claude-code', '42', 0)).toEqual([])
  })
})
