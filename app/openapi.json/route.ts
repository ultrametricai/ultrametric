import { NextResponse } from 'next/server'
import { loadCategories } from '@/lib/data'
import { REPO, SITE_URL as SITE } from '@/lib/site'

// Static export safety: this route has no dynamic segments and no request-time data
// dependency (categories.json is bundled at build time), so it's safe to force-static —
// Next prerenders it once at build and serves the cached response forever after.
export const dynamic = 'force-static'

// Hand-written JSON Schema summaries mirroring lib/schemas.ts (zod). Kept intentionally
// hand-authored rather than auto-derived so this file stays a stable, readable contract —
// if lib/schemas.ts changes shape, update this block to match (see lib/__tests__ for the
// zod-side source of truth).
const SCHEMAS = {
  Category: {
    type: 'object',
    required: ['id', 'name', 'description', 'personas'],
    properties: {
      id: { type: 'string', description: 'Category slug, e.g. "desktop-os".' },
      name: { type: 'string' },
      description: { type: 'string' },
      personas: { type: 'array', items: { type: 'string' }, minItems: 1 },
      themes: { type: 'array', items: { type: 'string' } },
    },
  },
  ProductLinks: {
    type: 'object',
    properties: {
      app: { type: 'string', format: 'uri' },
      api: { type: 'string', format: 'uri' },
      cli: { type: 'string', format: 'uri' },
      mcp: { type: 'string', format: 'uri' },
    },
  },
  ProductBusinessModel: {
    type: 'object',
    required: ['models', 'summary', 'url'],
    properties: {
      models: { type: 'array', items: { type: 'string' }, minItems: 1 },
      summary: { type: 'string', minLength: 10, maxLength: 240 },
      url: { type: 'string', format: 'uri' },
    },
  },
  Product: {
    type: 'object',
    required: ['id', 'name', 'vendor', 'type', 'urls'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      vendor: { type: 'string' },
      type: { type: 'string', enum: ['oss', 'commercial', 'government'] },
      urls: {
        type: 'object',
        required: ['site'],
        properties: {
          site: { type: 'string', format: 'uri' },
          docs: { type: 'string', format: 'uri' },
          changelog: { type: 'string', format: 'uri' },
          github: { type: 'string', format: 'uri' },
          extra: { type: 'array', items: { type: 'string', format: 'uri' } },
        },
      },
      logo: { type: 'string', description: 'Path under /logos/, e.g. "/logos/macos.png".' },
      links: { $ref: '#/components/schemas/ProductLinks' },
      businessModel: { $ref: '#/components/schemas/ProductBusinessModel' },
    },
  },
  StoryOrigin: {
    type: 'object',
    required: ['kind'],
    description:
      'Provenance of a story in the taxonomy. See /methodology#provenance. Optional — absent on stories migrated before this field existed.',
    properties: {
      kind: { type: 'string', enum: ['normalized', 'canonical', 'contest', 'manual'] },
      promptVersion: { type: 'string', description: 'Set for normalized/contest origins, e.g. "v2".' },
      recordedAt: { type: 'string', description: 'ISO 8601 timestamp the story was recorded/generated.' },
    },
  },
  Story: {
    type: 'object',
    required: ['id', 'persona', 'title', 'theme', 'group', 'weight'],
    properties: {
      id: { type: 'string' },
      persona: { type: 'string' },
      title: { type: 'string', description: 'User-story text, "As a <persona>, I can <capability>".' },
      theme: { type: 'string' },
      group: { type: 'string' },
      weight: { type: 'integer', minimum: 1, maximum: 3 },
      origin: { $ref: '#/components/schemas/StoryOrigin' },
    },
  },
  Evidence: {
    type: 'object',
    required: ['id', 'tier', 'url', 'excerpt', 'fetchedAt'],
    properties: {
      id: { type: 'string' },
      tier: { type: 'string', enum: ['claimed-docs', 'github', 'community', 'probe'] },
      url: { type: 'string', format: 'uri' },
      excerpt: { type: 'string' },
      fetchedAt: { type: 'string', format: 'date-time' },
    },
  },
  Verdict: {
    type: 'object',
    required: ['productId', 'storyId', 'verdict', 'quality', 'confidence', 'rationale', 'evidenceIds'],
    properties: {
      productId: { type: 'string' },
      storyId: { type: 'string' },
      verdict: { type: 'string', enum: ['full', 'partial', 'none', 'disputed', 'na'] },
      quality: { type: 'number', minimum: 0, maximum: 10 },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      rationale: { type: 'string' },
      evidenceIds: { type: 'array', items: { type: 'string' } },
    },
  },
  LeaderboardEntry: {
    type: 'object',
    required: ['productId', 'score', 'agentReady', 'agenticApp', 'apiQuality', 'aiEra', 'applicable', 'total', 'themeScores'],
    properties: {
      productId: { type: 'string' },
      score: { type: 'number', minimum: 0, maximum: 100, description: 'Coverage score across applicable (non-na) cells.' },
      agentReady: { type: 'number', minimum: 0, maximum: 100, nullable: true },
      agenticApp: { type: 'number', minimum: 0, maximum: 100, nullable: true },
      apiQuality: { type: 'number', minimum: 0, maximum: 100, nullable: true },
      aiEra: { type: 'number', minimum: 0, maximum: 100, nullable: true, description: 'Overall score (formerly Arena Score / INIT Score / AI-Era Index) — see /methodology.' },
      applicable: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
      themeScores: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 100, nullable: true } },
    },
  },
  BattleRound: {
    type: 'object',
    required: ['storyId', 'winner', 'margin'],
    properties: {
      storyId: { type: 'string' },
      winner: { type: 'string', enum: ['a', 'b', 'draw', 'na'] },
      margin: { type: 'number', minimum: 0 },
    },
  },
  Battle: {
    type: 'object',
    required: ['a', 'b', 'winner', 'record', 'rounds'],
    properties: {
      a: { type: 'string' },
      b: { type: 'string' },
      winner: { type: 'string', description: 'productId of the winner, or "draw".' },
      record: {
        type: 'object',
        required: ['aWins', 'bWins', 'draws'],
        properties: {
          aWins: { type: 'integer', minimum: 0 },
          bWins: { type: 'integer', minimum: 0 },
          draws: { type: 'integer', minimum: 0 },
        },
      },
      rounds: { type: 'array', items: { $ref: '#/components/schemas/BattleRound' } },
    },
  },
  Rankings: {
    type: 'object',
    required: ['generatedAt', 'leaderboard', 'battles'],
    properties: {
      generatedAt: { type: 'string', format: 'date-time' },
      leaderboard: { type: 'array', items: { $ref: '#/components/schemas/LeaderboardEntry' } },
      battles: { type: 'array', items: { $ref: '#/components/schemas/Battle' } },
      _provenance: {
        type: 'object',
        description:
          'Ownership watermark: an HMAC fingerprint over the rankings content identifying this as Ultrametric-published data (see DATA-LICENSE and /terms).',
        required: ['owner', 'license', 'source', 'arena', 'fingerprint'],
        properties: {
          owner: { type: 'string' },
          license: { type: 'string' },
          source: { type: 'string' },
          arena: { type: 'string' },
          fingerprint: { type: 'string' },
        },
      },
    },
  },
} as const

export async function GET() {
  const categoryIds = loadCategories().map((c) => c.id)

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Ultrametric Data API',
      version: '1.0.0',
      description:
        'Read-only, statically-served JSON data behind ultrametric.ai — the same files the site itself renders from. ' +
        'No auth, no rate limit beyond normal CDN caching. See /llms.txt for a full agent-facing index and /methodology for ' +
        'how the underlying scores and verdicts are produced.',
      contact: { url: `${SITE}/llms.txt` },
      license: { name: '© Ultrametric Inc — see DATA-LICENSE', url: `https://github.com/${REPO}/blob/main/DATA-LICENSE` },
    },
    servers: [{ url: SITE }],
    paths: {
      '/data/categories.json': {
        get: {
          operationId: 'listCategories',
          summary: 'List every ranking/category.',
          responses: {
            '200': {
              description: 'Array of categories.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Category' } } } },
            },
          },
        },
      },
      '/data/{category}/products.json': {
        get: {
          operationId: 'getProducts',
          summary: 'List every product judged in one category.',
          parameters: [categoryParam(categoryIds)],
          responses: {
            '200': {
              description: 'Array of products.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } },
            },
          },
        },
      },
      '/data/{category}/stories.json': {
        get: {
          operationId: 'getStories',
          summary: "Get the category's user-story taxonomy (30-80 stories, including the 29 canonical agenticness/openness/automation-depth/privacy-posture stories injected into every category).",
          parameters: [categoryParam(categoryIds)],
          responses: {
            '200': {
              description: 'Array of stories.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Story' } } } },
            },
          },
        },
      },
      '/data/{category}/verdicts.json': {
        get: {
          operationId: 'getVerdicts',
          summary: 'Get every (product, story) judged verdict for one category — the full agent-tested matrix.',
          parameters: [categoryParam(categoryIds)],
          responses: {
            '200': {
              description: 'Array of verdicts, one per (productId, storyId) cell.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Verdict' } } } },
            },
          },
        },
      },
      '/data/{category}/rankings.json': {
        get: {
          operationId: 'getRankings',
          summary: 'Get derived leaderboard + head-to-head battle results for one category.',
          parameters: [categoryParam(categoryIds)],
          responses: {
            '200': {
              description: 'Rankings object (leaderboard + battles).',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Rankings' } } },
            },
          },
        },
      },
      '/data/{category}/evidence/{product}.json': {
        get: {
          operationId: 'getEvidence',
          summary: "Get one product's raw evidence pack (the material every verdict for that product cites).",
          parameters: [
            categoryParam(categoryIds),
            {
              name: 'product',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Product id, e.g. "macos" (see products.json for a category\'s ids).',
            },
          ],
          responses: {
            '200': {
              description: 'Array of evidence items for that product.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Evidence' } } } },
            },
          },
        },
      },
    },
    components: { schemas: SCHEMAS },
  }

  return NextResponse.json(spec)
}

function categoryParam(categoryIds: string[]) {
  return {
    name: 'category',
    in: 'path',
    required: true,
    schema: { type: 'string', enum: categoryIds },
    description: 'Category slug from /data/categories.json, e.g. "desktop-os".',
  }
}
