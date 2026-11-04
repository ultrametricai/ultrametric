// Public intake uses its own bounded, credential-free transport. Never pass arbitrary
// submission URLs to fetch(): DNS validation and the connection must use the same address.
import dns from 'node:dns/promises'
import https from 'node:https'
import net from 'node:net'
import { createHash } from 'node:crypto'

export const MAX_BYTES = 256 * 1024
export const TIMEOUT_MS = 10_000
export interface Page { url: string; status: number; contentType: string; html: string }
export interface Receipt { url: string; status: number; checkedAt: string; sha256: string; excerpt: string; error?: string }

export function publicIpv4(address: string): boolean {
  if (net.isIP(address) !== 4) return false // IPv6-only hosts require manual review.
  const [a, b, c] = address.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113))
}

export function publicUrl(input: string): URL {
  if (input.length > 2048 || /[\s\\]/.test(input)) throw new Error('invalid public URL')
  const url = new URL(input)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('only credential-free HTTPS on port 443 is supported')
  const host = url.hostname.toLowerCase()
  if (net.isIP(host) || host.includes(':') || !host.includes('.') ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host) || host.endsWith('.localhost')) throw new Error('literal or local hostname is not supported')
  url.hash = ''
  return url
}

type Resolver = (host: string) => Promise<{ address: string; family: number }[]>
type Request = (url: URL, address: string) => Promise<Page & { location?: string }>

export async function resolvePublic(host: string, resolve: Resolver): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const addresses = await Promise.race([
      resolve(host),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), TIMEOUT_MS) }),
    ])
    // Reject mixed public/private answers. IPv6 is intentionally not a fallback.
    if (!addresses.length || addresses.some(a => a.family !== 4 || !publicIpv4(a.address))) throw new Error('DNS did not return exclusively public IPv4 addresses')
    return addresses[0].address
  } finally { clearTimeout(timer) }
}

export const pinnedRequest: Request = (url, address) => new Promise((resolve, reject) => {
  const req = https.request(url, {
    method: 'GET', agent: false, family: 4,
    headers: { 'User-Agent': 'Ultrametric-submission-intake/1.0', Accept: 'text/html, text/plain, application/json', 'Accept-Encoding': 'identity' },
    // TLS SNI/certificate verification still uses url.hostname; only DNS is pinned.
    lookup: (_hostname, _options, callback) => callback(null, address, 4),
  }, res => {
    const chunks: Buffer[] = []
    let bytes = 0
    res.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > MAX_BYTES) { req.destroy(new Error('response exceeds byte limit')); return }
      chunks.push(chunk)
    })
    res.on('error', reject)
    res.on('end', () => resolve({ url: url.href, status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), html: Buffer.concat(chunks).toString('utf8'), location: res.headers.location }))
  })
  const timer = setTimeout(() => req.destroy(new Error('request timeout')), TIMEOUT_MS)
  req.on('close', () => clearTimeout(timer))
  req.on('error', reject)
  req.end()
})

export async function fetchPublic(input: string, resolve: Resolver = host => dns.lookup(host, { all: true, family: 4 }), request: Request = pinnedRequest): Promise<Page> {
  let url = publicUrl(input)
  for (let hop = 0; hop <= 3; hop++) {
    const address = await resolvePublic(url.hostname, resolve)
    const page = await request(url, address)
    if ([301, 302, 303, 307, 308].includes(page.status)) {
      if (!page.location || hop === 3) throw new Error('redirect limit or missing location')
      url = publicUrl(new URL(page.location, url).href)
      continue
    }
    if (page.status === 200 && !/^(?:text\/(?:html|plain|markdown)|application\/(?:json|[^;]+\+json))(?:;|$)/i.test(page.contentType)) throw new Error('unsupported response content type')
    return page
  }
  throw new Error('redirect limit')
}

export function receipt(page: Page): Receipt {
  return { url: page.url, status: page.status, checkedAt: new Date().toISOString(), sha256: createHash('sha256').update(page.html).digest('hex'), excerpt: page.html.slice(0, 2000) }
}
