import assert from 'node:assert/strict'
import { readSharedCatalog, sharedProcessHref } from '../lib/shared-processes/reader'

// Run against the existing local dev server or a packaged-runtime validation lane.
// This script never starts/stops servers or builds the application.
async function main() {
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3232')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use an explicitly local validation server')
const results: Array<Record<string, unknown>> = []
for (const path of ['/processes/preview/form_001', '/processes/preview/incorporate-c-corp', '/processes/incorporate-c-corp/v2', '/processes/incorporate-a-company', '/processes/form_001']) {
  const source = new URL(`${path}?via=legal-ops:clerky&via=payments:stripe&geo=IN&extra=a&extra=b`, base)
  const response = await fetch(source, { redirect: 'manual' })
  assert.equal(response.status, 308)
  const destination = new URL(response.headers.get('location')!, base)
  assert.equal(destination.pathname, '/processes/incorporate-c-corp')
  assert.deepEqual([...destination.searchParams], [...source.searchParams])
  results.push({ path, status: response.status, queryPreserved: true, destination: destination.pathname })
}
const records = readSharedCatalog()
for (const id of ['form_001', 'qs_023', 'sales_002', 'company-launch']) {
  const path = sharedProcessHref(id, records)
  const response = await fetch(new URL(path, base))
  assert.equal(response.status, 200)
  const html = await response.text()
  assert(html.includes(`data-shared-record="${id}"`))
  assert(html.includes('id="steps"'))
  assert(!html.includes('content="noindex, nofollow"'))
  results.push({ path, id, status: response.status, sharedReader: true })
}
const aliasManifest = await fetch(new URL('/processes/incorporate-a-company/manifest.json', base))
assert.equal(aliasManifest.status, 200)
const manifest = await aliasManifest.json()
assert.equal(manifest.process.slug, 'incorporate-c-corp')
assert.equal(manifest.manifestUrl, 'https://ultrametric.ai/processes/incorporate-c-corp/manifest.json')
results.push({ aliasManifest: 'incorporate-a-company', status: 200, canonicalIdentity: true })
console.log(JSON.stringify({ base: base.origin, passed: results.length, results }, null, 2))

}

main().catch(error => { console.error(error); process.exitCode = 1 })
