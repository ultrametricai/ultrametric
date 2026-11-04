import { describe, expect, it, vi } from 'vitest'
import { normalizeIssue, assess, digest, type Catalog, type IntakeReport } from '../intake/submission'
import { publicIpv4, publicUrl, fetchPublic, resolvePublic, type Page } from '../intake/public-fetch'
import { publish, filesFor, type Publisher, type Pull } from '../intake/publish'

const body = (arena = 'vector-databases', name = 'Acme') => `### Product name\n\n${name}\n\n### Category\n\n${arena}\n\n### URLs\n\nSite: https://acme.io/\n\n### Why it matters\n\nPublic vector database.\n\n### Are you affiliated with this product?\n\nNo\n\n### Affiliation detail (if yes)\n\n_No response_\n`
const issue = (text = body()) => ({ number: 42, title: 'Submit a product: Acme', body: text, state: 'open', updated_at: '2026-11-01T00:00:00Z', labels: [{ name: 'product-request' }] })
const catalog: Catalog = { categories: [{ id: 'vector-databases', name: 'Vector Databases', description: 'Vector search databases.', personas: ['founder'] }], products: [], roadmap: [{ id: 'realtime-infra', name: 'Realtime infrastructure', status: 'planned', candidateProducts: ['A', 'B'] }] }
const html = '<h1>Acme vector database</h1> vector search embeddings similarity nearest neighbor ANN HNSW hybrid search index <a href="https://acme.io/docs">Documentation</a> Sign in. REST API.'
const pages = async (url: string): Promise<Page> => ({ url, status: 200, contentType: 'text/html', html })
const report = async () => assess(normalizeIssue(issue()), catalog, pages)

function publisher() {
  let reserved: IntakeReport | null = null
  const prs: Pull[] = []
  const io: Publisher = {
    currentRevision: vi.fn(async () => digest(body())),
    readBranch: vi.fn(async () => reserved),
    pulls: vi.fn(async () => prs),
    createBranch: vi.fn(async r => { if (reserved) throw new Error('reference already exists'); reserved = r }),
    createPull: vi.fn(async () => { const pr = { number: 10, html_url: 'https://github.com/ultrametricai/ultrametric/pull/10', draft: true, state: 'open' }; prs.push(pr); return pr }),
  }
  return { io, prs }
}

describe('submission normalization', () => {
  it('parses the current GitHub issue form and keeps asserted disclosure separate', () => {
    expect(normalizeIssue(issue())).toMatchObject({ name: 'Acme', arena: 'vector-databases', urls: ['https://acme.io/'], affiliated: false, disclosure: '' })
  })
  it.each([
    body().replace('### Category', '### Product name'),
    body().replace('vector-databases\n', '../../.github/workflows\n'),
    body().replace('\nNo\n', '\nMaybe\n'),
    body().replace('\nNo\n', '\nYes\n'),
    body().replace('Acme\n', '$(touch pwned)\n'),
    body().replace('https://acme.io/', 'http://acme.io/'),
    body().replace('https://acme.io/', 'https://github.com/a/b/../../settings'),
  ])('rejects ambiguous or injected fields', text => expect(() => normalizeIssue(issue(text))).toThrow())
  it('requires product-request and rejects closed issues and PR payloads', () => {
    expect(() => normalizeIssue({ ...issue(), labels: [] })).toThrow()
    expect(() => normalizeIssue({ ...issue(), state: 'closed' })).toThrow()
    expect(() => normalizeIssue({ ...issue(), pull_request: {} })).toThrow()
  })
  it('does not use Pro labels as routing/scoring inputs', () => {
    expect(normalizeIssue({ ...issue(), labels: [...issue().labels, { name: 'pro' }, { name: 'priority' }] })).toEqual(normalizeIssue(issue()))
  })
})

describe('untrusted public URLs', () => {
  it.each(['http://acme.io', 'file:///etc/passwd', 'https://user:password@acme.io/', 'https://acme.io:8443', 'https://localhost', 'https://a.local', 'https://a.internal', 'https://127.0.0.1', 'https://2130706433', 'https://0x7f000001', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://acme.io\\@localhost'])('blocks %s before transport', url => expect(() => publicUrl(url)).toThrow())
  it.each(['0.1.2.3', '10.1.1.1', '127.1.2.3', '169.254.169.254', '172.16.1.1', '192.168.1.1', '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.1.1.1', '255.255.255.255', '::1', 'fe80::1', 'fc00::1'])('rejects special address %s', ip => expect(publicIpv4(ip)).toBe(false))
  it('pins a public DNS answer into the request rather than resolving twice', async () => {
    const dns = vi.fn(async () => [{ address: '8.8.8.8', family: 4 }])
    const transport = vi.fn(async (url: URL, address: string) => { expect(address).toBe('8.8.8.8'); return pages(url.href) })
    await fetchPublic('https://acme.io/', dns, transport)
    expect(dns).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][1]).toBe('8.8.8.8')
  })
  it('rejects mixed DNS, failures, and empty DNS answers before request', async () => {
    const request = vi.fn()
    for (const addresses of [[], [{ address: '127.0.0.1', family: 4 }], [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]]) {
      await expect(fetchPublic('https://acme.io', async () => addresses, request)).rejects.toThrow()
    }
    await expect(resolvePublic('acme.io', async () => { throw new Error('DNS down') })).rejects.toThrow('DNS down')
    expect(request).not.toHaveBeenCalled()
  })
  it('revalidates every redirect and blocks DNS rebinding at the next hop', async () => {
    const dns = vi.fn().mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    const request = vi.fn(async () => ({ url: 'https://acme.io', status: 302, html: '', contentType: '', location: 'https://metadata.acme.io/' }))
    await expect(fetchPublic('https://acme.io', dns, request)).rejects.toThrow('public IPv4')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('bounds redirect loops and blocks redirected credentials', async () => {
    const dns = async () => [{ address: '8.8.8.8', family: 4 }]
    const request = vi.fn(async () => ({ url: 'https://acme.io/', status: 302, html: '', contentType: '', location: '/' }))
    await expect(fetchPublic('https://acme.io', dns, request)).rejects.toThrow('redirect limit')
    expect(request).toHaveBeenCalledTimes(4)
    await expect(fetchPublic('https://acme.io', dns, async () => ({ url: '', status: 302, html: '', contentType: '', location: 'https://secret@acme.io/' }))).rejects.toThrow('credential-free')
  })
  it('does not accept binary content as documentation', async () => {
    await expect(fetchPublic('https://acme.io', async () => [{ address: '8.8.8.8', family: 4 }], async () => ({ url: '', status: 200, html: 'abc', contentType: 'image/png' }))).rejects.toThrow('content type')
  })
})

describe('policy routing', () => {
  it('uses fetched evidence and prepares a schema-valid product proposal', async () => {
    const r = await report()
    expect(r.route).toBe('draft-bringup')
    expect(r.proposedProduct?.id).toBe('acme')
    expect(r.receipts.length).toBe(2)
    expect(r.receipts[0].sha256).toBe(digest(html))
    expect(Object.keys(filesFor(r)).every(p => p.startsWith('reports/submission-intake/'))).toBe(true)
  })
  it('retains vendor self-disclosure without treating payment as qualification', async () => {
    const r = await assess(normalizeIssue(issue(body().replace('\nNo\n', '\nYes\n').replace('_No response_', 'Vendor employee'))), catalog, pages)
    expect(r.route).toBe('draft-bringup')
    expect(r.proposedProduct?.affiliation).toContain('Vendor employee')
  })
  it.each(['Foreloop', 'AFK', 'Ultrametric'])('routes founder product %s without fetching', async name => {
    const get = vi.fn(pages)
    expect((await assess(normalizeIssue(issue(body('vector-databases', name))), catalog, get)).route).toBe('needs-human')
    expect(get).not.toHaveBeenCalled()
  })
  it('uses roster affiliation identity even when a submitter renames it', async () => {
    const r = await assess(normalizeIssue(issue()), { ...catalog, products: [{ arena: 'other', product: { id: 'owner', name: 'Other', vendor: 'Other', type: 'commercial', urls: { site: 'https://acme.io' }, affiliation: 'Founder affiliated' } }] }, pages)
    expect(r.reason).toContain('Affiliated identity')
  })
  it('deduplicates existing roster entries by domain in the requested arena', async () => {
    const r = await assess(normalizeIssue(issue()), { ...catalog, products: [{ arena: 'vector-databases', product: { id: 'different', name: 'Renamed', vendor: 'Acme', type: 'commercial', urls: { site: 'https://www.acme.io/pricing' } } }] }, pages)
    expect(r.route).toBe('duplicate')
  })
  it('routes planned arenas to reviewed creation without publishing live state', async () => {
    const r = await assess(normalizeIssue(issue(body('realtime-infra'))), catalog, vi.fn())
    expect(r.route).toBe('arena-review')
    expect(r.roadmap?.candidateProducts).toEqual(['A', 'B'])
    expect(r.proposedProduct).toBeUndefined()
    expect(Object.entries(filesFor(r)).find(([name]) => name.endsWith('/REVIEW.md'))![1]).toContain('each peer')
  })
  it('does not manufacture arena fit from submitter claims', async () => {
    const r = await assess(normalizeIssue(issue()), catalog, async url => ({ ...await pages(url), html: '<h1>Acme bakery</h1>' }))
    expect(r.route).toBe('needs-human')
  })
  it('rejects ambiguous ties and unknown arenas', async () => {
    const tied = { ...catalog, categories: [{ ...catalog.categories[0], id: 'one', name: 'Acme Vector Database' }, { ...catalog.categories[0], id: 'two', name: 'Acme Vector Database' }] }
    expect((await assess(normalizeIssue(issue(body('one'))), tied, pages)).route).toBe('needs-human')
    expect((await assess(normalizeIssue(issue(body('new'))), catalog, pages)).route).toBe('needs-human')
  })
  it('fails closed on fetch failure and preserves a failed receipt', async () => {
    const r = await assess(normalizeIssue(issue()), catalog, async () => { throw new Error('blocked private address') })
    expect(r.route).toBe('needs-human')
    expect(r.receipts[0].error).toContain('blocked private address')
  })
  it('does not silently accept a cross-identity redirect', async () => {
    const r = await assess(normalizeIssue(issue()), catalog, async url => ({ ...await pages(url), url: 'https://another.io/' }))
    expect(r.reason).toContain('different identity')
  })
  it('qualifies an OSS product from its own repository and retains fetched evidence', async () => {
    const sub = normalizeIssue(issue(body().replace('https://acme.io/', 'https://github.com/acme/vector')))
    const get = vi.fn(async (url: string): Promise<Page> => {
      const data = url.includes('/contributors?') ? [{ login: 'maintainer' }]
        : url.endsWith('/readme') ? { encoding: 'base64', content: Buffer.from(`${html} npm install acme. ${'Usage documentation. '.repeat(100)}`).toString('base64') }
          : { archived: false, fork: false, description: 'Vector database REST API', stargazers_count: 5, created_at: '2020-01-01T00:00:00Z' }
      return { url, status: 200, contentType: 'application/json', html: JSON.stringify(data) }
    })
    const r = await assess(sub, catalog, get)
    expect(r.route).toBe('draft-bringup')
    expect(r.proposedProduct?.urls.github).toBe('https://github.com/acme/vector')
    expect(get).toHaveBeenCalledTimes(3)
    expect(get.mock.calls.every(([url]) => url.startsWith('https://api.github.com/repos/acme/vector'))).toBe(true)
  })
  it('routes anomalous young repositories to review', async () => {
    const sub = normalizeIssue(issue(body().replace('https://acme.io/', 'https://github.com/acme/vector')))
    const get = async (url: string): Promise<Page> => ({ url, status: 200, contentType: 'application/json', html: JSON.stringify(
      url.includes('/contributors?') ? [{ login: 'maintainer' }] : url.endsWith('/readme') ? { encoding: 'base64', content: Buffer.from(`${html} ${'Usage install. '.repeat(200)}`).toString('base64') }
        : { archived: false, fork: false, description: 'Vector database API', stargazers_count: 100000, created_at: new Date().toISOString() }) })
    const r = await assess(sub, catalog, get)
    expect(r.route).toBe('needs-human')
    expect(r.disposition?.reason).toContain('star velocity')
  })
  it('does not confuse distinct repositories on a shared code host', async () => {
    const one = normalizeIssue(issue(body().replace('https://acme.io/', 'https://github.com/acme/one')))
    const two = normalizeIssue(issue(body().replace('https://acme.io/', 'https://github.com/acme/two')))
    const bad = async (): Promise<Page> => { throw new Error('offline') }
    const a = await assess(one, catalog, bad); const b = await assess(two, catalog, bad)
    expect(a.identity).not.toBe(b.identity)
    expect(a.branch).not.toBe(b.branch)
  })
  it('does not promote missing docs or waitlists', async () => {
    const r = await assess(normalizeIssue(issue()), catalog, async url => ({ ...await pages(url), html: 'vector search embeddings similarity nearest neighbor ANN HNSW hybrid search index coming soon join the waitlist' }))
    expect(r.route).toBe('needs-human')
    expect(r.disposition?.criterion).toBe('shipped-product')
  })
})

describe('draft publication and retries', () => {
  it('creates one draft and reuses it on retries and duplicate issues', async () => {
    const r = await report(); const { io } = publisher()
    expect((await publish(r, io)).status).toBe('created')
    expect((await publish(r, io)).status).toBe('existing')
    expect((await publish({ ...r, submission: { ...r.submission, issue: 43 } }, io)).status).toBe('existing')
    expect(io.createBranch).toHaveBeenCalledTimes(1)
    expect(io.createPull).toHaveBeenCalledTimes(1)
  })
  it('resumes a pushed branch after a failed PR API call without rewriting evidence', async () => {
    const r = await report(); const { io } = publisher()
    const create = io.createPull
    io.createPull = vi.fn().mockRejectedValueOnce(new Error('PR creation forbidden'))
    await expect(publish(r, io)).rejects.toThrow('forbidden')
    io.createPull = create
    expect((await publish(r, io)).status).toBe('created')
    expect(io.createBranch).toHaveBeenCalledTimes(1)
  })
  it('handles ambiguous PR sends by querying before retrying', async () => {
    const r = await report(); const { io, prs } = publisher()
    io.createPull = vi.fn(async () => { prs.push({ number: 10, html_url: 'https://github.com/ultrametricai/ultrametric/pull/10', state: 'open', draft: true }); throw new Error('response lost') })
    await expect(publish(r, io)).rejects.toThrow('response lost')
    expect((await publish(r, io)).status).toBe('existing')
    expect(io.createPull).toHaveBeenCalledTimes(1)
  })
  it('never reopens a closed/merged PR or overwrites an edited submission', async () => {
    const r = await report(); const { io, prs } = publisher()
    await publish(r, io); prs[0].state = 'closed'
    expect((await publish(r, io)).status).toBe('existing')
    io.currentRevision = vi.fn(async () => 'edited')
    await expect(publish({ ...r, submission: { ...r.submission, revision: 'edited' } }, io)).rejects.toThrow('edited after draft')
    expect(io.createBranch).toHaveBeenCalledTimes(1)
  })
  it('does not interpret failed state reads as a missing branch', async () => {
    const r = await report(); const { io } = publisher()
    io.readBranch = vi.fn(async () => { throw new Error('auth unavailable') })
    await expect(publish(r, io)).rejects.toThrow('auth unavailable')
    expect(io.createBranch).not.toHaveBeenCalled()
  })
  it('blocks issue edit races and nonqualified cases before mutations', async () => {
    const r = await report(); const { io } = publisher()
    io.currentRevision = vi.fn(async () => 'changed')
    await expect(publish(r, io)).rejects.toThrow('changed during intake')
    expect((await publish({ ...r, route: 'needs-human' }, io)).status).toBe('human-review')
    expect(io.createBranch).not.toHaveBeenCalled()
  })
  it('leaves a competing atomic reservation to a retry, with no force update', async () => {
    const r = await report(); const { io } = publisher()
    io.createBranch = vi.fn(async () => { throw new Error('reference already exists') })
    await expect(publish(r, io)).rejects.toThrow('reference already exists')
    expect(io.createPull).not.toHaveBeenCalled()
  })
})
