// Deterministic body digests for responses too large to commit as transcripts (the Stripe
// OpenAPI spec is several MB). Computed at record time from the raw body, stored in the
// transcript, and the ONLY thing grading reads for those checks — so a replay from disk is
// exact without the repo carrying megabyte bodies. The raw body's sha256/byte length are
// recorded alongside (rankings-engine/depth/arenabench.ts, DepthRequestRecord).

import { extractMdLinks } from '../scripts/certify'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export interface OpenapiDigest extends Record<string, unknown> {
  kind: 'openapi'
  parses: boolean
  openapi: string | null
  title: string | null
  pathCount: number
  operationCount: number
  operationsWithResponses: number
  componentSchemaCount: number
  /** Property names of components.schemas.error, when the spec declares one. */
  errorSchemaFields: string[] | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function digestOpenapi(rawBody: string): OpenapiDigest {
  const empty: OpenapiDigest = {
    kind: 'openapi',
    parses: false,
    openapi: null,
    title: null,
    pathCount: 0,
    operationCount: 0,
    operationsWithResponses: 0,
    componentSchemaCount: 0,
    errorSchemaFields: null,
  }
  let spec: unknown
  try {
    spec = JSON.parse(rawBody)
  } catch {
    return empty
  }
  if (!isRecord(spec)) return empty
  const paths = isRecord(spec.paths) ? spec.paths : {}
  let operationCount = 0
  let operationsWithResponses = 0
  for (const item of Object.values(paths)) {
    if (!isRecord(item)) continue
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (!isRecord(op)) continue
      operationCount++
      if (isRecord(op.responses) && Object.keys(op.responses).length > 0) operationsWithResponses++
    }
  }
  const components = isRecord(spec.components) ? spec.components : {}
  const schemas = isRecord(components.schemas) ? components.schemas : {}
  const errorSchema = isRecord(schemas.error) ? schemas.error : null
  const info = isRecord(spec.info) ? spec.info : {}
  return {
    kind: 'openapi',
    parses: true,
    openapi: typeof spec.openapi === 'string' ? spec.openapi : null,
    title: typeof info.title === 'string' ? info.title : null,
    pathCount: Object.keys(paths).length,
    operationCount,
    operationsWithResponses,
    componentSchemaCount: Object.keys(schemas).length,
    errorSchemaFields:
      errorSchema && isRecord(errorSchema.properties) ? Object.keys(errorSchema.properties).sort() : null,
  }
}

export interface LlmsTxtDigest extends Record<string, unknown> {
  kind: 'llms-txt'
  mdLinkCount: number
  headingCount: number
}

export function digestLlmsTxt(rawBody: string, baseUrl: string): LlmsTxtDigest {
  return {
    kind: 'llms-txt',
    mdLinkCount: extractMdLinks(rawBody, baseUrl).length,
    headingCount: rawBody.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l)).length,
  }
}
