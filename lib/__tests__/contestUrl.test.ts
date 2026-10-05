import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flagVerdictUrl } from '@/lib/contestUrl'

const URL_ARGS = { category: 'ai-coding', productId: 'cursor', storyId: 'agentic-agent-docs', verdict: 'full', quality: 9 }

describe('flagVerdictUrl', () => {
  it('prefills the issue form per field id, with no legacy body param', () => {
    const url = new URL(flagVerdictUrl(URL_ARGS))
    expect(url.origin + url.pathname).toBe('https://github.com/ultrametricai/ultrametric/issues/new')
    const p = url.searchParams
    expect(p.get('template')).toBe('flag-verdict.yml')
    expect(p.get('title')).toBe('[flag] ai-coding/cursor/agentic-agent-docs')
    expect(p.get('labels')).toBe('contest')
    expect(p.get('category')).toBe('ai-coding')
    expect(p.get('product')).toBe('cursor')
    expect(p.get('story-id')).toBe('agentic-agent-docs')
    expect(p.get('current-verdict')).toBe('full, quality 9')
    // GitHub ignores `body` for issue FORMS — the old ~600-byte body prefill never worked and
    // was serialized into every battle/vs prerender artifact (docs/BUILD-SIZE.md). Keep it out.
    expect(p.has('body')).toBe(false)
  })

  it('uses only field ids that exist in the flag-verdict issue form', () => {
    // The prefill contract is the template's field ids. If a field is renamed or removed in
    // .github/ISSUE_TEMPLATE/flag-verdict.yml, this fails instead of the prefill silently dying.
    const template = readFileSync(join(process.cwd(), '.github/ISSUE_TEMPLATE/flag-verdict.yml'), 'utf8')
    const templateIds = new Set([...template.matchAll(/^\s{4}id:\s*(\S+)\s*$/gm)].map((m) => m[1]))
    const reserved = new Set(['template', 'title', 'labels'])
    const url = new URL(flagVerdictUrl(URL_ARGS))
    const fieldParams = [...url.searchParams.keys()].filter((k) => !reserved.has(k))
    expect(fieldParams.length).toBeGreaterThan(0)
    for (const key of fieldParams) expect(templateIds, `param "${key}" has no matching form field id`).toContain(key)
  })

  it('stays compact — the whole point of the field-param form', () => {
    // The old body-carrying URL was ~600 bytes and appeared twice per judged round in every
    // battle/vs artifact. Pin the budget so a future param doesn't quietly regrow it.
    expect(flagVerdictUrl(URL_ARGS).length).toBeLessThan(300)
  })
})
