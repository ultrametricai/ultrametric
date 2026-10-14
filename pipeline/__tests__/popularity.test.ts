import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PopularityMapSchema } from '@/lib/schemas'
import {
  derivePopularity,
  isGhAvailable,
  parseGithubUrl,
  type GithubRepoInfo,
} from '@/pipeline/stages/popularity'

describe('parseGithubUrl', () => {
  it('extracts owner/repo from a plain repo URL', () => {
    expect(parseGithubUrl('https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' })
  })

  it('strips a trailing .git', () => {
    expect(parseGithubUrl('https://github.com/vuejs/core.git')).toEqual({ owner: 'vuejs', repo: 'core' })
  })

  it('ignores extra path segments', () => {
    expect(parseGithubUrl('https://github.com/ollama/ollama/tree/main')).toEqual({ owner: 'ollama', repo: 'ollama' })
  })

  it('returns null for a non-github.com URL', () => {
    expect(parseGithubUrl('https://gitlab.com/foo/bar')).toBeNull()
  })

  it('returns null for a malformed URL or missing repo segment', () => {
    expect(parseGithubUrl('not-a-url')).toBeNull()
    expect(parseGithubUrl('https://github.com/onlyowner')).toBeNull()
  })
})

describe('isGhAvailable', () => {
  // Doesn't touch api.github.com/gh api — just checks whether the `gh` CLI is installed and
  // authenticated on this machine (see resolvedGithubFetcher's comment). Deliberately does not
  // assert a specific value: CI/contributor machines without `gh` installed must resolve to
  // `false`, not throw or hang.
  it('resolves to a boolean without throwing', async () => {
    await expect(isGhAvailable()).resolves.toEqual(expect.any(Boolean))
  })
})

const github = (overrides: Partial<GithubRepoInfo> = {}): GithubRepoInfo => ({
  stars: 100_000,
  forks: 10_000,
  openIssues: 500,
  createdAt: '2020-01-01T00:00:00Z',
  pushedAt: '2026-08-20T00:00:00Z',
  ...overrides,
})

describe('derivePopularity', () => {
  const now = new Date('2026-08-27T00:00:00Z')

  it('derives stars/forks/openIssues/starsPerYear/daysSincePush from a github payload', () => {
    const out = derivePopularity({ github: github() }, now)
    expect(out.stars).toBe(100_000)
    expect(out.forks).toBe(10_000)
    expect(out.openIssues).toBe(500)
    expect(out.starsPerYear).toBeGreaterThan(0)
    expect(out.daysSincePush).toBe(7)
  })

  it('adds npm/pypi weekly downloads when present', () => {
    const out = derivePopularity({ npmWeekly: 250_000, pypiWeekly: 12_345 }, now)
    expect(out.npmWeekly).toBe(250_000)
    expect(out.pypiWeekly).toBe(12_345)
    expect(out.stars).toBeUndefined()
  })

  it('produces an empty object when nothing was found', () => {
    expect(derivePopularity({ github: null, npmWeekly: null, pypiWeekly: null }, now)).toEqual({})
  })

  it('omits starsPerYear/daysSincePush (but keeps stars/forks) for unparseable dates', () => {
    const out = derivePopularity({ github: github({ createdAt: 'bad', pushedAt: 'bad' }) }, now)
    expect(out.stars).toBe(100_000)
    expect(out.starsPerYear).toBeUndefined()
    expect(out.daysSincePush).toBeUndefined()
  })
})

describe('runPopularity (integration, fake fetchers, isolated data dir)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-popularity-'))
    const repoRoot = path.resolve(__dirname, '../..')
    fs.cpSync(path.join(repoRoot, 'open-rankings'), tmpDir, { recursive: true })
    // Strip any already-committed popularity.json/-history.jsonl from the fixture copy — the
    // real open-rankings/ has these once `pnpm pipeline popularity` has been run for real, and a
    // same-day fetchedAt would trip the 7-day cache-skip logic these tests are trying to
    // exercise from a clean slate.
    for (const catDir of fs.readdirSync(tmpDir, { withFileTypes: true })) {
      if (!catDir.isDirectory()) continue
      fs.rmSync(path.join(tmpDir, catDir.name, 'popularity.json'), { force: true })
      fs.rmSync(path.join(tmpDir, catDir.name, 'popularity-history.jsonl'), { force: true })
    }
    process.env.UM_DATA_DIR = tmpDir
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.UM_DATA_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('writes popularity.json only for react (github url) in frontend-frameworks, appends history', async () => {
    const { runPopularity } = await import('@/pipeline/stages/popularity')
    const fakeNow = new Date('2026-08-27T00:00:00Z')
    let githubCalls = 0
    await runPopularity(
      { category: 'frontend-frameworks', product: 'react' },
      {
        github: async (owner, repo) => {
          githubCalls++
          expect(owner).toBe('facebook')
          expect(repo).toBe('react')
          return github({ stars: 230_000, createdAt: '2013-05-24T16:15:54Z' })
        },
        npm: async () => 500_000,
        pypi: async () => null,
        now: () => fakeNow,
        delayMs: 0,
      },
    )
    expect(githubCalls).toBe(1)

    const written = PopularityMapSchema.parse(
      JSON.parse(fs.readFileSync(path.join(tmpDir, 'frontend-frameworks', 'popularity.json'), 'utf8')),
    )
    expect(written.react.stars).toBe(230_000)
    expect(written.react.npmWeekly).toBe(500_000)
    expect(written.react.fetchedAt).toBe(fakeNow.toISOString())

    const history = fs
      .readFileSync(path.join(tmpDir, 'frontend-frameworks', 'popularity-history.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(history).toHaveLength(1)
    expect(history[0].productId).toBe('react')
    expect(history[0].stars).toBe(230_000)
  })

  it('skips a product with no github url and no curated npm/pypi package (macos)', async () => {
    const { runPopularity } = await import('@/pipeline/stages/popularity')
    await runPopularity(
      { category: 'desktop-os', product: 'macos' },
      {
        github: async () => { throw new Error('should not be called') },
        npm: async () => { throw new Error('should not be called') },
        pypi: async () => { throw new Error('should not be called') },
        now: () => new Date('2026-08-27T00:00:00Z'),
        delayMs: 0,
      },
    )
    const popularityPath = path.join(tmpDir, 'desktop-os', 'popularity.json')
    const written = fs.existsSync(popularityPath) ? JSON.parse(fs.readFileSync(popularityPath, 'utf8')) : {}
    expect(written.macos).toBeUndefined()
  })

  it('skips refetching a product whose popularity.json entry is <7 days old', async () => {
    const dataDir = path.join(tmpDir, 'frontend-frameworks')
    fs.writeFileSync(
      path.join(dataDir, 'popularity.json'),
      JSON.stringify({ react: { stars: 111, fetchedAt: '2026-08-25T00:00:00.000Z' } }),
    )
    const { runPopularity } = await import('@/pipeline/stages/popularity')
    let githubCalls = 0
    await runPopularity(
      { category: 'frontend-frameworks', product: 'react' },
      {
        github: async () => { githubCalls++; return github() },
        npm: async () => null,
        pypi: async () => null,
        now: () => new Date('2026-08-27T00:00:00Z'), // 2 days after the cached fetchedAt
        delayMs: 0,
      },
    )
    expect(githubCalls).toBe(0)
    const written = PopularityMapSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dataDir, 'popularity.json'), 'utf8')),
    )
    expect(written.react.stars).toBe(111) // untouched, still the cached value
  })

  it('refetches once the cached entry is >=7 days old', async () => {
    const dataDir = path.join(tmpDir, 'frontend-frameworks')
    fs.writeFileSync(
      path.join(dataDir, 'popularity.json'),
      JSON.stringify({ react: { stars: 111, fetchedAt: '2026-08-01T00:00:00.000Z' } }),
    )
    const { runPopularity } = await import('@/pipeline/stages/popularity')
    let githubCalls = 0
    await runPopularity(
      { category: 'frontend-frameworks', product: 'react' },
      {
        github: async () => { githubCalls++; return github({ stars: 222 }) },
        npm: async () => null,
        pypi: async () => null,
        now: () => new Date('2026-08-27T00:00:00Z'), // 26 days after the cached fetchedAt
        delayMs: 0,
      },
    )
    expect(githubCalls).toBe(1)
    const written = PopularityMapSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dataDir, 'popularity.json'), 'utf8')),
    )
    expect(written.react.stars).toBe(222)
  })

  it('throws for an unknown --product filter', async () => {
    const { runPopularity } = await import('@/pipeline/stages/popularity')
    await expect(
      runPopularity(
        { category: 'frontend-frameworks', product: 'nonexistent' },
        { github: async () => null, npm: async () => null, pypi: async () => null, now: () => new Date(), delayMs: 0 },
      ),
    ).rejects.toThrow(/unknown product/)
  })
})
