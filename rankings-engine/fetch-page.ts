import TurndownService from 'turndown'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
turndown.remove(['script', 'style', 'nav', 'footer', 'iframe'])

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html)
}

export async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)' },
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

export interface BinaryResponse {
  buffer: Buffer
  contentType: string | null
}

// Same retry/backoff shape as fetchWithRetry, but for binary payloads (e.g. logo icons)
// where we need raw bytes and the content-type header rather than decoded text.
export async function fetchBinaryWithRetry(url: string, retries = 2): Promise<BinaryResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)' },
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const arrayBuffer = await res.arrayBuffer()
      return { buffer: Buffer.from(arrayBuffer), contentType: res.headers.get('content-type') }
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}
