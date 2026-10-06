// Alias/ID manifest coverage (docs/PR171-EXTRACTION.md, port plan item 2 — the
// alias-manifest equality pin lifted from PR #171's route-cutover suite as a standalone
// test): every key a process answers to — canonical title slug, immutable corpus id,
// renamed-process alias slugs — is enumerated for static export and serves the SAME
// canonical execution payload, byte-equal to buildProcessManifest(task).
import { describe, expect, it } from 'vitest'
import { GET, generateStaticParams } from '@/app/processes/[slug]/manifest.json/route'
import { buildProcessManifest } from '../processManifest'
import { loadProcesses, processSlug } from '../processes'

const tasks = loadProcesses()

describe('process manifest alias and stable-ID coverage', () => {
  it('keeps all alias and id manifests on the existing canonical execution payload', async () => {
    const params = new Set(generateStaticParams().map((param) => param.slug))
    for (const task of tasks) {
      for (const key of [processSlug(task.title), task.id, ...(task.slugAliases ?? []).map((alias) => alias.slug)]) {
        expect(params.has(key), `${key} must be enumerated for static export`).toBe(true)
        const response = await GET(new Request(`https://ultrametric.ai/processes/${key}/manifest.json`), { params: Promise.resolve({ slug: key }) })
        expect(response.status, key).toBe(200)
        expect(await response.json()).toEqual(buildProcessManifest(task))
      }
    }
  })

  it('404s unknown keys instead of guessing a process', async () => {
    const response = await GET(new Request('https://ultrametric.ai/processes/unpublished-process/manifest.json'), { params: Promise.resolve({ slug: 'unpublished-process' }) })
    expect(response.status).toBe(404)
  })
})
