// The embeddable badge rename (<id>-arena-score.svg → <id>-score.svg, 2026-10-08): badge URLs
// are pasted into third-party READMEs by design, so the retired filename 308s to the renamed
// one through the real Next redirect config. Exercised with Next's config-testing utility so
// the matcher semantics are the router's own (the process-id redirect test's idiom).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import config from '../../next.config'

describe('badge arena-score → score redirect', () => {
  it('308s the retired -arena-score.svg name to -score.svg, including multi-hyphen product ids', async () => {
    for (const id of ['stripe', 'adyen-for-platforms']) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ultrametric.ai/badges/${id}-arena-score.svg`,
        nextConfig: config,
      })
      expect(response.status, id).toBe(308)
      expect(new URL(getRedirectUrl(response)!).pathname).toBe(`/badges/${id}-score.svg`)
    }
  })

  it('every committed -score.svg badge is reachable from its retired -arena-score.svg name', async () => {
    const badges = fs
      .readdirSync(path.join(process.cwd(), 'public/badges'))
      .filter((f) => f.endsWith('-score.svg'))
    expect(badges.length).toBeGreaterThan(0)
    for (const file of badges) {
      const id = file.replace(/-score\.svg$/, '')
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ultrametric.ai/badges/${id}-arena-score.svg`,
        nextConfig: config,
      })
      expect(response.status, file).toBe(308)
      expect(new URL(getRedirectUrl(response)!).pathname).toBe(`/badges/${file}`)
    }
  })

  it('leaves the renamed and agent-ready badge paths alone', async () => {
    for (const file of ['stripe-score.svg', 'stripe-agent-ready.svg']) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ultrametric.ai/badges/${file}`,
        nextConfig: config,
      })
      expect(response.status, file).not.toBe(308)
      expect(response.status, file).not.toBe(307)
    }
  })
})
