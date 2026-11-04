import { describe, expect, it, vi } from 'vitest'
const exec = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ execFileSync: exec }))
import { ghApi, githubPublisher } from '../intake/publish'
import { assess, normalizeIssue } from '../intake/submission'

const sha = 'a'.repeat(40)
describe('GitHub intake adapter', () => {
  it('passes JSON through stdin without shell interpolation', () => {
    exec.mockReturnValue('{}')
    ghApi('repos/ultrametricai/ultrametric/pulls', 'POST', { body: '$(touch /tmp/no) `cmd`\ntext' })
    expect(exec).toHaveBeenLastCalledWith('gh', ['api', '--method', 'POST', 'repos/ultrametricai/ultrametric/pulls', '--input', '-'], expect.objectContaining({ input: JSON.stringify({ body: '$(touch /tmp/no) `cmd`\ntext' }) }))
  })
  it('explicitly creates a draft with fixed main base', async () => {
    exec.mockReturnValue(JSON.stringify({ number: 3, html_url: 'https://github.com/ultrametricai/ultrametric/pull/3', state: 'open', draft: true }))
    await githubPublisher(sha).createPull('submission-intake/abc', 'Title', 'Body')
    const sent = JSON.parse(exec.mock.calls.at(-1)![2].input)
    expect(sent).toMatchObject({ draft: true, base: 'main', head: 'submission-intake/abc' })
  })
  it('distinguishes no matching ref from an authentication failure', async () => {
    exec.mockReturnValue('[]')
    expect(await githubPublisher(sha).readBranch('submission-intake/abc')).toBeNull()
    exec.mockImplementation(() => { throw new Error('HTTP 403') })
    await expect(githubPublisher(sha).readBranch('submission-intake/abc')).rejects.toThrow('403')
  })
  it('requires the same trusted main used for assessment before creating commits', async () => {
    const body = '### Product name\n\nAcme\n\n### Category\n\nrealtime-infra\n\n### URLs\n\nhttps://acme.io/\n\n### Why it matters\n\nRealtime.\n\n### Are you affiliated with this product?\n\nNo\n'
    const submission = normalizeIssue({ number: 1, title: 'Submit a product: Acme', body, state: 'open', updated_at: '', labels: [{ name: 'product-request' }] })
    const report = await assess(submission, { categories: [], products: [], roadmap: [{ id: 'realtime-infra', name: 'Realtime', status: 'planned', candidateProducts: ['Acme'] }] })
    exec.mockReset().mockReturnValue(JSON.stringify({ object: { sha: 'b'.repeat(40) } }))
    await expect(githubPublisher(sha).createBranch(report, {})).rejects.toThrow('main advanced')
    expect(exec).toHaveBeenCalledTimes(1)
  })
})
