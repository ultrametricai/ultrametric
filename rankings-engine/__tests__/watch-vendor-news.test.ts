import { describe, expect, it } from 'vitest'
import {
  candidateSourcesFor,
  decodeEntities,
  discoverFeedUrl,
  extractAnchorPosts,
  isAgenticTitle,
  parseFeedItems,
  sectionRootOf,
} from '../scripts/watch-vendor-news'

// Pure-parsing units for the vendor-news watcher: RSS + Atom + scrape fixtures and the
// founder's agentic keyword flagging. No network — checkSource/run are exercised only through
// their pure pieces here (the seeded open-rankings/vendor-news.json is the integration evidence).

describe('isAgenticTitle', () => {
  it('flags the founder keywords: mcp | agent | ai | llm | assistant | copilot | api v | sdk', () => {
    expect(isAgenticTitle('Introducing our MCP server')).toBe(true)
    expect(isAgenticTitle('Agents can now file expenses')).toBe(true)
    expect(isAgenticTitle('Agentic workflows in the dashboard')).toBe(true)
    expect(isAgenticTitle('New AI features for teams')).toBe(true)
    expect(isAgenticTitle('Building with AI')).toBe(true) // trailing 'ai' still matches 'ai '
    expect(isAgenticTitle('LLM-powered search')).toBe(true)
    expect(isAgenticTitle('Meet your new assistant')).toBe(true)
    expect(isAgenticTitle('Copilot for spreadsheets')).toBe(true)
    expect(isAgenticTitle('Announcing API v2')).toBe(true)
    expect(isAgenticTitle('The TypeScript SDK is here')).toBe(true)
  })

  it("stays quiet on titles where 'ai' is just letters inside a word", () => {
    expect(isAgenticTitle('Air quality dashboard launch')).toBe(false)
    expect(isAgenticTitle('Details about our new pricing')).toBe(false)
    expect(isAgenticTitle('Maintenance window this Sunday')).toBe(false)
    expect(isAgenticTitle('Yearly retained revenue report')).toBe(false)
  })
})

describe('sectionRootOf', () => {
  it('truncates a deep post URL to its news-section root', () => {
    expect(sectionRootOf('https://relayfi.com/blog/profit-first-method/')).toBe('https://relayfi.com/blog')
    expect(sectionRootOf('https://docs.mercury.com/changelog/cards-api-now-available.md')).toBe(
      'https://docs.mercury.com/changelog',
    )
    expect(sectionRootOf('https://a.com/x/news/2026/post')).toBe('https://a.com/x/news')
  })

  it('returns null for URLs without a news-ish segment, or unparseable ones', () => {
    expect(sectionRootOf('https://example.com/docs/api')).toBe(null)
    expect(sectionRootOf('not a url')).toBe(null)
  })
})

describe('candidateSourcesFor', () => {
  it('prefers explicit corpus URLs (deduped section roots, cap 2), changelog field first', () => {
    const sources = candidateSourcesFor({
      urls: {
        site: 'https://vendor.com',
        changelog: 'https://vendor.com/changelog',
        extra: ['https://vendor.com/blog/some-post', 'https://vendor.com/blog/other-post', 'https://vendor.com/news/x'],
      },
    })
    expect(sources).toEqual([
      { url: 'https://vendor.com/changelog', derived: false },
      { url: 'https://vendor.com/blog', derived: false },
    ])
  })

  it('falls back to derived /blog and /changelog guesses off the site origin', () => {
    expect(candidateSourcesFor({ urls: { site: 'https://vendor.com/product/page' } })).toEqual([
      { url: 'https://vendor.com/blog', derived: true },
      { url: 'https://vendor.com/changelog', derived: true },
    ])
  })
})

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Vendor Blog</title>
  <item>
    <title><![CDATA[Ship faster with our new MCP server]]></title>
    <link>https://vendor.com/blog/mcp-server</link>
    <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Pricing update &amp; annual plans</title>
    <link>https://vendor.com/blog/pricing</link>
    <pubDate>Mon, 01 Sep 2026 08:30:00 GMT</pubDate>
  </item>
</channel></rss>`

const ATOM_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Vendor Changelog</title>
  <entry>
    <title>Agent mode ships to everyone</title>
    <link rel="alternate" href="https://vendor.com/changelog/agent-mode"/>
    <updated>2026-09-20T12:00:00Z</updated>
  </entry>
</feed>`

describe('parseFeedItems', () => {
  it('parses RSS items: CDATA titles, links, pubDate → ISO date', () => {
    const parsed = parseFeedItems(RSS_FIXTURE)
    expect(parsed?.kind).toBe('rss')
    expect(parsed?.items).toEqual([
      { title: 'Ship faster with our new MCP server', url: 'https://vendor.com/blog/mcp-server', date: '2026-09-15' },
      { title: 'Pricing update & annual plans', url: 'https://vendor.com/blog/pricing', date: '2026-09-01' },
    ])
  })

  it('parses Atom entries: link href attribute, updated → ISO date', () => {
    const parsed = parseFeedItems(ATOM_FIXTURE)
    expect(parsed?.kind).toBe('atom')
    expect(parsed?.items).toEqual([
      { title: 'Agent mode ships to everyone', url: 'https://vendor.com/changelog/agent-mode', date: '2026-09-20' },
    ])
  })

  it('returns null for non-feed payloads (an HTML 404 on a guessed feed path yields no junk)', () => {
    expect(parseFeedItems('<html><body><h1>Not found</h1></body></html>')).toBe(null)
    expect(parseFeedItems('')).toBe(null)
  })
})

const SCRAPE_FIXTURE = `<html><head>
  <link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">
</head><body>
  <a href="/blog">Blog home</a>
  <a href="/blog/tag/ai/">AI tag</a>
  <a href="/blog/launching-our-agent-sdk">Launching our Agent SDK for developers</a>
  <a href="/blog/short">ok</a>
  <a href="https://other.com/blog/external-post">An external cross-post about something</a>
  <a href="/blog/quarterly-recap"><time datetime="2026-09-10T00:00:00Z">Sep 10</time> Quarterly recap: what we shipped</a>
  <a href="/blog/launching-our-agent-sdk">Launching our Agent SDK for developers</a>
</body></html>`

describe('extractAnchorPosts', () => {
  it('keeps same-origin post links deeper than the root, drops nav/tag/short/external, dedupes', () => {
    const items = extractAnchorPosts(SCRAPE_FIXTURE, 'https://vendor.com/blog')
    expect(items).toEqual([
      { title: 'Launching our Agent SDK for developers', url: 'https://vendor.com/blog/launching-our-agent-sdk', date: null },
      { title: 'Sep 10 Quarterly recap: what we shipped', url: 'https://vendor.com/blog/quarterly-recap', date: '2026-09-10' },
    ])
  })
})

describe('discoverFeedUrl', () => {
  it('resolves the page-declared rel=alternate feed against the base URL', () => {
    expect(discoverFeedUrl(SCRAPE_FIXTURE, 'https://vendor.com/blog')).toBe('https://vendor.com/blog/rss.xml')
  })

  it('returns null when no feed link is declared', () => {
    expect(discoverFeedUrl('<html><head></head></html>', 'https://vendor.com/blog')).toBe(null)
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Q&amp;A &#8212; what&#x27;s new')).toBe("Q&A — what's new")
  })
})
