// Stable-ID process URLs (docs/PR171-EXTRACTION.md, port plan item 1): every immutable
// corpus id 308s to its canonical title slug through the real Next redirect config —
// /processes/form_001 → /processes/incorporate-c-corp — with query values (lens picks,
// geo, unknown params) passing through. Alias SLUGS stay full prerendered pages, not
// redirects. Exercised with Next's config-testing utility so the matcher semantics are
// the router's own, not a reimplementation.
import { describe, expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import config from '../../next.config'
import { loadProcesses, processSlug } from '../processes'
import { parseViaParam } from '../processLens'

const tasks = loadProcesses()

describe('stable-ID process redirects', () => {
  it('308s every corpus id to its canonical slug, retaining repeated, lens and unknown query values', async () => {
    for (const task of tasks) {
      const url = `https://ultrametric.ai/processes/${task.id}?via=legal-ops:clerky&via=payments:stripe&geo=IN&extra=keep`
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig: config })
      expect(response.status, task.id).toBe(308)
      const destination = new URL(getRedirectUrl(response)!)
      expect(destination.pathname).toBe(`/processes/${processSlug(task.title)}`)
      expect(destination.pathname).not.toBe(`/processes/${task.id}`)
      // Next's config-testing utility folds repeated values into one comma string.
      // Assert lens semantics (parseViaParam handles both encodings); geo and unknown
      // params survive untouched. HTTP cannot receive a fragment; hashes stay client-side.
      expect(parseViaParam(destination.searchParams.getAll('via'))).toEqual({ 'legal-ops': 'clerky', payments: 'stripe' })
      expect(destination.searchParams.get('geo')).toBe('IN')
      expect(destination.searchParams.get('extra')).toBe('keep')
      expect(destination.hash).toBe('')
    }
  })

  it('leaves canonical and alias slugs alone — they are prerendered pages, never redirects', async () => {
    const aliased = tasks.find((task) => (task.slugAliases ?? []).length > 0)!
    for (const slug of [processSlug(aliased.title), ...aliased.slugAliases!.map((alias) => alias.slug)]) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ultrametric.ai/processes/${slug}`,
        nextConfig: config,
      })
      expect(response.status, slug).not.toBe(308)
      expect(response.status).not.toBe(307)
    }
  })
})
